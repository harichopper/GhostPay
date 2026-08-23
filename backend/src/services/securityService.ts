/**
 * securityService.ts
 *
 * GhostPay wallet risk analysis service.
 *
 * Provides AI-agent-ready transaction pre-flight security analysis:
 *   - On-chain activity checks (tx history, age, volume)
 *   - Balance adequacy check
 *   - Blacklist / known-bad-actor list
 *   - Receiver trust scoring
 *   - Risk score aggregation and recommendation
 *
 * This is the valuable resource sold behind the x402 payment gate.
 * AI agents pay $0.10 USDC per analysis via the GoPlausible facilitator.
 */

import algosdk from 'algosdk';
import { env } from '../config/env.js';

// ─── Known high-risk / blacklisted addresses ─────────────────────────────────
// In production these would come from a threat-intelligence feed or database.
const BLACKLISTED_ADDRESSES = new Set<string>([
  // Placeholder known-bad Algorand testnet addresses (for demo)
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
]);

// ─── Risk levels ─────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Recommendation = 'SAFE_TO_PROCEED' | 'PROCEED_WITH_CAUTION' | 'REVIEW_BEFORE_PROCEEDING' | 'BLOCK';

export type RiskFlag = {
  code: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
};

export type WalletRiskResult = {
  success: true;
  analysedAt: string;
  sender: {
    address: string;
    risk: RiskLevel;
    score: number;
    flags: RiskFlag[];
    algoBalance: number;
    transactionCount: number;
    accountAgeEstimate: 'new' | 'recent' | 'established' | 'veteran';
  };
  receiver: {
    address: string;
    risk: RiskLevel;
    score: number;
    flags: RiskFlag[];
    algoBalance: number;
    transactionCount: number;
    accountAgeEstimate: 'new' | 'recent' | 'established' | 'veteran';
  };
  transaction: {
    amountAlgo: number;
    senderHasSufficientFunds: boolean;
    estimatedFeeAlgo: number;
  };
  overall: {
    risk: RiskLevel;
    score: number;
    recommendation: Recommendation;
    reason: string;
  };
  payment: {
    verified: true;
    txId: string;
    network: string;
    settledAt: string;
  };
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getAlgodClient() {
  return new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
}

type AccountOnChainData = {
  balance: number;
  txCount: number;
  ageEstimate: 'new' | 'recent' | 'established' | 'veteran';
  exists: boolean;
};

async function fetchAccountData(address: string): Promise<AccountOnChainData> {
  try {
    const algod = getAlgodClient();
    const info = await algod.accountInformation(address).do() as {
      amount?: unknown;
      'total-created-assets'?: unknown;
      round?: unknown;
    };

    const balance = Number(info.amount ?? 0) / 1_000_000;

    // Estimate tx count from the indexer
    let txCount = 0;
    try {
      const idxBase = env.algorandNetwork === 'mainnet'
        ? 'https://mainnet-idx.algonode.cloud'
        : 'https://testnet-idx.algonode.cloud';
      const r = await fetch(
        `${idxBase}/v2/accounts/${address}/transactions?limit=1`,
        { signal: AbortSignal.timeout(4_000) }
      );
      if (r.ok) {
        const d = await r.json() as { 'current-round'?: number; transactions?: unknown[] };
        // Use current round minus first-seen as a proxy for account age
        // Without min-round, we can approximate activity via balance + assets
        txCount = typeof d['current-round'] === 'number' ? Math.min(d['current-round'], 999) : 0;
        // actual tx count approximation: accounts with 0-10 = new, 11-100 = recent etc.
        const txList = d.transactions ?? [];
        if (txList.length === 0) {
          txCount = 0;
        } else {
          // Fetch a broader count
          const r2 = await fetch(
            `${idxBase}/v2/accounts/${address}/transactions?limit=100`,
            { signal: AbortSignal.timeout(4_000) }
          );
          if (r2.ok) {
            const d2 = await r2.json() as { transactions?: unknown[] };
            txCount = (d2.transactions ?? []).length;
          } else {
            txCount = 1;
          }
        }
      }
    } catch {
      txCount = 0;
    }

    let ageEstimate: AccountOnChainData['ageEstimate'];
    if (txCount === 0) ageEstimate = 'new';
    else if (txCount < 10) ageEstimate = 'recent';
    else if (txCount < 50) ageEstimate = 'established';
    else ageEstimate = 'veteran';

    return { balance, txCount, ageEstimate, exists: true };
  } catch {
    // Account not found or node error — treat as new/empty
    return { balance: 0, txCount: 0, ageEstimate: 'new', exists: false };
  }
}

function scoreAddress(
  address: string,
  data: AccountOnChainData
): { score: number; flags: RiskFlag[] } {
  let score = 0;
  const flags: RiskFlag[] = [];

  // Blacklist check
  if (BLACKLISTED_ADDRESSES.has(address)) {
    score += 80;
    flags.push({ code: 'BLACKLISTED', severity: 'critical', message: 'Address appears on known threat list' });
  }

  // Never-active account
  if (!data.exists || data.txCount === 0) {
    score += 15;
    flags.push({ code: 'NO_HISTORY', severity: 'warn', message: 'Address has no on-chain transaction history' });
  }

  // Very new account (1-9 transactions)
  if (data.txCount > 0 && data.txCount < 10) {
    score += 10;
    flags.push({ code: 'NEW_ACCOUNT', severity: 'info', message: 'Account has limited transaction history' });
  }

  // Zero balance
  if (data.balance === 0) {
    score += 10;
    flags.push({ code: 'ZERO_BALANCE', severity: 'warn', message: 'Account holds no ALGO' });
  }

  // Dust balance (< 0.1 ALGO) — possible burner/disposable
  if (data.balance > 0 && data.balance < 0.1) {
    score += 5;
    flags.push({ code: 'DUST_BALANCE', severity: 'info', message: 'Account holds minimal ALGO (possible disposable address)' });
  }

  return { score: Math.min(score, 100), flags };
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

function toRecommendation(overallScore: number, hasBlacklist: boolean): Recommendation {
  if (hasBlacklist || overallScore >= 70) return 'BLOCK';
  if (overallScore >= 40) return 'REVIEW_BEFORE_PROCEEDING';
  if (overallScore >= 20) return 'PROCEED_WITH_CAUTION';
  return 'SAFE_TO_PROCEED';
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type WalletRiskInput = {
  sender: string;
  receiver: string;
  amount: number;
};

export async function analyseWalletRisk(
  input: WalletRiskInput,
  payment: { txId: string; network: string; settledAt: string }
): Promise<WalletRiskResult> {

  if (!algosdk.isValidAddress(input.sender)) {
    throw Object.assign(new Error('sender is not a valid Algorand address'), { code: 'INVALID_ADDRESS' });
  }
  if (!algosdk.isValidAddress(input.receiver)) {
    throw Object.assign(new Error('receiver is not a valid Algorand address'), { code: 'INVALID_ADDRESS' });
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error('amount must be a positive number'), { code: 'INVALID_AMOUNT' });
  }

  // Fetch on-chain data for both addresses in parallel
  const [senderData, receiverData] = await Promise.all([
    fetchAccountData(input.sender),
    fetchAccountData(input.receiver)
  ]);

  const senderScore = scoreAddress(input.sender, senderData);
  const receiverScore = scoreAddress(input.receiver, receiverData);

  // Transaction-level check: sufficient funds?
  const estimatedFee = 0.001; // 1000 µALGO minimum fee
  const senderHasSufficientFunds = senderData.balance >= input.amount + estimatedFee + 0.1; // 0.1 ALGO min balance

  if (!senderHasSufficientFunds) {
    senderScore.score += 15;
    senderScore.flags.push({
      code: 'INSUFFICIENT_FUNDS',
      severity: 'warn',
      message: `Sender balance (${senderData.balance.toFixed(6)} ALGO) may be insufficient for ${input.amount} ALGO + fees`
    });
  }

  const overallScore = Math.round((senderScore.score * 0.6) + (receiverScore.score * 0.4));
  const hasBlacklist = senderScore.flags.some(f => f.code === 'BLACKLISTED') ||
                       receiverScore.flags.some(f => f.code === 'BLACKLISTED');
  const recommendation = toRecommendation(overallScore, hasBlacklist);

  let reason: string;
  switch (recommendation) {
    case 'SAFE_TO_PROCEED':
      reason = 'Both addresses have acceptable on-chain history and no threat indicators.';
      break;
    case 'PROCEED_WITH_CAUTION':
      reason = 'Minor risk indicators detected. Review flags before proceeding.';
      break;
    case 'REVIEW_BEFORE_PROCEEDING':
      reason = 'Significant risk indicators present. Manual review recommended.';
      break;
    case 'BLOCK':
      reason = hasBlacklist
        ? 'One or more addresses appear on known threat lists. Transaction blocked.'
        : 'Risk score exceeds acceptable threshold. Transaction not recommended.';
      break;
  }

  return {
    success: true,
    analysedAt: new Date().toISOString(),
    sender: {
      address: input.sender,
      risk: toRiskLevel(senderScore.score),
      score: senderScore.score,
      flags: senderScore.flags,
      algoBalance: senderData.balance,
      transactionCount: senderData.txCount,
      accountAgeEstimate: senderData.ageEstimate
    },
    receiver: {
      address: input.receiver,
      risk: toRiskLevel(receiverScore.score),
      score: receiverScore.score,
      flags: receiverScore.flags,
      algoBalance: receiverData.balance,
      transactionCount: receiverData.txCount,
      accountAgeEstimate: receiverData.ageEstimate
    },
    transaction: {
      amountAlgo: input.amount,
      senderHasSufficientFunds,
      estimatedFeeAlgo: estimatedFee
    },
    overall: {
      risk: toRiskLevel(overallScore),
      score: overallScore,
      recommendation,
      reason
    },
    payment: {
      verified: true,
      txId: payment.txId,
      network: payment.network,
      settledAt: payment.settledAt
    }
  };
}
