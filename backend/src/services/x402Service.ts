/**
 * x402Service.ts
 *
 * Core x402 payment protocol service for GhostPay.
 *
 * Uses @x402/avm (ExactAvmScheme) and @x402/core v2 types with the
 * GoPlausible facilitator for verify + settle on Algorand Testnet USDC.
 *
 * Reference: https://facilitator.goplausible.xyz/supported
 */

import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from '@x402/avm';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import type { Network, PaymentPayload, PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { env } from '../config/env.js';

export const GOPLAUSIBLE_FACILITATOR_URL = env.x402FacilitatorUrl;

const avmServerScheme = new ExactAvmScheme();

/**
 * Full CAIP-2 network identifiers for Algorand.
 *
 * NOTE: The ALGORAND_TESTNET_CAIP2 / ALGORAND_MAINNET_CAIP2 constants
 * exported by @x402/avm@2.23.0 are truncated (41 chars instead of 53).
 * We use the correct full strings that GoPlausible's /supported endpoint
 * returns, verified against the genesis hash of each network.
 */
export const ALGORAND_TESTNET_CAIP2_FULL = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=' as Network;
export const ALGORAND_MAINNET_CAIP2_FULL = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=' as Network;

/** Re-export for test compatibility */
export { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from '@x402/avm';

/** CAIP-2 network identifier for the configured Algorand network (full, correct string) */
export function getAlgorandCaip2(): Network {
  return env.algorandNetwork === 'mainnet' ? ALGORAND_MAINNET_CAIP2_FULL : ALGORAND_TESTNET_CAIP2_FULL;
}

/**
 * USDC ASA IDs by network.
 * Testnet: 10458941
 * Mainnet: 31566704
 */
export const USDC_ASA_ID = env.algorandNetwork === 'mainnet' ? '31566704' : '10458941';

export type PaymentRequiredOptions = {
  /** Amount in USD cents — e.g., 10 = $0.10 */
  amountUsdCents: number;
  /** Algorand address that receives the payment */
  payTo: string;
  /** Human-readable description of what is being paid for */
  resource?: string;
  /** Path being protected, e.g. "/api/x402/pay" */
  path?: string;
};

export type X402PaymentRequired = PaymentRequired;

type SupportedKind = {
  x402Version: number;
  scheme: string;
  network: string;
  extra?: { feePayer?: string };
};

async function fetchSupportedKind(network: string): Promise<SupportedKind | undefined> {
  try {
    const res = await fetch(`${GOPLAUSIBLE_FACILITATOR_URL}/supported`, {
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { kinds?: SupportedKind[] };
    return data.kinds?.find(k => k.network === network);
  } catch {
    return undefined;
  }
}

/**
 * Builds the x402 v2 PaymentRequired object for a 402 response.
 */
export async function buildPaymentRequired(opts: PaymentRequiredOptions): Promise<X402PaymentRequired> {
  const network = getAlgorandCaip2();
  const path = opts.path ?? '/api/x402/pay';
  const description = opts.resource ?? 'GhostPay x402 payment';
  const amountUsd = (opts.amountUsdCents / 100).toFixed(2);

  const assetAmount = await avmServerScheme.parsePrice(amountUsd, network);

  let requirements: PaymentRequirements = {
    scheme: 'exact',
    network,
    asset: assetAmount.asset,
    amount: assetAmount.amount,
    payTo: opts.payTo,
    maxTimeoutSeconds: 60,
    extra: {
      ...(assetAmount.extra ?? {}),
      // Global x402 Challenge attribution tag
      tag: 'x402-global-challenge'
    }
  };

  const supportedKind = await fetchSupportedKind(network);
  if (supportedKind) {
    requirements = await avmServerScheme.enhancePaymentRequirements(
      requirements,
      { ...supportedKind, network: supportedKind.network as Network },
      []
    );
  }

  // Ensure the challenge tag survives enhancement (feePayer from facilitator is preserved too)
  requirements = {
    ...requirements,
    extra: {
      ...(requirements.extra ?? {}),
      tag: 'x402-global-challenge'
    }
  };

  return {
    x402Version: 2,
    resource: {
      url: path,
      description,
      mimeType: 'application/json'
    },
    accepts: [requirements]
  };
}

export type FacilitatorVerifyResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Calls GoPlausible facilitator /verify with a full x402 v2 PaymentPayload.
 */
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequired: X402PaymentRequired
): Promise<FacilitatorVerifyResult> {
  const requirements = paymentRequired.accepts[0];
  if (!requirements) {
    return { valid: false, error: 'No payment requirements available' };
  }

  const body = {
    x402Version: paymentRequired.x402Version,
    paymentPayload,
    paymentRequirements: requirements
  };

  let res: Response;
  try {
    res = await fetch(`${GOPLAUSIBLE_FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
  } catch (e) {
    return {
      valid: false,
      error: `Facilitator unreachable: ${e instanceof Error ? e.message : 'network error'}`
    };
  }

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  const d = data as Record<string, unknown>;

  if (!res.ok || d['isValid'] === false) {
    return {
      valid: false,
      error: String(
        d['invalidReason'] ?? d['invalidMessage'] ?? d['error'] ??
        d['message'] ?? d['reason'] ?? `HTTP ${res.status}`
      )
    };
  }

  return { valid: true };
}

export type FacilitatorSettleResult =
  | { success: true; txId: string; network: string }
  | { success: false; error: string };

/**
 * Calls GoPlausible facilitator /settle with a full x402 v2 PaymentPayload.
 * Must only be called after a successful /verify.
 */
export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequired: X402PaymentRequired
): Promise<FacilitatorSettleResult> {
  const requirements = paymentRequired.accepts[0];
  if (!requirements) {
    return { success: false, error: 'No payment requirements available' };
  }

  const body = {
    x402Version: paymentRequired.x402Version,
    paymentPayload,
    paymentRequirements: requirements
  };

  let res: Response;
  try {
    res = await fetch(`${GOPLAUSIBLE_FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (e) {
    return {
      success: false,
      error: `Facilitator unreachable: ${e instanceof Error ? e.message : 'network error'}`
    };
  }

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  const d = data as Record<string, unknown>;

  if (!res.ok || d['success'] === false) {
    return {
      success: false,
      error: String(
        d['errorMessage'] ?? d['error'] ?? d['message'] ?? d['reason'] ?? `HTTP ${res.status}`
      )
    };
  }

  const txId = String(
    d['transaction'] ?? d['txId'] ?? d['txHash'] ??
    (d['result'] as Record<string, unknown> | undefined)?.['txId'] ??
    'confirmed'
  );

  return {
    success: true,
    txId,
    network: requirements.network
  };
}
