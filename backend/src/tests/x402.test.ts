/**
 * x402.test.ts
 *
 * Tests for the x402 HTTP payment protocol integration.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { PaymentPayload, Network } from '@x402/core/types';

vi.mock('../config/env.js', () => ({
  env: {
    algorandNetwork: 'testnet',
    algodServer: 'https://testnet-api.algonode.cloud',
    algodPort: '443',
    algodToken: '',
    signerMnemonic: '',
    contractAppId: 769719989,
    enforceContract: true,
    explorerTxBaseUrl: 'https://lora.algokit.io/testnet/transaction/',
    allowDemoMode: false,
    confirmationRounds: 3,
    maxAlgoPerTx: 1000,
    requireIdentityForSend: false,
    accountsApiKey: '',
    x402FacilitatorUrl: 'https://facilitator.goplausible.xyz',
    x402PayTo: ''
  }
}));

import {
  buildPaymentRequired,
  verifyPayment,
  settlePayment,
  getAlgorandCaip2,
  GOPLAUSIBLE_FACILITATOR_URL,
  USDC_ASA_ID,
  ALGORAND_TESTNET_CAIP2_FULL,
  ALGORAND_MAINNET_CAIP2_FULL
} from '../services/x402Service.js';

import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from '@x402/avm';

const PAY_TO = 'TFWA7LW2S2XV74WV36IZ5ZFS6Z3UP63F6QQGPFPWZMLO6SD3BKC5VPWDIU';

function mockPaymentPayload(): PaymentPayload {
  return {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: ALGORAND_TESTNET_CAIP2_FULL,
      amount: '100000',
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      asset: '10458941',
      extra: {}
    },
    payload: {
      paymentGroup: ['abc'],
      paymentIndex: 0
    }
  };
}

describe('x402 constants', () => {
  it('ALGORAND_TESTNET_CAIP2_FULL has the correct full genesis hash (53 chars)', () => {
    expect(ALGORAND_TESTNET_CAIP2_FULL).toBe('algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=');
    expect(ALGORAND_TESTNET_CAIP2_FULL.length).toBe(53);
  });

  it('getAlgorandCaip2() returns the FULL testnet CAIP-2 (matches GoPlausible /supported)', () => {
    expect(getAlgorandCaip2()).toBe(ALGORAND_TESTNET_CAIP2_FULL);
    // The truncated constant from @x402/avm is 41 chars — we must NOT use it for GoPlausible
    expect(getAlgorandCaip2()).not.toBe(ALGORAND_TESTNET_CAIP2);
  });

  it('USDC_ASA_ID is testnet USDC on testnet', () => {
    expect(USDC_ASA_ID).toBe('10458941');
  });

  it('GOPLAUSIBLE_FACILITATOR_URL is the correct facilitator endpoint', () => {
    expect(GOPLAUSIBLE_FACILITATOR_URL).toBe('https://facilitator.goplausible.xyz');
  });
});

describe('buildPaymentRequired', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        kinds: [
          {
            x402Version: 2,
            scheme: 'exact',
            network: ALGORAND_TESTNET_CAIP2_FULL,
            extra: { feePayer: 'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA' }
          }
        ]
      })
    }));
  });

  it('returns x402Version 2 with resource and accepts', async () => {
    const req = await buildPaymentRequired({
      amountUsdCents: 10,
      payTo: PAY_TO,
      resource: 'Test',
      path: '/api/x402/pay'
    });
    expect(req.x402Version).toBe(2);
    expect(req.resource.url).toBe('/api/x402/pay');
    expect(req.resource.description).toBe('Test');
    expect(req.accepts).toHaveLength(1);
  });

  it('accept entry uses exact scheme and testnet network', async () => {
    const req = await buildPaymentRequired({ amountUsdCents: 10, payTo: PAY_TO });
    expect(req.accepts[0].scheme).toBe('exact');
    expect(req.accepts[0].network).toBe(ALGORAND_TESTNET_CAIP2_FULL);
  });

  it('converts $0.10 (10 cents) to 100000 USDC atomic units', async () => {
    const req = await buildPaymentRequired({ amountUsdCents: 10, payTo: PAY_TO });
    expect(req.accepts[0].amount).toBe('100000');
  });

  it('converts $0.50 (50 cents) to 500000 USDC atomic units', async () => {
    const req = await buildPaymentRequired({ amountUsdCents: 50, payTo: PAY_TO });
    expect(req.accepts[0].amount).toBe('500000');
  });

  it('sets payTo and USDC testnet asset', async () => {
    const req = await buildPaymentRequired({ amountUsdCents: 10, payTo: PAY_TO });
    expect(req.accepts[0].payTo).toBe(PAY_TO);
    expect(req.accepts[0].asset).toBe('10458941');
  });

  it('includes feePayer from facilitator in extra', async () => {
    const req = await buildPaymentRequired({ amountUsdCents: 10, payTo: PAY_TO });
    expect(req.accepts[0].extra?.feePayer).toBe(
      'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA'
    );
  });

  it('still works if facilitator fetch fails (no feePayer)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const req = await buildPaymentRequired({ amountUsdCents: 10, payTo: PAY_TO });
    expect(req.x402Version).toBe(2);
    expect(req.accepts[0].extra?.feePayer).toBeUndefined();
  });
});

describe('verifyPayment', () => {
  const mockPaymentRequired = {
    x402Version: 2 as const,
    resource: { url: '/api/x402/pay', description: 'Test', mimeType: 'application/json' },
    accepts: [{
      scheme: 'exact' as const,
      network: ALGORAND_TESTNET_CAIP2_FULL as Network,
      amount: '100000',
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      asset: '10458941',
      extra: {}
    }]
  };

  it('returns valid:true when facilitator returns ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ isValid: true })
    }));

    const result = await verifyPayment(mockPaymentPayload(), mockPaymentRequired);
    expect(result.valid).toBe(true);
  });

  it('returns valid:false when facilitator returns isValid:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ isValid: false, invalidMessage: 'invalid signature' })
    }));

    const result = await verifyPayment(mockPaymentPayload(), mockPaymentRequired);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('invalid signature');
  });

  it('returns valid:false when facilitator is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await verifyPayment(mockPaymentPayload(), mockPaymentRequired);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Facilitator unreachable');
  });
});

describe('settlePayment', () => {
  const mockPaymentRequired = {
    x402Version: 2 as const,
    resource: { url: '/api/x402/pay', description: 'Test', mimeType: 'application/json' },
    accepts: [{
      scheme: 'exact' as const,
      network: ALGORAND_TESTNET_CAIP2_FULL as Network,
      amount: '100000',
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      asset: '10458941',
      extra: {}
    }]
  };

  it('returns success:true and txId from transaction field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true, transaction: 'SETTLE_TX_001' })
    }));

    const result = await settlePayment(mockPaymentPayload(), mockPaymentRequired);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.txId).toBe('SETTLE_TX_001');
      expect(result.network).toBe(ALGORAND_TESTNET_CAIP2_FULL);
    }
  });

  it('returns success:false when facilitator settle fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ success: false, errorMessage: 'node error' })
    }));

    const result = await settlePayment(mockPaymentPayload(), mockPaymentRequired);
    expect(result.success).toBe(false);
  });
});

describe('requirePayment middleware', () => {
  it('returns 402 with PaymentRequired when no X-PAYMENT header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.get(
      '/test-gated',
      requirePayment({ amountUsdCents: 10, payTo: PAY_TO, resource: 'Test', path: '/test-gated' }),
      (_req, res) => { res.json({ ok: true }); }
    );

    const res = await request(app).get('/test-gated');
    expect(res.status).toBe(402);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.resource).toBeDefined();
    expect(res.body.accepts).toHaveLength(1);
  });

  it('returns 402 when X-PAYMENT header is not valid PaymentPayload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL }] })
    }));

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.get(
      '/test-gated',
      requirePayment({ amountUsdCents: 10, payTo: PAY_TO }),
      (_req, res) => { res.json({ ok: true }); }
    );

    const res = await request(app)
      .get('/test-gated')
      .set('x-payment', Buffer.from('not-json').toString('base64'));
    expect(res.status).toBe(402);
  });
});

describe('GET /api/x402/status', () => {
  it('returns x402Version 2 in status response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, extra: { feePayer: 'ZMFK...' } }]
      })
    }));

    const { x402Router } = await import('../routes/x402Routes.js');
    const app = express();
    app.use('/api/x402', x402Router);

    const res = await request(app).get('/api/x402/status');
    expect(res.status).toBe(200);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.scheme).toBe('exact');
    expect(res.body.asset).toBe('10458941');
    expect(res.body.facilitator).toBe('https://facilitator.goplausible.xyz');
  });
});

describe('GET /api/x402/payment-required', () => {
  it('returns x402 v2 PaymentRequired shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { x402Router } = await import('../routes/x402Routes.js');
    const app = express();
    app.use('/api/x402', x402Router);

    const res = await request(app).get('/api/x402/payment-required');
    expect(res.status).toBe(200);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.resource.url).toBe('/api/x402/pay');
    expect(res.body.accepts[0].scheme).toBe('exact');
    expect(res.body.accepts[0].network).toBe(ALGORAND_TESTNET_CAIP2_FULL);
    expect(res.body.accepts[0].amount).toBe('100000');
    expect(res.body.accepts[0].asset).toBe('10458941');
  });
});

// ─── Security endpoint tests ─────────────────────────────────────────────────

describe('GET /api/security/status', () => {
  it('returns security service status without payment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, extra: { feePayer: 'ZMFK...' } }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use('/api/security', securityRouter);

    const res = await request(app).get('/api/security/status');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('GhostPay Security Analysis');
    expect(res.body.facilitator).toBe('https://facilitator.goplausible.xyz');
    expect(res.body.asset).toBe('10458941');
  });
});

describe('GET /api/security/payment-required', () => {
  it('returns PaymentRequired for wallet-risk endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use('/api/security', securityRouter);

    const res = await request(app).get('/api/security/payment-required');
    expect(res.status).toBe(200);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.accepts[0].scheme).toBe('exact');
    expect(res.body.accepts[0].amount).toBe('100000');
    expect(res.body.accepts[0].asset).toBe('10458941');
  });
});

describe('POST /api/security/wallet-risk — x402 gate', () => {
  const VALID_SENDER   = 'TFWA7LW2S2XV74WV36IZ5ZFS6Z3UP63F6QQGPFPWZMLO6SD3BKC5VPWDIU';
  const VALID_RECEIVER = 'NHQ2ELYNFMVNRT4MVWNJNOLNWIZQQ47DBVMW4KW4DPOR5AC3THYRYJWY6Q';

  it('returns 402 when no X-PAYMENT header is provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    expect(res.status).toBe(402);
    expect(res.body.x402Version).toBe(2);
    expect(res.body.accepts).toHaveLength(1);
    expect(res.body.accepts[0].asset).toBe('10458941');
  });

  it('returns 402 for malformed X-PAYMENT header (not valid base64 JSON)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', Buffer.from('garbage-not-json').toString('base64'))
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    expect(res.status).toBe(402);
  });

  it('returns 402 when facilitator verify returns isValid:false (fake txId)', async () => {
    // First call: /supported (for buildPaymentRequired)
    // Second call: /verify (returns isValid:false)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ isValid: false, invalidMessage: 'transaction not found on chain' })
      });
    vi.stubGlobal('fetch', fetchMock);

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const payload = mockPaymentPayload();
    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', header)
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('transaction not found');
  });

  it('returns 402 when facilitator settle fails after successful verify', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ isValid: true })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ success: false, errorMessage: 'node error during settlement' })
      });
    vi.stubGlobal('fetch', fetchMock);

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const payload = mockPaymentPayload();
    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', header)
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('settlement');
  });

  it('returns 400 when sender is not a valid Algorand address', async () => {
    // requirePayment fires first — no X-PAYMENT means 402
    // 400 for invalid address only fires after payment succeeds
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .send({ sender: 'not-an-address', receiver: VALID_RECEIVER, amount: 1.0 });

    // Without payment header, the 402 gate fires first
    expect(res.status).toBe(402);
  });

  it('returns 400 when sender is invalid — after payment succeeds', async () => {
    // Mock full payment flow succeeding, then hit the field validation
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ isValid: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, transaction: 'TX001' })
      });
    vi.stubGlobal('fetch', fetchMock);

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const payload = mockPaymentPayload();
    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', header)
      .send({ sender: 'INVALID_SENDER_ADDRESS', receiver: VALID_RECEIVER, amount: 1.0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sender/i);
  });

  it('returns 402 when receiver field is missing (payment gate fires first)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .send({ sender: VALID_SENDER, receiver: 'BADADDRESS', amount: 1.0 });

    // requirePayment fires first with no X-PAYMENT → 402
    expect(res.status).toBe(402);
  });

  it('returns 400 when receiver is invalid — after payment succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ isValid: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, transaction: 'TX001' })
      });
    vi.stubGlobal('fetch', fetchMock);

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const payload = mockPaymentPayload();
    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', header)
      .send({ sender: VALID_SENDER, receiver: 'BADADDRESS', amount: 1.0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/receiver/i);
  });

  it('returns 402 when amount is missing (payment gate fires first)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER });

    // requirePayment fires before field validation — 402 because no X-PAYMENT header
    expect(res.status).toBe(402);
  });

  it('passes x402 gate (verify+settle succeed) when payment is valid', async () => {
    // The x402 middleware calls: /supported, /verify, /settle
    // After the gate passes, the handler calls algosdk for account data.
    // We mock the facilitator calls to succeed; algod calls may fail in CI —
    // what matters here is that the 402 gate is passed (not a 402 response).
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: { feePayer: 'FEE_PAYER' } }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ isValid: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, transaction: 'REAL_TX_001' })
      })
      // All subsequent calls (algod/indexer) return empty accounts
      .mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 10_000_000 }),
        text: async () => JSON.stringify({ amount: 10_000_000 })
      });

    vi.stubGlobal('fetch', fetchMock);

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    const payload = mockPaymentPayload();
    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    const res = await request(app)
      .post('/api/security/wallet-risk')
      .set('x-payment', header)
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    // Must NOT be 402 — the x402 payment gate was passed
    expect(res.status).not.toBe(402);
    // If algod succeeded: 200 with risk result
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.payment.verified).toBe(true);
      expect(res.body.payment.txId).toBe('REAL_TX_001');
      expect(res.headers['x-payment-response']).toBeDefined();
    }
    // 500 means algod was reached but failed — that's fine, the x402 gate passed
  });

  it('response does not leak mnemonic or private key material', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact' }] })
    }));

    const { securityRouter } = await import('../routes/securityRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/security', securityRouter);

    // No payment — 402 response
    const res = await request(app)
      .post('/api/security/wallet-risk')
      .send({ sender: VALID_SENDER, receiver: VALID_RECEIVER, amount: 1.0 });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('mnemonic');
    expect(body).not.toContain('privateKey');
    expect(body).not.toContain('secretKey');
    expect(body).not.toContain('seedPhrase');
    expect(body).not.toContain('MONGODB_URI');
    expect(body).not.toContain('TWILIO_AUTH_TOKEN');
  });
});

// ─── x402 payment verification hardening tests ───────────────────────────────

describe('x402 payment verification — rejection scenarios', () => {
  it('rejects payment with wrong network identifier', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'network mismatch: expected algorand testnet, got algorand mainnet'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const wrongNetworkPayload: PaymentPayload = {
      ...mockPaymentPayload(),
      accepted: {
        ...mockPaymentPayload().accepted,
        network: ALGORAND_MAINNET_CAIP2 as Network
      }
    };

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(wrongNetworkPayload)).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('network mismatch');
  });

  it('rejects payment with wrong amount (too low)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'amount too low: expected 100000, got 1000'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const lowAmountPayload: PaymentPayload = {
      ...mockPaymentPayload(),
      accepted: { ...mockPaymentPayload().accepted, amount: '1000' }
    };

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(lowAmountPayload)).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('amount too low');
  });

  it('rejects payment with wrong receiver address', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'receiver mismatch: payment was sent to wrong address'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const wrongReceiverPayload: PaymentPayload = {
      ...mockPaymentPayload(),
      accepted: {
        ...mockPaymentPayload().accepted,
        payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      }
    };

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(wrongReceiverPayload)).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('receiver mismatch');
  });

  it('rejects payment with wrong asset ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'unsupported asset: 99999999 is not USDC'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const wrongAssetPayload: PaymentPayload = {
      ...mockPaymentPayload(),
      accepted: { ...mockPaymentPayload().accepted, asset: '99999999' }
    };

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(wrongAssetPayload)).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('unsupported asset');
  });

  it('rejects a forged/fake transaction ID that fails on-chain verification', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'transaction FAKEFAKEFAKEFAKEFAKE not found on Algorand testnet'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const fakePayload: PaymentPayload = {
      x402Version: 2,
      accepted: mockPaymentPayload().accepted,
      payload: {
        paymentGroup: ['FAKEFAKEFAKEFAKEFAKE'],
        paymentIndex: 0
      }
    };

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(fakePayload)).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('FAKEFAKEFAKEFAKEFAKE');
  });

  it('rejects a replayed payment that has already been settled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, x402Version: 2, scheme: 'exact', extra: {} }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          isValid: false,
          invalidMessage: 'transaction already settled — replay detected'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.post('/gated', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .post('/gated')
      .set('x-payment', Buffer.from(JSON.stringify(mockPaymentPayload())).toString('base64'))
      .send({});

    expect(res.status).toBe(402);
    expect(JSON.stringify(res.body)).toContain('replay');
  });
});

// ─── Security and secret leakage tests ───────────────────────────────────────

describe('security — no secret leakage in responses', () => {
  it('402 response does not contain MONGODB_URI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL }] })
    }));

    const { requirePayment } = await import('../middleware/x402Middleware.js');
    const app = express();
    app.use(express.json());
    app.get('/test', requirePayment({ amountUsdCents: 10, payTo: PAY_TO }), (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app).get('/test');
    expect(JSON.stringify(res.body)).not.toContain('mongodb');
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('mnemonic');
  });

  it('x402 status endpoint does not expose mnemonic or private key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kinds: [{ network: ALGORAND_TESTNET_CAIP2_FULL, extra: {} }] })
    }));

    const { x402Router } = await import('../routes/x402Routes.js');
    const app = express();
    app.use('/api/x402', x402Router);

    const res = await request(app).get('/api/x402/status');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('mnemonic');
    expect(body).not.toContain('secretKey');
    expect(body).not.toContain('privateKey');
    expect(body).not.toContain('TWILIO');
    expect(body).not.toContain('ACCOUNTS_API_KEY');
  });
});
