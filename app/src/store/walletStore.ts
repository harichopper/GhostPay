import algosdk from 'algosdk';
import { Buffer } from 'buffer';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fetchBalanceFromApi, fetchNetworkInfo, sendTransactionToAlgorand, fetchTransactionsFromApi } from '../services/api';
import { platformStorage } from '../storage/platformStorage';
import { loadWalletSecretKey, saveWalletSecretKey, savePendingMnemonic, clearWalletSecretKey } from '../storage/walletSecretStorage';
import type { GhostTransaction } from '../types/transaction';

const ALGO_TX_FEE_BUFFER = 0.001;
const ALGO_MIN_BALANCE_RESERVE = 0.1;
const ALGONODE_MAINNET = 'https://mainnet-api.algonode.cloud';
const ALGONODE_TESTNET = 'https://testnet-api.algonode.cloud';

async function triggerLocalNotification(title: string, body: string) {
  if (!useWalletStore.getState().pushNotificationsEnabled) {
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true
      },
      trigger: null
    });
  } catch (error) {
    console.warn('Error scheduling local notification:', error);
  }
}

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
  verifiedPhone: string | null;
  setVerifiedPhone: (phone: string | null) => void;
  userName: string | null;
  setUserName: (name: string | null) => void;
  displayCurrency: 'USD' | 'INR' | 'EUR';
  setDisplayCurrency: (currency: 'USD' | 'INR' | 'EUR') => void;
  algoRates: { USD: number; INR: number; EUR: number };
  notificationsClearedAt: string | null;
  setNotificationsClearedAt: (date: string | null) => void;
  readTxIds: string[];
  markTxAsRead: (txId: string) => void;
  pushNotificationsEnabled: boolean;
  setPushNotificationsEnabled: (enabled: boolean) => void;
  fetchExchangeRates: () => Promise<void>;
  hydrateSampleData: () => void;
  loadNetworkInfo: () => Promise<boolean>;
  setWalletAddress: (address: string) => void;
  addWallet: (address: string, label?: string) => void;
  removeWallet: (address: string) => void;
  generateWalletAddress: () => Promise<{ address: string; mnemonic: string }>;
  importWalletFromMnemonic: (mnemonic: string, label?: string) => Promise<{ success: boolean; address?: string; error?: string }>;
  disconnectWallet: () => Promise<void>;
  setConnectionStatus: (isConnected: boolean) => void;
  toggleDemoOffline: () => void;
  toggleDemoSyncSuccess: () => void;
  enqueueOfflinePayment: (receiver: string, amount: number) => Promise<GhostTransaction>;
  syncPendingTransactions: () => Promise<void>;
  retryFailedTransaction: (txId: string) => void;
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
      verifiedPhone: null,
      setVerifiedPhone: (phone) => set({ verifiedPhone: phone }),
      userName: null,
      setUserName: (name) => set({ userName: name }),
      displayCurrency: 'USD',
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      notificationsClearedAt: null,
      setNotificationsClearedAt: (date) => set({ notificationsClearedAt: date }),
      readTxIds: [],
      markTxAsRead: (txId) => {
        if (!txId) return;
        set((state) => {
          if (state.readTxIds.includes(txId)) return state;
          return { readTxIds: [...state.readTxIds, txId] };
        });
      },
      pushNotificationsEnabled: true,
      setPushNotificationsEnabled: (enabled) => set({ pushNotificationsEnabled: enabled }),
      algoRates: { USD: 0.15, INR: 12.5, EUR: 0.14 },
      fetchExchangeRates: async () => {
        try {
          const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ALGO');
          const data = await res.json() as { data?: { rates?: Record<string, string> } };
          if (data && data.data && data.data.rates) {
            const usd = parseFloat(data.data.rates.USD || '0.15');
            const inr = parseFloat(data.data.rates.INR || '12.5');
            const eur = parseFloat(data.data.rates.EUR || '0.14');
            set({ algoRates: { USD: usd, INR: inr, EUR: eur } });
          }
        } catch (error) {
          // Ignore and keep using fallback rates
        }
      },

      hydrateSampleData: () => {
        // Purge any legacy demo transactions from persistent storage
        const current = get().transactions || [];
        const filtered = current.filter((tx) => !tx.id.startsWith('demo-'));
        if (filtered.length !== current.length) {
          set({ transactions: filtered });
        }
      },

      loadNetworkInfo: async () => {
        try {
          void get().fetchExchangeRates();
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
          return true;
        } catch {
          // Keep existing values when backend is temporarily unreachable.
          return false;
        }
      },

      setWalletAddress: (address: string) => {
        const normalizedAddress = address.trim();
        set((state) => ({
          walletAddress: normalizedAddress,
          wallets: normalizedAddress ? upsertWallet(state.wallets, normalizedAddress) : state.wallets,
          balanceAlgo: null,
          lastBalanceRefreshAt: null,
          transactions: state.transactions.filter((tx) => !tx.id.startsWith('demo-'))
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

      generateWalletAddress: async () => {
        const account = algosdk.generateAccount();
        const walletAddress = account.addr.toString();
        const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
        return { address: walletAddress, mnemonic };
      },

      importWalletFromMnemonic: async (mnemonic: string, label?: string) => {
        try {
          const cleanMnemonic = mnemonic.trim();
          const account = algosdk.mnemonicToSecretKey(cleanMnemonic);
          const address = account.addr.toString();

          await saveWalletSecretKey(address, account.sk);

          set((state) => {
            const hasActiveWallet = Boolean(state.walletAddress);

            return {
              walletAddress: hasActiveWallet ? state.walletAddress : address,
              wallets: upsertWallet(state.wallets, address, label),
              balanceAlgo: hasActiveWallet ? state.balanceAlgo : null,
              lastBalanceRefreshAt: hasActiveWallet ? state.lastBalanceRefreshAt : null
            };
          });
          return { success: true, address };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Invalid mnemonic phrase' };
        }
      },

      disconnectWallet: async () => {
        const { walletAddress, wallets } = get();
        try {
          await clearWalletSecretKey(walletAddress);
          for (const item of wallets) {
            await clearWalletSecretKey(item.address);
          }
        } catch {
          // Ignore key deletion errors
        }

        set({
          walletAddress: '',
          wallets: [],
          balanceAlgo: null,
          lastBalanceRefreshAt: null,
          transactions: [],
          verifiedPhone: null,
          userName: null
        });
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

        const secretKey = await loadWalletSecretKey(walletAddress);
        if (!secretKey) {
          throw new Error('This account is Watch-Only (imported by Address). To send payments, please re-import this wallet using your 25-word secret seed phrase.');
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

        set((state) => ({
          balanceAlgo: state.balanceAlgo !== null ? Math.max(0, state.balanceAlgo - amount) : state.balanceAlgo,
          transactions: [transaction, ...state.transactions]
        }));

        if (get().demoMode.simulateOffline) {
          void triggerLocalNotification(
            'Offline Payment Queued',
            `Your payment of ${amount} ALGO has been signed and queued offline. It will sync automatically when back online.`
          );
        }

        // Trigger network sync automatically
        void get().syncPendingTransactions();

        return transaction;
      },

      syncPendingTransactions: async () => {
        const isOnline = get().isConnected && !get().demoMode.simulateOffline;
        if (!isOnline) {
          return;
        }

        const pending = get().transactions.filter(
          (tx) => tx.status === 'pending' || tx.status === 'syncing'
        );
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

            try {
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

              if (!signedTxnBase64) {
                throw new Error('Wallet secret key missing. Please re-import wallet using 25-word seed phrase.');
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
            } catch (err: any) {
              const errMsg = err?.message || '';
              const isNetworkError =
                !get().isConnected ||
                get().demoMode.simulateOffline ||
                errMsg.toLowerCase().includes('fetch') ||
                errMsg.toLowerCase().includes('network') ||
                errMsg.toLowerCase().includes('connection') ||
                errMsg.toLowerCase().includes('failed to fetch') ||
                errMsg.toLowerCase().includes('503') ||
                errMsg.toLowerCase().includes('502') ||
                errMsg.toLowerCase().includes('timeout') ||
                errMsg.toLowerCase().includes('http status 5');

              if (isNetworkError) {
                // Revert to pending so it stays queued and auto-syncs when network is back
                set((current) => ({
                  transactions: withUpdatedTransaction(current.transactions, tx.id, {
                    status: 'pending',
                    error: 'Queued (Offline) — Will auto-sync when online'
                  })
                }));
                continue;
              }

              set((current) => ({
                transactions: withUpdatedTransaction(current.transactions, tx.id, {
                  status: 'failed',
                  error: errMsg || 'Broadcast failed on Algorand network'
                })
              }));
              void triggerLocalNotification(
                'Payment Sync Failed',
                `Payment of ${tx.amount} ALGO failed to sync: ${errMsg || 'Broadcast failed'}`
              );
              continue;
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
            void triggerLocalNotification(
              'Payment Confirmed',
              `Your payment of ${tx.amount} ALGO has been confirmed on-chain on ${network || 'testnet'}.`
            );
          } catch {
            set((current) => ({
              transactions: withUpdatedTransaction(current.transactions, tx.id, {
                status: 'pending',
                error: 'Queued — Will retry automatically'
              })
            }));
          }
        }

        set({ isSyncing: false });
        void get().refreshBalance();
      },

      retryFailedTransaction: (txId: string) => {
        set((current) => ({
          transactions: withUpdatedTransaction(current.transactions, txId, {
            status: 'pending',
            error: undefined
          })
        }));
        void get().syncPendingTransactions();
      },

      refreshBalance: async () => {
        const { walletAddress, fetchExchangeRates, transactions: localTxs } = get();
        if (!walletAddress) {
          return;
        }

        void fetchExchangeRates();

        try {
          const fetchedBalance = await fetchBalanceFromApi(walletAddress);
          const currentTxs = get().transactions;
          const pendingOutgoing = currentTxs
            .filter((t) => (t.status === 'pending' || t.status === 'syncing') && t.sender?.toLowerCase() === walletAddress.toLowerCase())
            .reduce((sum, t) => sum + t.amount, 0);

          const finalBalance = Math.max(0, fetchedBalance - pendingOutgoing);
          set({ balanceAlgo: finalBalance, lastBalanceRefreshAt: new Date().toISOString() });
        } catch {
          // Keep current local balance when offline or API call fails
        }

        try {
          const apiTxs = await fetchTransactionsFromApi(walletAddress);
          if (apiTxs && apiTxs.length > 0) {
            const map = new Map<string, GhostTransaction>();
            localTxs.forEach((t) => map.set(t.id, t));

            let receivedTxCount = 0;
            let lastReceivedAmount = 0;
            let lastSender = '';

            apiTxs.forEach((t) => {
              if (!map.has(t.id)) {
                // Check if we are the recipient and NOT the sender of this new transaction
                if (
                  t.receiver?.toLowerCase() === walletAddress.toLowerCase() &&
                  t.sender?.toLowerCase() !== walletAddress.toLowerCase()
                ) {
                  receivedTxCount++;
                  lastReceivedAmount = t.amount;
                  lastSender = t.sender;
                }
                map.set(t.id, t);
              }
            });

            if (receivedTxCount > 0) {
              const body = receivedTxCount === 1
                ? `Received ${lastReceivedAmount.toFixed(2)} ALGO from ${lastSender.slice(0, 6)}...${lastSender.slice(-4)}`
                : `Received ${receivedTxCount} new payments.`;
              void triggerLocalNotification('Payment Received', body);
            }

            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            set({ transactions: merged });
          }
        } catch {
          // Ignore transaction fetch errors when offline
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
        demoMode: state.demoMode,
        verifiedPhone: state.verifiedPhone,
        userName: state.userName,
        displayCurrency: state.displayCurrency,
        notificationsClearedAt: state.notificationsClearedAt,
        readTxIds: state.readTxIds,
        pushNotificationsEnabled: state.pushNotificationsEnabled
      })
    }
  )
);
