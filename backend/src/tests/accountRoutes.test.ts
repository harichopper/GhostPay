/**
 * accountRoutes.test.ts
 *
 * HTTP route tests for /api/accounts.
 * The accountService is mocked — no MongoDB required.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock env
// ---------------------------------------------------------------------------
vi.mock('../config/env.js', () => ({
  env: {
    algorandNetwork: 'testnet',
    accountsApiKey: '' // no auth in tests by default
  }
}));

// ---------------------------------------------------------------------------
// Mock database check — pretend Mongo is configured
// ---------------------------------------------------------------------------
vi.mock('../db/mongo.js', () => ({
  isMongoConfigured: () => true,
  connectMongo: () => Promise.resolve()
}));

// ---------------------------------------------------------------------------
// Mock accountService
// ---------------------------------------------------------------------------
const mockCreateAccount = vi.fn();
const mockGetAccountByPhone = vi.fn();
const mockGetAccountByWalletId = vi.fn();

vi.mock('../services/accountService.js', () => ({
  createAccount: (...args: unknown[]) => mockCreateAccount(...args),
  getAccountByPhone: (...args: unknown[]) => mockGetAccountByPhone(...args),
  getAccountByWalletId: (...args: unknown[]) => mockGetAccountByWalletId(...args)
}));

// ---------------------------------------------------------------------------
// Mock identityService (normalizeMobileNumber used in route)
// ---------------------------------------------------------------------------
vi.mock('../services/identityService.js', () => ({
  normalizeMobileNumber: (input: string) => {
    const digits = input.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) throw new Error('invalid phone');
    return `+${digits}`;
  }
}));

// ---------------------------------------------------------------------------
// Build a minimal Express app with the router under test
// Import the router once at module level so mocks are applied consistently
// ---------------------------------------------------------------------------
import { accountRouter } from '../routes/accountRoutes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountRouter);
  return app;
}

const VALID_ADDRESS = 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4';

const SAMPLE_ACCOUNT = {
  accountId: 'acct_abc',
  phone: '+919876543210',
  walletId: 'wallet_xyz',
  walletAddress: VALID_ADDRESS,
  network: 'testnet',
  status: 'active'
};

function resetMocks() {
  mockCreateAccount.mockReset();
  mockGetAccountByPhone.mockReset();
  mockGetAccountByWalletId.mockReset();
}

// ---------------------------------------------------------------------------
// POST /api/accounts
// ---------------------------------------------------------------------------
describe('POST /api/accounts', () => {
  let app: express.Express;

  beforeEach(() => {
    resetMocks();
    app = buildApp();
  });

  it('201 — creates a valid account', async () => {
    mockCreateAccount.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const res = await request(app)
      .post('/api/accounts')
      .send({
        phone: '+919876543210',
        walletId: 'wallet_xyz',
        walletAddress: VALID_ADDRESS,
        network: 'testnet'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.account.accountId).toBe('acct_abc');
    expect(res.body.account).not.toHaveProperty('privateKey');
    expect(res.body.account).not.toHaveProperty('mnemonic');
    expect(res.body.account).not.toHaveProperty('seedPhrase');
  });

  it('400 — missing phone', async () => {
    const err = Object.assign(new Error('phone is required'), { code: 'VALIDATION_ERROR', field: 'phone' });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      walletId: 'wallet_xyz',
      walletAddress: VALID_ADDRESS,
      network: 'testnet'
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.field).toBe('phone');
  });

  it('400 — invalid Algorand address', async () => {
    const err = Object.assign(new Error('walletAddress is not a valid Algorand address'), {
      code: 'VALIDATION_ERROR',
      field: 'walletAddress'
    });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      phone: '+919876543210',
      walletId: 'wallet_xyz',
      walletAddress: 'bad-address',
      network: 'testnet'
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 — unsupported network', async () => {
    const err = Object.assign(new Error('network "ethereum" is not supported'), {
      code: 'VALIDATION_ERROR',
      field: 'network'
    });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      phone: '+919876543210',
      walletId: 'wallet_xyz',
      walletAddress: VALID_ADDRESS,
      network: 'ethereum'
    });

    expect(res.status).toBe(400);
    expect(res.body.field).toBe('network');
  });

  it('409 — duplicate phone', async () => {
    const err = Object.assign(new Error('An account already exists for this phone number.'), {
      code: 'ACCOUNT_EXISTS'
    });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      phone: '+919876543210',
      walletId: 'wallet_new',
      walletAddress: VALID_ADDRESS,
      network: 'testnet'
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_EXISTS');
  });

  it('409 — duplicate walletId', async () => {
    const err = Object.assign(new Error('This walletId is already associated with another account.'), {
      code: 'WALLET_ID_EXISTS'
    });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      phone: '+911111111111',
      walletId: 'wallet_xyz',
      walletAddress: VALID_ADDRESS,
      network: 'testnet'
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WALLET_ID_EXISTS');
  });

  it('409 — duplicate walletAddress', async () => {
    const err = Object.assign(new Error('This wallet address is already associated with another account.'), {
      code: 'WALLET_ADDRESS_EXISTS'
    });
    mockCreateAccount.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/accounts').send({
      phone: '+912222222222',
      walletId: 'wallet_new2',
      walletAddress: VALID_ADDRESS,
      network: 'testnet'
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WALLET_ADDRESS_EXISTS');
  });
});

// ---------------------------------------------------------------------------
// GET /api/accounts/phone/:phone
// ---------------------------------------------------------------------------
describe('GET /api/accounts/phone/:phone', () => {
  let app: express.Express;

  beforeEach(() => {
    resetMocks();
    app = buildApp();
  });

  it('200 — returns account for existing phone', async () => {
    mockGetAccountByPhone.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const res = await request(app).get('/api/accounts/phone/%2B919876543210');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.walletId).toBe('wallet_xyz');
    expect(res.body.account.walletAddress).toBe(VALID_ADDRESS);
  });

  it('404 — unknown phone', async () => {
    mockGetAccountByPhone.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/accounts/phone/%2B910000000000');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('400 — invalid phone format', async () => {
    const res = await request(app).get('/api/accounts/phone/123');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('does not return private key material', async () => {
    mockGetAccountByPhone.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const res = await request(app).get('/api/accounts/phone/%2B919876543210');
    const acct = res.body.account;

    expect(acct).not.toHaveProperty('privateKey');
    expect(acct).not.toHaveProperty('mnemonic');
    expect(acct).not.toHaveProperty('seedPhrase');
    expect(acct).not.toHaveProperty('secretKey');
  });
});

// ---------------------------------------------------------------------------
// GET /api/accounts/wallet/:walletId
// ---------------------------------------------------------------------------
describe('GET /api/accounts/wallet/:walletId', () => {
  let app: express.Express;

  beforeEach(() => {
    resetMocks();
    app = buildApp();
  });

  it('200 — returns account for existing walletId', async () => {
    mockGetAccountByWalletId.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const res = await request(app).get('/api/accounts/wallet/wallet_xyz');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.phone).toBe('+919876543210');
    expect(res.body.account.accountId).toBe('acct_abc');
  });

  it('404 — unknown walletId', async () => {
    mockGetAccountByWalletId.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/accounts/wallet/wallet_unknown');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('does not return private key material', async () => {
    mockGetAccountByWalletId.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const res = await request(app).get('/api/accounts/wallet/wallet_xyz');
    const acct = res.body.account;

    expect(acct).not.toHaveProperty('privateKey');
    expect(acct).not.toHaveProperty('mnemonic');
    expect(acct).not.toHaveProperty('seedPhrase');
    expect(acct).not.toHaveProperty('secretKey');
  });
});

// ---------------------------------------------------------------------------
// API Key auth
// ---------------------------------------------------------------------------
describe('API key authentication', () => {
  it('401 — rejects request when API key is configured and not provided', async () => {
    // Test the middleware directly with a small express app — no module resetting needed
    const { requireApiKey } = await import('../middleware/requireApiKey.js');

    // Temporarily override env.accountsApiKey for this test
    const envModule = await import('../config/env.js');
    const originalKey = envModule.env.accountsApiKey;
    // @ts-ignore test mutation
    envModule.env.accountsApiKey = 'secret-key-123';

    try {
      const testApp = express();
      testApp.use(express.json());
      testApp.get('/test', requireApiKey, (_req, res) => { res.json({ ok: true }); });

      const noKeyRes = await request(testApp).get('/test');
      expect(noKeyRes.status).toBe(401);
      expect(noKeyRes.body.code).toBe('UNAUTHORIZED');

      const withKeyRes = await request(testApp)
        .get('/test')
        .set('X-Api-Key', 'secret-key-123');
      expect(withKeyRes.status).toBe(200);

      const bearerRes = await request(testApp)
        .get('/test')
        .set('Authorization', 'Bearer secret-key-123');
      expect(bearerRes.status).toBe(200);
    } finally {
      // @ts-ignore test cleanup
      envModule.env.accountsApiKey = originalKey;
    }
  });
});

// ---------------------------------------------------------------------------
// Bidirectional consistency test
// ---------------------------------------------------------------------------
describe('bidirectional resolution via HTTP', () => {
  let app: express.Express;

  beforeEach(() => {
    resetMocks();
    app = buildApp();
  });

  it('phone lookup and walletId lookup return same accountId', async () => {
    mockGetAccountByPhone.mockResolvedValueOnce(SAMPLE_ACCOUNT);
    mockGetAccountByWalletId.mockResolvedValueOnce(SAMPLE_ACCOUNT);

    const byPhone = await request(app).get('/api/accounts/phone/%2B919876543210');
    const byWallet = await request(app).get('/api/accounts/wallet/wallet_xyz');

    expect(byPhone.body.account.accountId).toBe(byWallet.body.account.accountId);
    expect(byPhone.body.account.walletId).toBe(byWallet.body.account.walletId);
    expect(byPhone.body.account.walletAddress).toBe(byWallet.body.account.walletAddress);
    expect(byPhone.body.account.phone).toBe(byWallet.body.account.phone);
  });
});
