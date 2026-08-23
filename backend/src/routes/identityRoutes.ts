import { Router } from 'express';
import { connectMongo, isMongoConfigured } from '../db/mongo.js';
import {
  getIdentityByWallet,
  getWalletsByMobile,
  requestMobileVerification,
  verifyMobileAndLinkWallet
} from '../services/identityService.js';

export const identityRouter = Router();

identityRouter.use(async (_request, response, next) => {
  await connectMongo().catch(() => {});
  if (!isMongoConfigured()) {
    response.status(503).json({ error: 'MongoDB is not configured. Set MONGODB_URI to enable identity features.' });
    return;
  }

  next();
});

/**
 * @openapi
 * /api/identity/request-verification:
 *   post:
 *     summary: Request verification for a mobile number
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 description: The mobile number to verify
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 otpCode:
 *                   type: string
 *                   description: The OTP code (available in non-production environments when enabled)
 *       400:
 *         description: Invalid request parameter or error during request
 */
identityRouter.post('/request-verification', async (request, response) => {
  try {
    const { mobileNumber } = request.body as { mobileNumber?: string };

    if (!mobileNumber) {
      response.status(400).json({ error: 'mobileNumber is required' });
      return;
    }

    const result = await requestMobileVerification(mobileNumber);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to request verification' });
  }
});

/**
 * @openapi
 * /api/identity/send-sms-otp:
 *   post:
 *     summary: Send SMS OTP to a mobile number
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 description: The mobile number to send SMS OTP
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP SMS dispatched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameter or error during sending
 */
identityRouter.post('/send-sms-otp', async (request, response) => {
  try {
    const { mobileNumber } = request.body as { mobileNumber?: string };

    if (!mobileNumber) {
      response.status(400).json({ error: 'mobileNumber is required' });
      return;
    }

    const result = await requestMobileVerification(mobileNumber);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to send OTP SMS' });
  }
});

/**
 * @openapi
 * /api/identity/verify-mobile:
 *   post:
 *     summary: Verify mobile number with OTP and link the wallet
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobileNumber
 *               - otpCode
 *               - walletAddress
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 description: The mobile number that was verified
 *                 example: "+1234567890"
 *               otpCode:
 *                 type: string
 *                 description: The OTP code received
 *                 example: "123456"
 *               walletAddress:
 *                 type: string
 *                 description: The Algorand wallet address to link
 *                 example: "VMOY...ALGO...ADDR"
 *               walletLabel:
 *                 type: string
 *                 description: A friendly label for the wallet
 *                 example: "My Main Wallet"
 *     responses:
 *       200:
 *         description: Mobile verified and wallet linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid OTP, expired OTP, or validation error
 */
identityRouter.post('/verify-mobile', async (request, response) => {
  try {
    const { mobileNumber, otpCode, walletAddress, walletLabel } = request.body as {
      mobileNumber?: string;
      otpCode?: string;
      walletAddress?: string;
      walletLabel?: string;
    };

    if (!mobileNumber || !otpCode || !walletAddress) {
      response.status(400).json({ error: 'mobileNumber, otpCode, walletAddress are required' });
      return;
    }

    const result = await verifyMobileAndLinkWallet({
      mobileNumberRaw: mobileNumber,
      otpCode,
      walletAddress,
      walletLabel
    });

    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to verify mobile' });
  }
});

/**
 * @openapi
 * /api/identity/mobile/{mobileNumber}/wallets:
 *   get:
 *     summary: Resolve wallets associated with a mobile number
 *     tags: [Identity]
 *     parameters:
 *       - in: path
 *         name: mobileNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: The mobile number to query
 *         example: "+1234567890"
 *     responses:
 *       200:
 *         description: Wallets resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       label:
 *                         type: string
 *                       primary:
 *                         type: boolean
 *       400:
 *         description: Unable to resolve wallets
 */
identityRouter.get('/mobile/:mobileNumber/wallets', async (request, response) => {
  try {
    const result = await getWalletsByMobile(request.params.mobileNumber);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to resolve wallets' });
  }
});

/**
 * @openapi
 * /api/identity/wallet/{walletAddress}:
 *   get:
 *     summary: Look up identity details for a given wallet address
 *     tags: [Identity]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: The Algorand wallet address to check
 *         example: "VMOY...ALGO...ADDR"
 *     responses:
 *       200:
 *         description: Identity retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 identity:
 *                   type: object
 *                   properties:
 *                     mobileNumber:
 *                       type: string
 *                     verified:
 *                       type: boolean
 *                     primaryWallet:
 *                       type: string
 *       400:
 *         description: Unable to look up wallet identity
 */
identityRouter.get('/wallet/:walletAddress', async (request, response) => {
  try {
    const result = await getIdentityByWallet(request.params.walletAddress);
    response.json({ identity: result });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to lookup wallet identity' });
  }
});
