import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import algosdk from 'algosdk';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { AppChrome, CHROME_SIDEBAR_WIDTH, CHROME_TOP_HEIGHT } from '../src/components/AppChrome';
import { MnemonicBackupModal } from '../src/components/MnemonicBackupModal';
import { WalletQrModal } from '../src/components/WalletQrModal';
import {
  clearPendingMnemonic,
  clearWalletSecretKey,
  consumePendingMnemonic,
  loadWalletSecretKey,
  savePendingMnemonic,
  saveWalletSecretKey
} from '../src/storage/walletSecretStorage';
import { useWalletStore } from '../src/store/walletStore';
import { shortAddress } from '../src/utils/format';

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const withSidebar = Platform.OS === 'web' && width >= 1024;

  const walletAddress = useWalletStore((state) => state.walletAddress);
  const wallets = useWalletStore((state) => state.wallets);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const addWallet = useWalletStore((state) => state.addWallet);
  const removeWallet = useWalletStore((state) => state.removeWallet);

  const [busy, setBusy] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [backupMnemonic, setBackupMnemonic] = useState('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const loadOneTimeMnemonic = async () => {
      if (!walletAddress) {
        return;
      }

      const pendingMnemonic = await consumePendingMnemonic(walletAddress);
      if (pendingMnemonic) {
        setBackupMnemonic(pendingMnemonic);
      }
    };

    void loadOneTimeMnemonic();
  }, [walletAddress]);

  const createWallet = async () => {
    setBusy(true);
    try {
      const account = algosdk.generateAccount();
      const address = account.addr.toString();
      const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

      await saveWalletSecretKey(address, account.sk);
      await savePendingMnemonic(address, mnemonic);
      addWallet(address, `Wallet ${wallets.length + 1}`);
      setWalletAddress(address);
      setBackupMnemonic((await consumePendingMnemonic(address)) ?? '');
      setImportMnemonic('');
      Toast.show({
        type: 'success',
        text1: 'Wallet created',
        text2: 'Backup phrase is shown once. Save it now.'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Wallet creation failed',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setBusy(false);
    }
  };

  const importWallet = async () => {
    if (!importMnemonic.trim()) {
      Toast.show({ type: 'error', text1: 'Enter 25-word mnemonic first' });
      return;
    }

    setBusy(true);
    try {
      const account = algosdk.mnemonicToSecretKey(importMnemonic.trim().replace(/\s+/g, ' '));
      const importedAddress = account.addr.toString();
      await saveWalletSecretKey(importedAddress, account.sk);
      addWallet(importedAddress, `Imported ${wallets.length + 1}`);
      setWalletAddress(importedAddress);
      await clearPendingMnemonic();
      setBackupMnemonic('');
      setImportMnemonic('');
      Toast.show({ type: 'success', text1: 'Wallet imported and secured locally' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Invalid mnemonic',
        text2: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setBusy(false);
    }
  };

  const removeActiveWallet = async () => {
    if (!walletAddress) {
      Toast.show({ type: 'error', text1: 'No active wallet selected' });
      return;
    }

    setBusy(true);
    try {
      await clearWalletSecretKey(walletAddress);
      removeWallet(walletAddress);
      setBackupMnemonic('');
      setImportMnemonic('');
      Toast.show({ type: 'success', text1: 'Wallet removed from this device' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to clear wallet',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setBusy(false);
    }
  };

  const copyMnemonic = async () => {
    if (!backupMnemonic) {
      return;
    }

    try {
      await Clipboard.setStringAsync(backupMnemonic);
      Toast.show({ type: 'success', text1: 'Mnemonic copied', text2: 'Paste it into your secure notes' });
    } catch {
      Toast.show({ type: 'error', text1: 'Copy failed', text2: 'Please screenshot or copy manually' });
    }
  };

  const acknowledgeBackup = () => {
    setBackupMnemonic('');
    Toast.show({ type: 'success', text1: 'Backup phrase hidden', text2: 'It will not be shown again' });
  };

  return (
    <LinearGradient colors={['#111417', '#131B24', '#111417']} style={styles.screen}>
      <AppChrome activeSection='settings' />

      <ScrollView contentContainerStyle={[styles.content, withSidebar && styles.contentWithSidebar]}>
        <Animated.View entering={FadeInDown.duration(420).springify()}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSub}>Wallet security and key management</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(460).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Wallets</Text>
          <Text style={styles.address}>{walletAddress || 'No wallet configured yet'}</Text>

          {wallets.length > 0 ? (
            <View style={styles.walletListWrap}>
              {wallets.map((item) => {
                const active = item.address === walletAddress;
                return (
                  <Pressable
                    key={item.address}
                    style={[styles.walletListItem, active && styles.walletListItemActive]}
                    onPress={() => setWalletAddress(item.address)}
                  >
                    <View style={styles.walletListTextCol}>
                      <Text style={styles.walletListLabel}>{item.label}</Text>
                      <Text style={styles.walletListAddress}>{shortAddress(item.address, 10, 8)}</Text>
                    </View>
                    {active ? <Text style={styles.walletListActive}>Active</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.row}>
            <Pressable style={styles.secondaryBtn} onPress={() => (walletAddress ? setShowQr(true) : Toast.show({ type: 'error', text1: 'Create or import wallet first' }))}>
              <MaterialIcons name='qr-code' size={18} color='#00F5FF' />
              <Text style={styles.secondaryBtnText}>Show Receive QR</Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={() => void removeActiveWallet()} disabled={busy || !walletAddress}>
              <MaterialIcons name='delete-outline' size={18} color='#FFB4AB' />
              <Text style={styles.dangerBtnText}>{busy ? 'WORKING...' : 'Remove Active Wallet'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>{wallets.length === 0 ? 'Create First Wallet' : 'Add New Wallet'}</Text>
          <Text style={styles.cardSub}>Generate an additional Algorand wallet with one-time 25-word backup phrase popup.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void createWallet()} disabled={busy}>
            <MaterialIcons name='add-circle-outline' size={20} color='#002021' />
            <Text style={styles.primaryBtnText}>{busy ? 'GENERATING...' : wallets.length === 0 ? 'Create Wallet' : 'Add New Wallet'}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(520).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Import Existing Wallet</Text>
          <TextInput
            value={importMnemonic}
            onChangeText={setImportMnemonic}
            placeholder='Paste 25-word mnemonic'
            placeholderTextColor='rgba(185,202,202,0.35)'
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <Pressable style={styles.secondaryBtnWide} onPress={() => void importWallet()} disabled={busy}>
            <MaterialIcons name='vpn-key' size={18} color='#00F5FF' />
            <Text style={styles.secondaryBtnText}>{busy ? 'IMPORTING...' : 'Import from Mnemonic'}</Text>
          </Pressable>
        </Animated.View>

      </ScrollView>

      <WalletQrModal visible={showQr} walletAddress={walletAddress} onClose={() => setShowQr(false)} />
      <MnemonicBackupModal
        visible={Boolean(backupMnemonic)}
        mnemonic={backupMnemonic}
        onCopy={() => void copyMnemonic()}
        onDone={acknowledgeBackup}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingTop: CHROME_TOP_HEIGHT + 18,
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 12,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center'
  },
  contentWithSidebar: {
    paddingLeft: CHROME_SIDEBAR_WIDTH + 24,
    paddingRight: 24
  },
  pageTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 38
  },
  pageSub: {
    marginTop: 4,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 15
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(29,32,35,0.85)',
    padding: 14
  },
  cardTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16
  },
  cardSub: {
    marginTop: 4,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13
  },
  address: {
    marginTop: 4,
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  walletListWrap: {
    marginTop: 10,
    gap: 8
  },
  walletListItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(17,20,23,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  walletListItemActive: {
    borderColor: 'rgba(0,245,255,0.45)',
    backgroundColor: 'rgba(0,245,255,0.08)'
  },
  walletListTextCol: {
    flex: 1
  },
  walletListLabel: {
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  walletListAddress: {
    marginTop: 2,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  walletListActive: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  primaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    height: 46,
    backgroundColor: '#00F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  primaryBtnText: {
    color: '#002021',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 0.7
  },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.35)',
    backgroundColor: 'rgba(0,245,255,0.12)',
    paddingHorizontal: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  secondaryBtnWide: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.35)',
    backgroundColor: 'rgba(0,245,255,0.12)',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  secondaryBtnText: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  dangerBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.35)',
    backgroundColor: 'rgba(255,180,171,0.1)',
    paddingHorizontal: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  dangerBtnText: {
    color: '#FFB4AB',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  input: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(17,20,23,0.9)',
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_500Medium',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 76,
    textAlignVertical: 'top'
  }
});
