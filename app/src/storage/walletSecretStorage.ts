import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import algosdk from 'algosdk';

const WALLET_SECRET_KEY = 'ghostpay.wallet.secretKey.base64';
const WALLET_SECRET_PREFIX = 'ghostpay.wallet.secret.';
const WALLET_PENDING_MNEMONIC = 'ghostpay.wallet.pendingMnemonic';

type PendingMnemonicPayload = {
  address: string;
  mnemonic: string;
  createdAt: string;
};

export async function saveWalletSecretKey(address: string, secretKey: Uint8Array): Promise<void> {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    throw new Error('Wallet address is required to store secret key');
  }

  const base64 = Buffer.from(secretKey).toString('base64');
  const key = `${WALLET_SECRET_PREFIX}${normalizedAddress}`;

  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, base64);
    return;
  }

  await SecureStore.setItemAsync(key, base64, {
    keychainService: 'ghostpay.wallet',
    requireAuthentication: false
  });
}

export async function loadWalletSecretKey(address: string): Promise<Uint8Array | null> {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return null;
  }

  const key = `${WALLET_SECRET_PREFIX}${normalizedAddress}`;
  const base64 = Platform.OS === 'web' ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key);

  if (base64) {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  const legacyBase64 = Platform.OS === 'web'
    ? await AsyncStorage.getItem(WALLET_SECRET_KEY)
    : await SecureStore.getItemAsync(WALLET_SECRET_KEY);

  if (!legacyBase64) {
    return null;
  }

  const legacySecret = Uint8Array.from(Buffer.from(legacyBase64, 'base64'));
  const legacyAddress = algosdk.encodeAddress(legacySecret.slice(32));
  if (legacyAddress !== normalizedAddress) {
    return null;
  }

  await saveWalletSecretKey(normalizedAddress, legacySecret);
  await clearSecureValue(WALLET_SECRET_KEY);
  return legacySecret;
}

export async function clearWalletSecretKey(address?: string): Promise<void> {
  if (address) {
    await clearSecureValue(`${WALLET_SECRET_PREFIX}${address.trim()}`);

    const legacyBase64 = Platform.OS === 'web'
      ? await AsyncStorage.getItem(WALLET_SECRET_KEY)
      : await SecureStore.getItemAsync(WALLET_SECRET_KEY);

    if (legacyBase64) {
      const legacySecret = Uint8Array.from(Buffer.from(legacyBase64, 'base64'));
      const legacyAddress = algosdk.encodeAddress(legacySecret.slice(32));
      if (legacyAddress === address.trim()) {
        await clearSecureValue(WALLET_SECRET_KEY);
      }
    }

    return;
  }

  await clearSecureValue(WALLET_SECRET_KEY);
  await clearSecureValue(WALLET_PENDING_MNEMONIC);
}

async function setSecureValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainService: 'ghostpay.wallet',
    requireAuthentication: false
  });
}

async function getSecureValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function clearSecureValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function savePendingMnemonic(address: string, mnemonic: string): Promise<void> {
  const payload: PendingMnemonicPayload = {
    address,
    mnemonic,
    createdAt: new Date().toISOString()
  };

  await setSecureValue(WALLET_PENDING_MNEMONIC, JSON.stringify(payload));
}

export async function consumePendingMnemonic(address: string): Promise<string | null> {
  const raw = await getSecureValue(WALLET_PENDING_MNEMONIC);
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as PendingMnemonicPayload;
    if (!payload?.address || !payload?.mnemonic || payload.address !== address) {
      return null;
    }

    await clearSecureValue(WALLET_PENDING_MNEMONIC);
    return payload.mnemonic;
  } catch {
    await clearSecureValue(WALLET_PENDING_MNEMONIC);
    return null;
  }
}

export async function clearPendingMnemonic(): Promise<void> {
  await clearSecureValue(WALLET_PENDING_MNEMONIC);
}
