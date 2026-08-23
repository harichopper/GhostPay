import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { authenticateBiometric, verifyPin } from '../../utils/security';
import { useSecurityStore } from '../../store/securityStore';

type PaymentPinScreenProps = {
  visible: boolean;
  amount: string;
  currencyMode: 'FIAT' | 'ALGO';
  displayCurrency?: string;
  onAuthorized: () => void;
  onCancel?: () => void;
};

export function PaymentPinScreen({
  visible,
  amount,
  currencyMode,
  displayCurrency,
  onAuthorized,
  onCancel
}: PaymentPinScreenProps) {
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const biometricEnabled = useSecurityStore((state) => state.biometricEnabled);

  const amountSummary = useMemo(() => {
    const numericAmount = Number.parseFloat(amount || '0');
    const isValidAmount = Number.isFinite(numericAmount) && numericAmount >= 0;

    if (currencyMode === 'ALGO') {
      return {
        primary: isValidAmount ? numericAmount.toFixed(2) : '0.00',
        secondary: 'ALGO'
      };
    }

    const currencyCode = displayCurrency || 'USD';
    const prefix = currencyCode === 'INR' ? '₹' : currencyCode === 'EUR' ? '€' : '$';
    const label = currencyCode.toUpperCase();

    return {
      primary: isValidAmount ? `${prefix}${numericAmount.toFixed(2)}` : `${prefix}0.00`,
      secondary: label
    };
  }, [amount, currencyMode, displayCurrency]);

  const handleNumberPress = (number: string) => {
    if (pin.length >= 4 || isAuthenticating) {
      return;
    }

    const nextPin = `${pin}${number}`;
    setPin(nextPin);
    setErrorMessage(null);

    if (nextPin.length === 4) {
      void handlePinComplete(nextPin);
    }
  };

  const handleClearPress = () => {
    if (isAuthenticating) {
      return;
    }

    setPin('');
    setErrorMessage(null);
  };

  const handleDeletePress = () => {
    if (isAuthenticating) {
      return;
    }

    setPin((current) => current.slice(0, -1));
    setErrorMessage(null);
  };

  const handlePinComplete = async (nextPin: string) => {
    setIsAuthenticating(true);
    setErrorMessage(null);

    try {
      const isValid = await verifyPin(nextPin);
      if (!isValid) {
        setErrorMessage('Incorrect PIN. Please try again.');
        setPin('');
        return;
      }

      setPin('');
      onAuthorized();
    } catch {
      setErrorMessage('Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricPress = async () => {
    if (isAuthenticating) {
      return;
    }

    setIsAuthenticating(true);
    setErrorMessage(null);

    try {
      const isAuthenticated = await authenticateBiometric();
      if (isAuthenticated) {
        onAuthorized();
      }
    } catch {
      setErrorMessage(null);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel || (() => undefined)}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <LinearGradient
          colors={['#F4F6F4', '#F3F6F3', '#F2F5F4']}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              disabled={isAuthenticating}
              onPress={onCancel}
              style={({ pressed }) => [styles.backButton, pressed && styles.keypadBtnPressed]}
            >
              <Ionicons name="arrow-back" size={24} color="#172B3E" />
            </Pressable>

            <View style={styles.fixedViewport}>
              <View style={styles.headerSection}>
                <Text style={styles.amountText}>{amountSummary.primary}</Text>
                <Text style={styles.amountCurrency}>{amountSummary.secondary}</Text>
              </View>

              <View style={styles.lockCard}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-open-outline" size={28} color="#12B76A" />
                </View>

                <Text style={styles.cardTitle}>Confirm Payment</Text>
                <Text style={styles.cardSubtitle}>Enter your 4-digit PIN to authorize this payment</Text>

                <View style={styles.pinDotsRow}>
                  {[0, 1, 2, 3].map((index) => (
                    <View
                      key={index}
                      style={[styles.pinDot, pin.length > index ? styles.pinDotFilled : styles.pinDotEmpty]}
                    />
                  ))}
                </View>

                <View style={[styles.errorRow, !errorMessage && styles.errorRowHidden]}>
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{errorMessage || ' '}</Text>
                </View>

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

                  <View style={styles.keypadCell}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        styles.clearKeypadBtn,
                        pressed && styles.keypadBtnPressed
                      ]}
                      disabled={isAuthenticating}
                      onPress={handleClearPress}
                    >
                      <Text style={[styles.keypadBtnText, styles.clearText]}>C</Text>
                    </Pressable>
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
                      onPress={handleDeletePress}
                    >
                      <Ionicons name="close-outline" size={28} color="#172B3E" />
                    </Pressable>
                  </View>
                </View>

                {biometricEnabled ? (
                  <Pressable
                    style={styles.biometricFooter}
                    disabled={isAuthenticating}
                    onPress={() => void handleBiometricPress()}
                  >
                    <Ionicons name="finger-print" size={24} color="#12B76A" style={{ marginRight: 10 }} />
                    <Text style={styles.biometricText}>{isAuthenticating ? 'Authenticating...' : 'Use Biometric'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#f3f5f3'
  },
  gradientBackground: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 20,
    zIndex: 1,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fixedViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 8
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 22
  },
  amountText: {
    color: '#172B3E',
    fontSize: 62,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -2,
    lineHeight: 70
  },
  amountCurrency: {
    color: '#172B3E',
    fontSize: 26,
    fontFamily: 'Orbitron_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#cbd5d1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f9f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#0fd89b'
  },
  cardTitle: {
    color: '#172B3E',
    fontSize: 27,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 6,
    textAlign: 'center'
  },
  cardSubtitle: {
    color: '#4f667c',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 22
  },
  pinDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 9,
    borderWidth: 2,
    borderColor: '#d7e3ec'
  },
  pinDotFilled: {
    backgroundColor: '#0f2038',
    borderColor: '#0f2038'
  },
  pinDotEmpty: {
    backgroundColor: 'transparent'
  },
  errorRow: {
    width: '100%',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f4d7d7',
    paddingHorizontal: 8,
    marginBottom: 10,
    overflow: 'hidden'
  },
  errorRowHidden: {
    opacity: 0
  },
  errorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d92d20',
    marginRight: 10
  },
  errorText: {
    color: '#d92d20',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center'
  },
  keypadGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    columnGap: 8,
    marginTop: 4,
    marginBottom: 8
  },
  keypadCell: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  keypadBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#f2f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3
  },
  clearKeypadBtn: {
    backgroundColor: '#f2f4f6'
  },
  keypadBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }]
  },
  keypadBtnText: {
    color: '#172B3E',
    fontSize: 24,
    fontFamily: 'Inter_700Bold'
  },
  clearText: {
    color: '#0f2038'
  },
  biometricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 8,
    width: '100%'
  },
  biometricText: {
    color: '#12B76A',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold'
  }
});
