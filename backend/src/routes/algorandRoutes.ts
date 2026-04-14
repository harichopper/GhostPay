import { Router } from 'express';
import algosdk from 'algosdk';
import { env } from '../config/env.js';
import { isMongoConfigured } from '../db/mongo.js';
import { getIdentityByWallet } from '../services/identityService.js';
import {
  ensureAccountHasMintFunds,
  getAccountAssets,
  getAccountBalance,
  getNetworkInfo,
  getSignerAddress,
  mintDemoAsset,
  relaySignedTransaction,
  sendAlgoPayment
} from '../services/algorandService.js';

export const algorandRouter = Router();

function decimalPlaces(value: number): number {
  const split = value.toString().split('.');
  return split[1]?.length ?? 0;
}

function mintStatusCode(message: string): number {
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid')
    || lower.includes('insufficient')
    || lower.includes('overspend')
    || lower.includes('missing')
    || lower.includes('required')
    || lower.includes('restricted')
  ) {
    return 400;
  }

  return 500;
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
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load balance'
    });
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
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load account assets'
    });
  }
});

algorandRouter.post('/mint', async (request, response) => {
  try {
    const { assetName, unitName, total, decimals, assetUrl, senderAddress, signedTxnBase64 } = request.body as {
      assetName?: string;
      unitName?: string;
      total?: number;
      decimals?: number;
      assetUrl?: string;
      senderAddress?: string;
      signedTxnBase64?: string;
    };

    if (signedTxnBase64) {
      if (!senderAddress || !algosdk.isValidAddress(senderAddress)) {
        response.status(400).json({ error: 'Valid senderAddress is required when signedTxnBase64 is provided' });
        return;
      }

      await ensureAccountHasMintFunds(senderAddress);

      const relayed = await relaySignedTransaction({
        signedTxnBase64,
        expectedSender: senderAddress,
        expectedType: algosdk.TransactionType.acfg
      });

      response.json({
        txId: relayed.txId,
        assetId: relayed.assetId,
        creator: senderAddress,
        explorerUrl: relayed.explorerUrl,
        network: relayed.network
      });
      return;
    }

    const minted = await mintDemoAsset({
      assetName,
      unitName,
      total,
      decimals,
      assetUrl
    });

    response.json(minted);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to mint asset token';
    response.status(mintStatusCode(message)).json({
      error: message
    });
  }
});

algorandRouter.post('/send', async (request, response) => {
  try {
    const { sender, receiver, amount, timestamp, signedTxnBase64, demoMode } = request.body as {
      sender?: string;
      receiver?: string;
      amount?: number;
      timestamp?: string;
      signedTxnBase64?: string;
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

    if (!algosdk.isValidAddress(sender) || !algosdk.isValidAddress(receiver)) {
      response.status(400).json({ error: 'Invalid Algorand sender or receiver address' });
      return;
    }

    if (!isMongoConfigured()) {
      response.status(503).json({
        error: 'Mobile identity verification is unavailable. Configure MongoDB to enable linked-mobile transfers.'
      });
      return;
    }

    const [senderIdentity, receiverIdentity] = await Promise.all([
      getIdentityByWallet(sender),
      getIdentityByWallet(receiver)
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

    const tx = await sendAlgoPayment({
      sender,
      receiver,
      amount,
      timestamp,
      signedTxnBase64,
      demoMode
    });

    response.json(tx);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to send transaction'
    });
  }
});
