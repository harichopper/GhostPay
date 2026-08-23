/**
 * algorandService.ts
 *
 * All Algorand blockchain interactions for GhostPay.
 *
 * Exports:
 *   getNetworkInfo()          — static network/contract config
 *   getSignerAddress()        — server signer address (if configured)
 *   getPaymentParams()        — live params for offline tx construction
 *   getAccountBalance()       — ALGO balance
 *   getAccountAssets()        — ALGO + ASA holdings
 *   getAccountTransactions()  — recent txns via indexer
 *   decodeAndValidateSinglePayTxn()  — validate a client-signed pay txn
 *   decodeAndValidateGroupTxns()     — validate a client-signed pay+app group
 *   sendAlgoPayment()         — the main payment dispatcher
 *
 * Payment modes (sendAlgoPayment):
 *   1. Demo mode      — fake txId, only when env.allowDemoMode=true
 *   2. Client-signed group — signedGroupTxnsBase64: [payB64, appCallB64]
 *   3. Client-signed single — signedTxnBase64: payB64
 *   4. Server-signed  — backend builds, signs, and submits
 */

import algosdk from 'algosdk';
import { env } from '../config/env.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getAlgodClient() {
  return new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
}

function buildExplorerUrl(txId: string): string {
  return `${env.explorerTxBaseUrl}${txId}`;
}

function readNumericField(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  return fallback;
}

function microToAlgo(value: number): number {
  return value / 1_000_000;
}

function makeErr(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type AccountAsset = {
  assetId: number;
  name: string;
  unitName: string;
  amount: number;
  decimals: number;
  isAlgo: boolean;
};

/**
 * Safe, client-consumable Algorand transaction parameters for offline
 * transaction construction.
 *
 * Validity window: params are valid for (lastValidRound - firstValidRound)
 * rounds. On Algorand testnet each round is ~3.9 s, so a 1000-round window
 * is ~65 minutes. Clients MUST re-fetch before the window expires.
 *
 * genesisHashB64: base64-encoded genesis hash.
 * Use Buffer.from(genesisHashB64, 'base64') to get the Uint8Array algosdk needs.
 */
export type PaymentParams = {
  network: string;
  genesisId: string;
  genesisHashB64: string;
  firstValidRound: number;
  lastValidRound: number;
  minFee: number;
  contractAppId: number;
  contractEnabled: boolean;
  validityWindowRounds: number;
  fetchedAt: string;
};

// ─── Network / config ─────────────────────────────────────────────────────────

export function getNetworkInfo() {
  return {
    network: env.algorandNetwork,
    explorerTxBaseUrl: env.explorerTxBaseUrl,
    demoModeAllowed: env.allowDemoMode,
    contractAppId: env.contractAppId,
    contractEnabled: env.contractAppId > 0
  };
}

export function getSignerAddress(): string {
  if (!env.signerMnemonic) return '';
  return algosdk.mnemonicToSecretKey(env.signerMnemonic).addr.toString();
}

// ─── Payment params (offline support) ────────────────────────────────────────

export async function getPaymentParams(): Promise<PaymentParams> {
  const algod = getAlgodClient();
  const params = await algod.getTransactionParams().do();

  const firstValid = Number(params.firstValid ?? 0);
  const lastValid = Number(params.lastValid ?? 0);

  // algosdk v3 SuggestedParamsFromAlgod has minFee as bigint
  const minFee = Number((params as unknown as { minFee?: bigint | number }).minFee ?? 1_000);

  const genesisHashBytes: Uint8Array =
    params.genesisHash instanceof Uint8Array
      ? params.genesisHash
      : new Uint8Array(Buffer.from(String(params.genesisHash), 'base64'));

  return {
    network: env.algorandNetwork,
    genesisId: params.genesisID,
    genesisHashB64: Buffer.from(genesisHashBytes).toString('base64'),
    firstValidRound: firstValid,
    lastValidRound: lastValid,
    minFee,
    contractAppId: env.contractAppId,
    contractEnabled: env.contractAppId > 0,
    validityWindowRounds: lastValid - firstValid,
    fetchedAt: new Date().toISOString()
  };
}

// ─── Account data ─────────────────────────────────────────────────────────────

export async function getAccountBalance(address: string): Promise<number> {
  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do();
  return Number(accountInfo.amount) / 1_000_000;
}

export async function getAccountTransactions(address: string) {
  const indexerBaseUrl =
    env.algorandNetwork === 'mainnet'
      ? 'https://mainnet-idx.algonode.cloud'
      : 'https://testnet-idx.algonode.cloud';

  try {
    const res = await fetch(`${indexerBaseUrl}/v2/accounts/${address}/transactions?limit=35`);
    if (!res.ok) return [];

    const data = (await res.json()) as { transactions?: unknown[] };
    const rawTxs = data.transactions ?? [];

    return rawTxs.map((tx: unknown) => {
      const t = tx as Record<string, unknown>;
      const payDets = (t['payment-transaction'] as Record<string, unknown>) ?? {};
      const amountMicro = (payDets['amount'] as number) || (t['fee'] as number) || 0;
      const sender = (t['sender'] as string) || '';
      const receiver = (payDets['receiver'] as string) || sender;
      return {
        id: (t['id'] as string) || `tx-${Date.now()}`,
        sender,
        receiver,
        amount: amountMicro / 1_000_000,
        timestamp: t['round-time']
          ? new Date((t['round-time'] as number) * 1000).toISOString()
          : new Date().toISOString(),
        status: 'confirmed',
        txHash: t['id'] as string,
        explorerUrl: `${env.explorerTxBaseUrl}${t['id']}`,
        network: env.algorandNetwork
      };
    });
  } catch {
    return [];
  }
}

export async function getAccountAssets(address: string): Promise<AccountAsset[]> {
  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do() as {
    amount?: unknown;
    assets?: Array<{ amount?: unknown; 'asset-id'?: unknown }>;
  };

  const algoAmountMicro = readNumericField(accountInfo.amount, 0);
  const algoAsset: AccountAsset = {
    assetId: 0,
    name: 'Algorand',
    unitName: 'ALGO',
    amount: microToAlgo(algoAmountMicro),
    decimals: 6,
    isAlgo: true
  };

  const holdings = accountInfo.assets ?? [];
  const asaAssets = await Promise.all(
    holdings.map(async (holding) => {
      const assetId = readNumericField(holding['asset-id'], -1);
      if (assetId < 0) return null;

      const holdingAmountRaw = readNumericField(holding.amount, 0);
      let unitName = `ASA-${assetId}`;
      let name = `Asset ${assetId}`;
      let decimals = 0;

      try {
        const meta = await algod.getAssetByID(assetId).do() as {
          params?: { name?: unknown; 'unit-name'?: unknown; decimals?: unknown };
        };
        const p = meta.params;
        if (p) {
          if (typeof p.name === 'string' && p.name.trim()) name = p.name;
          if (typeof p['unit-name'] === 'string' && p['unit-name'].trim()) unitName = p['unit-name'];
          decimals = readNumericField(p.decimals, 0);
        }
      } catch {
        // asset metadata fetch failed — use defaults
      }

      return {
        assetId,
        name,
        unitName,
        amount: holdingAmountRaw / 10 ** Math.max(decimals, 0),
        decimals,
        isAlgo: false
      } satisfies AccountAsset;
    })
  );

  return [algoAsset, ...(asaAssets.filter(Boolean) as AccountAsset[])];
}

// ─── Transaction validation helpers ──────────────────────────────────────────

/**
 * Decode and validate a client-signed single payment transaction.
 * Verifies: type, sender, receiver, amount, note, genesis hash, expiry.
 * Throws a coded Error on any validation failure — never resigns.
 */
export function decodeAndValidateSinglePayTxn(
  signedTxnBase64: string,
  expected: {
    sender: string;
    receiver: string;
    amountAlgo: number;
    timestamp: string;
    genesisHashB64?: string;
    currentRound?: number;
  }
): { signedBytes: Uint8Array; txId: string } {
  let signedBytes: Uint8Array;
  try {
    signedBytes = Uint8Array.from(Buffer.from(signedTxnBase64, 'base64'));
  } catch {
    throw makeErr('signedTxnBase64 is not valid base64', 'TXN_INVALID');
  }

  let decoded: ReturnType<typeof algosdk.decodeSignedTransaction>;
  try {
    decoded = algosdk.decodeSignedTransaction(signedBytes);
  } catch {
    throw makeErr('signedTxnBase64 could not be decoded as a signed Algorand transaction', 'TXN_INVALID');
  }

  const txn = decoded.txn as algosdk.Transaction & {
    payment?: { receiver: { toString(): string }; amount: bigint | number };
  };

  if (txn.type !== algosdk.TransactionType.pay || !txn.payment) {
    throw makeErr('Signed transaction must be a payment (pay) transaction', 'TXN_WRONG_TYPE');
  }

  const signedSender = txn.sender.toString();
  if (signedSender !== expected.sender) {
    throw makeErr(
      `Transaction sender ${signedSender} does not match expected sender ${expected.sender}`,
      'TXN_WRONG_SENDER'
    );
  }

  const signedReceiver = txn.payment.receiver.toString();
  if (signedReceiver !== expected.receiver) {
    throw makeErr(
      `Transaction receiver ${signedReceiver} does not match expected receiver ${expected.receiver}`,
      'TXN_WRONG_RECEIVER'
    );
  }

  const signedAmountMicro = Number(txn.payment.amount);
  const expectedAmountMicro = Math.round(expected.amountAlgo * 1_000_000);
  if (Math.abs(signedAmountMicro - expectedAmountMicro) > 1) {
    throw makeErr(
      `Transaction amount ${signedAmountMicro} µALGO does not match expected ${expectedAmountMicro} µALGO`,
      'TXN_WRONG_AMOUNT'
    );
  }

  const noteText = txn.note?.length ? Buffer.from(txn.note).toString('utf-8') : '';
  if (!noteText.startsWith(`GhostPay:${expected.timestamp}`)) {
    throw makeErr('Transaction note does not match expected GhostPay timestamp marker', 'TXN_WRONG_NOTE');
  }

  if (expected.genesisHashB64 && txn.genesisHash) {
    const txnGenB64 = Buffer.from(txn.genesisHash).toString('base64');
    if (txnGenB64 !== expected.genesisHashB64) {
      throw makeErr(
        'Transaction genesis hash does not match this network — transaction was built for a different network',
        'TXN_WRONG_NETWORK'
      );
    }
  }

  if (expected.currentRound !== undefined && txn.lastValid) {
    const lastValid = Number(txn.lastValid);
    if (lastValid > 0 && expected.currentRound > lastValid) {
      throw makeErr(
        `Transaction has expired (lastValid=${lastValid}, currentRound=${expected.currentRound})`,
        'TXN_EXPIRED'
      );
    }
  }

  const txId = typeof txn.txID === 'function' ? txn.txID() : '';
  return { signedBytes, txId };
}

/**
 * Decode and validate a client-signed atomic group: [payTxn, appCallTxn].
 * Verifies: count=2, order, group ID match, types, sender, receiver,
 * amount, note, app ID, app args, genesis hash, expiry.
 * Throws a coded Error on any validation failure — never resigns.
 */
export function decodeAndValidateGroupTxns(
  signedGroupTxnsBase64: string[],
  expected: {
    sender: string;
    receiver: string;
    amountAlgo: number;
    timestamp: string;
    contractAppId: number;
    genesisHashB64?: string;
    currentRound?: number;
  }
): { combinedBytes: Uint8Array; payTxId: string } {
  if (!Array.isArray(signedGroupTxnsBase64) || signedGroupTxnsBase64.length !== 2) {
    throw makeErr(
      'signedGroupTxnsBase64 must be an array of exactly 2 signed transactions [payTxn, appCallTxn]',
      'TXN_GROUP_INVALID'
    );
  }

  let payBytes: Uint8Array;
  let appBytes: Uint8Array;
  try {
    payBytes = Uint8Array.from(Buffer.from(signedGroupTxnsBase64[0], 'base64'));
    appBytes = Uint8Array.from(Buffer.from(signedGroupTxnsBase64[1], 'base64'));
  } catch {
    throw makeErr('One or more signedGroupTxnsBase64 entries are not valid base64', 'TXN_INVALID');
  }

  let decodedPay: ReturnType<typeof algosdk.decodeSignedTransaction>;
  let decodedApp: ReturnType<typeof algosdk.decodeSignedTransaction>;
  try {
    decodedPay = algosdk.decodeSignedTransaction(payBytes);
    decodedApp = algosdk.decodeSignedTransaction(appBytes);
  } catch {
    throw makeErr('One or more transactions could not be decoded as signed Algorand transactions', 'TXN_INVALID');
  }

  const payTxn = decodedPay.txn as algosdk.Transaction & {
    payment?: { receiver: { toString(): string }; amount: bigint | number };
    applicationCall?: { appIndex?: bigint | number; appArgs?: Uint8Array[] };
  };
  const appTxn = decodedApp.txn as algosdk.Transaction & {
    applicationCall?: { appIndex?: bigint | number; appArgs?: Uint8Array[]; accounts?: Array<{ publicKey: Uint8Array }> };
  };

  // Type checks
  if (payTxn.type !== algosdk.TransactionType.pay) {
    throw makeErr('First transaction in group must be a payment (pay) transaction', 'TXN_WRONG_TYPE');
  }
  if (appTxn.type !== algosdk.TransactionType.appl) {
    throw makeErr('Second transaction in group must be an application call (appl) transaction', 'TXN_WRONG_TYPE');
  }

  // Group ID — both must have the same non-empty group
  if (!payTxn.group || !appTxn.group) {
    throw makeErr(
      'Both transactions must have a group ID assigned (call algosdk.assignGroupID before signing)',
      'TXN_GROUP_INVALID'
    );
  }
  if (Buffer.from(payTxn.group).toString('hex') !== Buffer.from(appTxn.group).toString('hex')) {
    throw makeErr('Group ID mismatch between payment and app-call transactions', 'TXN_GROUP_INVALID');
  }

  // Sender — both transactions must come from the declared sender
  const paySender = payTxn.sender.toString();
  const appSender = appTxn.sender.toString();
  if (paySender !== expected.sender) {
    throw makeErr(`Payment sender ${paySender} does not match expected sender ${expected.sender}`, 'TXN_WRONG_SENDER');
  }
  if (appSender !== expected.sender) {
    throw makeErr(`App-call sender ${appSender} does not match expected sender ${expected.sender}`, 'TXN_WRONG_SENDER');
  }

  // Receiver
  if (!payTxn.payment) {
    throw makeErr('Payment transaction is missing payment details', 'TXN_WRONG_TYPE');
  }
  const signedReceiver = payTxn.payment.receiver.toString();
  if (signedReceiver !== expected.receiver) {
    throw makeErr(
      `Payment receiver ${signedReceiver} does not match expected receiver ${expected.receiver}`,
      'TXN_WRONG_RECEIVER'
    );
  }

  // Amount
  const signedAmountMicro = Number(payTxn.payment.amount);
  const expectedAmountMicro = Math.round(expected.amountAlgo * 1_000_000);
  if (Math.abs(signedAmountMicro - expectedAmountMicro) > 1) {
    throw makeErr(
      `Payment amount ${signedAmountMicro} µALGO does not match expected ${expectedAmountMicro} µALGO`,
      'TXN_WRONG_AMOUNT'
    );
  }

  // Note
  const noteText = payTxn.note?.length ? Buffer.from(payTxn.note).toString('utf-8') : '';
  if (!noteText.startsWith(`GhostPay:${expected.timestamp}`)) {
    throw makeErr('Payment transaction note does not match expected GhostPay timestamp marker', 'TXN_WRONG_NOTE');
  }

  // App ID
  const txnAppId = Number(appTxn.applicationCall?.appIndex ?? 0);
  if (txnAppId !== expected.contractAppId) {
    throw makeErr(
      `App-call targets app ID ${txnAppId} but expected ${expected.contractAppId}`,
      'TXN_WRONG_APP_ID'
    );
  }

  // App args: [record, timestamp, amount_uint64]
  const appArgs = appTxn.applicationCall?.appArgs;
  if (!appArgs || appArgs.length !== 3) {
    throw makeErr('App-call must have exactly 3 arguments: ["record", timestamp, amount_uint64]', 'TXN_WRONG_APP_ARGS');
  }
  const arg0 = new TextDecoder().decode(appArgs[0]);
  if (arg0 !== 'record') {
    throw makeErr(`App-call arg[0] must be "record", got "${arg0}"`, 'TXN_WRONG_APP_ARGS');
  }
  const arg1 = new TextDecoder().decode(appArgs[1]);
  if (arg1 !== expected.timestamp) {
    throw makeErr(
      `App-call arg[1] (timestamp) "${arg1}" does not match expected "${expected.timestamp}"`,
      'TXN_WRONG_APP_ARGS'
    );
  }
  const arg2Amount = Number(algosdk.decodeUint64(appArgs[2], 'safe'));
  if (Math.abs(arg2Amount - expectedAmountMicro) > 1) {
    throw makeErr(
      `App-call arg[2] (amount) ${arg2Amount} µALGO does not match expected ${expectedAmountMicro} µALGO`,
      'TXN_WRONG_APP_ARGS'
    );
  }

  // Genesis hash — wrong-network protection
  if (expected.genesisHashB64) {
    for (const txn of [payTxn, appTxn]) {
      if (txn.genesisHash) {
        const txnGenB64 = Buffer.from(txn.genesisHash).toString('base64');
        if (txnGenB64 !== expected.genesisHashB64) {
          throw makeErr(
            'Transaction genesis hash does not match this network — group was built for a different network',
            'TXN_WRONG_NETWORK'
          );
        }
      }
    }
  }

  // Round expiry
  if (expected.currentRound !== undefined) {
    for (const txn of [payTxn, appTxn]) {
      if (txn.lastValid) {
        const lastValid = Number(txn.lastValid);
        if (lastValid > 0 && expected.currentRound > lastValid) {
          throw makeErr(
            `Transaction has expired (lastValid=${lastValid}, currentRound=${expected.currentRound})`,
            'TXN_EXPIRED'
          );
        }
      }
    }
  }

  const combinedBytes = new Uint8Array(payBytes.length + appBytes.length);
  combinedBytes.set(payBytes, 0);
  combinedBytes.set(appBytes, payBytes.length);

  const payTxId = typeof payTxn.txID === 'function' ? payTxn.txID() : '';
  return { combinedBytes, payTxId };
}

// ─── sendAlgoPayment ─────────────────────────────────────────────────────────

export async function sendAlgoPayment(input: {
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  signedTxnBase64?: string;
  signedGroupTxnsBase64?: string[];
  demoMode?: boolean;
}): Promise<{
  txId: string;
  confirmedRound?: number;
  explorerUrl: string;
  network: string;
  contractVerified: boolean;
}> {

  // ── 1. Demo mode ────────────────────────────────────────────────────────────
  if (input.demoMode) {
    if (!env.allowDemoMode) {
      throw makeErr('Demo mode is disabled for this backend environment', 'DEMO_DISABLED');
    }
    const txId = `DEMO-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
    return { txId, explorerUrl: buildExplorerUrl(txId), network: env.algorandNetwork, contractVerified: false };
  }

  const algod = getAlgodClient();

  // Fetch live params once — used for genesis hash validation and round check
  const liveParams = await algod.getTransactionParams().do();
  const currentRound = Number(liveParams.firstValid ?? 0);
  const genesisHashBytes: Uint8Array =
    liveParams.genesisHash instanceof Uint8Array
      ? liveParams.genesisHash
      : new Uint8Array(Buffer.from(String(liveParams.genesisHash), 'base64'));
  const genesisHashB64 = Buffer.from(genesisHashBytes).toString('base64');

  // ── 2. Client-signed atomic group (contract mode) ───────────────────────────
  if (input.signedGroupTxnsBase64) {
    if (env.contractAppId <= 0) {
      throw makeErr(
        'signedGroupTxnsBase64 provided but contract is not configured (GHOSTPAY_CONTRACT_APP_ID=0)',
        'CONTRACT_NOT_CONFIGURED'
      );
    }

    const { combinedBytes, payTxId } = decodeAndValidateGroupTxns(input.signedGroupTxnsBase64, {
      sender: input.sender,
      receiver: input.receiver,
      amountAlgo: input.amount,
      timestamp: input.timestamp,
      contractAppId: env.contractAppId,
      genesisHashB64,
      currentRound
    });

    const broadcastResult = await algod.sendRawTransaction(combinedBytes).do();
    const confirmation = await algosdk.waitForConfirmation(algod, broadcastResult.txid, env.confirmationRounds);
    const txId = payTxId || broadcastResult.txid;
    return {
      txId,
      confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
      explorerUrl: buildExplorerUrl(txId),
      network: env.algorandNetwork,
      contractVerified: true
    };
  }

  // ── 3. Client-signed single payment ─────────────────────────────────────────
  if (input.signedTxnBase64 && input.signedTxnBase64.trim().length > 0) {
    // Contract enforcement: if enabled, client MUST use the group path
    if (env.contractAppId > 0 && env.enforceContract) {
      throw makeErr(
        'Contract enforcement is enabled. Submit both signed transactions via signedGroupTxnsBase64: [payTxnBase64, appCallTxnBase64].',
        'CONTRACT_REQUIRED'
      );
    }

    const { signedBytes, txId } = decodeAndValidateSinglePayTxn(input.signedTxnBase64, {
      sender: input.sender,
      receiver: input.receiver,
      amountAlgo: input.amount,
      timestamp: input.timestamp,
      genesisHashB64,
      currentRound
    });

    const broadcastResult = await algod.sendRawTransaction(signedBytes).do();
    const confirmation = await algosdk.waitForConfirmation(algod, broadcastResult.txid, env.confirmationRounds);
    const finalTxId = txId || broadcastResult.txid;
    return {
      txId: finalTxId,
      confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
      explorerUrl: buildExplorerUrl(finalTxId),
      network: env.algorandNetwork,
      contractVerified: false
    };
  }

  // ── 4. Server-signed ────────────────────────────────────────────────────────
  if (!env.signerMnemonic) {
    throw makeErr(
      'Server signer mnemonic is missing. Set ALGORAND_SENDER_MNEMONIC in backend/.env',
      'SIGNER_NOT_CONFIGURED'
    );
  }

  const account = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const senderAddress = account.addr.toString();

  const accountInfo = await algod.accountInformation(senderAddress).do();
  const params = liveParams;

  const accountAmountMicro = readNumericField((accountInfo as { amount?: unknown }).amount, 0);
  const minBalanceMicro = readNumericField((accountInfo as { 'min-balance'?: unknown })['min-balance'], 100_000);
  const networkFeeMicro = readNumericField((params as unknown as { fee?: unknown }).fee, 1_000);
  const minFeeMicro = readNumericField((params as unknown as { minFee?: unknown }).minFee, 1_000);
  const feeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

  const paymentAmountMicro = Number(algosdk.algosToMicroalgos(input.amount));
  const requiredMicro = paymentAmountMicro + feeMicro;
  const spendableMicro = Math.max(accountAmountMicro - minBalanceMicro, 0);

  if (requiredMicro > spendableMicro) {
    throw makeErr(
      `Insufficient funds. Spendable: ${microToAlgo(spendableMicro).toFixed(6)} ALGO, required: ${microToAlgo(requiredMicro).toFixed(6)} ALGO`,
      'INSUFFICIENT_FUNDS'
    );
  }

  const note = new TextEncoder().encode(`GhostPay:${input.timestamp}`);
  const txFeeMicro = Math.max(feeMicro, 1_000);

  if (env.enforceContract && env.contractAppId <= 0) {
    throw makeErr(
      'Contract enforcement is enabled, but GHOSTPAY_CONTRACT_APP_ID is not configured',
      'CONTRACT_NOT_CONFIGURED'
    );
  }

  if (env.contractAppId > 0) {
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: input.receiver,
      amount: paymentAmountMicro,
      note,
      suggestedParams: { ...params, fee: BigInt(txFeeMicro), flatFee: true }
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: senderAddress,
      appIndex: BigInt(env.contractAppId),
      appArgs: [
        new TextEncoder().encode('record'),
        new TextEncoder().encode(input.timestamp),
        algosdk.encodeUint64(paymentAmountMicro)
      ],
      accounts: [input.receiver],
      suggestedParams: { ...params, fee: BigInt(txFeeMicro), flatFee: true }
    });

    algosdk.assignGroupID([paymentTxn, appCallTxn]);

    const signedGroup = [paymentTxn.signTxn(account.sk), appCallTxn.signTxn(account.sk)];
    const broadcastResult = await algod.sendRawTransaction(signedGroup).do();
    const confirmation = await algosdk.waitForConfirmation(algod, broadcastResult.txid, env.confirmationRounds);
    const paymentTxId = paymentTxn.txID();
    return {
      txId: paymentTxId,
      confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
      explorerUrl: buildExplorerUrl(paymentTxId),
      network: env.algorandNetwork,
      contractVerified: true
    };
  }

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: input.receiver,
    amount: paymentAmountMicro,
    note,
    suggestedParams: { ...params, fee: BigInt(txFeeMicro), flatFee: true }
  });

  const signedTxn = txn.signTxn(account.sk);
  const broadcastResult = await algod.sendRawTransaction(signedTxn).do();
  const confirmation = await algosdk.waitForConfirmation(algod, broadcastResult.txid, env.confirmationRounds);
  return {
    txId: broadcastResult.txid,
    confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
    explorerUrl: buildExplorerUrl(broadcastResult.txid),
    network: env.algorandNetwork,
    contractVerified: false
  };
}
