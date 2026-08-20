import 'react-native-get-random-values';
import { Ionicons } from '@expo/vector-icons';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => { });
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { ToastConfigParams } from 'react-native-toast-message';
import { LockScreen } from '../src/components/security/LockScreen';
import { useSecurityStore } from '../src/store/securityStore';
import { useWalletStore } from '../src/store/walletStore';
import { authenticateBiometric, getBiometricName, verifyPin } from '../src/utils/security';

const toastConfig = {
  success: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[toastStyles.snackbarContainer, toastStyles.successSnackbar]}>
      <Ionicons name="checkmark-circle" size={24} color="#05DA93" style={toastStyles.toastIcon} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.toastTitle}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.toastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[toastStyles.snackbarContainer, toastStyles.errorSnackbar]}>
      <Ionicons name="alert-circle" size={24} color="#F04438" style={toastStyles.toastIcon} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.toastTitle}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.toastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: ToastConfigParams<any>) => (
    <View style={[toastStyles.snackbarContainer, toastStyles.infoSnackbar]}>
      <Ionicons name="information-circle" size={24} color="#2E90FA" style={toastStyles.toastIcon} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.toastTitle}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.toastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  )
};

export default function RootLayout() {
  const router = useRouter();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSecurityReady, setIsSecurityReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [securityError, setSecurityError] = useState<string | undefined>();
  const [biometricName, setBiometricName] = useState('Biometric');

  const [fontsLoaded] = useFonts({
    Orbitron_700Bold,
    Rajdhani_700Bold,
    Rajdhani_600SemiBold,
    Rajdhani_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  const walletAddress = useWalletStore((state) => state.walletAddress);
  const setConnectionStatus = useWalletStore((state) => state.setConnectionStatus);
  const syncPendingTransactions = useWalletStore((state) => state.syncPendingTransactions);
  const hydrateSampleData = useWalletStore((state) => state.hydrateSampleData);
  const loadNetworkInfo = useWalletStore((state) => state.loadNetworkInfo);
  const biometricEnabled = useSecurityStore((state) => state.biometricEnabled);
  const unlock = useSecurityStore((state) => state.unlock);

  useEffect(() => {
    hydrateSampleData();
    void loadNetworkInfo();

    const loaderTimer = setTimeout(() => {
      setIsAppLoading(false);
      void SplashScreen.hideAsync().catch(() => { });
    }, 600);

    return () => clearTimeout(loaderTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadNetworkInfo();
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Global NetInfo Auto-Broadcaster listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      if (isOnline) {
        const store = useWalletStore.getState();
        const pendingCount = (store.transactions || []).filter(
          (tx) => tx.status === 'pending' || tx.status === 'syncing'
        ).length;

        if (pendingCount > 0 && !store.isSyncing) {
          Toast.show({
            type: 'info',
            text1: 'Internet Connection Active',
            text2: `Broadcasting ${pendingCount} pending offline transaction(s)...`
          });
          void store.syncPendingTransactions();
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);



  useEffect(() => {
    let isMounted = true;

    const initializeSecurity = async () => {
      let securityState = useSecurityStore.getState();
      let name = 'Biometric';

      try {
        await useSecurityStore.persist.rehydrate();
        securityState = useSecurityStore.getState();
        securityState.initialize();

        try {
          name = await getBiometricName();
        } catch {
          name = 'Biometric';
        }
      } catch {
        securityState.initialize();
      } finally {
        if (!isMounted) {
          return;
        }

        setBiometricName(name);
        setIsLocked(securityState.appLockEnabled);
        setIsSecurityReady(true);
      }
    };

    void initializeSecurity();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    let currentAppState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (currentAppState === 'active' && (nextAppState === 'inactive' || nextAppState === 'background')) {
        backgroundedAt = Date.now();
      }

      if (nextAppState === 'active' && backgroundedAt !== null) {
        const securityState = useSecurityStore.getState();
        const elapsed = Date.now() - backgroundedAt;
        backgroundedAt = null;

        if (securityState.appLockEnabled && elapsed >= securityState.sessionTimeout) {
          securityState.lock();
          setSecurityError(undefined);
          setIsLocked(true);
        }
      }

      currentAppState = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const handlePinComplete = useCallback(async (pin: string): Promise<boolean> => {
    setIsAuthenticating(true);
    setSecurityError(undefined);

    try {
      const isPinValid = await verifyPin(pin);
      if (!isPinValid) {
        setSecurityError('Incorrect PIN. Try again.');
        return false;
      }

      unlock();
      setIsLocked(false);
      return true;
    } catch {
      setSecurityError('Unable to verify your PIN. Try again.');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [unlock]);

  const handleBiometricUnlock = useCallback(async (isAutomatic = false): Promise<void> => {
    setIsAuthenticating(true);
    setSecurityError(undefined);

    try {
      const isAuthenticated = await authenticateBiometric();
      if (!isAuthenticated) {
        if (!isAutomatic) {
          setSecurityError('Biometric authentication was not completed. Use your PIN.');
        }
        return;
      }

      unlock();
      setIsLocked(false);
    } catch {
      if (!isAutomatic) {
        setSecurityError('Biometric authentication is unavailable. Use your PIN.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [unlock]);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setConnectionStatus(online);
      if (online) {
        void syncPendingTransactions();
      }
    });

    void NetInfo.fetch().then((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setConnectionStatus(online);
      if (online) {
        void syncPendingTransactions();
      }
    });

    return () => subscription();
  }, [setConnectionStatus, syncPendingTransactions]);

  if (!fontsLoaded) {
    return (
      <View style={splashStyles.fullScreenOverlay}>
        <StatusBar style="light" />
        <Image
          source={require('../assets/branding/ghostpay-logo.png')}
          style={splashStyles.logoImage}
          resizeMode="contain"
        />
        <Text style={splashStyles.connectingTextFallback}>Connecting...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen name='analytics' />
        <Stack.Screen name='settings' />
        <Stack.Screen name='profile' />
        <Stack.Screen name='+not-found' />
      </Stack>
      <StatusBar style='light' />
      {Platform.OS !== 'web' || isClientMounted ? <Toast config={toastConfig} /> : null}

      {isAppLoading && (
        <Pressable
          style={splashStyles.fullScreenOverlay}
          onPress={() => {
            setIsAppLoading(false);
            void SplashScreen.hideAsync().catch(() => { });
          }}
        >
          <StatusBar style="light" />
          <Image
            source={require('../assets/branding/ghostpay-logo.png')}
            style={splashStyles.logoImage}
            resizeMode="contain"
          />
          <Text style={splashStyles.connectingText}>Connecting...</Text>
        </Pressable>
      )}
      {isSecurityReady && isLocked && !isAppLoading ? (
        <LockScreen
          biometricEnabled={biometricEnabled}
          biometricName={biometricName}
          isAuthenticating={isAuthenticating}
          errorMessage={securityError}
          onPinComplete={handlePinComplete}
          onBiometricPress={handleBiometricUnlock}
        />
      ) : null}
    </SafeAreaProvider>
  );
}

const toastStyles = StyleSheet.create({
  snackbarContainer: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#172B3E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12
  },
  successSnackbar: {
    borderColor: 'rgba(5, 218, 147, 0.4)',
    borderLeftWidth: 5,
    borderLeftColor: '#05DA93',
    shadowColor: '#05DA93'
  },
  errorSnackbar: {
    borderColor: 'rgba(240, 68, 56, 0.4)',
    borderLeftWidth: 5,
    borderLeftColor: '#F04438',
    shadowColor: '#F04438'
  },
  infoSnackbar: {
    borderColor: 'rgba(46, 144, 250, 0.4)',
    borderLeftWidth: 5,
    borderLeftColor: '#2E90FA',
    shadowColor: '#2E90FA'
  },
  toastIcon: {
    marginRight: 12
  },
  textContainer: {
    flex: 1
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 2
  },
  toastSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  }
});

const splashStyles = StyleSheet.create({
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999
  },
  logoImage: {
    width: 184,
    height: 184
  },
  connectingTextFallback: {
    color: '#05DA93',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    letterSpacing: 1.2
  },
  connectingText: {
    color: '#05DA93',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 18,
    letterSpacing: 1.2
  }
});
