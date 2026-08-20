import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_HASH_KEY = 'ghostpay.security.pinHash';

function ensureNativeSecureStorage(): void {
  if (Platform.OS === 'web') {
    throw new Error('App Lock is available only in the GhostPay mobile app.');
  }
}

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function savePin(pin: string): Promise<void> {
  ensureNativeSecureStorage();
  const pinHash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, pinHash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  ensureNativeSecureStorage();
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) {
    return false;
  }

  return storedHash === await hashPin(pin);
}

export async function changePin(currentPin: string, newPin: string): Promise<boolean> {
  const isCurrentPinValid = await verifyPin(currentPin);
  if (!isCurrentPinValid) {
    return false;
  }

  await savePin(newPin);
  return true;
}

export async function removePin(): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
}

export async function hasPin(): Promise<boolean> {
  ensureNativeSecureStorage();
  return Boolean(await SecureStore.getItemAsync(PIN_HASH_KEY));
}

export async function canUseBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync()
  ]);

  return hasHardware && isEnrolled;
}

export async function authenticateBiometric(): Promise<boolean> {
  if (!(await canUseBiometrics())) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock GhostPay',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'weak'
  });

  return result.success;
}

export async function getBiometricName(): Promise<string> {
  return 'Biometric';
}
