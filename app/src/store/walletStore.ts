import algosdk from 'algosdk';
import { Buffer } from 'buffer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fetchBalanceFromApi, fetchNetworkInfo, sendTransactionToAlgorand } from '../services/api';
import { platformStorage } from '../storage/platformStorage';
import { loadWalletSecretKey } from '../storage/walletSecretStorage';
import type { GhostTransaction } from '../types/transaction';

const ALGO_TX_FEE_BUFFER = 0.001;
const ALGO_MIN_BALANCE_RESERVE = 0.1;
const ALGONODE_MAINNET = 'https://mainnet-api.algonode.cloud';
const ALGONODE_TESTNET = 'https://testnet-api.algonode.cloud';

type DemoMode = {
  simulateOffline: boolean;
  simulateSyncSuccess: boolean;
};

export type LocalWalletItem = {
  address: string;
  label: string;
  addedAt: string;
};

function upsertWallet(list: LocalWalletItem[], address: string, label?: string): LocalWalletItem[] {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return list;
  }

  const existing = list.find((item) => item.address === normalizedAddress);
  if (existing) {
    if (!label || existing.label === label) {
      return list;
    }

    return list.map((item) => (item.address === normalizedAddress ? { ...item, label } : item));
  }

  return [
    ...list,
    {
      address: normalizedAddress,
      label: label?.trim() || `Wallet ${list.length + 1}`,
      addedAt: new Date().toISOString()
    }
  ];
}

type WalletState = {
  walletAddress: string;
  wallets: LocalWalletItem[];
  algorandNetwork: 'testnet' | 'mainnet' | 'unknown';
  explorerTxBaseUrl: string;
  demoModeAllowed: boolean;
  contractEnabled: boolean;
  contractAppId: number;
  balanceAlgo: number | null;
  lastBalanceRefreshAt: string | null;
  isConnected: boolean;
  isSyncing: boolean;
  transactions: GhostTransaction[];
  demoMode: DemoMode;
  hydrateSampleData: () => void;
  loadNetworkInfo: () => Promise<void>;
  setWalletAddress: (address: string) => void;
  addWallet: (address: string, label?: string) => void;
  removeWallet: (address: string) => void;
  generateWalletAddress: () => string;
  setConnectionStatus: (isConnected: boolean) => void;
  toggleDemoOffline: () => void;
  toggleDemoSyncSuccess: () => void;
  enqueueOfflinePayment: (receiver: string, amount: number) => Promise<GhostTransaction>;
  syncPendingTransactions: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

function getAlgodServer(network: 'testnet' | 'mainnet' | 'unknown'): string {
  return network === 'mainnet' ? ALGONODE_MAINNET : ALGONODE_TESTNET;
}

async function signPaymentTransactionLocally(input: {
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  network: 'testnet' | 'mainnet' | 'unknown';
  secretKey: Uint8Array;
}): Promise<string> {
  const signerAddress = algosdk.encodeAddress(input.secretKey.slice(32));
  if (signerAddress !== input.sender) {
    throw new Error(`Local wallet key mismatch. Expected ${input.sender}, got ${signerAddress}`);
  }

  const algod = new algosdk.Algodv2('', getAlgodServer(input.network), '');
  const params = await algod.getTransactionParams().do();
  const networkFeeMicro = typeof params.fee === 'bigint' ? Number(params.fee) : Number(params.fee ?? 1_000);
  const minFeeMicro = typeof params.minFee === 'bigint' ? Number(params.minFee) : Number(params.minFee ?? 1_000);
  const txFeeMicro = Math.max(networkFeeMicro, minFeeMicro, 1_000);

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: input.sender,
    receiver: input.receiver,
    amount: Number(algosdk.algosToMicroalgos(input.amount)),
    note: new TextEncoder().encode(`GhostPay:${input.timestamp}`),
    suggestedParams: {
      ...params,
      fee: BigInt(txFeeMicro),
      flatFee: true
    }
  });

  const signed = txn.signTxn(input.secretKey);
  return Buffer.from(signed).toString('base64');
}

function withUpdatedTransaction(
  transactions: GhostTransaction[],
  transactionId: string,
  updates: Partial<GhostTransaction>
): GhostTransaction[] {
  return transactions.map((tx) => (tx.id === transactionId ? { ...tx, ...updates } : tx));
}

function getEffectiveOnline(isConnected: boolean, demoMode: DemoMode): boolean {
  return isConnected && !demoMode.simulateOffline;
}

function calculateCommittedOutgoing(
  transactions: GhostTransaction[],
  walletAddress: string,
  lastBalanceRefreshAt: string | null
): number {
  const relevant = transactions.filter((tx) => {
    if (tx.sender !== walletAddress) {
      return false;
    }

    if (tx.status === 'pending' || tx.status === 'syncing') {
      return true;
    }

    if (tx.status === 'confirmed' && lastBalanceRefreshAt) {
      return tx.timestamp >= lastBalanceRefreshAt;
    }

    return false;
  });

  const amountSum = relevant.reduce((sum, tx) => sum + tx.amount, 0);
  const feeSum = relevant.length * ALGO_TX_FEE_BUFFER;
  return amountSum + feeSum;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      walletAddress: '',
      wallets: [],
      algorandNetwork: 'unknown',
      explorerTxBaseUrl: '',
      demoModeAllowed: true,
      contractEnabled: false,
      contractAppId: 0,
      balanceAlgo: null,
      lastBalanceRefreshAt: null,
      isConnected: true,
      isSyncing: false,
      transactions: [],
      demoMode: {
        simulateOffline: false,
        simulateSyncSuccess: false
      },

      hydrateSampleData: () => {
        const current = get().transactions;
        if (current.length > 0) {
          return;
        }

        const now = Date.now();
        const sampleTxs: GhostTransaction[] = [
          {
            id: 'demo-pending-1',
            sender: 'DEMO-SENDER-ADDRESS',
            receiver: 'DEMO-RECEIVER-ADDRESS',
            amount: 2.4,
            timestamp: new Date(now - 1000 * 60 * 9).toISOString(),
            status: 'pending'
          },
          {
            id: 'demo-confirmed-1',
            sender: 'DEMO-SENDER-ADDRESS',
            receiver: 'DEMO-RECEIVER-ADDRESS',
            amount: 1.1,
            timestamp: new Date(now - 1000 * 60 * 60).toISOString(),
            status: 'confirmed',
            txHash: 'DEMO-CONFIRMED-HASH'
          }
        ];

        set({ transactions: sampleTxs });
      },

      loadNetworkInfo: async () => {
        try {
          const info = await fetchNetworkInfo();

          set((state) => ({
            algorandNetwork: info.network,
            explorerTxBaseUrl: info.explorerTxBaseUrl,
            demoModeAllowed: info.demoModeAllowed,
            contractEnabled: info.contractEnabled,
            contractAppId: info.contractAppId,
            demoMode: info.demoModeAllowed
              ? state.demoMode
              : {
                  ...state.demoMode,
                  simulateSyncSuccess: false
                }
          }));
        } catch {
          // Keep existing values when backend is temporarily unreachable.
        }
      },

      setWalletAddress: (address: string) => {
        const normalizedAddress = address.trim();
        set((state) => ({
          walletAddress: normalizedAddress,
          wallets: normalizedAddress ? upsertWallet(state.wallets, normalizedAddress) : state.wallets
        }));
      },

      addWallet: (address: string, label?: string) => {
        const normalizedAddress = address.trim();
        if (!normalizedAddress) {
          return;
        }

        set((state) => ({
          wallets: upsertWallet(state.wallets, normalizedAddress, label)
        }));
      },

      removeWallet: (address: string) => {
        const normalizedAddress = address.trim();
        if (!normalizedAddress) {
          return;
        }

        set((state) => {
          const wallets = state.wallets.filter((item) => item.address !== normalizedAddress);
          const walletAddress = state.walletAddress === normalizedAddress ? (wallets[0]?.address ?? '') : state.walletAddress;

          return {
            wallets,
            walletAddress,
            balanceAlgo: state.walletAddress === normalizedAddress ? null : state.balanceAlgo
          };
        });
      },

      generateWalletAddress: () => {
        const account = algosdk.generateAccount();
        const walletAddress = account.addr.toString();
        set((state) => ({
          walletAddress,
          wallets: upsertWallet(state.wallets, walletAddress)
        }));
        return walletAddress;
      },

      setConnectionStatus: (isConnected: boolean) => {
        set({ isConnected });
      },

      toggleDemoOffline: () => {
        set((state) => ({
          demoMode: {
            ...state.demoMode,
            simulateOffline: !state.demoMode.simulateOffline
          }
        }));
      },

      toggleDemoSyncSuccess: () => {
        if (!get().demoModeAllowed) {
          return;
        }

        set((state) => ({
          demoMode: {
            ...state.demoMode,
            simulateSyncSuccess: !state.demoMode.simulateSyncSuccess
          }
        }));
      },

      enqueueOfflinePayment: async (receiver: string, amount: number) => {
        const { walletAddress, transactions, balanceAlgo, lastBalanceRefreshAt } = get();

        if (!walletAddress) {
          throw new Error('Set sender wallet address first');
        }

        if (amount <= 0 || Number.isNaN(amount)) {
          throw new Error('Amount must be greater than zero');
        }

        if (balanceAlgo !== null) {
          const committedOutgoing = calculateCommittedOutgoing(transactions, walletAddress, lastBalanceRefreshAt);
          const availableOffline = Math.max(balanceAlgo - committedOutgoing - ALGO_MIN_BALANCE_RESERVE, 0);
          const required = amount + ALGO_TX_FEE_BUFFER;

          if (required > availableOffline + 1e-9) {
            throw new Error(
              `Insufficient offline balance. Available spendable: ${availableOffline.toFixed(3)} ALGO (includes fee and reserve).`
            );
          }
        }

        const transaction: GhostTransaction = {
          id: `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          sender: walletAddress,
          receiver: receiver.trim(),
          amount,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };

        set({ transactions: [transaction, ...transactions] });
        return transaction;
      },

      syncPendingTransactions: async () => {
        const state = get();
        if (state.isSyncing) {
          return;
        }

        const online = getEffectiveOnline(state.isConnected, state.demoMode);
        if (!online) {
          return;
        }

        const pending = state.transactions.filter((tx) => tx.status === 'pending');
        if (pending.length === 0) {
          return;
        }

        set({ isSyncing: true });

        for (const tx of pending) {
          set((current) => ({
            transactions: withUpdatedTransaction(current.transactions, tx.id, {
              status: 'syncing',
              error: undefined
            })
          }));

          try {
            let txId = '';
            let explorerUrl: string | undefined;
            let network: string | undefined;
            let contractVerified = false;

            if (get().demoModeAllowed && get().demoMode.simulateSyncSuccess) {
              await new Promise((resolve) => setTimeout(resolve, 700));
              txId = `DEMO-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
              explorerUrl = `${get().explorerTxBaseUrl}${txId}`;
              network = get().algorandNetwork;
              contractVerified = false;
            } else {
              let signedTxnBase64 = tx.signedTxnBase64;
              const localSecretKey = await loadWalletSecretKey(tx.sender);
              if (!signedTxnBase64 && localSecretKey) {
                signedTxnBase64 = await signPaymentTransactionLocally({
                  sender: tx.sender,
                  receiver: tx.receiver,
                  amount: tx.amount,
                  timestamp: tx.timestamp,
                  network: get().algorandNetwork,
                  secretKey: localSecretKey
                });
              }

              const response = await sendTransactionToAlgorand({
                sender: tx.sender,
                receiver: tx.receiver,
                amount: tx.amount,
                timestamp: tx.timestamp,
                signedTxnBase64,
                demoMode: false
              });
              txId = response.txId;
              explorerUrl = response.explorerUrl;
              network = response.network;
              contractVerified = Boolean(response.contractVerified);

              if (signedTxnBase64) {
                set((current) => ({
                  transactions: withUpdatedTransaction(current.transactions, tx.id, {
                    signedTxnBase64
                  })
                }));
              }
            }

            set((current) => ({
              transactions: withUpdatedTransaction(current.transactions, tx.id, {
                status: 'confirmed',
                txHash: txId,
                explorerUrl,
                network,
                contractVerified,
                error: undefined
              })
            }));
          } catch (error) {
            set((current) => ({
              transactions: withUpdatedTransaction(current.transactions, tx.id, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown sync error'
              })
            }));
          }
        }

        set({ isSyncing: false });
      },

      refreshBalance: async () => {
        const { walletAddress } = get();
        if (!walletAddress) {
          return;
        }

        try {
          const balanceAlgo = await fetchBalanceFromApi(walletAddress);
          set({ balanceAlgo, lastBalanceRefreshAt: new Date().toISOString() });
        } catch {
          set({ balanceAlgo: null });
        }
      }
    }),
    {
      name: 'ghostpay-wallet-storage',
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        wallets: state.wallets,
        algorandNetwork: state.algorandNetwork,
        explorerTxBaseUrl: state.explorerTxBaseUrl,
        demoModeAllowed: state.demoModeAllowed,
        contractEnabled: state.contractEnabled,
        contractAppId: state.contractAppId,
        balanceAlgo: state.balanceAlgo,
        lastBalanceRefreshAt: state.lastBalanceRefreshAt,
        transactions: state.transactions,
        demoMode: state.demoMode
      })
    }
  )
);
