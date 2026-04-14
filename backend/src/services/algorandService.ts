import algosdk from 'algosdk';
import { env } from '../config/env.js';

function getAlgodClient() {
  return new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
}

function buildExplorerUrl(txId: string): string {
  return `${env.explorerTxBaseUrl}${txId}`;
}

function readNumericField(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return fallback;
}

function microToAlgo(value: number): number {
  return value / 1_000_000;
}

async function resolveAssetIdFromPendingInfo(
  algod: algosdk.Algodv2,
  txId: string,
  maxAdditionalRounds = 4
): Promise<number | undefined> {
  let status = await algod.status().do() as { ['last-round']?: unknown };
  let lastRound = readNumericField(status['last-round'], 0);

  for (let i = 0; i < maxAdditionalRounds; i += 1) {
    const pending = await algod.pendingTransactionInformation(txId).do() as { ['asset-index']?: unknown };
    const assetId = readNumericField(pending['asset-index'], 0);
    if (assetId > 0) {
      return assetId;
    }

    await algod.statusAfterBlock(lastRound + 1).do();
    status = await algod.status().do() as { ['last-round']?: unknown };
    lastRound = readNumericField(status['last-round'], lastRound + 1);
  }

  return undefined;
}

export type AccountAsset = {
  assetId: number;
  name: string;
  unitName: string;
  amount: number;
  decimals: number;
  isAlgo: boolean;
};

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
  if (!env.signerMnemonic) {
    return '';
  }

  return algosdk.mnemonicToSecretKey(env.signerMnemonic).addr.toString();
}

export async function getAccountBalance(address: string): Promise<number> {
  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do();
  return Number(accountInfo.amount) / 1_000_000;
}

export async function getAccountAssets(address: string): Promise<AccountAsset[]> {
  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do() as {
    amount?: unknown;
    assets?: Array<{ amount?: unknown; ['asset-id']?: unknown }>;
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
      if (assetId < 0) {
        return null;
      }

      const holdingAmountRaw = readNumericField(holding.amount, 0);
      let unitName = `ASA-${assetId}`;
      let name = `Asset ${assetId}`;
      let decimals = 0;

      try {
        const meta = await algod.getAssetByID(assetId).do() as {
          params?: {
            name?: unknown;
            ['unit-name']?: unknown;
            decimals?: unknown;
          };
        };

        const params = meta.params;
        if (params) {
          if (typeof params.name === 'string' && params.name.trim()) {
            name = params.name;
          }

          if (typeof params['unit-name'] === 'string' && params['unit-name'].trim()) {
            unitName = params['unit-name'];
          }

          decimals = readNumericField(params.decimals, 0);
        }
      } catch {
        // If asset metadata fetch fails, still return raw holding.
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

  const normalizedAssets = asaAssets.filter((item) => item !== null) as AccountAsset[];
  return [algoAsset, ...normalizedAssets];
}

export async function mintDemoAsset(input?: {
  assetName?: string;
  unitName?: string;
  total?: number;
  decimals?: number;
  assetUrl?: string;
}): Promise<{ txId: string; assetId: number; creator: string; explorerUrl: string; network: string }> {
  if (!env.signerMnemonic) {
    throw new Error('Server signer mnemonic is missing. Set ALGORAND_SENDER_MNEMONIC in backend/.env');
  }

  if (env.algorandNetwork === 'mainnet') {
    throw new Error('Mint endpoint is restricted to testnet for safety');
  }

  const assetName = input?.assetName?.trim() || 'GhostPay Token';
  const unitName = input?.unitName?.trim() || 'GHOST';
  const total = Number.isFinite(input?.total) ? Math.floor(input!.total as number) : 1_000_000;
  const decimals = Number.isFinite(input?.decimals) ? Math.floor(input!.decimals as number) : 2;
  const assetUrl = input?.assetUrl?.trim() || 'https://ghostpay.app/token';

  if (total <= 0) {
    throw new Error('Asset total must be positive');
  }

  if (decimals < 0 || decimals > 19) {
    throw new Error('Asset decimals must be between 0 and 19');
  }

  const account = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const creator = account.addr.toString();
  const algod = getAlgodClient();
  const params = await algod.getTransactionParams().do();
  const networkFeeMicro = readNumericField((params as { fee?: unknown; minFee?: unknown }).fee, 1_000);
  const minFeeMicro = readNumericField((params as { minFee?: unknown }).minFee, 1_000);
  const txFeeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creator,
    total: BigInt(total),
    decimals,
    defaultFrozen: false,
    unitName,
    assetName,
    assetURL: assetUrl,
    manager: creator,
    reserve: creator,
    freeze: creator,
    clawback: creator,
    suggestedParams: {
      ...params,
      fee: BigInt(txFeeMicro),
      flatFee: true
    }
  });

  const signed = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const confirmation = await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);
  const confirmedAssetId = readNumericField((confirmation as { ['asset-index']?: unknown })['asset-index'], 0);
  const resolvedAssetId = confirmedAssetId > 0
    ? confirmedAssetId
    : await resolveAssetIdFromPendingInfo(algod, response.txid);

  return {
    txId: response.txid,
    assetId: resolvedAssetId ?? 0,
    creator,
    explorerUrl: buildExplorerUrl(response.txid),
    network: env.algorandNetwork
  };
}

export async function relaySignedTransaction(input: {
  signedTxnBase64: string;
  expectedSender?: string;
  expectedType?: algosdk.TransactionType;
}): Promise<{ txId: string; confirmedRound?: number; assetId?: number; explorerUrl: string; network: string }> {
  const signedBytes = Uint8Array.from(Buffer.from(input.signedTxnBase64, 'base64'));
  const decoded = algosdk.decodeSignedTransaction(signedBytes);
  const txn = decoded.txn;

  if (input.expectedType && txn.type !== input.expectedType) {
    throw new Error(`Signed transaction type mismatch. Expected ${input.expectedType}`);
  }

  if (input.expectedSender) {
    const sender = txn.sender.toString();
    if (sender !== input.expectedSender) {
      throw new Error('Signed transaction sender does not match request sender');
    }
  }

  const algod = getAlgodClient();
  const response = await algod.sendRawTransaction(signedBytes).do();
  const confirmation = await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);
  const confirmedAssetId = readNumericField((confirmation as { ['asset-index']?: unknown })['asset-index'], 0);
  const resolvedAssetId = confirmedAssetId > 0
    ? confirmedAssetId
    : await resolveAssetIdFromPendingInfo(algod, response.txid);

  return {
    txId: response.txid,
    confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
    assetId: resolvedAssetId,
    explorerUrl: buildExplorerUrl(response.txid),
    network: env.algorandNetwork
  };
}

export async function ensureAccountHasMintFunds(address: string): Promise<void> {
  if (env.algorandNetwork === 'mainnet') {
    return;
  }

  if (!env.signerMnemonic) {
    throw new Error('Mint top-up signer is missing. Configure ALGORAND_SENDER_MNEMONIC or pre-fund the wallet before minting.');
  }

  const algod = getAlgodClient();
  let amountMicro = 0;
  try {
    const accountInfo = await algod.accountInformation(address).do() as { amount?: unknown };
    amountMicro = readNumericField(accountInfo.amount, 0);
  } catch {
    // Brand-new accounts may not exist on chain yet; treat as 0 and pre-fund.
    amountMicro = 0;
  }

  const amountAlgo = microToAlgo(amountMicro);

  // Fresh wallets need enough ALGO for fee + min balance increases from asset creation.
  const minRequiredAlgo = 0.3;
  if (amountAlgo >= minRequiredAlgo) {
    return;
  }

  const signer = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const signerAddress = signer.addr.toString();
  if (signerAddress === address) {
    return;
  }

  const topUpAlgo = Math.max(minRequiredAlgo - amountAlgo + 0.05, 0.2);
  const params = await algod.getTransactionParams().do();
  const networkFeeMicro = readNumericField((params as { fee?: unknown; minFee?: unknown }).fee, 1_000);
  const minFeeMicro = readNumericField((params as { minFee?: unknown }).minFee, 1_000);
  const txFeeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

  const topUpTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signerAddress,
    receiver: address,
    amount: Number(algosdk.algosToMicroalgos(topUpAlgo)),
    note: new TextEncoder().encode('GhostPay mint prefund'),
    suggestedParams: {
      ...params,
      fee: BigInt(txFeeMicro),
      flatFee: true
    }
  });

  const signed = topUpTxn.signTxn(signer.sk);
  const response = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);
}

export async function sendAlgoPayment(input: {
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  signedTxnBase64?: string;
  demoMode?: boolean;
}): Promise<{ txId: string; confirmedRound?: number; explorerUrl: string; network: string; contractVerified: boolean }> {
  if (input.demoMode) {
    if (!env.allowDemoMode) {
      throw new Error('Demo mode is disabled for this backend environment');
    }

    const txId = `DEMO-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
    return {
      txId,
      explorerUrl: buildExplorerUrl(txId),
      network: env.algorandNetwork,
      contractVerified: false
    };
  }

  if (input.signedTxnBase64) {
    if (env.contractAppId > 0 || env.enforceContract) {
      throw new Error('Client-signed mode currently supports direct payments only. Disable contract mode or use server signer mode.');
    }

    const signedBytes = Uint8Array.from(Buffer.from(input.signedTxnBase64, 'base64'));
    const decoded = algosdk.decodeSignedTransaction(signedBytes);
    const txn = decoded.txn;

    if (txn.type !== algosdk.TransactionType.pay || !txn.payment) {
      throw new Error('Client-signed transaction must be a payment transaction');
    }

    const signedSender = txn.sender.toString();
    const signedReceiver = txn.payment.receiver.toString();
    const signedAmountAlgo = Number(txn.payment.amount) / 1_000_000;

    if (signedSender !== input.sender) {
      throw new Error('Signed transaction sender does not match request sender');
    }

    if (signedReceiver !== input.receiver) {
      throw new Error('Signed transaction receiver does not match request receiver');
    }

    if (Math.abs(signedAmountAlgo - input.amount) > 0.000001) {
      throw new Error('Signed transaction amount does not match request amount');
    }

    const noteText = txn.note?.length ? new TextDecoder().decode(txn.note) : '';
    if (!noteText.startsWith(`GhostPay:${input.timestamp}`)) {
      throw new Error('Signed transaction note does not match expected GhostPay timestamp marker');
    }

    const algod = getAlgodClient();
    const response = await algod.sendRawTransaction(signedBytes).do();
    const confirmation = await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);

    return {
      txId: response.txid,
      confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
      explorerUrl: buildExplorerUrl(response.txid),
      network: env.algorandNetwork,
      contractVerified: false
    };
  }

  if (!env.signerMnemonic) {
    throw new Error('Server signer mnemonic is missing. Set ALGORAND_SENDER_MNEMONIC in backend/.env');
  }

  const account = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const senderAddress = account.addr.toString();

  if (input.sender !== senderAddress) {
    throw new Error(`Sender must match server signer wallet (${senderAddress})`);
  }

  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(senderAddress).do();
  const params = await algod.getTransactionParams().do();

  const accountAmountMicro = readNumericField((accountInfo as { amount?: unknown }).amount, 0);
  const minBalanceMicro = readNumericField((accountInfo as { minBalance?: unknown }).minBalance, 100_000);
  const networkFeeMicro = readNumericField((params as { fee?: unknown; minFee?: unknown }).fee, 1_000);
  const minFeeMicro = readNumericField((params as { minFee?: unknown }).minFee, 1_000);
  const feeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

  const paymentAmountMicro = Number(algosdk.algosToMicroalgos(input.amount));
  const requiredMicro = paymentAmountMicro + feeMicro;
  const spendableMicro = Math.max(accountAmountMicro - minBalanceMicro, 0);

  if (requiredMicro > spendableMicro) {
    throw new Error(
      `Insufficient funds. Spendable: ${microToAlgo(spendableMicro).toFixed(6)} ALGO, required: ${microToAlgo(requiredMicro).toFixed(6)} ALGO`
    );
  }

  const note = new TextEncoder().encode(`GhostPay:${input.timestamp}`);
  const txFeeMicro = Math.max(feeMicro, 1_000);

  if (env.enforceContract && env.contractAppId <= 0) {
    throw new Error('Contract enforcement is enabled, but GHOSTPAY_CONTRACT_APP_ID is not configured');
  }

  if (env.contractAppId > 0) {
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: input.receiver,
      amount: paymentAmountMicro,
      note,
      suggestedParams: {
        ...params,
        fee: BigInt(txFeeMicro),
        flatFee: true
      }
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: senderAddress,
      appIndex: BigInt(env.contractAppId),
      appArgs: [new TextEncoder().encode('record'), new TextEncoder().encode(input.timestamp), algosdk.encodeUint64(paymentAmountMicro)],
      accounts: [input.receiver],
      suggestedParams: {
        ...params,
        fee: BigInt(txFeeMicro),
        flatFee: true
      }
    });

    algosdk.assignGroupID([paymentTxn, appCallTxn]);

    const signedGroup = [paymentTxn.signTxn(account.sk), appCallTxn.signTxn(account.sk)];
    const response = await algod.sendRawTransaction(signedGroup).do();
    const confirmation = await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);

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
    suggestedParams: {
      ...params,
      fee: BigInt(txFeeMicro),
      flatFee: true
    }
  });

  const signedTxn = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signedTxn).do();
  const confirmation = await algosdk.waitForConfirmation(algod, response.txid, env.confirmationRounds);

  return {
    txId: response.txid,
    confirmedRound: confirmation.confirmedRound ? Number(confirmation.confirmedRound) : undefined,
    explorerUrl: buildExplorerUrl(response.txid),
    network: env.algorandNetwork,
    contractVerified: false
  };
}
