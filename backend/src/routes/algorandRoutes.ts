import { Router } from 'express';
import algosdk from 'algosdk';
import { env } from '../config/env.js';
import { isMongoConfigured } from '../db/mongo.js';
import { getIdentityByWallet, getWalletsByMobile } from '../services/identityService.js';
import {
  getAccountAssets,
  getAccountBalance,
  getAccountTransactions,
  getNetworkInfo,
  getPaymentParams,
  getSignerAddress,
  sendAlgoPayment
} from '../services/algorandService.js';

export const algorandRouter = Router();

function decimalPlaces(value: number): number {
  const split = value.toString().split('.');
  return split[1]?.length ?? 0;
}

/**
 * Map a service-layer error code to an appropriate HTTP status.
 * 4xx for client / transaction errors; 5xx for infrastructure.
 */
function txnErrorToStatus(code: string | undefined): number {
  switch (code) {
    case 'TXN_INVALID':
    case 'TXN_WRONG_TYPE':
    case 'TXN_WRONG_SENDER':
    case 'TXN_WRONG_RECEIVER':
    case 'TXN_WRONG_AMOUNT':
    case 'TXN_WRONG_NOTE':
    case 'TXN_WRONG_APP_ID':
    case 'TXN_WRONG_APP_ARGS':
    case 'TXN_GROUP_INVALID':
      return 422;
    case 'TXN_WRONG_NETWORK':
    case 'TXN_EXPIRED':
    case 'CONTRACT_REQUIRED':
    case 'CONTRACT_NOT_CONFIGURED':
    case 'INSUFFICIENT_FUNDS':
    case 'SIGNER_NOT_CONFIGURED':
      return 400;
    case 'DEMO_DISABLED':
      return 403;
    default:
      return 500;
  }
}

algorandRouter.get('/network', (_request, response) => {
  response.json({
    ...getNetworkInfo(),
    signerAddress: getSignerAddress()
  });
});

algorandRouter.get('/signer', (_request, response) => {
  response.json({ signerAddress: getSignerAddress() });
});

algorandRouter.get('/balance/:address', async (request, response) => {
  try {
    const { address } = request.params;
    if (!algosdk.isValidAddress(address)) {
      response.status(400).json({ error: 'Invalid Algorand address' });
      return;
    }
    const balanceAlgo = await getAccountBalance(address);
    response.json({ balanceAlgo });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load balance' });
  }
});

algorandRouter.get('/assets/:address', async (request, response) => {
  try {
    const { address } = request.params;
    if (!algosdk.isValidAddress(address)) {
      response.status(400).json({ error: 'Invalid Algorand address' });
      return;
    }
    const assets = await getAccountAssets(address);
    response.json({ assets });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load account assets' });
  }
});

algorandRouter.get('/transactions/:address', async (request, response) => {
  try {
    const { address } = request.params;
    if (!algosdk.isValidAddress(address)) {
      response.status(400).json({ error: 'Invalid Algorand address' });
      return;
    }
    const transactions = await getAccountTransactions(address);
    response.json({ transactions });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load transactions' });
  }
});

/**
 * GET /api/algorand/params
 *
 * Returns the minimum Algorand transaction parameters needed for offline
 * transaction construction on the client.
 *
 * Validity window: params are valid for (lastValidRound - firstValidRound) rounds.
 * On testnet each round is ~3.9 s → default ~65 minutes.
 * Clients MUST re-fetch before the window expires.
 *
 * The genesisHashB64 field is the base64-encoded genesis hash — pass it to
 * Buffer.from(genesisHashB64, 'base64') to reconstruct the Uint8Array that
 * algosdk requires when building transactions offline.
 */
algorandRouter.get('/params', async (_request, response) => {
  try {
    const params = await getPaymentParams();
    response.json(params);
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : 'Unable to fetch transaction parameters from Algorand node'
    });
  }
});

algorandRouter.post('/send', async (request, response) => {
  try {
    const {
      sender,
      receiver,
      amount,
      timestamp,
      signedTxnBase64,
      signedGroupTxnsBase64,
      demoMode
    } = request.body as {
      sender?: string;
      receiver?: string;
      amount?: number;
      timestamp?: string;
      signedTxnBase64?: string;
      signedGroupTxnsBase64?: string[];
      demoMode?: boolean;
    };

    if (!sender || !receiver || !amount || !timestamp) {
      response.status(400).json({ error: 'sender, receiver, amount and timestamp are required' });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    if (decimalPlaces(amount) > 6) {
      response.status(400).json({ error: 'Amount can have at most 6 decimal places' });
      return;
    }

    if (amount > env.maxAlgoPerTx) {
      response.status(400).json({ error: `Amount exceeds configured MAX_ALGO_PER_TX (${env.maxAlgoPerTx})` });
      return;
    }

    if (Number.isNaN(Date.parse(timestamp))) {
      response.status(400).json({ error: 'Invalid timestamp format' });
      return;
    }

    // Phone-number receiver resolution
    let targetReceiver = receiver.trim();
    if (!algosdk.isValidAddress(targetReceiver) && targetReceiver.replace(/\D/g, '').length >= 8) {
      try {
        const lookup = await getWalletsByMobile(targetReceiver);
        if (lookup && lookup.wallets && lookup.wallets.length > 0) {
          const primary = lookup.wallets.find((w) => w.isDefault) || lookup.wallets[0];
          targetReceiver = primary.address;
        }
      } catch {
        // Fallback to original receiver
      }
    }

    if (!algosdk.isValidAddress(sender) || !algosdk.isValidAddress(targetReceiver)) {
      response.status(400).json({ error: 'Invalid Algorand sender or receiver address' });
      return;
    }

    // Identity gate
    if (env.requireIdentityForSend) {
      if (!isMongoConfigured()) {
        response.status(503).json({
          error: 'Mobile identity verification is unavailable. Configure MongoDB to enable linked-mobile transfers, or set REQUIRE_IDENTITY_FOR_SEND=false in .env for development.'
        });
        return;
      }

      const [senderIdentity, receiverIdentity] = await Promise.all([
        getIdentityByWallet(sender),
        getIdentityByWallet(targetReceiver)
      ]);

      if (!senderIdentity || !senderIdentity.verified) {
        response.status(403).json({
          error: 'Sender wallet is not linked to a verified mobile number. Link mobile identity before sending.'
        });
        return;
      }

      if (!receiverIdentity || !receiverIdentity.verified) {
        response.status(403).json({
          error: 'Receiver wallet is not linked to a verified mobile number. Send only to linked mobile identities.'
        });
        return;
      }
    }

    const tx = await sendAlgoPayment({
      sender,
      receiver: targetReceiver,
      amount,
      timestamp,
      signedTxnBase64,
      signedGroupTxnsBase64,
      demoMode
    });

    response.json(tx);
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    const status = txnErrorToStatus(code);
    response.status(status).json({
      error: error instanceof Error ? error.message : 'Unable to send transaction',
      ...(code ? { code } : {})
    });
  }
});
