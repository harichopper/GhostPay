import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import algosdk from 'algosdk';
import { useSecurityStore } from '../../store/securityStore';
import { useWalletStore } from '../../store/walletStore';
import { removePin, savePin } from '../../utils/security';

type LockScreenProps = {
  biometricEnabled: boolean;
  biometricName: string;
  isAuthenticating: boolean;
  errorMessage?: string;
  onPinComplete: (pin: string) => Promise<boolean>;
  onBiometricPress: (isAutomatic?: boolean) => Promise<void>;
};

export function LockScreen({
  biometricEnabled,
  biometricName,
  isAuthenticating,
  errorMessage,
  onPinComplete,
  onBiometricPress
}: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'option' | 'mnemonic' | 'newPin'>('option');
  const [seedPhrase, setSeedPhrase] = useState('');
  const [newPin, setNewPin] = useState('');

  const { height } = useWindowDimensions();
  const isSmallScreen = height < 680;
  const isMediumScreen = height >= 680 && height < 780;

  // Responsive metric calculations
  const mascotOuterSize = isSmallScreen ? 76 : isMediumScreen ? 94 : 110;
  const mascotImgSize = isSmallScreen ? 60 : isMediumScreen ? 76 : 90;
  const keypadBtnSize = isSmallScreen ? 48 : isMediumScreen ? 54 : 60;
  const lockIconSize = isSmallScreen ? 38 : 46;

  useEffect(() => {
    if (biometricEnabled) {
      void onBiometricPress(true);
    }
  }, [biometricEnabled, onBiometricPress]);

  const handleNumberPress = (number: string) => {
    if (pin.length >= 4 || isAuthenticating) {
      return;
    }

    const nextPin = `${pin}${number}`;
    setPin(nextPin);

    if (nextPin.length === 4) {
      void onPinComplete(nextPin).then((isUnlocked) => {
        if (!isUnlocked) {
          setPin('');
        }
      });
    }
  };

  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const handleForgotPinPress = () => {
    setResetStep('option');
    setSeedPhrase('');
    setNewPin('');
    setMnemonicError(null);
    setIsSuccessModalOpen(false);
    setIsForgotModalOpen(true);
  };

  const handleVerifyMnemonic = () => {
    setMnemonicError(null);
    const cleanPhrase = seedPhrase.trim().toLowerCase();
    const words = cleanPhrase.split(/\s+/).filter(Boolean);

    if (words.length !== 25) {
      const errMsg = `Algorand secret key must contain exactly 25 words (you entered ${words.length}). Please check your phrase.`;
      setMnemonicError(errMsg);
      Toast.show({
        type: 'error',
        text1: 'Invalid Seed Phrase',
        text2: `Expected 25 words, got ${words.length}`
      });
      return;
    }

    try {
      const account = algosdk.mnemonicToSecretKey(cleanPhrase);
      const derivedAddress = String(account.addr);
      const activeAddress = useWalletStore.getState().walletAddress;

      if (activeAddress && derivedAddress.toLowerCase() !== activeAddress.toLowerCase()) {
        const errMsg = `Entered seed phrase derives address ${derivedAddress.slice(0, 8)}... but active wallet is ${activeAddress.slice(0, 8)}...`;
        setMnemonicError(errMsg);
        Toast.show({
          type: 'error',
          text1: 'Mnemonic Mismatch',
          text2: 'Seed phrase does not match active wallet'
        });
        return;
      }

      // Valid phrase! Display Mnemonic Verification Success Modal
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      const errMsg = err?.message || 'Invalid 25-word Algorand checksum seed phrase. Please verify your words.';
      setMnemonicError(errMsg);
      Toast.show({
        type: 'error',
        text1: 'Invalid Checksum',
        text2: 'Please verify your words'
      });
    }
  };

  const handleSaveNewPin = async () => {
    if (newPin.length < 4) return;
    try {
      await savePin(newPin);
      useSecurityStore.getState().unlock();
      setIsForgotModalOpen(false);
      Toast.show({
        type: 'success',
        text1: 'PIN Reset Successfully',
        text2: 'Your new security PIN is now active'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'PIN Update Failed',
        text2: 'Could not save new PIN'
      });
    }
  };

  const handleResetSecurityLock = async () => {
    try {
      await removePin();
      useSecurityStore.getState().disableAppLock();
      useSecurityStore.getState().unlock();
      setIsForgotModalOpen(false);
      Toast.show({
        type: 'info',
        text1: 'Security Lock Disabled',
        text2: 'App lock requirement has been removed'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: 'Could not disable lock'
      });
    }
  };

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Non-scrollable fixed responsive viewport */}
          <View style={styles.fixedViewport}>
            {/* Top Mascot & Brand Header */}
            <View style={styles.headerSection}>
              <View
                style={[
                  styles.mascotCircleOuter,
                  { width: mascotOuterSize, height: mascotOuterSize, borderRadius: mascotOuterSize / 2 }
                ]}
              >
                <Image
                  source={require('../../../assets/app_logo/ghostPay-logo-index.png')}
                  style={{ width: mascotImgSize, height: mascotImgSize }}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.brandTitleRow}>
                <Ionicons name="flash" size={isSmallScreen ? 18 : 22} color="#05DA93" style={{ marginRight: 5 }} />
                <Text style={[styles.brandTitle, isSmallScreen && { fontSize: 18 }]}>GHOSTPAY</Text>
              </View>
              <Text style={[styles.brandTagline, isSmallScreen && { fontSize: 11 }]}>Secure. Instant. Private.</Text>
            </View>

            {/* Main Lock Card */}
            <View style={[styles.lockCard, isSmallScreen && { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }]}>
              {/* Green Lock Badge */}
              <View
                style={[
                  styles.lockIconCircle,
                  { width: lockIconSize, height: lockIconSize, borderRadius: lockIconSize / 2 }
                ]}
              >
                <Ionicons name="lock-open-outline" size={isSmallScreen ? 20 : 24} color="#12B76A" />
              </View>

              {/* Header Titles */}
              <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 18 }]}>Enter PIN</Text>
              <Text style={[styles.cardSubtitle, isSmallScreen && { fontSize: 11, marginBottom: 10 }]}>
                Enter your 4-digit PIN to unlock GhostPay
              </Text>

              {/* 4-Digit PIN Indicators */}
              <View style={[styles.pinDotsRow, isSmallScreen && { marginBottom: 10 }]}>
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      pin.length > index ? styles.pinDotFilled : styles.pinDotEmpty,
                      isSmallScreen && { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6 }
                    ]}
                  />
                ))}
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              {/* 3x4 Keypad Grid */}
              <View style={[styles.keypadGrid, isSmallScreen && { rowGap: 8 }]}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                  <View key={key} style={styles.keypadCell}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        { width: keypadBtnSize, height: keypadBtnSize, borderRadius: keypadBtnSize / 2 },
                        pressed && styles.keypadBtnPressed
                      ]}
                      disabled={isAuthenticating}
                      onPress={() => handleNumberPress(key)}
                    >
                      <Text style={[styles.keypadBtnText, isSmallScreen && { fontSize: 20 }]}>{key}</Text>
                    </Pressable>
                  </View>
                ))}

                {/* Row 4: Biometric Icon, 0, Backspace */}
                <View style={styles.keypadCell}>
                  {biometricEnabled ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        styles.biometricKeypadBtn,
                        { width: keypadBtnSize, height: keypadBtnSize, borderRadius: keypadBtnSize / 2 },
                        pressed && styles.keypadBtnPressed
                      ]}
                      disabled={isAuthenticating}
                      onPress={() => void onBiometricPress()}
                    >
                      <Ionicons name="finger-print" size={isSmallScreen ? 22 : 26} color="#12B76A" />
                    </Pressable>
                  ) : (
                    <View style={{ width: keypadBtnSize, height: keypadBtnSize }} />
                  )}
                </View>

                <View style={styles.keypadCell}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      { width: keypadBtnSize, height: keypadBtnSize, borderRadius: keypadBtnSize / 2 },
                      pressed && styles.keypadBtnPressed
                    ]}
                    disabled={isAuthenticating}
                    onPress={() => handleNumberPress('0')}
                  >
                    <Text style={[styles.keypadBtnText, isSmallScreen && { fontSize: 20 }]}>0</Text>
                  </Pressable>
                </View>

                <View style={styles.keypadCell}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      { width: keypadBtnSize, height: keypadBtnSize, borderRadius: keypadBtnSize / 2 },
                      pressed && styles.keypadBtnPressed
                    ]}
                    disabled={isAuthenticating}
                    onPress={() => setPin((current) => current.slice(0, -1))}
                  >
                    <Ionicons name="backspace-outline" size={isSmallScreen ? 20 : 24} color="#101828" />
                  </Pressable>
                </View>
              </View>

              {/* Biometric Link Button */}
              {biometricEnabled && (
                <Pressable
                  style={[styles.biometricLinkBtn, isSmallScreen && { marginTop: 10 }]}
                  disabled={isAuthenticating}
                  onPress={() => void onBiometricPress()}
                >
                  <Ionicons name="finger-print" size={16} color="#12B76A" style={{ marginRight: 6 }} />
                  <Text style={[styles.biometricLinkText, isSmallScreen && { fontSize: 12 }]}>
                    {isAuthenticating ? 'Authenticating...' : `Use ${biometricName}`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Bottom Forgot PIN Link */}
            <Pressable style={styles.forgotPinBtn} onPress={handleForgotPinPress}>
              <Text style={styles.forgotPinText}>Forgot PIN?</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Functional Forgot PIN Recovery Modal */}
      <Modal
        visible={isForgotModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsForgotModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsForgotModalOpen(false)} />

          <View style={styles.modalCard}>
            <View style={styles.modalHandleBar} />

            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="key" size={22} color="#05DA93" />
                </View>
                <View>
                  <Text style={styles.modalTitleText}>PIN Recovery</Text>
                  <Text style={styles.modalSubText}>Restore access to your GhostPay wallet</Text>
                </View>
              </View>

              <Pressable style={styles.modalCloseBtn} onPress={() => setIsForgotModalOpen(false)}>
                <Ionicons name="close" size={20} color="#101828" />
              </Pressable>
            </View>

            {resetStep === 'option' && (
              <View style={styles.modalBody}>
                <Text style={styles.sectionSubtitle}>
                  Select how you would like to recover or reset your PIN:
                </Text>

                <Pressable
                  style={styles.recoveryCard}
                  onPress={() => setResetStep('mnemonic')}
                >
                  <View style={styles.optionIconCircle}>
                    <Ionicons name="document-text" size={22} color="#027A48" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitleText}>Reset with Mnemonic Phrase</Text>
                    <Text style={styles.optionSubText}>Enter your 25-word secret key to set a new PIN</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
                </Pressable>
              </View>
            )}

            {resetStep === 'mnemonic' && (
              <View style={styles.modalBody}>
                <Text style={styles.sectionSubtitle}>
                  Paste or type your 25-word secret seed phrase to verify ownership:
                </Text>

                <TextInput
                  style={styles.mnemonicInput}
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. apple banana cherry zebra..."
                  placeholderTextColor="#98A2B3"
                  value={seedPhrase}
                  onChangeText={setSeedPhrase}
                />

                <Pressable
                  style={[styles.primaryModalBtn, !seedPhrase.trim() && { opacity: 0.5 }]}
                  disabled={!seedPhrase.trim()}
                  onPress={handleVerifyMnemonic}
                >
                  <Text style={styles.primaryBtnText}>Verify Mnemonic & Set New PIN</Text>
                </Pressable>
              </View>
            )}

            {resetStep === 'newPin' && (
              <View style={styles.modalBody}>
                <Text style={styles.sectionSubtitle}>
                  Enter a new 4-digit security passcode for GhostPay:
                </Text>

                <TextInput
                  style={styles.pinInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  placeholder="• • • •"
                  placeholderTextColor="#98A2B3"
                  value={newPin}
                  onChangeText={setNewPin}
                />

                <Pressable
                  style={[styles.primaryModalBtn, newPin.length < 4 && { opacity: 0.5 }]}
                  disabled={newPin.length < 4}
                  onPress={handleSaveNewPin}
                >
                  <Text style={styles.primaryBtnText}>Save New PIN & Unlock</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Error Alert Modal */}
      <Modal
        visible={Boolean(mnemonicError)}
        transparent
        animationType="fade"
        onRequestClose={() => setMnemonicError(null)}
      >
        <View style={styles.errorModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMnemonicError(null)} />
          <View style={styles.errorModalCard}>
            <View style={styles.errorIconBadge}>
              <Ionicons name="alert-circle" size={32} color="#D92D20" />
            </View>

            <Text style={styles.errorModalTitle}>Seed Phrase Error</Text>
            <Text style={styles.errorModalBody}>{mnemonicError}</Text>

            <Pressable
              style={styles.errorModalBtn}
              onPress={() => setMnemonicError(null)}
            >
              <Text style={styles.errorModalBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Custom Mnemonic Verification Success Modal */}
      <Modal
        visible={isSuccessModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSuccessModalOpen(false)}
      >
        <View style={styles.errorModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsSuccessModalOpen(false)} />
          <View style={styles.errorModalCard}>
            <View style={styles.successIconBadge}>
              <Ionicons name="checkmark-circle" size={40} color="#12B76A" />
            </View>

            <Text style={styles.errorModalTitle}>Mnemonic Verified!</Text>
            <Text style={styles.errorModalBody}>
              Your 25-word secret phrase was successfully verified for wallet ownership. Tap below to set your new 4-digit security PIN.
            </Text>

            <Pressable
              style={styles.successModalBtn}
              onPress={() => {
                setIsSuccessModalOpen(false);
                setResetStep('newPin');
              }}
            >
              <Ionicons name="key" size={18} color="#172B3E" style={{ marginRight: 8 }} />
              <Text style={styles.successModalBtnText}>Set 4-Digit PIN</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100000,
    elevation: 100000,
    backgroundColor: '#F0F7F3'
  },
  gradientBackground: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  fixedViewport: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 20 : 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 4
  },
  mascotCircleOuter: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(5, 218, 147, 0.2)'
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  brandTitle: {
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    color: '#172B3E',
    letterSpacing: 1.2
  },
  brandTagline: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085'
  },
  lockCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.06)'
  },
  lockIconCircle: {
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    textAlign: 'center'
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14
  },
  pinDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8
  },
  pinDotFilled: {
    backgroundColor: '#12B76A'
  },
  pinDotEmpty: {
    backgroundColor: '#E4E7EC'
  },
  errorText: {
    color: '#D92D20',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center'
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 300,
    justifyContent: 'space-between',
    rowGap: 10
  },
  keypadCell: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  keypadBtn: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  keypadBtnPressed: {
    backgroundColor: '#F2F4F7',
    transform: [{ scale: 0.95 }]
  },
  keypadBtnText: {
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#101828'
  },
  biometricKeypadBtn: {
    backgroundColor: '#E8F8F0',
    borderColor: 'rgba(18, 183, 106, 0.2)'
  },
  biometricLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 12
  },
  biometricLinkText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#12B76A'
  },
  forgotPinBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4
  },
  forgotPinText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    textAlign: 'center'
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23, 43, 62, 0.6)'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 20,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E7EC',
    alignSelf: 'center',
    marginBottom: 16
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
  modalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  modalTitleText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#101828'
  },
  modalSubText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBody: {
    paddingVertical: 10
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#475467',
    marginBottom: 16
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  optionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  optionTitleText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#101828'
  },
  optionSubText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    marginTop: 2
  },
  mnemonicInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#101828',
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.12)',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16
  },
  inModalErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECDCA'
  },
  inModalErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#D92D20'
  },
  pinInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.12)',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 16
  },
  primaryModalBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#05DA93',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#172B3E'
  },
  /* Error Alert Modal Styles */
  errorModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 43, 62, 0.65)',
    paddingHorizontal: 24
  },
  errorModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20
  },
  errorIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  errorModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    textAlign: 'center'
  },
  errorModalBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20
  },
  errorModalBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorModalBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF'
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successModalBtn: {
    flexDirection: 'row',
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#05DA93',
    alignItems: 'center',
    justifyContent: 'center'
  },
  successModalBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#172B3E'
  }
});
