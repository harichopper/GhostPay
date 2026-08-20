import { Ionicons } from '@expo/vector-icons';
import algosdk from 'algosdk';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
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

  const handleForgotPinPress = () => {
    setResetStep('option');
    setSeedPhrase('');
    setNewPin('');
    setIsForgotModalOpen(true);
  };

  const handleVerifyMnemonic = () => {
    const cleanPhrase = seedPhrase.trim().toLowerCase();
    const words = cleanPhrase.split(/\s+/).filter(Boolean);

    if (words.length !== 25) {
      Alert.alert(
        'Invalid Seed Phrase',
        'Algorand secret key must contain exactly 25 words. Please check your entered words.'
      );
      return;
    }

    try {
      const account = algosdk.mnemonicToSecretKey(cleanPhrase);
      const derivedAddress = String(account.addr);
      const activeAddress = useWalletStore.getState().walletAddress;

      if (activeAddress && derivedAddress.toLowerCase() !== activeAddress.toLowerCase()) {
        Alert.alert(
          'Mnemonic Mismatch',
          `The entered seed phrase derives address ${derivedAddress.slice(0, 8)}... but active wallet address is ${activeAddress.slice(0, 8)}... Please enter the correct seed phrase.`
        );
        return;
      }

      // Valid phrase! Advance to new PIN step
      setResetStep('newPin');
    } catch (err: any) {
      Alert.alert(
        'Invalid Seed Phrase',
        err?.message || 'The phrase you entered is not a valid 25-word Algorand checksum seed phrase.'
      );
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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Mascot & Brand Header */}
            <View style={styles.headerSection}>
              <View style={styles.mascotCircleOuter}>
                <Image
                  source={require('../../../assets/app_logo/ghostPay-logo-index.png')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.brandTitleRow}>
                <Ionicons name="flash" size={22} color="#05DA93" style={{ marginRight: 6 }} />
                <Text style={styles.brandTitle}>GHOSTPAY</Text>
              </View>
              <Text style={styles.brandTagline}>Secure. Instant. Private.</Text>
            </View>

            {/* Main Lock Card */}
            <View style={styles.lockCard}>
              {/* Green Lock Badge */}
              <View style={styles.lockIconCircle}>
                <Ionicons name="lock-open-outline" size={26} color="#12B76A" />
              </View>

              {/* Header Titles */}
              <Text style={styles.cardTitle}>Enter PIN</Text>
              <Text style={styles.cardSubtitle}>Enter your 4-digit PIN to unlock GhostPay</Text>

              {/* 4-Digit PIN Indicators */}
              <View style={styles.pinDotsRow}>
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      pin.length > index ? styles.pinDotFilled : styles.pinDotEmpty
                    ]}
                  />
                ))}
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              {/* 3x4 Keypad Grid */}
              <View style={styles.keypadGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                  <View key={key} style={styles.keypadCell}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        pressed && styles.keypadBtnPressed
                      ]}
                      disabled={isAuthenticating}
                      onPress={() => handleNumberPress(key)}
                    >
                      <Text style={styles.keypadBtnText}>{key}</Text>
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
                        pressed && styles.keypadBtnPressed
                      ]}
                      disabled={isAuthenticating}
                      onPress={() => void onBiometricPress()}
                    >
                      <Ionicons name="finger-print" size={26} color="#12B76A" />
                    </Pressable>
                  ) : (
                    <View style={styles.keypadBtnEmpty} />
                  )}
                </View>

                <View style={styles.keypadCell}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      pressed && styles.keypadBtnPressed
                    ]}
                    disabled={isAuthenticating}
                    onPress={() => handleNumberPress('0')}
                  >
                    <Text style={styles.keypadBtnText}>0</Text>
                  </Pressable>
                </View>

                <View style={styles.keypadCell}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      pressed && styles.keypadBtnPressed
                    ]}
                    disabled={isAuthenticating}
                    onPress={() => setPin((current) => current.slice(0, -1))}
                  >
                    <Ionicons name="backspace-outline" size={24} color="#101828" />
                  </Pressable>
                </View>
              </View>

              {/* Biometric Link Button */}
              {biometricEnabled && (
                <Pressable
                  style={styles.biometricLinkBtn}
                  disabled={isAuthenticating}
                  onPress={() => void onBiometricPress()}
                >
                  <Ionicons name="finger-print" size={18} color="#12B76A" style={{ marginRight: 6 }} />
                  <Text style={styles.biometricLinkText}>
                    {isAuthenticating ? 'Authenticating...' : `Use ${biometricName}`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Forgot PIN Link */}
            <Pressable style={styles.forgotPinBtn} onPress={handleForgotPinPress}>
              <Text style={styles.forgotPinText}>Forgot PIN?</Text>
            </Pressable>
          </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 40,
    alignItems: 'center'
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20
  },
  mascotCircleOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(5, 218, 147, 0.2)'
  },
  mascotImage: {
    width: 110,
    height: 110
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  brandTitle: {
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    color: '#172B3E',
    letterSpacing: 1.2
  },
  brandTagline: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#667085'
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    textAlign: 'center'
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18
  },
  pinDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
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
    marginBottom: 14,
    textAlign: 'center'
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 320,
    justifyContent: 'space-between',
    rowGap: 14
  },
  keypadCell: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  keypadBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    color: '#101828'
  },
  biometricKeypadBtn: {
    backgroundColor: '#E8F8F0',
    borderColor: 'rgba(18, 183, 106, 0.2)'
  },
  keypadBtnEmpty: {
    width: 64,
    height: 64
  },
  biometricLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  biometricLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#12B76A'
  },
  forgotPinBtn: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 20
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
  }
});
