/**
 * x402Middleware.ts
 *
 * Express middleware that enforces x402 payment on any protected route.
 *
 * Flow:
 *   1. No X-PAYMENT header → respond 402 with PaymentRequired JSON
 *   2. X-PAYMENT header present → decode PaymentPayload, call GoPlausible /verify
 *   3. Verify fails → respond 402 with error
 *   4. Verify passes → call GoPlausible /settle
 *   5. Settle fails → respond 402 with error
 *   6. Settle succeeds → set X-PAYMENT-RESPONSE header, call next()
 *
 * The X-PAYMENT header value is a base64-encoded JSON PaymentPayload (x402 v2).
 * The X-PAYMENT-RESPONSE header value is a base64-encoded JSON SettleResponse.
 */

import type { PaymentPayload } from '@x402/core/types';
import type { NextFunction, Request, Response } from 'express';
import {
  buildPaymentRequired,
  settlePayment,
  verifyPayment,
  type PaymentRequiredOptions,
  type X402PaymentRequired
} from '../services/x402Service.js';

export const X_PAYMENT_HEADER = 'x-payment';
export const X_PAYMENT_RESPONSE_HEADER = 'x-payment-response';

export type X402Settlement = {
  success: true;
  txId: string;
  network: string;
  settledAt: string;
};

export type X402Request = Request & { x402?: X402Settlement };

function decodePaymentHeader(headerValue: string | undefined): PaymentPayload | null {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as PaymentPayload;
    if (parsed?.x402Version !== 2 || !parsed.accepted || !parsed.payload) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function encodePaymentResponse(data: unknown): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function requirePayment(opts: PaymentRequiredOptions) {
  return async function x402Gate(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {

    const rawPaymentHeader = request.headers[X_PAYMENT_HEADER];
    const paymentHeader = Array.isArray(rawPaymentHeader)
      ? rawPaymentHeader[0]
      : rawPaymentHeader;

    let paymentRequired: X402PaymentRequired;
    try {
      paymentRequired = await buildPaymentRequired({
        ...opts,
        path: opts.path ?? request.path
      });
    } catch (err) {
      response.status(503).json({
        error: 'Unable to build payment requirements',
        detail: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    if (!paymentHeader) {
      response
        .status(402)
        .header('Cache-Control', 'no-store')
        .json(paymentRequired);
      return;
    }

    const paymentPayload = decodePaymentHeader(paymentHeader);
    if (!paymentPayload) {
      response
        .status(402)
        .header('Cache-Control', 'no-store')
        .json({
          ...paymentRequired,
          error: 'X-PAYMENT header must be base64-encoded x402 v2 PaymentPayload JSON'
        });
      return;
    }

    const verifyResult = await verifyPayment(paymentPayload, paymentRequired);
    if (!verifyResult.valid) {
      response
        .status(402)
        .header('Cache-Control', 'no-store')
        .json({
          ...paymentRequired,
          error: `Payment verification failed: ${verifyResult.error}`
        });
      return;
    }

    const settleResult = await settlePayment(paymentPayload, paymentRequired);
    if (!settleResult.success) {
      response
        .status(402)
        .header('Cache-Control', 'no-store')
        .json({
          ...paymentRequired,
          error: `Payment settlement failed: ${settleResult.error}`
        });
      return;
    }

    const paymentResponse: X402Settlement = {
      success: true,
      txId: settleResult.txId,
      network: settleResult.network,
      settledAt: new Date().toISOString()
    };

    response.setHeader(
      X_PAYMENT_RESPONSE_HEADER,
      encodePaymentResponse(paymentResponse)
    );

    (request as X402Request).x402 = paymentResponse;

    next();
  };
}
