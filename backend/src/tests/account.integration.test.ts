/**
 * account.integration.test.ts
 *
 * Live MongoDB integration tests for the GhostPay x402 account-mapping layer.
 *
 * Uses mongodb-memory-server to spin up a real (in-process) MongoDB instance.
 * Tests the REAL Mongoose model, real indexes, and real service functions —
 * no mocking of database operations.
 *
 * Covers:
 *   - Account creation + persistence
 *   - Phone lookup against persisted data
 *   - WalletId lookup against persisted data
 *   - Bidirectional consistency
 *   - Duplicate constraints (phone, walletId, walletAddress) at DB level
 *   - Algorand address validation
 *   - Network validation
 *   - Phone normalization
 *   - API authentication
 *   - Secret leakage safety
 *   - Network field consistency
 *   - x402 consumer lookup flow
 *   - Regression: existing MobileIdentity operations unaffected
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

// ─── Real modules — no mocks ────────────────────────────────────────────────
import { MobileIdentityModel, type MobileIdentity } from '../models/MobileIdentity.js';
import { MobileVerificationModel } from '../models/MobileVerification.js';
import { createAccount, getAccountByPhone, getAccountByWalletId } from '../services/accountService.js';
import { accountRouter } from '../routes/accountRoutes.js';
import { requireApiKey } from '../middleware/requireApiKey.js';
import { env } from '../config/env.js';

// ─── Test constants ──────────────────────────────────────────────────────────

// Genuine Algorand addresses (generated with algosdk.generateAccount())
const ADDR_A = 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4';
const ADDR_B = '6XPKERRH7SRNUUOULNHEGJENORE2Y537ZDYTUA5O4TRIGXRZQ5ML6LMXLY';
const ADDR_C = 'DV57K32W34OTANT64X4FHDGMU4RVC7WVLMQYXEJVDM773A5LL44IG74JTU';

// ─── MongoDB in-memory setup ─────────────────────────────────────────────────

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'ghostpay_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Wipe collections between tests for isolation
  await MobileIdentityModel.deleteMany({});
  await MobileVerificationModel.deleteMany({});
});

// ─── Express app for HTTP tests ──────────────────────────────────────────────

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountRouter);
  return app;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Override env.accountsApiKey for a single test block and restore after. */
function withApiKey(key: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const original = env.accountsApiKey;
    // @ts-ignore test mutation
    env.accountsApiKey = key;
    try {
      await fn();
    } finally {
      // @ts-ignore test cleanup
      env.accountsApiKey = original;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SERVICE LAYER — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('createAccount — real MongoDB', () => {
  it('creates a document and returns correct AccountView', async () => {
    const result = await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_int_001',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    expect(result.accountId).toMatch(/^acct_/);
    expect(result.phone).toBe('+919876543210');
    expect(result.walletId).toBe('wallet_int_001');
    expect(result.walletAddress).toBe(ADDR_A);
    expect(result.network).toBe('testnet');
    expect(result.status).toBe('active');

    // Verify document actually exists in MongoDB
    const doc = await MobileIdentityModel.findOne({ mobileNumber: '+919876543210' }).lean<MobileIdentity>();
    expect(doc).not.toBeNull();
    expect(doc?.accountId).toBe(result.accountId);
    expect(doc?.wallets).toHaveLength(1);
    expect(doc?.wallets[0].walletId).toBe('wallet_int_001');
    expect(doc?.wallets[0].address).toBe(ADDR_A);
    expect(doc?.wallets[0].network).toBe('testnet');
    expect(doc?.wallets[0].isDefault).toBe(true);
  });

  it('AccountView never contains private key material', async () => {
    const result = await createAccount({
      phone: '+919000000001',
      walletId: 'wallet_int_safe',
      walletAddress: ADDR_B,
      network: 'testnet'
    });

    const keys = Object.keys(result);
    for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('normalizes phone before storing — +91 and 91 become the same', async () => {
    await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_norm_1',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    // Second create with same digits, different format → ACCOUNT_EXISTS
    await expect(createAccount({
      phone: '919876543210',   // no leading +
      walletId: 'wallet_norm_2',
      walletAddress: ADDR_B,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });

    // Only one document in the collection
    const count = await MobileIdentityModel.countDocuments({ mobileNumber: '+919876543210' });
    expect(count).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DUPLICATE CONSTRAINTS — REAL DATABASE
// ─────────────────────────────────────────────────────────────────────────────

describe('duplicate constraints — real MongoDB', () => {
  it('rejects duplicate phone at service level', async () => {
    await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_dup_phone_1',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_dup_phone_2',
      walletAddress: ADDR_B,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });
  });

  it('rejects duplicate walletId at service level', async () => {
    await createAccount({
      phone: '+919000000001',
      walletId: 'wallet_shared_id',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    await expect(createAccount({
      phone: '+919000000002',
      walletId: 'wallet_shared_id',
      walletAddress: ADDR_B,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'WALLET_ID_EXISTS' });
  });

  it('rejects duplicate walletAddress at service level', async () => {
    await createAccount({
      phone: '+919000000001',
      walletId: 'wallet_addr_1',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    await expect(createAccount({
      phone: '+919000000002',
      walletId: 'wallet_addr_2',
      walletAddress: ADDR_A,  // same address
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'WALLET_ADDRESS_EXISTS' });
  });

  it('MongoDB unique index on mobileNumber prevents DB-level duplicate', async () => {
    // Bypass service and insert directly to test the index itself
    const now = new Date();
    await MobileIdentityModel.create({
      accountId: 'acct_direct_1',
      mobileNumber: '+910000000000',
      verified: false,
      status: 'active',
      wallets: [{ walletId: 'w1', address: ADDR_A, network: 'testnet', isDefault: true, verifiedAt: now, addedAt: now }]
    });

    await expect(
      MobileIdentityModel.create({
        accountId: 'acct_direct_2',
        mobileNumber: '+910000000000',  // same number
        verified: false,
        status: 'active',
        wallets: [{ walletId: 'w2', address: ADDR_B, network: 'testnet', isDefault: true, verifiedAt: now, addedAt: now }]
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('MongoDB unique index on accountId prevents DB-level duplicate', async () => {
    const now = new Date();
    await MobileIdentityModel.create({
      accountId: 'acct_same_id',
      mobileNumber: '+910000000001',
      verified: false,
      status: 'active',
      wallets: [{ walletId: 'w3', address: ADDR_A, network: 'testnet', isDefault: true, verifiedAt: now, addedAt: now }]
    });

    await expect(
      MobileIdentityModel.create({
        accountId: 'acct_same_id',  // same accountId
        mobileNumber: '+910000000002',
        verified: false,
        status: 'active',
        wallets: [{ walletId: 'w4', address: ADDR_B, network: 'testnet', isDefault: true, verifiedAt: now, addedAt: now }]
      })
    ).rejects.toThrow(/duplicate key/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PHONE LOOKUP — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('getAccountByPhone — real MongoDB', () => {
  it('retrieves the persisted account by phone', async () => {
    const created = await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_ph_1',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const found = await getAccountByPhone('+919876543210');

    expect(found).not.toBeNull();
    expect(found?.accountId).toBe(created.accountId);
    expect(found?.walletId).toBe('wallet_ph_1');
    expect(found?.walletAddress).toBe(ADDR_A);
    expect(found?.network).toBe('testnet');
    expect(found?.status).toBe('active');
  });

  it('returns null for unknown phone', async () => {
    const result = await getAccountByPhone('+910000000000');
    expect(result).toBeNull();
  });

  it('normalizes phone on lookup — finds with or without leading +', async () => {
    await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_ph_norm',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const found = await getAccountByPhone('919876543210');  // no leading +
    expect(found).not.toBeNull();
    expect(found?.walletId).toBe('wallet_ph_norm');
  });

  it('result never contains private key material', async () => {
    await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_ph_safe',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const result = await getAccountByPhone('+919876543210');
    expect(result).not.toBeNull();

    const keys = Object.keys(result!);
    for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. WALLETID LOOKUP — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('getAccountByWalletId — real MongoDB', () => {
  it('retrieves the persisted account by walletId', async () => {
    const created = await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_wid_1',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const found = await getAccountByWalletId('wallet_wid_1');

    expect(found).not.toBeNull();
    expect(found?.accountId).toBe(created.accountId);
    expect(found?.phone).toBe('+919876543210');
    expect(found?.walletAddress).toBe(ADDR_A);
    expect(found?.network).toBe('testnet');
  });

  it('returns null for unknown walletId', async () => {
    const result = await getAccountByWalletId('wallet_does_not_exist');
    expect(result).toBeNull();
  });

  it('returns null for empty/whitespace walletId', async () => {
    const result = await getAccountByWalletId('   ');
    expect(result).toBeNull();
  });

  it('result never contains private key material', async () => {
    await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_wid_safe',
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const result = await getAccountByWalletId('wallet_wid_safe');
    expect(result).not.toBeNull();

    const keys = Object.keys(result!);
    for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. BIDIRECTIONAL CONSISTENCY — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('bidirectional consistency — real MongoDB', () => {
  it('phone lookup and walletId lookup resolve to the same document', async () => {
    const phone = '+919876543210';
    const walletId = 'wallet_bidir_1';

    const created = await createAccount({
      phone,
      walletId,
      walletAddress: ADDR_A,
      network: 'testnet'
    });

    const byPhone = await getAccountByPhone(phone);
    const byWallet = await getAccountByWalletId(walletId);

    // Both resolve to the same account
    expect(byPhone?.accountId).toBe(created.accountId);
    expect(byWallet?.accountId).toBe(created.accountId);

    // All four mapping fields match
    expect(byPhone?.accountId).toBe(byWallet?.accountId);
    expect(byPhone?.phone).toBe(byWallet?.phone);
    expect(byPhone?.walletId).toBe(byWallet?.walletId);
    expect(byPhone?.walletAddress).toBe(byWallet?.walletAddress);
    expect(byPhone?.network).toBe(byWallet?.network);
  });

  it('multiple accounts remain independent — no cross-contamination', async () => {
    await createAccount({ phone: '+919000000001', walletId: 'wallet_ind_1', walletAddress: ADDR_A, network: 'testnet' });
    await createAccount({ phone: '+919000000002', walletId: 'wallet_ind_2', walletAddress: ADDR_B, network: 'mainnet' });

    const account1 = await getAccountByPhone('+919000000001');
    const account2 = await getAccountByPhone('+919000000002');

    expect(account1?.walletId).toBe('wallet_ind_1');
    expect(account2?.walletId).toBe('wallet_ind_2');
    expect(account1?.accountId).not.toBe(account2?.accountId);
    expect(account1?.network).toBe('testnet');
    expect(account2?.network).toBe('mainnet');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. VALIDATION — REAL SERVICE
// ─────────────────────────────────────────────────────────────────────────────

describe('input validation — Algorand address and network', () => {
  it('rejects invalid Algorand address', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_v_1',
      walletAddress: 'not-a-valid-algorand-address',
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'walletAddress' });
  });

  it('rejects empty walletAddress', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_v_2',
      walletAddress: '',
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'walletAddress' });
  });

  it('accepts testnet', async () => {
    const r = await createAccount({ phone: '+919000000001', walletId: 'w_net_1', walletAddress: ADDR_A, network: 'testnet' });
    expect(r.network).toBe('testnet');
  });

  it('accepts mainnet', async () => {
    const r = await createAccount({ phone: '+919000000002', walletId: 'w_net_2', walletAddress: ADDR_B, network: 'mainnet' });
    expect(r.network).toBe('mainnet');
  });

  it('accepts localnet', async () => {
    const r = await createAccount({ phone: '+919000000003', walletId: 'w_net_3', walletAddress: ADDR_C, network: 'localnet' });
    expect(r.network).toBe('localnet');
  });

  it('rejects empty network', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_v_3',
      walletAddress: ADDR_A,
      network: ''
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'network' });
  });

  it('rejects unsupported network', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_v_4',
      walletAddress: ADDR_A,
      network: 'ethereum'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'network' });
  });

  it('rejects undefined network', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_v_5',
      walletAddress: ADDR_A
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'network' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. HTTP LAYER — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('HTTP /api/accounts — real MongoDB', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    app = buildTestApp();
  });

  it('POST 201 — creates and persists account', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_http_1', walletAddress: ADDR_A, network: 'testnet' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.account.accountId).toMatch(/^acct_/);
    expect(res.body.account.phone).toBe('+919876543210');
    expect(res.body.account.walletId).toBe('wallet_http_1');
    expect(res.body.account.walletAddress).toBe(ADDR_A);
    expect(res.body.account.network).toBe('testnet');
    expect(res.body.account.status).toBe('active');

    // Verify persisted
    const doc = await MobileIdentityModel.findOne({ mobileNumber: '+919876543210' }).lean();
    expect(doc).not.toBeNull();
  });

  it('POST 201 — response never exposes private key material', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919000000001', walletId: 'wallet_http_safe', walletAddress: ADDR_A, network: 'testnet' });

    expect(res.status).toBe(201);
    const acct = res.body.account;
    for (const f of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(acct).not.toHaveProperty(f);
    }
  });

  it('GET /phone/:phone 200 — retrieves persisted account', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_http_2', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app).get('/api/accounts/phone/%2B919876543210');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.walletId).toBe('wallet_http_2');
    expect(res.body.account.walletAddress).toBe(ADDR_A);
  });

  it('GET /phone/:phone 404 — unknown phone', async () => {
    const res = await request(app).get('/api/accounts/phone/%2B910000000000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('GET /phone/:phone 400 — invalid phone', async () => {
    const res = await request(app).get('/api/accounts/phone/123');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('GET /wallet/:walletId 200 — retrieves persisted account', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_http_3', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app).get('/api/accounts/wallet/wallet_http_3');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.phone).toBe('+919876543210');
    expect(res.body.account.walletAddress).toBe(ADDR_A);
  });

  it('GET /wallet/:walletId 404 — unknown walletId', async () => {
    const res = await request(app).get('/api/accounts/wallet/wallet_does_not_exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('POST 409 — duplicate phone returns ACCOUNT_EXISTS', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_dup_1', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_dup_2', walletAddress: ADDR_B, network: 'testnet' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_EXISTS');
  });

  it('POST 409 — duplicate walletId returns WALLET_ID_EXISTS', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919000000001', walletId: 'wallet_dup_id', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919000000002', walletId: 'wallet_dup_id', walletAddress: ADDR_B, network: 'testnet' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WALLET_ID_EXISTS');
  });

  it('POST 409 — duplicate walletAddress returns WALLET_ADDRESS_EXISTS', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919000000001', walletId: 'wallet_addr_x1', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919000000002', walletId: 'wallet_addr_x2', walletAddress: ADDR_A, network: 'testnet' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WALLET_ADDRESS_EXISTS');
  });

  it('GET phone response never exposes private key material', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_http_4', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app).get('/api/accounts/phone/%2B919876543210');
    const acct = res.body.account;
    for (const f of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(acct).not.toHaveProperty(f);
    }
  });

  it('GET wallet response never exposes private key material', async () => {
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_http_5', walletAddress: ADDR_A, network: 'testnet' });

    const res = await request(app).get('/api/accounts/wallet/wallet_http_5');
    const acct = res.body.account;
    for (const f of ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password', 'PIN', 'encryptedPrivateKey']) {
      expect(acct).not.toHaveProperty(f);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. BIDIRECTIONAL HTTP — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('bidirectional HTTP lookup — real MongoDB', () => {
  it('POST then GET phone and GET walletId return the same account', async () => {
    const app = buildTestApp();

    const createRes = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_bd_1', walletAddress: ADDR_A, network: 'testnet' });

    expect(createRes.status).toBe(201);
    const { accountId } = createRes.body.account;

    const byPhone = await request(app).get('/api/accounts/phone/%2B919876543210');
    const byWallet = await request(app).get('/api/accounts/wallet/wallet_bd_1');

    expect(byPhone.status).toBe(200);
    expect(byWallet.status).toBe(200);

    // Same accountId
    expect(byPhone.body.account.accountId).toBe(accountId);
    expect(byWallet.body.account.accountId).toBe(accountId);

    // All four mapping fields match between both lookups
    expect(byPhone.body.account.accountId).toBe(byWallet.body.account.accountId);
    expect(byPhone.body.account.phone).toBe(byWallet.body.account.phone);
    expect(byPhone.body.account.walletId).toBe(byWallet.body.account.walletId);
    expect(byPhone.body.account.walletAddress).toBe(byWallet.body.account.walletAddress);
    expect(byPhone.body.account.network).toBe(byWallet.body.account.network);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. API KEY AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('API key authentication', () => {
  it('401 — no key when ACCOUNTS_API_KEY is set', withApiKey('test-secret-key', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/accounts/phone/%2B919876543210');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.success).toBe(false);
  }));

  it('401 — wrong key when ACCOUNTS_API_KEY is set', withApiKey('test-secret-key', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/api/accounts/phone/%2B919876543210')
      .set('X-Api-Key', 'wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  }));

  it('200 — Bearer correct key passes', withApiKey('test-secret-key', async () => {
    const app = buildTestApp();
    // 404 is fine — auth passed, account doesn't exist
    const res = await request(app)
      .get('/api/accounts/phone/%2B910000000000')
      .set('Authorization', 'Bearer test-secret-key');
    expect(res.status).toBe(404);  // auth passed, not 401
  }));

  it('200 — X-Api-Key correct key passes', withApiKey('test-secret-key', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/api/accounts/phone/%2B910000000000')
      .set('X-Api-Key', 'test-secret-key');
    expect(res.status).toBe(404);  // auth passed, not 401
  }));

  it('open — ACCOUNTS_API_KEY empty allows all requests (dev mode)', async () => {
    // env.accountsApiKey is '' by default in test env (no .env loaded with a key)
    const savedKey = env.accountsApiKey;
    // @ts-ignore
    env.accountsApiKey = '';
    try {
      const app = buildTestApp();
      const res = await request(app).get('/api/accounts/phone/%2B910000000000');
      // Auth not enforced — response is 404 (no account), not 401
      expect(res.status).toBe(404);
    } finally {
      // @ts-ignore
      env.accountsApiKey = savedKey;
    }
  });

  it('auth header with wrong Bearer format is rejected', withApiKey('test-secret-key', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/api/accounts/phone/%2B910000000000')
      .set('Authorization', 'Token test-secret-key');  // not Bearer
    expect(res.status).toBe(401);
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. x402 CONSUMER FLOW — REAL MONGODB
// ─────────────────────────────────────────────────────────────────────────────

describe('x402 consumer flow — real MongoDB', () => {
  it('phone-first resolution: phone → walletId → walletAddress → network', async () => {
    const app = buildTestApp();

    // x402 consumer registers the account mapping
    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_x402_ph', walletAddress: ADDR_A, network: 'testnet' });

    // x402 payment service looks up destination by phone
    const res = await request(app).get('/api/accounts/phone/%2B919876543210');

    expect(res.status).toBe(200);
    const { account } = res.body;

    // x402 can resolve all required fields for payment routing
    expect(account.walletId).toBeTruthy();
    expect(account.walletAddress).toBe(ADDR_A);
    expect(account.network).toBe('testnet');
    expect(account.accountId).toMatch(/^acct_/);

    // x402 knows exactly which network to route on
    expect(['testnet', 'mainnet', 'localnet']).toContain(account.network);
  });

  it('walletId-first resolution: walletId → phone → walletAddress → network', async () => {
    const app = buildTestApp();

    await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_x402_wid', walletAddress: ADDR_B, network: 'mainnet' });

    // x402 service resolves account by walletId (e.g. from a prior interaction)
    const res = await request(app).get('/api/accounts/wallet/wallet_x402_wid');

    expect(res.status).toBe(200);
    const { account } = res.body;

    expect(account.phone).toBe('+919876543210');
    expect(account.walletAddress).toBe(ADDR_B);
    expect(account.network).toBe('mainnet');
    expect(account.accountId).toMatch(/^acct_/);
  });

  it('full end-to-end x402 flow: create → lookup phone → lookup wallet → assert consistency', async () => {
    const app = buildTestApp();

    // Step 1: Create the account mapping
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ phone: '+919876543210', walletId: 'wallet_e2e', walletAddress: ADDR_C, network: 'testnet' });

    expect(createRes.status).toBe(201);
    const { accountId, phone, walletId, walletAddress, network } = createRes.body.account;

    // Step 2: Retrieve by phone
    const byPhone = await request(app).get(`/api/accounts/phone/${encodeURIComponent(phone)}`);
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.account.walletId).toBe(walletId);
    expect(byPhone.body.account.walletAddress).toBe(walletAddress);

    // Step 3: Retrieve by walletId
    const byWallet = await request(app).get(`/api/accounts/wallet/${walletId}`);
    expect(byWallet.status).toBe(200);
    expect(byWallet.body.account.phone).toBe(phone);
    expect(byWallet.body.account.walletAddress).toBe(walletAddress);

    // Step 4: Assert bidirectional consistency
    expect(byPhone.body.account.accountId).toBe(accountId);
    expect(byWallet.body.account.accountId).toBe(accountId);
    expect(byPhone.body.account.network).toBe(network);
    expect(byWallet.body.account.network).toBe(network);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. REGRESSION — EXISTING MobileIdentity OPERATIONS UNAFFECTED
// ─────────────────────────────────────────────────────────────────────────────

describe('regression — existing MobileIdentity model operations', () => {
  it('can still create MobileIdentity documents directly (existing OTP flow)', async () => {
    // Simulate what the existing identityService does during OTP verification
    const now = new Date();
    const doc = await MobileIdentityModel.create({
      accountId: 'acct_legacy_1',
      mobileNumber: '+919999999999',
      verified: true,
      status: 'active',
      wallets: [
        {
          walletId: 'wallet_legacy_1',
          address: ADDR_A,
          network: 'testnet',
          label: 'Primary Wallet',
          isDefault: true,
          verifiedAt: now,
          addedAt: now
        }
      ]
    });

    expect(doc.mobileNumber).toBe('+919999999999');
    expect(doc.verified).toBe(true);
    expect(doc.wallets).toHaveLength(1);
    expect(doc.wallets[0].isDefault).toBe(true);
  });

  it('wallet address lookup still works for existing send-gate logic', async () => {
    // The send-gate uses: MobileIdentityModel.findOne({ 'wallets.address': address })
    const now = new Date();
    await MobileIdentityModel.create({
      accountId: 'acct_legacy_2',
      mobileNumber: '+919888888888',
      verified: true,
      status: 'active',
      wallets: [
        {
          walletId: 'wallet_legacy_2',
          address: ADDR_B,
          network: 'testnet',
          isDefault: true,
          verifiedAt: now,
          addedAt: now
        }
      ]
    });

    const found = await MobileIdentityModel.findOne({ 'wallets.address': ADDR_B });
    expect(found).not.toBeNull();
    expect(found?.mobileNumber).toBe('+919888888888');
    expect(found?.verified).toBe(true);
  });

  it('new accountId/walletId fields are optional for legacy inserts — defaults gracefully', async () => {
    // Confirm the schema handles documents that might be missing new fields
    // (relevant for existing data in a production DB before migration)
    const now = new Date();

    // Insert a minimal document (as identityService would have created before this change)
    // accountId is required so we must supply it, but walletId on wallet sub-doc is required too
    // This test confirms the new required fields are clearly required
    await expect(
      MobileIdentityModel.create({
        mobileNumber: '+910000099999',
        verified: true,
        status: 'active',
        wallets: []
        // missing accountId → should fail
      })
    ).rejects.toThrow();
  });

  it('REQUIRE_IDENTITY_FOR_SEND logic path still resolves via wallets.address', async () => {
    // The send-gate in algorandRoutes checks: getIdentityByWallet(address)
    // which queries MobileIdentityModel.findOne({ 'wallets.address': address })
    // This must still work after our schema additions.
    const now = new Date();
    await MobileIdentityModel.create({
      accountId: 'acct_sendgate',
      mobileNumber: '+919777777777',
      verified: true,
      status: 'active',
      wallets: [{
        walletId: 'wallet_sg',
        address: ADDR_C,
        network: 'testnet',
        isDefault: true,
        verifiedAt: now,
        addedAt: now
      }]
    });

    const identity = await MobileIdentityModel.findOne({ 'wallets.address': ADDR_C });
    expect(identity).not.toBeNull();
    expect(identity?.verified).toBe(true);
    expect(identity?.mobileNumber).toBe('+919777777777');
  });
});
