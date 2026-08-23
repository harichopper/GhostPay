/**
 * demoX402Flow.ts
 *
 * End-to-end x402 demo for hackathon judges:
 *   1. GET /api/x402/pay → HTTP 402 PaymentRequired
 *   2. Build USDC payment with @x402/avm ExactAvmScheme
 *   3. Retry with X-PAYMENT header → GoPlausible verify + settle
 *   4. Print real txId viewable on Algorand Lora
 *
 * Prerequisites:
 *   - Backend running (npm run dev) OR set API_BASE_URL
 *   - ALGORAND_SENDER_MNEMONIC set in .env
 *   - Wallet opted into USDC ASA 10458941 (npm run opt-in-usdc)
 *   - Wallet holds testnet USDC (fund via testnet faucet)
 *
 * Usage:
 *   npm run demo:x402
 */

import algosdk from 'algosdk';
import dotenv from 'dotenv';
import { ExactAvmScheme } from '@x402/avm/exact/client';
import { toClientAvmSigner } from '@x402/avm';
import type { PaymentPayload, PaymentRequired } from '@x402/core/types';
import { env } from '../config/env.js';
import { getSignerAddress } from '../services/algorandService.js';

dotenv.config();

const API_BASE = process.env.API_BASE_URL ?? `http://localhost:${env.port}`;
const LORA_BASE = 'https://lora.algokit.io/testnet/transaction/';

function encodeHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function checkUsdcBalance(address: string): Promise<number> {
  const algod = new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
  const info = await algod.accountInformation(address).do() as {
    assets?: Array<{ 'asset-id'?: bigint | number; amount?: bigint | number }>;
  };
  const usdc = (info.assets ?? []).find(a => Number(a['asset-id']) === 10458941);
  return usdc ? Number(usdc.amount ?? 0) : 0;
}

async function run() {
  if (!env.signerMnemonic) {
    throw new Error('ALGORAND_SENDER_MNEMONIC must be set in backend/.env');
  }

  const payerAddress = getSignerAddress();
  const payTo = env.x402PayTo || payerAddress;

  console.log('=== GhostPay x402 Live Demo ===');
  console.log('API:', API_BASE);
  console.log('Payer:', payerAddress);
  console.log('PayTo:', payTo);
  console.log('Facilitator:', env.x402FacilitatorUrl);
  console.log('');

  const usdcAtomic = await checkUsdcBalance(payerAddress);
  console.log(`USDC balance: ${usdcAtomic / 1_000_000} USDC (${usdcAtomic} atomic)`);
  if (usdcAtomic < 100_000) {
    console.warn('');
    console.warn('⚠️  Need at least 0.10 USDC (100000 atomic) for this demo.');
    console.warn('   Run: npm run opt-in-usdc');
    console.warn('   Then fund USDC from a testnet faucet.');
    console.warn('');
  }

  // Step 1: Request gated endpoint without payment → 402
  console.log('Step 1: GET /api/x402/pay (no X-PAYMENT) → expect 402');
  const unpaid = await fetch(`${API_BASE}/api/x402/pay`);
  if (unpaid.status !== 402) {
    throw new Error(`Expected HTTP 402, got ${unpaid.status}: ${await unpaid.text()}`);
  }
  const paymentRequired = (await unpaid.json()) as PaymentRequired;
  console.log('  ✓ Received PaymentRequired v2');
  console.log('  Resource:', paymentRequired.resource.url);
  console.log('  Amount:', paymentRequired.accepts[0]?.amount, 'USDC atomic');
  console.log('');

  const requirements = paymentRequired.accepts[0];
  if (!requirements) throw new Error('No payment requirements in 402 response');

  // Step 2: Build payment payload with @x402/avm
  console.log('Step 2: Build USDC payment with @x402/avm ExactAvmScheme');
  const acc = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const signer = toClientAvmSigner(Buffer.from(acc.sk).toString('base64'));
  const clientScheme = new ExactAvmScheme(signer, {
    algodUrl: env.algodServer,
    algodToken: env.algodToken
  });

  const payloadResult = await clientScheme.createPaymentPayload(
    paymentRequired.x402Version,
    requirements
  );

  const paymentPayload: PaymentPayload = {
    x402Version: payloadResult.x402Version,
    accepted: requirements,
    payload: payloadResult.payload,
    ...(payloadResult.extensions ? { extensions: payloadResult.extensions } : {})
  };
  console.log('  ✓ PaymentPayload built');
  console.log('  Group size:', (payloadResult.payload as { paymentGroup?: string[] }).paymentGroup?.length);
  console.log('');

  // Step 3: Retry with X-PAYMENT header
  console.log('Step 3: GET /api/x402/pay with X-PAYMENT → GoPlausible verify + settle');
  const paid = await fetch(`${API_BASE}/api/x402/pay`, {
    headers: {
      'X-PAYMENT': encodeHeader(paymentPayload),
      Accept: 'application/json'
    }
  });

  const bodyText = await paid.text();
  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { body = bodyText; }

  if (paid.status !== 200) {
    console.error('  ✗ Payment failed');
    console.error('  Status:', paid.status);
    console.error('  Body:', typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const paymentResponseHeader = paid.headers.get('x-payment-response');
  let settlement: { txId?: string; network?: string } = {};
  if (paymentResponseHeader) {
    settlement = JSON.parse(
      Buffer.from(paymentResponseHeader, 'base64').toString('utf-8')
    ) as { txId?: string; network?: string };
  }

  const responseBody = body as { x402?: { usdcTxId?: string } };
  const txId = settlement.txId ?? responseBody.x402?.usdcTxId ?? 'unknown';

  console.log('  ✓ Payment settled on Algorand Testnet');
  console.log('');
  console.log('=== RESULT ===');
  console.log('USDC settlement txId:', txId);
  console.log('Lora:', `${LORA_BASE}${txId}`);
  console.log('Network:', settlement.network ?? requirements.network);
  console.log('');
  console.log('Premium params preview:', JSON.stringify(body, null, 2).slice(0, 500), '...');
}

run().catch(err => {
  console.error('DEMO FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
