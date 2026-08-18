import { Router } from 'express';
import algosdk from 'algosdk';
import { env } from '../config/env.js';
import { isMongoConfigured } from '../db/mongo.js';
import { getIdentityByWallet } from '../services/identityService.js';
import {
  getAccountAssets,
  getAccountBalance,
  getNetworkInfo,
  getSignerAddress,
  sendAlgoPayment
} from '../services/algorandService.js';

export const algorandRouter = Router();

function decimalPlaces(value: number): number {
  const split = value.toString().split('.');
  return split[1]?.length ?? 0;
}

algorandRouter.get('/network', (_request, response) => {
  response.json({
    ...getNetworkInfo(),
    signerAddress: getSignerAddress()
  });
});

/**
 * @openapi
 * /api/algorand/signer:
 *   get:
 *     summary: Retrieve the backend signer account address
 *     tags: [Algorand]
 *     responses:
 *       200:
 *         description: Signer address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signerAddress:
 *                   type: string
 */
algorandRouter.get('/signer', (_request, response) => {
  response.json({ signerAddress: getSignerAddress() });
});

/**
 * @openapi
 * /api/algorand/balance/{address}:
 *   get:
 *     summary: Retrieve the ALGO balance of a wallet address
 *     tags: [Algorand]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The Algorand address to query
 *         example: "VMOY...ALGO...ADDR"
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balanceAlgo:
 *                   type: number
 *       400:
 *         description: Invalid Algorand address
 *       500:
 *         description: Internal server error loading balance
 */
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

/**
 * @openapi
 * /api/algorand/assets/{address}:
 *   get:
 *     summary: Retrieve assets held by an Algorand address
 *     tags: [Algorand]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The Algorand address to query assets for
 *         example: "VMOY...ALGO...ADDR"
 *     responses:
 *       200:
 *         description: List of assets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assets:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid Algorand address
 *       500:
 *         description: Internal server error loading assets
 */
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

    if (env.requireIdentityForSend) {
      if (!isMongoConfigured()) {
        response.status(503).json({
          error: 'Mobile identity verification is unavailable. Configure MongoDB to enable linked-mobile transfers, or set REQUIRE_IDENTITY_FOR_SEND=false in .env for development.'
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
