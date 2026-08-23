/**
 * securityRoutes.ts
 *
 * GhostPay x402-gated wallet risk / security analysis API.
 *
 * Routes:
 *   POST /api/security/wallet-risk   — x402-gated: AI-agent wallet risk analysis
 *   GET  /api/security/status        — public: security service status
 *
 * The x402 flow for POST /api/security/wallet-risk:
 *   1. AI agent calls without X-PAYMENT  → HTTP 402 + PaymentRequired
 *   2. Agent builds USDC payment via @x402/avm ExactAvmScheme
 *   3. Agent retries with X-PAYMENT: <base64 PaymentPayload>
 *   4. Backend calls GoPlausible /verify → /settle
 *   5. On success: risk analysis runs → 200 + X-PAYMENT-RESPONSE header
 *
 * Payment: $0.10 USDC (ASA 10458941) on Algorand Testnet
 * Facilitator: https://facilitator.goplausible.xyz
 *
 * This endpoint provides REAL VALUE to AI agents:
 *   - On-chain transaction history analysis
 *   - Account age / activity scoring
 *   - Blacklist / threat intelligence check
 *   - Balance adequacy check
 *   - Risk score + recommendation
 */

import { Router, type Request, type Response } from 'express';
import algosdk from 'algosdk';
import { requirePayment, type X402Request } from '../middleware/x402Middleware.js';
import {
  buildPaymentRequired,
  getAlgorandCaip2,
  GOPLAUSIBLE_FACILITATOR_URL,
  USDC_ASA_ID
} from '../services/x402Service.js';
import { analyseWalletRisk } from '../services/securityService.js';
import { getSignerAddress } from '../services/algorandService.js';
import { env } from '../config/env.js';

export const securityRouter = Router();

/** $0.10 USDC per analysis — hackathon-safe price */
const RISK_ANALYSIS_PRICE_USD_CENTS = 10;

function getPayToAddress(): string {
  return env.x402PayTo || getSignerAddress();
}

// ─── GET /api/security/status ─────────────────────────────────────────────────

/**
 * Public status endpoint — returns security service configuration.
 * No payment required. Use to discover payment requirements before calling
 * the gated analysis endpoint.
 */
securityRouter.get('/status', async (_request: Request, response: Response) => {
  try {
    const payTo = getPayToAddress();
    const network = getAlgorandCaip2();

    let facilitatorOnline = false;
    let feePayer: string | undefined;
    try {
      const r = await fetch(`${GOPLAUSIBLE_FACILITATOR_URL}/supported`, {
        signal: AbortSignal.timeout(5_000)
      });
      if (r.ok) {
        facilitatorOnline = true;
        const data = await r.json() as { kinds?: Array<{ network: string; extra?: { feePayer?: string } }> };
        const kind = data.kinds?.find(k => k.network === network);
        feePayer = kind?.extra?.feePayer;
      }
    } catch {
      // non-fatal
    }

    response.json({
      service: 'GhostPay Security Analysis',
      version: '1.0.0',
      x402Version: 2,
      scheme: 'exact',
      network,
      asset: USDC_ASA_ID,
      assetSymbol: 'USDC',
      assetDecimals: 6,
      paymentAmountUsd: (RISK_ANALYSIS_PRICE_USD_CENTS / 100).toFixed(2),
      payTo,
      facilitator: GOPLAUSIBLE_FACILITATOR_URL,
      facilitatorOnline,
      feePayer: feePayer ?? null,
      endpoints: [
        {
          method: 'POST',
          path: '/api/security/wallet-risk',
          description: 'AI-agent wallet risk analysis — pays $0.10 USDC for on-chain risk scoring',
          x402Required: true
        }
      ]
    });
  } catch (err) {
    response.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to fetch security status'
    });
  }
});

// ─── GET /api/security/payment-required ──────────────────────────────────────

/**
 * Returns the raw PaymentRequired object for /api/security/wallet-risk.
 * Public endpoint — no payment needed. Use for pre-flight payment construction.
 */
securityRouter.get('/payment-required', async (_request: Request, response: Response) => {
  try {
    const payRequired = await buildPaymentRequired({
      amountUsdCents: RISK_ANALYSIS_PRICE_USD_CENTS,
      payTo: getPayToAddress(),
      resource: 'GhostPay Security — Wallet Risk Analysis',
      path: '/api/security/wallet-risk'
    });
    response.json(payRequired);
  } catch (err) {
    response.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to build payment requirements'
    });
  }
});

// ─── POST /api/security/wallet-risk — x402-gated ─────────────────────────────

/**
 * x402-gated wallet risk analysis.
 *
 * Request body:
 *   { "sender": "<Algorand address>", "receiver": "<Algorand address>", "amount": 0.01 }
 *
 * X-PAYMENT header:
 *   Base64-encoded x402 v2 PaymentPayload (USDC transfer built with @x402/avm)
 *
 * Without X-PAYMENT → HTTP 402 with PaymentRequired JSON
 * With valid payment  → HTTP 200 with risk analysis + X-PAYMENT-RESPONSE header
 */
securityRouter.post(
  '/wallet-risk',
  requirePayment({
    amountUsdCents: RISK_ANALYSIS_PRICE_USD_CENTS,
    payTo: getPayToAddress(),
    resource: 'GhostPay Security — Wallet Risk Analysis',
    path: '/api/security/wallet-risk'
  }),
  async (request: Request, response: Response): Promise<void> => {
    try {
      const { sender, receiver, amount } = request.body as {
        sender?: unknown;
        receiver?: unknown;
        amount?: unknown;
      };

      // Validate required fields
      if (typeof sender !== 'string' || !sender.trim()) {
        response.status(400).json({ error: 'sender is required (Algorand address)' });
        return;
      }
      if (typeof receiver !== 'string' || !receiver.trim()) {
        response.status(400).json({ error: 'receiver is required (Algorand address)' });
        return;
      }
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        response.status(400).json({ error: 'amount must be a positive number (ALGO)' });
        return;
      }

      // Validate addresses up-front for a clean error message
      if (!algosdk.isValidAddress(sender.trim())) {
        response.status(400).json({ error: 'sender is not a valid Algorand address' });
        return;
      }
      if (!algosdk.isValidAddress(receiver.trim())) {
        response.status(400).json({ error: 'receiver is not a valid Algorand address' });
        return;
      }

      // x402 settlement info attached by requirePayment middleware
      const x402 = (request as X402Request).x402!;

      const result = await analyseWalletRisk(
        { sender: sender.trim(), receiver: receiver.trim(), amount },
        { txId: x402.txId, network: x402.network, settledAt: x402.settledAt }
      );

      response.json(result);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'INVALID_ADDRESS' || code === 'INVALID_AMOUNT') {
        response.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
      } else {
        response.status(500).json({
          error: err instanceof Error ? err.message : 'Risk analysis failed'
        });
      }
    }
  }
);
