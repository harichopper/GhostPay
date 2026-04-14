import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Rajdhani_700Bold, Rajdhani_500Medium } from '@expo-google-fonts/rajdhani';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../src/store/walletStore';

export default function RootLayout() {
  const [isClientMounted, setIsClientMounted] = useState(false);

  const [fontsLoaded] = useFonts({
    Orbitron_700Bold,
    Rajdhani_700Bold,
    Rajdhani_500Medium
  });

  const setConnectionStatus = useWalletStore((state) => state.setConnectionStatus);
  const syncPendingTransactions = useWalletStore((state) => state.syncPendingTransactions);
  const hydrateSampleData = useWalletStore((state) => state.hydrateSampleData);
  const loadNetworkInfo = useWalletStore((state) => state.loadNetworkInfo);

  useEffect(() => {
    hydrateSampleData();
    void loadNetworkInfo();
  }, [hydrateSampleData, loadNetworkInfo]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadNetworkInfo();
    }, 15000);

    return () => clearInterval(timer);
  }, [loadNetworkInfo]);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

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
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen name='identity' />
        <Stack.Screen name='settings' />
      </Stack>
      <StatusBar style='light' />
      {Platform.OS !== 'web' || isClientMounted ? <Toast /> : null}
    </SafeAreaProvider>
  );
}
