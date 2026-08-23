/**
 * demoSecurityFlow.ts
 *
 * GhostPay x402 Hackathon Judge Demo
 * ====================================
 *
 * Demonstrates the COMPLETE end-to-end x402 payment flow.
 * Runs standalone — no running server required.
 *
 * Flow (mirrors exactly what an AI-agent HTTP client would do):
 *   Step 1.  Simulate an unpaid request → build HTTP 402 PaymentRequired
 *              ↓ scheme: exact, network: Algorand Testnet, asset: USDC 10458941
 *
 *   Step 2.  Parse payment requirements
 *              ↓ amount: 100000 atomic = $0.10 USDC, feePayer from GoPlausible
 *
 *   Step 3.  Build USDC payment with @x402/avm ExactAvmScheme
 *              ↓ Signs Algorand ASA transfer offline; GoPlausible covers gas
 *
 *   Step 4.  GoPlausible /verify — validate the payment payload
 *              ↓ isValid: true
 *
 *   Step 5.  GoPlausible /settle — broadcast on-chain USDC transfer
 *              ↓ REAL Algorand Testnet transaction ID
 *
 *   Step 6.  Run GhostPay security/risk analysis
 *              ↓ HTTP 200 equivalent: full risk score + recommendation
 *
 *   Step 7.  Print Lora URL for on-chain verification
 *
 * Prerequisites:
 *   - ALGORAND_SENDER_MNEMONIC in backend/.env
 *   - Wallet opted into USDC ASA 10458941:  npm run opt-in-usdc
 *   - Wallet funded with testnet USDC (≥ 0.10):
 *       https://bank.testnet.algorand.network/
 *
 * Usage:
 *   npm run demo:x402
 *   npm run demo:security
 *
 * Asset details:
 *   Network:  Algorand Testnet
 *   Asset ID: 10458941 (USDC testnet, 6 decimals)
 *   Price:    100000 atomic = $0.10 USDC
 *   Tag:      x402-global-challenge
 */

import algosdk from 'algosdk';
import dotenv from 'dotenv';
import { ExactAvmScheme } from '@x402/avm/exact/client';
import { toClientAvmSigner } from '@x402/avm';
import type { PaymentPayload } from '@x402/core/types';

dotenv.config();

import { env } from '../config/env.js';
import { getSignerAddress } from '../services/algorandService.js';
import {
  buildPaymentRequired,
  verifyPayment,
  settlePayment
} from '../services/x402Service.js';
import { analyseWalletRisk } from '../services/securityService.js';

const LORA_BASE = 'https://lora.algokit.io/testnet/transaction/';
const USDC_ASA_TESTNET = 10458941;
const PRICE_USD_CENTS = env.x402PriceCents; // default 10 = $0.10

// ─── Helpers ─────────────────────────────────────────────────────────────────

function encodePaymentHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function checkUsdcBalance(address: string): Promise<{ usdc: number; algo: number }> {
  const algod = new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
  const info = await algod.accountInformation(address).do() as {
    amount?: unknown;
    assets?: Array<{ 'asset-id'?: bigint | number; amount?: bigint | number }>;
  };
  const algo = Number(info.amount ?? 0) / 1_000_000;
  const usdcAsset = (info.assets ?? []).find(a => Number(a['asset-id']) === USDC_ASA_TESTNET);
  const usdc = usdcAsset ? Number(usdcAsset.amount ?? 0) : 0;
  return { usdc, algo };
}

// ─── Main demo ───────────────────────────────────────────────────────────────

async function run() {
  if (!env.signerMnemonic) {
    console.error('');
    console.error('ERROR: ALGORAND_SENDER_MNEMONIC is not set in backend/.env');
    console.error('');
    console.error('Add your funded testnet mnemonic to backend/.env and run:');
    console.error('  npm run opt-in-usdc   (opt the wallet into USDC ASA 10458941)');
    console.error('  Then fund USDC at: https://bank.testnet.algorand.network/');
    process.exit(1);
  }

  const payerAddress = getSignerAddress();
  const payTo = env.x402PayTo || payerAddress;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      GhostPay x402 — End-to-End Hackathon Demo              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Payer:       ', payerAddress);
  console.log('  PayTo:       ', payTo);
  console.log('  Facilitator: ', env.x402FacilitatorUrl);
  console.log('  Network:     Algorand Testnet');
  console.log('  Asset:       USDC ASA 10458941 (testnet)');
  console.log(`  Price:       $${(PRICE_USD_CENTS / 100).toFixed(2)} USDC (${PRICE_USD_CENTS * 10000} atomic)`);
  console.log('');

  // ── Wallet balance check ────────────────────────────────────────────────────

  try {
    const balances = await checkUsdcBalance(payerAddress);
    console.log(`  ALGO balance:  ${balances.algo.toFixed(6)} ALGO`);
    console.log(`  USDC balance:  ${(balances.usdc / 1_000_000).toFixed(6)} USDC (${balances.usdc} atomic)`);
    console.log('');

    if (balances.usdc === 0 && balances.algo === 0) {
      console.warn('  ⚠️  Wallet appears empty. Steps to fund:');
      console.warn('     1. npm run opt-in-usdc');
      console.warn('     2. Get USDC at: https://bank.testnet.algorand.network/');
      console.warn('');
      console.warn('  Continuing anyway — GoPlausible covers network fees via feePayer.');
      console.warn('');
    } else if (balances.usdc < 100_000) {
      console.warn(`  ⚠️  USDC balance (${balances.usdc} atomic) < 100000 required.`);
      console.warn('     Fund USDC at: https://bank.testnet.algorand.network/');
      console.warn('');
    } else {
      console.log('  ✓ Wallet has sufficient USDC for the demo.');
      console.log('');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not fetch wallet balances:', (err as Error).message);
    console.log('');
  }

  // ─── STEP 1: Simulate unpaid request — build HTTP 402 PaymentRequired ───────

  const SENDER_ADDR = payerAddress;
  const RECEIVER_ADDR = payTo !== payerAddress
    ? payTo
    : 'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA';

  const requestBody = { sender: SENDER_ADDR, receiver: RECEIVER_ADDR, amount: 1.5 };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Request paid endpoint WITHOUT payment');
  console.log('        → Generating HTTP 402 PaymentRequired response...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const paymentRequired = await buildPaymentRequired({
    amountUsdCents: PRICE_USD_CENTS,
    payTo,
    resource: 'GhostPay Security — Wallet Risk Analysis',
    path: '/api/security/wallet-risk'
  });

  const requirements = paymentRequired.accepts[0];
  if (!requirements) {
    console.error('  ✗ No payment requirements returned by buildPaymentRequired');
    process.exit(1);
  }

  console.log('');
  console.log('  ✓ HTTP 402 Payment Required');
  console.log('  x402Version:', paymentRequired.x402Version);
  console.log('  resource:   ', paymentRequired.resource.url);
  console.log('  scheme:     ', requirements.scheme);
  console.log('  network:    ', requirements.network);
  console.log('  asset:      ', requirements.asset, '(USDC testnet ASA 10458941)');
  console.log('  amount:     ', requirements.amount, 'atomic =',
    Number(requirements.amount) / 1_000_000, 'USDC');
  console.log('  payTo:      ', requirements.payTo);
  const feePayer = (requirements.extra as Record<string, unknown>)?.feePayer ?? 'none';
  console.log('  feePayer:   ', feePayer);
  const tag = (requirements.extra as Record<string, unknown>)?.tag ?? 'none';
  console.log('  tag:        ', tag);
  console.log('');

  // ─── STEP 2: Build payment payload with @x402/avm ──────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Build USDC payment with @x402/avm ExactAvmScheme');
  console.log('        Signing Algorand ASA transfer offline...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const acc = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const signer = toClientAvmSigner(Buffer.from(acc.sk).toString('base64'));
  const clientScheme = new ExactAvmScheme(signer, {
    algodUrl: env.algodServer,
    algodToken: env.algodToken
  });

  let payloadResult: Awaited<ReturnType<typeof clientScheme.createPaymentPayload>>;
  try {
    payloadResult = await clientScheme.createPaymentPayload(
      paymentRequired.x402Version,
      requirements
    );
  } catch (err) {
    console.error('  ✗ Failed to build payment payload:', (err as Error).message);
    console.error('');
    console.error('  Common causes:');
    console.error('  - Wallet not opted into USDC ASA 10458941 → run: npm run opt-in-usdc');
    console.error('  - Insufficient USDC balance → fund at: https://bank.testnet.algorand.network/');
    console.error('  - Algod unreachable');
    process.exit(1);
  }

  const paymentPayload: PaymentPayload = {
    x402Version: payloadResult.x402Version,
    accepted: requirements,
    payload: payloadResult.payload,
    ...(payloadResult.extensions ? { extensions: payloadResult.extensions } : {})
  };

  const paymentGroup = (payloadResult.payload as { paymentGroup?: string[] }).paymentGroup ?? [];
  console.log('');
  console.log('  ✓ PaymentPayload built and signed locally');
  console.log('  Transaction group size:', paymentGroup.length,
    '(1 = single tx, 2 = with feePayer cover)');
  console.log('  X-PAYMENT header length:',
    encodePaymentHeader(paymentPayload).length, 'bytes (base64)');
  console.log('');

  // ─── STEP 3: GoPlausible /verify ────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: GoPlausible /verify — validate payment payload');
  console.log(`        POST ${env.x402FacilitatorUrl}/verify`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const verifyResult = await verifyPayment(paymentPayload, paymentRequired);

  if (!verifyResult.valid) {
    console.error('');
    console.error('  ✗ Payment verification FAILED');
    console.error('  Error:', verifyResult.error);
    console.error('');
    console.error('  Common causes:');
    console.error('  - Insufficient USDC balance (need ≥ 100000 atomic = $0.10)');
    console.error('  - Wallet not opted into USDC ASA 10458941');
    console.error('  - Transaction params expired (try again)');
    console.error('  - Replay detected (same tx already settled)');
    process.exit(1);
  }

  console.log('');
  console.log('  ✓ /verify → isValid: true');
  console.log('');

  // ─── STEP 4: GoPlausible /settle ────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: GoPlausible /settle — broadcast USDC on Algorand Testnet');
  console.log(`        POST ${env.x402FacilitatorUrl}/settle`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const settleResult = await settlePayment(paymentPayload, paymentRequired);

  if (!settleResult.success) {
    console.error('');
    console.error('  ✗ Payment settlement FAILED');
    console.error('  Error:', settleResult.error);
    process.exit(1);
  }

  const txId = settleResult.txId;
  const loraUrl = txId && txId !== 'confirmed'
    ? `${LORA_BASE}${txId}`
    : `${LORA_BASE}(awaiting-txid)`;

  console.log('');
  console.log('  ✓ /settle → SUCCESS — REAL on-chain transaction!');
  console.log('  Settlement TxId: ', txId);
  console.log('  Lora URL:        ', loraUrl);
  console.log('');

  // ─── STEP 5: GhostPay security/risk analysis ────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: Run GhostPay wallet risk analysis (HTTP 200 equivalent)');
  console.log('        On-chain account data → risk scoring → recommendation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const settledAt = new Date().toISOString();
  const riskResult = await analyseWalletRisk(
    requestBody,
    { txId, network: settleResult.network, settledAt }
  );

  // ─── FINAL RESULT ────────────────────────────────────────────────────────────

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║               ✓ DEMO COMPLETE — ALL 10 STEPS                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  ① Request paid endpoint     → POST /api/security/wallet-risk');
  console.log('  ② HTTP 402                  → Payment Required');
  console.log('  ③ x402 payment requirement  → scheme:exact, USDC, Algorand Testnet');
  console.log('  ④ Pay with Algorand USDC    → $0.10 ASA 10458941 signed offline');
  console.log('  ⑤ GoPlausible /verify       → isValid: true');
  console.log('  ⑥ GoPlausible /settle       → broadcast on Algorand Testnet');
  console.log('  ⑦ Real Algorand transaction → TxId:', txId);
  console.log('  ⑧ Lora transaction          →', loraUrl);
  console.log('  ⑨ HTTP 200                  → payment verified + risk result');
  console.log('  ⑩ GhostPay security result  → see below');
  console.log('');
  console.log('  ─── x402 Payment Settlement ────────────────────────────────');
  console.log('  Facilitator:     https://facilitator.goplausible.xyz');
  console.log('  Network:         Algorand Testnet');
  console.log('  Asset:           USDC ASA 10458941');
  console.log(`  Amount:          $${(PRICE_USD_CENTS / 100).toFixed(2)} (${PRICE_USD_CENTS * 10000} atomic)`);
  console.log('  Settlement TxId:', txId);
  console.log('  Settled At:     ', settledAt);
  console.log('');
  console.log('  ─── GhostPay Security Analysis ─────────────────────────────');
  console.log('  Sender:         ', requestBody.sender);
  console.log('  Receiver:       ', requestBody.receiver);
  console.log('  Amount (ALGO):  ', requestBody.amount);
  console.log('');
  console.log('  Overall Risk:   ', riskResult.overall.risk);
  console.log('  Risk Score:     ', riskResult.overall.score, '/ 100');
  console.log('  Recommendation: ', riskResult.overall.recommendation);
  console.log('  Reason:         ', riskResult.overall.reason);
  console.log('');
  console.log('  Sender:         ', riskResult.sender.risk,
    `(score: ${riskResult.sender.score})`, `| ${riskResult.sender.accountAgeEstimate}`);
  console.log('  Sender balance: ', riskResult.sender.algoBalance.toFixed(6), 'ALGO');
  console.log('  Receiver:       ', riskResult.receiver.risk,
    `(score: ${riskResult.receiver.score})`, `| ${riskResult.receiver.accountAgeEstimate}`);
  console.log('');

  console.log('  ─── Verify on Algorand Lora ────────────────────────────────');
  console.log('');
  console.log('  Open this URL in your browser to confirm the on-chain payment:');
  console.log('');
  console.log('  ', loraUrl);
  console.log('');

  if (!txId || txId === 'confirmed') {
    console.warn('  ⚠️  The facilitator settled but did not return a txId.');
    console.warn('     Check the GoPlausible leaderboard for your wallet:');
    console.warn('     https://facilitator.goplausible.xyz/dashboard/leaderboards');
    console.warn('');
  }

  console.log('  ─── Full JSON result ───────────────────────────────────────');
  const jsonStr = JSON.stringify(riskResult, null, 2);
  console.log(jsonStr.length > 3000 ? jsonStr.slice(0, 3000) + '\n  ... (truncated)' : jsonStr);
  console.log('');
}

run().catch(err => {
  console.error('');
  console.error('DEMO FAILED:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 5).join('\n'));
  }
  console.error('');
  process.exit(1);
});
