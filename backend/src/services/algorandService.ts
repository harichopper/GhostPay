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

    const noteText = txn.note?.length ? Buffer.from(txn.note).toString('utf-8') : '';
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
