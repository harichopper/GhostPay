/**
 * x402Routes.ts
 *
 * x402 payment-gated endpoints for GhostPay.
 *
 * Routes:
 *   GET  /api/x402/status          — public: x402 config info + facilitator status
 *   POST /api/x402/pay             — x402-gated: send ALGO payment after USDC micropayment
 *   GET  /api/x402/pay             — x402-gated: premium payment params (offline tx params + contract info)
 *
 * The x402 flow for every gated route:
 *   1. Client calls without X-PAYMENT → receives HTTP 402 + PaymentRequired JSON
 *   2. Client builds USDC transfer using @x402/avm ExactAvmScheme
 *   3. Client retries with base64-encoded PaymentPayload in X-PAYMENT header
 *   4. Backend calls GoPlausible /verify → /settle
 *   5. On success: respond 200 + X-PAYMENT-RESPONSE header with txId
 */

import { Router } from 'express';
import { requirePayment, type X402Request } from '../middleware/x402Middleware.js';
import {
  buildPaymentRequired,
  getAlgorandCaip2,
  GOPLAUSIBLE_FACILITATOR_URL,
  USDC_ASA_ID
} from '../services/x402Service.js';
import { getPaymentParams, getSignerAddress, sendAlgoPayment } from '../services/algorandService.js';
import { env } from '../config/env.js';

export const x402Router = Router();

// ─── The payTo address is the GhostPay signer wallet ─────────────────────────
// In production this should be a dedicated treasury wallet.
function getPayToAddress(): string {
  if (env.x402PayTo) return env.x402PayTo;
  return getSignerAddress();
}

// ─── GET /api/x402/status ─────────────────────────────────────────────────────

/**
 * Public status endpoint — returns x402 configuration and facilitator info.
 * No payment required.
 */
x402Router.get('/status', async (_request, response) => {
  try {
    const payTo = getPayToAddress();
    const network = getAlgorandCaip2();

    // Fetch facilitator supported kinds
    let facilitatorOnline = false;
    let feePayer: string | undefined;
    try {
      const r = await fetch(`${GOPLAUSIBLE_FACILITATOR_URL}/supported`, {
        signal: AbortSignal.timeout(5_000)
      });
      if (r.ok) {
        facilitatorOnline = true;
        const data = (await r.json()) as {
          kinds: Array<{ network: string; extra?: { feePayer?: string } }>;
        };
        const kind = data.kinds?.find(k => k.network === network);
        feePayer = kind?.extra?.feePayer;
      }
    } catch {
      // facilitator offline — non-fatal for status endpoint
    }

    response.json({
      x402Version: 2,
      scheme: 'exact',
      network,
      asset: USDC_ASA_ID,
      assetSymbol: 'USDC',
      assetDecimals: 6,
      payTo,
      facilitator: GOPLAUSIBLE_FACILITATOR_URL,
      facilitatorOnline,
      feePayer: feePayer ?? null,
      contractAppId: env.contractAppId,
      contractEnabled: env.contractAppId > 0,
      gatedEndpoints: [
        { method: 'POST', path: '/api/x402/pay', amountUsd: 0.10, description: 'Send ALGO via GhostPay (x402 gated)' },
        { method: 'GET',  path: '/api/x402/pay', amountUsd: 0.10, description: 'Get premium Algorand tx params (x402 gated)' }
      ]
    });
  } catch (err) {
    response.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to fetch x402 status'
    });
  }
});

// ─── GET /api/x402/payment-required ──────────────────────────────────────────

/**
 * Returns the raw PaymentRequired object for the /api/x402/pay endpoint.
 * Useful for clients that want to pre-build the payment before calling the gated route.
 */
x402Router.get('/payment-required', async (_request, response) => {
  try {
    const payRequired = await buildPaymentRequired({
      amountUsdCents: 10,
      payTo: getPayToAddress(),
      resource: 'GhostPay x402 — Premium Algorand Payment Service',
      path: '/api/x402/pay'
    });
    response.json(payRequired);
  } catch (err) {
    response.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to build payment requirements'
    });
  }
});

// ─── POST /api/x402/pay — x402-gated payment endpoint ────────────────────────

/**
 * x402-gated ALGO payment endpoint.
 *
 * Pay $0.10 USDC via GoPlausible facilitator → receive the ability to send
 * a GhostPay ALGO payment in the same request.
 *
 * Request body: same as POST /api/algorand/send (server-signed mode)
 * X-PAYMENT header: base64-encoded ExactAvmPayloadV2 (USDC transfer)
 *
 * Response: GhostPay payment result + X-PAYMENT-RESPONSE header
 */
x402Router.post(
  '/pay',
  requirePayment({
    amountUsdCents: 10,
    payTo: getPayToAddress(),
    resource: 'GhostPay x402 — Send ALGO Payment',
    path: '/api/x402/pay'
  }),
  async (request, response) => {
    try {
      const {
        sender,
        receiver,
        amount,
        timestamp,
        signedTxnBase64,
        signedGroupTxnsBase64
      } = request.body as {
        sender?: string;
        receiver?: string;
        amount?: number;
        timestamp?: string;
        signedTxnBase64?: string;
        signedGroupTxnsBase64?: string[];
      };

      if (!sender || !receiver || !amount || !timestamp) {
        response.status(400).json({
          error: 'sender, receiver, amount and timestamp are required'
        });
        return;
      }

      const result = await sendAlgoPayment({
        sender,
        receiver,
        amount,
        timestamp,
        signedTxnBase64,
        signedGroupTxnsBase64
      });

      // x402 settlement info is already on the X-PAYMENT-RESPONSE header
      const x402 = (request as X402Request).x402;

      response.json({
        ...result,
        x402: {
          settled: true,
          usdcTxId: x402?.txId,
          network: x402?.network,
          settledAt: x402?.settledAt
        }
      });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      response.status(500).json({
        error: err instanceof Error ? err.message : 'Payment failed',
        ...(code ? { code } : {})
      });
    }
  }
);

// ─── GET /api/x402/pay — x402-gated premium params endpoint ──────────────────

/**
 * x402-gated premium transaction parameters endpoint.
 *
 * Pay $0.10 USDC via GoPlausible facilitator → receive Algorand transaction
 * parameters enriched with GhostPay contract info and recommended fees.
 *
 * X-PAYMENT header: base64-encoded ExactAvmPayloadV2 (USDC transfer)
 * Response: PaymentParams + x402 settlement details + X-PAYMENT-RESPONSE header
 */
x402Router.get(
  '/pay',
  requirePayment({
    amountUsdCents: 10,
    payTo: getPayToAddress(),
    resource: 'GhostPay x402 — Premium Transaction Parameters',
    path: '/api/x402/pay'
  }),
  async (request, response) => {
    try {
      const params = await getPaymentParams();
      const x402 = (request as X402Request).x402;

      response.json({
        ...params,
        x402: {
          settled: true,
          usdcTxId: x402?.txId,
          network: x402?.network,
          settledAt: x402?.settledAt
        }
      });
    } catch (err) {
      response.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to fetch params'
      });
    }
  }
);
