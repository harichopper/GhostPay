import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AwesomeAlert from 'react-native-awesome-alerts';
import Toast from 'react-native-toast-message';
import { AppChrome, CHROME_SIDEBAR_WIDTH, CHROME_TOP_HEIGHT } from '../../src/components/AppChrome';
import { QRScannerModal } from '../../src/components/QRScannerModal';
import { WalletPickerModal } from '../../src/components/WalletPickerModal';
import { lookupWalletsByMobile } from '../../src/services/api';
import { useWalletStore } from '../../src/store/walletStore';
import type { WalletIdentityItem } from '../../src/types/transaction';

const ALGO_USD_RATE = 1.5;

type AmountMode = 'ALGO' | 'USD';

function looksLikeMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  return `+${digits}`;
}

export default function SendScreen() {
  const { width } = useWindowDimensions();
  const [receiverInput, setReceiverInput] = useState('');
  const [amount, setAmount] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [walletChoices, setWalletChoices] = useState<WalletIdentityItem[]>([]);
  const [resolvedReceiverAddress, setResolvedReceiverAddress] = useState('');
  const [resolvedReceiverLabel, setResolvedReceiverLabel] = useState('');
  const [resolvedFromMobile, setResolvedFromMobile] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [amountMode, setAmountMode] = useState<AmountMode>('ALGO');

  const enqueueOfflinePayment = useWalletStore((state) => state.enqueueOfflinePayment);
  const syncPendingTransactions = useWalletStore((state) => state.syncPendingTransactions);
  const walletAddress = useWalletStore((state) => state.walletAddress);
  const isConnected = useWalletStore((state) => state.isConnected);
  const demoMode = useWalletStore((state) => state.demoMode);
  const balanceAlgo = useWalletStore((state) => state.balanceAlgo ?? 0);
  const refreshBalance = useWalletStore((state) => state.refreshBalance);

  const withSidebar = Platform.OS === 'web' && width >= 1024;
  const effectiveOnline = useMemo(() => isConnected && !demoMode.simulateOffline, [demoMode.simulateOffline, isConnected]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    void refreshBalance();
  }, [refreshBalance, walletAddress]);

  const resetReceiverResolution = () => {
    setResolvedReceiverAddress('');
    setResolvedReceiverLabel('');
    setResolvedFromMobile('');
  };

  const resolveReceiver = async () => {
    const value = receiverInput.trim();
    if (!value) {
      Toast.show({ type: 'error', text1: 'Receiver is required' });
      return;
    }

    resetReceiverResolution();

    if (!looksLikeMobile(value)) {
      Toast.show({ type: 'error', text1: 'Enter linked mobile number identifier' });
      return;
    }

    setIsResolving(true);

    try {
      const normalized = normalizeMobile(value);
      const result = await lookupWalletsByMobile(normalized);

      if (!result.verified) {
        throw new Error('Mobile number is not verified');
      }

      if (result.wallets.length === 0) {
        throw new Error('No wallets linked to this mobile number');
      }

      if (result.wallets.length === 1) {
        const [wallet] = result.wallets;
        setResolvedReceiverAddress(wallet.address);
        setResolvedReceiverLabel(wallet.label || 'Wallet');
        setResolvedFromMobile(result.mobileNumber);
        Toast.show({ type: 'success', text1: 'Receiver resolved from mobile number' });
      } else {
        setWalletChoices(result.wallets);
        setResolvedFromMobile(result.mobileNumber);
        setWalletPickerVisible(true);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Receiver lookup failed',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsResolving(false);
    }
  };

  const openSendConfirmation = () => {
    if (!resolvedReceiverAddress) {
      Toast.show({ type: 'error', text1: 'Resolve receiver before sending' });
      return;
    }

    const numericAmount = Number(amount);
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      Toast.show({ type: 'error', text1: 'Enter amount first' });
      return;
    }

    setConfirmVisible(true);
  };

  const confirmSend = async () => {
    setConfirmVisible(false);

    const numericAmount = Number(amount);
    const amountAlgo = amountMode === 'ALGO' ? numericAmount : numericAmount / ALGO_USD_RATE;
    if (!Number.isFinite(amountAlgo) || amountAlgo <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid amount' });
      return;
    }

    try {
      const queued = await enqueueOfflinePayment(resolvedReceiverAddress, amountAlgo);

      if (!effectiveOnline) {
        Toast.show({ type: 'success', text1: 'Transaction queued offline' });
        setAmount('');
        setReceiverInput('');
        resetReceiverResolution();
        return;
      }

      await syncPendingTransactions();

      const latest = useWalletStore.getState().transactions.find((tx) => tx.id === queued.id);
      if (latest?.status === 'confirmed') {
        Toast.show({
          type: 'success',
          text1: 'Transaction sent',
          text2: latest.txHash ? `Tx: ${latest.txHash.slice(0, 10)}...` : 'Confirmed on network'
        });
      } else if (latest?.status === 'failed') {
        throw new Error(latest.error ?? 'Transaction failed to broadcast');
      } else {
        Toast.show({
          type: 'success',
          text1: 'Transaction queued',
          text2: 'It will auto-send as soon as sync completes.'
        });
      }

      setAmount('');
      setReceiverInput('');
      resetReceiverResolution();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to store transaction',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const switchAmountMode = (nextMode: AmountMode) => {
    if (nextMode === amountMode) {
      return;
    }

    const numeric = Number(amount);
    if (amount.trim() && Number.isFinite(numeric) && numeric > 0) {
      const converted = amountMode === 'ALGO' ? numeric * ALGO_USD_RATE : numeric / ALGO_USD_RATE;
      setAmount(nextMode === 'ALGO' ? converted.toFixed(3) : converted.toFixed(2));
    }

    setAmountMode(nextMode);
  };

  const displayAmount = Number(amount);
  const normalizedAlgoAmount = Number.isFinite(displayAmount)
    ? (amountMode === 'ALGO' ? displayAmount : displayAmount / ALGO_USD_RATE)
    : 0;
  const confirmAmountLabel = Number.isFinite(displayAmount) && displayAmount > 0
    ? (amountMode === 'ALGO'
      ? `${displayAmount.toFixed(3)} ALGO`
      : `$${displayAmount.toFixed(2)} (~${normalizedAlgoAmount.toFixed(3)} ALGO)`)
    : amountMode === 'ALGO'
      ? '0.000 ALGO'
      : '$0.00 (~0.000 ALGO)';

  return (
    <LinearGradient colors={['#111417', '#0F1A2A', '#111417']} style={styles.screen}>
      <AppChrome activeSection='pay' />

      <ScrollView contentContainerStyle={[styles.content, withSidebar && styles.contentWithSidebar]}>
        <Animated.View entering={FadeInDown.duration(450).springify()}>
          <View style={styles.titleWrap}>
            <View>
              <Text style={styles.pageTitle}>Send Funds</Text>
              <Text style={styles.pageSub}>Transfer assets securely, even without a live connection.</Text>
            </View>

            <View style={[styles.modeChip, !effectiveOnline && styles.modeChipOffline]}>
              <MaterialIcons name={effectiveOnline ? 'cloud-done' : 'cloud-off'} size={16} color={effectiveOnline ? '#90D5B7' : '#00F5FF'} />
              <Text style={[styles.modeChipText, !effectiveOnline && styles.modeChipTextOffline]}>
                {effectiveOnline ? 'Online Mode' : 'Offline Mode'}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(500).springify()}>
          <View style={styles.glassCard}>
            <MaterialIcons name='alternate-email' size={90} color='rgba(225,226,231,0.06)' style={styles.emailGhost} />
            <Text style={styles.inputLabel}>Recipient</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={receiverInput}
                onChangeText={(value) => {
                  setReceiverInput(value);
                  resetReceiverResolution();
                }}
                placeholder='Linked mobile e.g. +1 (555) 000...'
                placeholderTextColor='rgba(185,202,202,0.45)'
                style={styles.input}
                autoCapitalize='none'
                autoCorrect={false}
              />
              <Pressable style={styles.iconButton} onPress={() => setScannerVisible(true)}>
                <MaterialIcons name='qr-code-scanner' size={20} color='#00F5FF' />
              </Pressable>
            </View>

            <View style={styles.resolveRow}>
              <Pressable style={styles.resolveButton} onPress={() => void resolveReceiver()}>
                <MaterialIcons name='person-search' size={18} color='#00F5FF' />
                <Text style={styles.resolveLabel}>{isResolving ? 'Resolving...' : 'Resolve Receiver'}</Text>
              </Pressable>

              <Text style={styles.senderText}>From: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'set wallet on identity page'}</Text>
            </View>

            {resolvedReceiverAddress ? (
              <View style={styles.resolvedCard}>
                <Text style={styles.resolvedTitle}>Receiver Ready</Text>
                <Text style={styles.resolvedText}>{resolvedReceiverLabel || 'Wallet'}: {resolvedReceiverAddress}</Text>
                {resolvedFromMobile ? <Text style={styles.resolvedText}>from mobile {resolvedFromMobile}</Text> : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(520).springify()}>
          <View style={styles.glassCard}>
            <View style={styles.amountTopRow}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountChipRow}>
                <Pressable
                  style={[styles.unitChip, amountMode === 'USD' && styles.unitChipActive]}
                  onPress={() => switchAmountMode('USD')}
                >
                  <Text style={[styles.unitChipText, amountMode === 'USD' && styles.unitChipTextActive]}>USD</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitChip, amountMode === 'ALGO' && styles.unitChipActive]}
                  onPress={() => switchAmountMode('ALGO')}
                >
                  <Text style={[styles.unitChipText, amountMode === 'ALGO' && styles.unitChipTextActive]}>ALGO</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>{amountMode === 'USD' ? '$' : 'A'}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={amountMode === 'USD' ? '0.00' : '0.000'}
                placeholderTextColor='rgba(50,53,57,0.8)'
                keyboardType='decimal-pad'
                style={styles.amountInput}
              />
            </View>

            <View style={styles.balanceRow}>
              <MaterialIcons name='info-outline' size={15} color='#B9CACA' />
              <Text style={styles.balanceText}>Balance: {balanceAlgo.toFixed(3)} ALGO (~${(balanceAlgo * ALGO_USD_RATE).toFixed(2)})</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(170).duration(550).springify()}>
          <View style={styles.queueCard}>
            <View style={styles.queueIconWrap}>
              <MaterialIcons name='wifi-off' size={22} color='#00F5FF' />
            </View>
            <View style={styles.queueTextCol}>
              <Text style={styles.queueTitle}>Offline Queue Active</Text>
              <Text style={styles.queueBody}>This transaction is signed locally and broadcast as soon as you reconnect.</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(560).springify()}>
          <Pressable style={styles.confirmButton} onPress={openSendConfirmation}>
            <LinearGradient colors={['#E9FEFF', '#00DCE5']} style={styles.confirmGradient}>
              <Text style={styles.confirmLabel}>Confirm Transfer</Text>
              <MaterialIcons name='arrow-forward' size={22} color='#002021' />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(value) => {
          setReceiverInput(value);
          setResolvedReceiverAddress(value);
          setResolvedReceiverLabel('QR wallet');
          setResolvedFromMobile('');
          Toast.show({ type: 'success', text1: 'Receiver QR scanned' });
        }}
      />

      <WalletPickerModal
        visible={walletPickerVisible}
        wallets={walletChoices}
        mobileNumber={resolvedFromMobile}
        onClose={() => setWalletPickerVisible(false)}
        onSelect={(wallet) => {
          setWalletPickerVisible(false);
          setResolvedReceiverAddress(wallet.address);
          setResolvedReceiverLabel(wallet.label || 'Wallet');
          Toast.show({ type: 'success', text1: 'Receiver wallet selected' });
        }}
      />

      <AwesomeAlert
        show={confirmVisible}
        title={effectiveOnline ? 'Confirm Payment' : 'Confirm Offline Payment'}
        message={`Send ${confirmAmountLabel} to ${resolvedReceiverLabel || 'wallet'}?`}
        closeOnTouchOutside={false}
        closeOnHardwareBackPress={false}
        showCancelButton
        showConfirmButton
        cancelText='Cancel'
        confirmText='Send'
        confirmButtonColor='#0BA5EC'
        cancelButtonColor='#6B7280'
        onCancelPressed={() => setConfirmVisible(false)}
        onConfirmPressed={confirmSend}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingTop: CHROME_TOP_HEIGHT + 16,
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 14,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center'
  },
  contentWithSidebar: {
    paddingLeft: CHROME_SIDEBAR_WIDTH + 24,
    paddingRight: 24
  },
  titleWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 2
  },
  pageTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 46,
    letterSpacing: -0.5
  },
  pageSub: {
    marginTop: 6,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 15
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(144,213,183,0.2)',
    backgroundColor: 'rgba(1,84,61,0.35)'
  },
  modeChipOffline: {
    borderColor: 'rgba(0,245,255,0.25)',
    backgroundColor: 'rgba(0,245,255,0.12)'
  },
  modeChipText: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  modeChipTextOffline: {
    color: '#00F5FF'
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(50,53,57,0.55)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(233,254,255,0.2)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(233,254,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    overflow: 'hidden'
  },
  emailGhost: {
    position: 'absolute',
    top: 12,
    right: 12
  },
  inputLabel: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  input: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0C0E12',
    color: '#E1E2E7',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 18,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)'
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(29,32,35,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)'
  },
  resolveRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  resolveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
    backgroundColor: 'rgba(0,245,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  resolveLabel: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  senderText: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  resolvedCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.28)',
    backgroundColor: 'rgba(17,20,23,0.7)',
    padding: 10
  },
  resolvedTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12
  },
  resolvedText: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12,
    marginTop: 2
  },
  amountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  amountChipRow: {
    flexDirection: 'row',
    gap: 8
  },
  unitChip: {
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.45)',
    borderRadius: 999,
    backgroundColor: '#323539',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  unitChipActive: {
    borderColor: 'rgba(0,245,255,0.35)',
    backgroundColor: 'rgba(0,245,255,0.12)'
  },
  unitChipText: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  unitChipTextActive: {
    color: '#00F5FF'
  },
  amountRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  amountPrefix: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 58,
    lineHeight: 64
  },
  amountInput: {
    flex: 1,
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 58,
    lineHeight: 64,
    paddingVertical: 0
  },
  balanceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  balanceText: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 14
  },
  queueCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: '#1D2023',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  queueIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#282A2E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  queueTextCol: {
    flex: 1
  },
  queueTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  queueBody: {
    marginTop: 2,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00F5FF',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
    marginTop: 2
  },
  confirmGradient: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  confirmLabel: {
    color: '#002021',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 18,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  }
});
