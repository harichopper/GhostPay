import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    walletAddress,
    isConnected,
    demoMode,
    toggleDemoOffline,
    syncPendingTransactions,
    transactions
  } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const isOfflineDemo = demoMode?.simulateOffline ?? false;
  const pendingCount = transactions
    ? transactions.filter((t) => t.status === 'pending' || t.status === 'syncing').length
    : 0;

  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [ghostModeEnabled, setGhostModeEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // PIN / Passcode Lock Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [savedPin, setSavedPin] = useState('1234');
  const [enteredPin, setEnteredPin] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'create' | 'confirm'>('create');
  const [tempPin, setTempPin] = useState('');

  // Biometric Scan Modal States
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [bioStatus, setBioStatus] = useState<'idle' | 'scanning' | 'success'>('idle');

  const triggerBiometricScan = () => {
    setIsBioModalOpen(true);
    setBioStatus('scanning');
    setTimeout(() => {
      setBioStatus('success');
      setTimeout(() => {
        setIsBioModalOpen(false);
        setBioStatus('idle');
        setBiometricsEnabled(true);
        Toast.show({
          type: 'success',
          text1: 'Biometric Authenticated',
          text2: 'Fingerprint & Touch ID verified successfully!'
        });
      }, 800);
    }, 1200);
  };

  // Handle Numeric Keypad Presses
  const handleNumPress = (num: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);

      if (nextPin.length === 4) {
        setTimeout(() => {
          if (pinStep === 'create') {
            setTempPin(nextPin);
            setEnteredPin('');
            setPinStep('confirm');
          } else if (pinStep === 'confirm') {
            if (nextPin === tempPin) {
              setSavedPin(nextPin);
              setIsPasscodeEnabled(true);
              setIsPinModalOpen(false);
              setEnteredPin('');
              Toast.show({
                type: 'success',
                text1: 'PIN Lock Activated',
                text2: `Your new 4-digit security PIN is set!`
              });
            } else {
              setEnteredPin('');
              Toast.show({
                type: 'error',
                text1: 'PIN Mismatch',
                text2: 'PINs do not match. Please try again.'
              });
            }
          } else {
            // Unlock verification mode
            if (nextPin === savedPin) {
              setIsPinModalOpen(false);
              setEnteredPin('');
              Toast.show({
                type: 'success',
                text1: 'Unlocked Successfully',
                text2: 'Security PIN verified'
              });
            } else {
              setEnteredPin('');
              Toast.show({
                type: 'error',
                text1: 'Incorrect PIN',
                text2: 'The PIN you entered is incorrect.'
              });
            }
          }
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingTransactions();
      Toast.show({
        type: 'success',
        text1: 'Sync Completed',
        text2: 'Pending offline transactions synced with testnet'
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

  const handleDisconnectWallet = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your GhostPay account? Make sure your recovery seed phrase is backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            Toast.show({
              type: 'info',
              text1: 'Wallet Disconnected',
              text2: 'Please sign in or restore seed phrase'
            });
          }
        }
      ]
    );
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
          {/* User Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>GP</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#12B76A' : '#F79E1B' }]} />
            </View>

            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>GhostPay User</Text>
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
                  <Text style={styles.statusSubtitle}>
                    {pendingCount > 0
                      ? `${pendingCount} transaction(s) pending sync`
                      : 'Real-time node sync active'}
                  </Text>
                </View>
              </View>

              <Switch
                value={isOfflineDemo}
                onValueChange={toggleDemoOffline}
                trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                thumbColor={colors.white}
              />
            </View>

            {pendingCount > 0 && (
              <Pressable
                style={[styles.syncButton, isSyncing && { opacity: 0.6 }]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                <Ionicons name="sync" size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                <Text style={styles.syncButtonText}>
                  {isSyncing ? 'Syncing...' : 'Sync Pending Queue Now'}
                </Text>
              </Pressable>
            )}
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
                      {isPasscodeEnabled ? '4-Digit Code Active (••••)' : 'Require PIN to open app'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPasscodeEnabled}
                  onValueChange={(val) => {
                    if (val) {
                      setPinStep('create');
                      setEnteredPin('');
                      setIsPinModalOpen(true);
                    } else {
                      setIsPasscodeEnabled(false);
                      Toast.show({
                        type: 'info',
                        text1: 'PIN Lock Disabled',
                        text2: 'Password protection turned off'
                      });
                    }
                  }}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              {/* Row 2: Change Security PIN (Separate Row) */}
              {isPasscodeEnabled && (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      setPinStep('create');
                      setEnteredPin('');
                      setIsPinModalOpen(true);
                    }}
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
                  onPress={triggerBiometricScan}
                >
                  <View style={[styles.iconCircle, { backgroundColor: '#E4F2EB' }]}>
                    <Ionicons name="finger-print" size={20} color="#12B76A" />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>Fingerprint & Face ID</Text>
                    <Text style={styles.settingSubLabel}>
                      {biometricsEnabled ? 'Active • Tap to test scanner' : 'Tap to enable biometrics'}
                    </Text>
                  </View>
                </Pressable>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={(val) => {
                    if (val) {
                      triggerBiometricScan();
                    } else {
                      setBiometricsEnabled(false);
                      Toast.show({
                        type: 'info',
                        text1: 'Biometrics Disabled',
                        text2: 'Fingerprint & Face ID turned off'
                      });
                    }
                  }}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0EBFB' }]}>
                    <Ionicons name="eye-off" size={20} color="#7F56D9" />
                  </View>
                  <Text style={styles.settingLabel}>Ghost Stealth Mode</Text>
                </View>
                <Switch
                  value={ghostModeEnabled}
                  onValueChange={setGhostModeEnabled}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={() => Alert.alert('Backup Seed Phrase', 'Your 24-word recovery seed is encrypted.')}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEF0C7' }]}>
                    <Ionicons name="key" size={20} color="#DC6803" />
                  </View>
                  <Text style={styles.settingLabel}>Backup Mnemonic Phrase</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
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
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={() => Toast.show({ type: 'info', text1: 'Default Currency', text2: 'USD ($) set as default display' })}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="cash" size={20} color="#026AA7" />
                  </View>
                  <Text style={styles.settingLabel}>Display Currency</Text>
                </View>
                <View style={styles.settingRightPill}>
                  <Text style={styles.settingRightText}>USD ($)</Text>
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
            </View>
          </View>

          {/* App Version Tag */}
          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>GhostPay v1.0.5 • Algorand Testnet</Text>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Passcode / PIN Keypad Modal */}
      <Modal
        visible={isPinModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPinModalOpen(false)}
      >
        <View style={styles.pinModalOverlay}>
          <Animated.View entering={ZoomIn.duration(300)} style={styles.pinModalCard}>
            {/* Close Icon */}
            <Pressable
              style={styles.pinModalCloseBtn}
              onPress={() => {
                setIsPinModalOpen(false);
                setEnteredPin('');
              }}
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
                : pinStep === 'confirm'
                ? 'Confirm Your Security PIN'
                : 'Enter Security PIN'}
            </Text>
            <Text style={styles.pinModalSub}>
              {pinStep === 'create'
                ? 'Enter a 4-digit code to lock GhostPay'
                : pinStep === 'confirm'
                ? 'Re-enter your 4-digit PIN to confirm'
                : 'Verify your PIN to unlock'}
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
                      onPress={() => {
                        setIsPinModalOpen(false);
                        setEnteredPin('');
                      }}
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
                      onPress={handleBackspace}
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

      {/* Biometric / Fingerprint Verification Modal */}
      <Modal
        visible={isBioModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBioModalOpen(false)}
      >
        <View style={styles.pinModalOverlay}>
          <Animated.View entering={ZoomIn.duration(300)} style={styles.bioModalCard}>
            {/* Close Button */}
            <Pressable
              style={styles.pinModalCloseBtn}
              onPress={() => setIsBioModalOpen(false)}
            >
              <Ionicons name="close" size={20} color={colors.white} />
            </Pressable>

            {/* Glowing Fingerprint Sensor Button */}
            <Pressable style={styles.bioSensorCircle} onPress={triggerBiometricScan}>
              <Ionicons
                name="finger-print"
                size={54}
                color={bioStatus === 'success' ? '#12B76A' : colors.secondary}
              />
            </Pressable>

            <Text style={styles.pinModalTitle}>
              {bioStatus === 'scanning'
                ? 'Scanning Fingerprint...'
                : bioStatus === 'success'
                ? 'Biometric Verified!'
                : 'Touch Fingerprint Sensor'}
            </Text>
            <Text style={styles.pinModalSub}>
              {bioStatus === 'scanning'
                ? 'Hold your finger steady on the sensor'
                : bioStatus === 'success'
                ? 'Touch ID & Face ID authenticated successfully'
                : 'Place your finger on the sensor or camera to verify'}
            </Text>

            {/* Status Pill Indicator */}
            <View style={[styles.bioStatusPill, bioStatus === 'success' && styles.bioStatusPillSuccess]}>
              <Ionicons
                name={bioStatus === 'success' ? 'checkmark-circle' : 'scan'}
                size={16}
                color={bioStatus === 'success' ? '#12B76A' : colors.secondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.bioStatusPillText, bioStatus === 'success' && styles.bioStatusPillTextSuccess]}>
                {bioStatus === 'scanning'
                  ? 'Authenticating...'
                  : bioStatus === 'success'
                  ? 'Access Granted'
                  : 'Touch Sensor'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  sectionGroup: {
    marginBottom: 20
  },
  groupHeaderTitle: {
    color: '#5C768D',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginLeft: 4
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
    alignItems: 'center'
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
  }
});
