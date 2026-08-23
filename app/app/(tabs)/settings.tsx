import { Ionicons } from '@expo/vector-icons';
import algosdk from 'algosdk';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Toast, { ToastConfigParams } from 'react-native-toast-message';
import PendingQueueModal from '../../src/components/PendingQueueModal';
import { MnemonicBackupModal } from '../../src/components/MnemonicBackupModal';
import { loadWalletSecretKey } from '../../src/storage/walletSecretStorage';
import { useSecurityStore } from '../../src/store/securityStore';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import {
  authenticateBiometric,
  canUseBiometrics,
  removePin,
  savePin,
  verifyPin
} from '../../src/utils/security';

type SecurityPinStep =
  | 'create'
  | 'confirmCreate'
  | 'disableLock'
  | 'verifyCurrentForChange'
  | 'createChange'
  | 'confirmChange'
  | 'enableBiometric'
  | 'disableBiometric';

const pinToastConfig = {
  error: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={styles.pinToastContainer}>
      <Ionicons name="alert-circle" size={24} color="#F04438" style={styles.pinToastIcon} />
      <View style={styles.pinToastTextContainer}>
        {text1 ? <Text style={styles.pinToastTitle}>{text1}</Text> : null}
        {text2 ? <Text style={styles.pinToastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  )
};

export default function SettingsScreen() {
  const router = useRouter();
  const {
    walletAddress,
    wallets,
    setWalletAddress,
    isConnected,
    demoMode,
    toggleDemoOffline,
    syncPendingTransactions,
    transactions,
    disconnectWallet,
    importWalletFromMnemonic,
    generateWalletAddress,
    displayCurrency,
    setDisplayCurrency,
    userName,
    pushNotificationsEnabled,
    setPushNotificationsEnabled
  } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isOfflineDemo = demoMode?.simulateOffline ?? false;
  const pendingCount = transactions
    ? transactions.filter((t) => t.status === 'pending' || t.status === 'syncing').length
    : 0;

  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const biometricEnabled = useSecurityStore((state) => state.biometricEnabled);
  const enableAppLock = useSecurityStore((state) => state.enableAppLock);
  const disableAppLock = useSecurityStore((state) => state.disableAppLock);
  const enableBiometric = useSecurityStore((state) => state.enableBiometric);
  const disableBiometric = useSecurityStore((state) => state.disableBiometric);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isPendingQueueModalOpen, setIsPendingQueueModalOpen] = useState(false);

  // Wallet Import & Backup states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importLabel, setImportLabel] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupMnemonic, setBackupMnemonic] = useState('');

  const handleOpenImportModal = () => {
    setImportInput('');
    setImportLabel('');
    setIsImportModalOpen(true);
  };

  const handleExecuteImport = async () => {
    if (!importInput.trim()) {
      Toast.show({ type: 'error', text1: 'Missing Input', text2: 'Please enter your 25-word seed phrase or address.' });
      return;
    }

    setIsImporting(true);
    try {
      const res = await importWalletFromMnemonic(importInput, importLabel);
      if (res.success) {
        setIsImportModalOpen(false);
        Toast.show({
          type: 'success',
          text1: 'Wallet Imported!',
          text2: `Active address: ${res.address?.slice(0, 10)}...`
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Import Failed',
          text2: res.error || 'Invalid seed phrase or address'
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Import Failed',
        text2: err?.message || 'Failed to import wallet'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenBackupModal = async () => {
    if (!walletAddress) {
      Toast.show({ type: 'error', text1: 'No Active Wallet', text2: 'Please create or import a wallet first.' });
      return;
    }

    try {
      const sk = await loadWalletSecretKey(walletAddress);
      if (!sk) {
        setImportInput('');
        setIsImportModalOpen(true);
        Toast.show({
          type: 'info',
          text1: 'Watch-Only Account',
          text2: 'Enter the 25-word secret seed phrase for this address to activate backup & full sending power.'
        });
        return;
      }
      const phrase = algosdk.secretKeyToMnemonic(sk);
      setBackupMnemonic(phrase);
      setIsBackupModalOpen(true);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load secret phrase.' });
    }
  };

  const [pendingGeneratedMnemonic, setPendingGeneratedMnemonic] = useState<string | null>(null);

  const handleGenerateNewWallet = async () => {
    try {
      const { mnemonic } = await generateWalletAddress();
      setBackupMnemonic(mnemonic);
      setPendingGeneratedMnemonic(mnemonic);
      setIsBackupModalOpen(true);
      Toast.show({
        type: 'info',
        text1: 'Mnemonic Generated',
        text2: 'Complete 3-word verification to activate wallet.'
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not generate new wallet.' });
    }
  };

  const handleBackupModalCancel = () => {
    if (pendingGeneratedMnemonic) {
      setPendingGeneratedMnemonic(null);
      Toast.show({
        type: 'info',
        text1: 'Wallet Creation Cancelled',
        text2: 'Verification incomplete. No wallet was created.'
      });
    }
    setIsBackupModalOpen(false);
  };

  const handleBackupModalDone = async () => {
    if (pendingGeneratedMnemonic) {
      const res = await importWalletFromMnemonic(pendingGeneratedMnemonic);
      setPendingGeneratedMnemonic(null);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Wallet Verified & Created!',
          text2: `Active address: ${res.address?.slice(0, 10)}...`
        });
      } else {
        Toast.show({ type: 'error', text1: 'Activation Failed', text2: res.error || 'Could not activate wallet.' });
      }
    }
    setIsBackupModalOpen(false);
  };

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinStep, setPinStep] = useState<SecurityPinStep>('create');
  const [tempPin, setTempPin] = useState('');

  const openPinModal = (step: SecurityPinStep) => {
    setPinStep(step);
    setEnteredPin('');
    setTempPin('');
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setEnteredPin('');
    setTempPin('');
    setIsPinModalOpen(false);
  };

  const handlePinComplete = async (pin: string) => {
    try {
      if (pinStep === 'create' || pinStep === 'createChange') {
        setTempPin(pin);
        setEnteredPin('');
        setPinStep(pinStep === 'create' ? 'confirmCreate' : 'confirmChange');
        return;
      }

      if (pinStep === 'confirmCreate' || pinStep === 'confirmChange') {
        if (pin !== tempPin) {
          setEnteredPin('');
          Toast.show({ type: 'error', text1: 'PIN Mismatch', text2: 'PINs do not match. Please try again.' });
          return;
        }

        await savePin(pin);
        if (pinStep === 'confirmCreate') {
          enableAppLock();
          Toast.show({ type: 'success', text1: 'PIN Lock Activated', text2: 'Your security PIN is set.' });
        } else {
          Toast.show({ type: 'success', text1: 'PIN Updated', text2: 'Your security PIN has been changed.' });
        }
        closePinModal();
        return;
      }

      const isPinValid = await verifyPin(pin);
      if (!isPinValid) {
        setEnteredPin('');
        if (pinStep === 'verifyCurrentForChange') {
          Toast.show({
            type: 'error',
            text1: 'Incorrect PIN',
            text2: 'Please try again.',
            position: 'top',
            topOffset: 72,
            visibilityTime: 6000
          });
        } else {
          Toast.show({ type: 'error', text1: 'Incorrect PIN', text2: 'Please try again.' });
        }
        return;
      }

      if (pinStep === 'disableLock') {
        await removePin();
        disableAppLock();
        closePinModal();
        Toast.show({ type: 'info', text1: 'PIN Lock Disabled', text2: 'App Lock has been turned off.' });
        return;
      }

      if (pinStep === 'verifyCurrentForChange') {
        setEnteredPin('');
        setPinStep('createChange');
        return;
      }

      if (pinStep === 'enableBiometric') {
        const biometricsAvailable = await canUseBiometrics();
        if (!biometricsAvailable || !(await authenticateBiometric())) {
          setEnteredPin('');
          Toast.show({ type: 'error', text1: 'Biometrics Unavailable', text2: 'Complete device biometric setup, then try again.' });
          return;
        }

        enableBiometric();
        closePinModal();
        Toast.show({ type: 'success', text1: 'Biometrics Enabled', text2: 'Biometric unlock is now active.' });
        return;
      }

      if (pinStep === 'disableBiometric') {
        disableBiometric();
        closePinModal();
        Toast.show({ type: 'info', text1: 'Biometrics Disabled', text2: 'Biometric unlock has been turned off.' });
      }
    } catch {
      setEnteredPin('');
      Toast.show({ type: 'error', text1: 'Security Update Failed', text2: 'Please try again.' });
    }
  };

  const handleNumPress = (num: string) => {
    if (enteredPin.length >= 4) {
      return;
    }

    const nextPin = enteredPin + num;
    setEnteredPin(nextPin);
    if (nextPin.length === 4) {
      void handlePinComplete(nextPin);
    }
  };

  const formattedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : '0xGhost...2872';

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      Toast.show({
        type: 'success',
        text1: 'Address Copied',
        text2: 'Wallet address saved to clipboard'
      });
    }
  };

  const handleSelectCurrency = () => {
    setIsCurrencyModalOpen(true);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingTransactions();
      await useWalletStore.getState().refreshBalance();
      Toast.show({
        type: 'success',
        text1: 'Sync Completed',
        text2: 'Offline transactions synced with Algorand Testnet'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Sync Failed',
        text2: 'Could not connect to Algorand Node'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleOfflineSwitch = async (val: boolean) => {
    toggleDemoOffline();
    if (!val) {
      // Switching from Offline -> Online: sync pending queue immediately
      await handleManualSync();
    } else {
      Toast.show({
        type: 'info',
        text1: 'Offline Mode Active',
        text2: 'Simulating zero-data vault payments'
      });
    }
  };

  const handleDisconnectWallet = () => {
    setIsDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectWallet();
      setIsDisconnectModalOpen(false);
      Toast.show({
        type: 'info',
        text1: 'Wallet Disconnected',
        text2: 'Your wallet has been disconnected.'
      });
      router.replace('/');
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Disconnect Error',
        text2: 'Failed to disconnect wallet.'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={[styles.gradientContainer, isDesktop && styles.gradientContainerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>

          <Text style={styles.headerTitle}>Settings</Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* User Profile Card & Status Banner (Only visible if wallet exists) */}
          {Boolean(walletAddress) && (
            <>
              {/* User Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.avatarWrapper}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {userName
                        ? userName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()
                        : 'GP'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#12B76A' : '#F79E1B' }]} />
                </View>

                <View style={styles.profileDetails}>
                  <Text style={styles.profileName}>{userName || 'GhostPay User'}</Text>
                  <Pressable style={styles.addressPill} onPress={handleCopyAddress}>
                    <Text style={styles.addressText}>{formattedAddress}</Text>
                    <Ionicons name="duplicate-outline" size={14} color="#667085" style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>

                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.secondary} />
                </View>
              </View>

              {/* Network & Offline Status Banner */}
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={styles.statusLeft}>
                    <Ionicons
                      name={isOfflineDemo ? 'cloud-offline' : 'globe'}
                      size={22}
                      color={isOfflineDemo ? '#F79E1B' : '#12B76A'}
                    />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.statusTitle}>
                        {isOfflineDemo ? 'Offline Mode (Simulation)' : 'Algorand Testnet Connected'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={styles.statusSubtitle}>
                          {pendingCount > 0
                            ? `${pendingCount} transaction(s) pending sync`
                            : 'Real-time node sync active'}
                        </Text>
                        {pendingCount > 0 && (
                          <Pressable
                            style={styles.viewQueuePill}
                            onPress={() => setIsPendingQueueModalOpen(true)}
                          >
                            <Ionicons name="eye" size={12} color={colors.primaryDark} style={{ marginRight: 3 }} />
                            <Text style={styles.viewQueueText}>View</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>

                  <Switch
                    value={isOfflineDemo}
                    onValueChange={handleToggleOfflineSwitch}
                    trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                    thumbColor={colors.white}
                  />
                </View>

                <Pressable
                  style={[styles.syncButton, isSyncing && { opacity: 0.6 }]}
                  onPress={handleManualSync}
                  disabled={isSyncing}
                >
                  <Ionicons name="sync" size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={styles.syncButtonText}>
                    {isSyncing
                      ? 'Syncing with Algorand Node...'
                      : pendingCount > 0
                        ? `Sync ${pendingCount} Pending Queue Now`
                        : 'Sync Node & Refresh Balance'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Group 0: Wallets & Key Management */}
          <View style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>WALLETS & KEY MANAGEMENT</Text>

            <View style={styles.settingsCard}>
              {/* Row 1: Import Wallet with 25-Word Mnemonic or Address */}
              <Pressable style={styles.settingRow} onPress={handleOpenImportModal}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#E4F2EB' }]}>
                    <Ionicons name="download-outline" size={20} color="#12B76A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Import Wallet / Seed Phrase</Text>
                    <Text style={styles.settingSubLabel} numberOfLines={1}>
                      Import 25-word seed phrase or address
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>

              <View style={styles.divider} />

              {/* Row 2: Backup Secret Mnemonic */}
              <Pressable style={styles.settingRow} onPress={handleOpenBackupModal}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEF3F2' }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#D92D20" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Backup 25-Word Mnemonic</Text>
                    <Text style={styles.settingSubLabel} numberOfLines={1}>
                      Reveal & save your 25-word recovery key
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>

              <View style={styles.divider} />

              {/* Row 3: Generate New Wallet */}
              <Pressable style={styles.settingRow} onPress={handleGenerateNewWallet}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0EBFB' }]}>
                    <Ionicons name="add-circle-outline" size={20} color="#7F56D9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Generate New Wallet</Text>
                    <Text style={styles.settingSubLabel} numberOfLines={1}>
                      Create a new Algorand TestNet account
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
            </View>
          </View>

          {/* Group 1: Security & Privacy */}
          <View style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>SECURITY & PRIVACY</Text>

            <View style={styles.settingsCard}>
              {/* Row 1: PIN / Password Lock Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#EBF4FE' }]}>
                    <Ionicons name="key" size={20} color="#2F80ED" />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>PIN / Password Lock</Text>
                    <Text style={styles.settingSubLabel}>
                      {appLockEnabled ? '4-Digit Code Active (••••)' : 'Require PIN to open app'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={appLockEnabled}
                  onValueChange={(val) => {
                    if (val) {
                      openPinModal('create');
                    } else {
                      openPinModal('disableLock');
                    }
                  }}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              {/* Row 2: Change Security PIN (Separate Row) */}
              {appLockEnabled && (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => openPinModal('verifyCurrentForChange')}
                  >
                    <View style={styles.settingLeft}>
                      <View style={[styles.iconCircle, { backgroundColor: '#F0EBFB' }]}>
                        <Ionicons name="lock-closed" size={20} color="#7F56D9" />
                      </View>
                      <View>
                        <Text style={styles.settingLabel}>Change Security PIN</Text>
                        <Text style={styles.settingSubLabel}>Update your 4-digit passcode</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
                  </Pressable>
                </>
              )}

              <View style={styles.divider} />

              {/* Row 3: Fingerprint & Biometrics */}
              <View style={styles.settingRow}>
                <Pressable
                  style={styles.settingLeft}
                  onPress={() => {
                    if (appLockEnabled) {
                      openPinModal(biometricEnabled ? 'disableBiometric' : 'enableBiometric');
                    }
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: '#E4F2EB' }]}>
                    <Ionicons name="finger-print" size={20} color="#12B76A" />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>Biometric Lock</Text>
                    <Text style={styles.settingSubLabel}>
                      {biometricEnabled
                        ? 'Active • PIN required to disable'
                        : appLockEnabled
                          ? 'PIN and biometric verification required'
                          : 'Enable App Lock first'}
                    </Text>
                  </View>
                </Pressable>
                <Switch
                  value={biometricEnabled}
                  disabled={!appLockEnabled}
                  onValueChange={(val) => {
                    if (val) {
                      openPinModal('enableBiometric');
                    } else {
                      openPinModal('disableBiometric');
                    }
                  }}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
          </View>

          {/* Group 2: Preferences */}
          <View style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>PREFERENCES</Text>

            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#ECFDF3' }]}>
                    <Ionicons name="notifications" size={20} color="#12B76A" />
                  </View>
                  <Text style={styles.settingLabel}>Push Payment Alerts</Text>
                </View>
                <Switch
                  value={pushNotificationsEnabled}
                  onValueChange={(val) => {
                    setPushNotificationsEnabled(val);
                    Toast.show({
                      type: 'info',
                      text1: val ? 'Push Alerts Enabled' : 'Push Alerts Disabled',
                      text2: val ? 'You will receive local push notifications' : 'Payment push alerts turned off'
                    });
                  }}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={handleSelectCurrency}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="cash" size={20} color="#026AA7" />
                  </View>
                  <Text style={styles.settingLabel}>Display Currency</Text>
                </View>
                <View style={styles.settingRightPill}>
                  <Text style={styles.settingRightText}>
                    {displayCurrency === 'INR' ? 'INR (₹)' : displayCurrency === 'EUR' ? 'EUR (€)' : 'USD ($)'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#98A2B3" style={{ marginLeft: 4 }} />
                </View>
              </Pressable>
            </View>
          </View>

          {/* Group 3: Support & Disconnect */}
          <View style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>ABOUT & ACCOUNT</Text>

            <View style={styles.settingsCard}>
              <Pressable style={styles.settingRow} onPress={() => Toast.show({ type: 'info', text1: 'Help Center', text2: 'Opening support documentation...' })}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F4F5F7' }]}>
                    <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
                  </View>
                  <Text style={styles.settingLabel}>Help Center & FAQ</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>

              {Boolean(walletAddress) && (
                <>
                  <View style={styles.divider} />

                  <Pressable style={styles.settingRow} onPress={handleDisconnectWallet}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.iconCircle, { backgroundColor: '#FEE4E2' }]}>
                        <Ionicons name="log-out" size={20} color="#D92D20" />
                      </View>
                      <Text style={[styles.settingLabel, { color: '#D92D20', fontFamily: 'Inter_700Bold' }]}>
                        Disconnect Wallet
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D92D20" />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* App Version Tag */}
          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>GhostPay v1.0.5 • Algorand Testnet</Text>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Currency Selector Modal */}
      <Modal
        visible={isCurrencyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCurrencyModalOpen(false)}
      >
        <View style={styles.currencyModalOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.currencyModalCard}>
            <Pressable style={styles.modalCloseButton} onPress={() => setIsCurrencyModalOpen(false)}>
              <Ionicons name="close" size={20} color={colors.primaryDark} />
            </Pressable>

            <Text style={styles.modalTitle}>Display Currency</Text>
            <Text style={styles.modalSub}>Choose your default currency for balance calculations</Text>

            <View style={styles.optionsList}>
              {[
                { code: 'USD', name: 'USD ($) - US Dollar', symbol: '$' },
                { code: 'INR', name: 'INR (₹) - Indian Rupee', symbol: '₹' },
                { code: 'EUR', name: 'EUR (€) - Euro', symbol: '€' }
              ].map((item) => {
                const isSelected = displayCurrency === item.code;
                return (
                  <Pressable
                    key={item.code}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => {
                      setDisplayCurrency(item.code as 'USD' | 'INR' | 'EUR');
                      setIsCurrencyModalOpen(false);
                      Toast.show({
                        type: 'success',
                        text1: 'Currency Updated',
                        text2: `Display set to ${item.name}`
                      });
                    }}
                  >
                    <View style={styles.optionInfo}>
                      <View style={[styles.symbolCircle, isSelected && styles.symbolCircleSelected]}>
                        <Text style={[styles.symbolText, isSelected && styles.symbolTextSelected]}>
                          {item.symbol}
                        </Text>
                      </View>
                      <Text style={[styles.optionNameText, isSelected && styles.optionNameSelected]}>
                        {item.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Custom Styled Disconnect Confirmation Modal */}
      <Modal
        visible={isDisconnectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDisconnectModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.disconnectModalCard}>
            <View style={styles.disconnectIconBadge}>
              <Ionicons name="log-out-outline" size={28} color="#D92D20" />
            </View>

            <Text style={styles.disconnectModalTitle}>Disconnect Wallet?</Text>

            <Text style={styles.disconnectModalSub}>
              Are you sure you want to disconnect your active wallet? Make sure you have saved your 25-word recovery seed phrase to re-import it.
            </Text>

            <View style={styles.disconnectActionsRow}>
              <Pressable
                style={styles.disconnectCancelBtn}
                onPress={() => setIsDisconnectModalOpen(false)}
                disabled={isDisconnecting}
              >
                <Text style={styles.disconnectCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.disconnectConfirmBtn}
                onPress={handleConfirmDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.disconnectConfirmText}>Disconnect</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Import Wallet Modal */}
      <Modal
        visible={isImportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.importModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <View style={styles.modalIconCircleGreen}>
                  <Ionicons name="download-outline" size={22} color="#12B76A" />
                </View>
                <View>
                  <Text style={styles.importModalTitle}>Import Algorand Wallet</Text>
                  <Text style={styles.importModalSub}>Enter 25-word secret seed phrase or address</Text>
                </View>
              </View>
            </View>

            <Text style={styles.inputFieldLabel}>25-Word Secret Seed Phrase or Address:</Text>
            <TextInput
              style={styles.importTextInput}
              multiline
              numberOfLines={4}
              placeholder="e.g. apple banana cherry zebra... OR 26SEOQY3..."
              placeholderTextColor="#98A2B3"
              value={importInput}
              onChangeText={setImportInput}
            />

            <Text style={styles.inputFieldLabel}>Wallet Label (Optional):</Text>
            <TextInput
              style={styles.labelTextInput}
              placeholder="e.g. Primary Savings"
              placeholderTextColor="#98A2B3"
              value={importLabel}
              onChangeText={setImportLabel}
            />

            <Pressable
              style={[styles.primaryImportBtn, (!importInput.trim() || isImporting) && { opacity: 0.5 }]}
              disabled={!importInput.trim() || isImporting}
              onPress={handleExecuteImport}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color="#172B3E" />
              ) : (
                <>
                  <Ionicons name="key-outline" size={18} color="#172B3E" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryImportBtnText}>Import Wallet Now</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.secondaryModalBtnAction} onPress={() => setIsImportModalOpen(false)}>
              <Text style={styles.secondaryModalBtnActionText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Secret Mnemonic Backup Modal Component */}
      <MnemonicBackupModal
        visible={isBackupModalOpen}
        mnemonic={backupMnemonic}
        onCopy={() => {
          void Clipboard.setStringAsync(backupMnemonic);
          Toast.show({ type: 'success', text1: 'Copied to Clipboard', text2: 'Secret 25-word phrase copied securely.' });
        }}
        onDone={handleBackupModalDone}
        onCancel={handleBackupModalCancel}
      />

      {/* Passcode / PIN Keypad Modal */}
      <Modal
        visible={isPinModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closePinModal}
      >
        <View style={styles.pinModalOverlay}>
          <Toast config={pinToastConfig} />
          <Animated.View entering={ZoomIn.duration(300)} style={styles.pinModalCard}>
            {/* Close Icon */}
            <Pressable
              style={styles.pinModalCloseBtn}
              onPress={closePinModal}
            >
              <Ionicons name="close" size={20} color={colors.white} />
            </Pressable>

            {/* Lock Shield Icon */}
            <View style={styles.pinHeaderIcon}>
              <Ionicons name="shield-checkmark" size={32} color={colors.secondary} />
            </View>

            {/* Modal Headers */}
            <Text style={styles.pinModalTitle}>
              {pinStep === 'create'
                ? 'Set 4-Digit Security PIN'
                : pinStep === 'confirmCreate'
                  ? 'Confirm Your Security PIN'
                  : pinStep === 'verifyCurrentForChange'
                    ? 'Verify Current PIN'
                    : pinStep === 'createChange'
                      ? 'Set New Security PIN'
                      : pinStep === 'confirmChange'
                        ? 'Confirm New Security PIN'
                        : pinStep === 'disableLock'
                          ? 'Disable App Lock'
                          : pinStep === 'enableBiometric'
                            ? 'Verify PIN to Enable Biometrics'
                            : 'Verify PIN to Disable Biometrics'}
            </Text>
            <Text style={styles.pinModalSub}>
              {pinStep === 'create'
                ? 'Enter a 4-digit code to lock GhostPay'
                : pinStep === 'confirmCreate' || pinStep === 'confirmChange'
                  ? 'Re-enter your 4-digit PIN to confirm'
                  : 'Enter your current 4-digit PIN to continue'}
            </Text>

            {/* 4 Passcode Dots */}
            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((index) => {
                const isFilled = enteredPin.length > index;
                return (
                  <View
                    key={index}
                    style={[styles.pinDot, isFilled && styles.pinDotFilled]}
                  />
                );
              })}
            </View>

            {/* 12-Button Keypad Grid */}
            <View style={styles.keypadGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'backspace'].map((key) => {
                if (key === 'cancel') {
                  return (
                    <Pressable
                      key={key}
                      style={styles.keypadButtonSpecial}
                      onPress={closePinModal}
                    >
                      <Text style={styles.keypadCancelText}>Cancel</Text>
                    </Pressable>
                  );
                }

                if (key === 'backspace') {
                  return (
                    <Pressable
                      key={key}
                      style={styles.keypadButtonSpecial}
                      onPress={() => setEnteredPin((current) => current.slice(0, -1))}
                    >
                      <Ionicons name="backspace-outline" size={24} color={colors.white} />
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={key}
                    style={styles.keypadButton}
                    onPress={() => handleNumPress(key)}
                  >
                    <Text style={styles.keypadNumText}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Pending Offline Queue Modal */}
      <PendingQueueModal
        visible={isPendingQueueModalOpen}
        onClose={() => setIsPendingQueueModalOpen(false)}
        onSyncAll={handleManualSync}
        isSyncing={isSyncing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryDark
  },
  gradientContainer: {
    flex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 88,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  gradientContainerDesktop: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold'
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    color: colors.primaryDark,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  addressText: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_500Medium'
  },
  verifiedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#172B3E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8
  },
  statusTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2
  },
  statusSubtitle: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 12
  },
  syncButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  viewQueuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8
  },
  viewQueueText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  },
  sectionGroup: {
    marginBottom: 20
  },
  groupHeaderTitle: {
    color: '#475765ff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    marginTop: 10,
    marginBottom: 15,
    marginLeft: 10
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  settingLabel: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold'
  },
  settingRightPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingRightText: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.06)',
    marginLeft: 52
  },
  versionFooter: {
    alignItems: 'center',
    paddingVertical: 16
  },
  versionText: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  settingSubLabel: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  changePinBtn: {
    backgroundColor: '#EBF4FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10
  },
  changePinBtnText: {
    color: '#2F80ED',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 30, 47, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  pinToastContainer: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#172B3E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 68, 56, 0.4)',
    borderLeftWidth: 5,
    borderLeftColor: '#F04438',
    elevation: 12,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12
  },
  pinToastIcon: {
    marginRight: 12
  },
  pinToastTextContainer: {
    flex: 1
  },
  pinToastTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 2
  },
  pinToastSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  pinModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#172B3E',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative'
  },
  pinModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pinHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.3)'
  },
  pinModalTitle: {
    color: colors.white,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    textAlign: 'center',
    marginBottom: 6
  },
  pinModalSub: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 24
  },
  pinDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  pinDotFilled: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    elevation: 4
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
    width: '100%'
  },
  keypadButton: {
    width: '30%',
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  keypadButtonSpecial: {
    width: '30%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keypadNumText: {
    color: colors.white,
    fontSize: 22,
    fontFamily: 'Inter_700Bold'
  },
  keypadCancelText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  bioModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#172B3E',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative'
  },
  bioSensorCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8
  },
  bioStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.3)'
  },
  bioStatusPillSuccess: {
    backgroundColor: 'rgba(18, 183, 106, 0.18)',
    borderColor: '#12B76A'
  },
  bioStatusPillText: {
    color: colors.secondary,
    fontSize: 12,
    fontFamily: 'Inter_700Bold'
  },
  bioStatusPillTextSuccess: {
    color: '#12B76A'
  },
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 30, 47, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  currencyModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    position: 'relative',
    elevation: 10,
    shadowColor: '#0D1E2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 15
  },
  modalCloseButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginBottom: 6
  },
  modalSub: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    lineHeight: 18,
    marginBottom: 20
  },
  optionsList: {
    gap: 12
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F2F4F7',
    backgroundColor: '#F9FAFB'
  },
  optionRowSelected: {
    borderColor: colors.secondary,
    backgroundColor: '#ECFDF3'
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  symbolCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  symbolCircleSelected: {
    backgroundColor: '#D1FADF'
  },
  symbolText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#475467'
  },
  symbolTextSelected: {
    color: '#027A48'
  },
  optionNameText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#344054'
  },
  optionNameSelected: {
    color: colors.primaryDark
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  disconnectModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  disconnectIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE4E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  disconnectModalTitle: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: '#101828',
    textAlign: 'center',
    marginBottom: 8
  },
  disconnectModalSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24
  },
  disconnectActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12
  },
  disconnectCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center'
  },
  disconnectCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#344054'
  },
  disconnectConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D92D20',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2
  },
  disconnectConfirmText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF'
  },
  /* Import Modal Styles */
  importModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalIconCircleGreen: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E4F2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  modalCloseBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  importModalTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#101828'
  },
  importModalSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    marginTop: 2
  },
  inputFieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#344054',
    marginBottom: 6,
    marginTop: 10
  },
  importTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#101828',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    minHeight: 90,
    textAlignVertical: 'top'
  },
  labelTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#101828',
    borderWidth: 1,
    borderColor: '#D0D5DD'
  },
  primaryImportBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    backgroundColor: '#05DA93',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20
  },
  primaryImportBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#172B3E'
  },
  secondaryModalBtnAction: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  secondaryModalBtnActionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#667085'
  }
});
