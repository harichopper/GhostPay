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
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { ToastConfigParams } from 'react-native-toast-message';
import { useWalletStore } from '../src/store/walletStore';

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
  const [isClientMounted, setIsClientMounted] = useState(false);

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
        <Stack.Screen name='analytics' />
        <Stack.Screen name='settings' />
      </Stack>
      <StatusBar style='light' />
      {Platform.OS !== 'web' || isClientMounted ? <Toast config={toastConfig} /> : null}
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
