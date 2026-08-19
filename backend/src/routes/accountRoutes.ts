/**
 * accountRoutes.ts
 *
 * x402 account-mapping API — the authoritative backend source of truth for:
 *   Phone ↔ Account ↔ WalletId ↔ Algorand Wallet Address
 *
 * Routes:
 *   POST   /api/accounts                       Create account mapping
 *   GET    /api/accounts/phone/:phone           Resolve account by phone number
 *   GET    /api/accounts/wallet/:walletId       Resolve account by walletId
 *
 * All routes are protected by API key authentication (requireApiKey middleware).
 * Set ACCOUNTS_API_KEY in backend/.env to enable auth. Omit for dev/open mode.
 */

import { Router, type Request, type Response } from 'express';
import { isMongoConfigured } from '../db/mongo.js';
import { requireApiKey } from '../middleware/requireApiKey.js';
import {
  createAccount,
  getAccountByPhone,
  getAccountByWalletId
} from '../services/accountService.js';
import { normalizeMobileNumber } from '../services/identityService.js';

export const accountRouter = Router();

// Apply API key auth to all account routes
accountRouter.use(requireApiKey);

// Require MongoDB on all account routes
accountRouter.use((_request, response, next) => {
  if (!isMongoConfigured()) {
    response.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'MongoDB is not configured. Set MONGODB_URI to enable account mapping features.'
    });
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// POST /api/accounts — Create a new account mapping
// ---------------------------------------------------------------------------
accountRouter.post('/', async (request: Request, response: Response): Promise<void> => {
  try {
    const account = await createAccount(request.body);

    response.status(201).json({
      success: true,
      account
    });
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      response.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
      return;
    }

    const code = (error as Error & { code?: string }).code;

    switch (code) {
      case 'VALIDATION_ERROR': {
        const field = (error as Error & { field?: string }).field;
        response.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          field,
          message: error.message
        });
        return;
      }
      case 'ACCOUNT_EXISTS':
        response.status(409).json({
          success: false,
          code: 'ACCOUNT_EXISTS',
          message: error.message
        });
        return;
      case 'WALLET_ID_EXISTS':
        response.status(409).json({
          success: false,
          code: 'WALLET_ID_EXISTS',
          message: error.message
        });
        return;
      case 'WALLET_ADDRESS_EXISTS':
        response.status(409).json({
          success: false,
          code: 'WALLET_ADDRESS_EXISTS',
          message: error.message
        });
        return;
      default:
        response.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.'
        });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/accounts/phone/:phone — Resolve account by phone number
// ---------------------------------------------------------------------------
accountRouter.get('/phone/:phone', async (request: Request, response: Response): Promise<void> => {
  try {
    const rawPhone = request.params.phone;

    if (!rawPhone) {
      response.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'phone path parameter is required.' });
      return;
    }

    // Validate and normalize phone before querying
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeMobileNumber(rawPhone);
    } catch {
      response.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'phone format is invalid.' });
      return;
    }

    const account = await getAccountByPhone(normalizedPhone);

    if (!account) {
      response.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No account was found for this phone number.'
      });
      return;
    }

    response.json({ success: true, account });
  } catch (error: unknown) {
    response.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred.'
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/accounts/wallet/:walletId — Resolve account by walletId
// ---------------------------------------------------------------------------
accountRouter.get('/wallet/:walletId', async (request: Request, response: Response): Promise<void> => {
  try {
    const walletId = request.params.walletId?.trim();

    if (!walletId) {
      response.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'walletId path parameter is required.' });
      return;
    }

    const account = await getAccountByWalletId(walletId);

    if (!account) {
      response.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No account was found for this walletId.'
      });
      return;
    }

    response.json({ success: true, account });
  } catch (error: unknown) {
    response.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred.'
    });
  }
});
