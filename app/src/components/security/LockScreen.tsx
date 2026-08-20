import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

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

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={34} color={colors.secondary} />
        </View>

        <Text style={styles.title}>GhostPay Locked</Text>
        <Text style={styles.subtitle}>
          {biometricEnabled ? `Use ${biometricName} or enter your PIN` : 'Enter your 4-digit PIN to continue'}
        </Text>

        <View style={styles.pinDots}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[styles.pinDot, pin.length > index && styles.pinDotFilled]} />
          ))}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {biometricEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Unlock with ${biometricName}`}
            disabled={isAuthenticating}
            onPress={() => void onBiometricPress()}
            style={[styles.biometricButton, isAuthenticating && styles.buttonDisabled]}
          >
            <Ionicons name="finger-print" size={22} color={colors.secondary} />
            <Text style={styles.biometricButtonText}>
              {isAuthenticating ? 'Authenticating...' : `Use ${biometricName}`}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'].map((key, index) => {
            if (!key) {
              return <View key={`empty-${index}`} style={styles.keypadButton} />;
            }

            if (key === 'backspace') {
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel="Delete PIN digit"
                  disabled={isAuthenticating}
                  onPress={() => setPin((current) => current.slice(0, -1))}
                  style={styles.keypadButton}
                >
                  <Ionicons name="backspace-outline" size={24} color={colors.white} />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`PIN digit ${key}`}
                disabled={isAuthenticating}
                onPress={() => handleNumberPress(key)}
                style={styles.keypadButton}
              >
                <Text style={styles.keypadNumber}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#0D1E2F',
    zIndex: 100000,
    elevation: 100000
  },
  card: {
    width: '100%',
    maxWidth: 420,
    height: '58%',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#172B3E',
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 16
  },
  iconCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    marginBottom: 10
  },
  title: {
    color: colors.white,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 19,
    textAlign: 'center'
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center'
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    marginBottom: 12
  },
  pinDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  pinDotFilled: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary
  },
  errorText: {
    color: '#F97066',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center'
  },
  biometricButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.38)',
    backgroundColor: 'rgba(5, 218, 147, 0.1)',
    paddingVertical: 12,
    marginBottom: 16
  },
  biometricButtonText: {
    color: colors.secondary,
    fontFamily: 'Inter_700Bold',
    fontSize: 13
  },
  buttonDisabled: {
    opacity: 0.65
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
    width: '100%',
    marginTop: 8
  },
  keypadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
    height: 42,
    borderRadius: 14
  },
  keypadNumber: {
    color: colors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 22
  }
});
