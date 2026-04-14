import { Router } from 'express';
import { isMongoConfigured } from '../db/mongo.js';
import {
  getIdentityByWallet,
  getWalletsByMobile,
  requestMobileVerification,
  verifyMobileAndLinkWallet
} from '../services/identityService.js';

export const identityRouter = Router();

identityRouter.use((_request, response, next) => {
  if (!isMongoConfigured()) {
    response.status(503).json({ error: 'MongoDB is not configured. Set MONGODB_URI to enable identity features.' });
    return;
  }

  next();
});

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

identityRouter.get('/mobile/:mobileNumber/wallets', async (request, response) => {
  try {
    const result = await getWalletsByMobile(request.params.mobileNumber);
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to resolve wallets' });
  }
});

identityRouter.get('/wallet/:walletAddress', async (request, response) => {
  try {
    const result = await getIdentityByWallet(request.params.walletAddress);
    response.json({ identity: result });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to lookup wallet identity' });
  }
});
