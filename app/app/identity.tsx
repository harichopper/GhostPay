import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import algosdk from 'algosdk';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { AppChrome, CHROME_SIDEBAR_WIDTH, CHROME_TOP_HEIGHT } from '../src/components/AppChrome';
import { MnemonicBackupModal } from '../src/components/MnemonicBackupModal';
import {
  lookupIdentityByWallet,
  lookupWalletsByMobile,
  requestMobileVerification,
  verifyMobileAndLinkWallet
} from '../src/services/api';
import {
  clearPendingMnemonic,
  consumePendingMnemonic,
  savePendingMnemonic,
  saveWalletSecretKey
} from '../src/storage/walletSecretStorage';
import { useWalletStore } from '../src/store/walletStore';
import type { WalletLookupResponse } from '../src/types/transaction';
import { shortAddress } from '../src/utils/format';

const COUNTRY_OPTIONS = [
  { code: '+1', label: 'US/CA' },
  { code: '+44', label: 'UK' },
  { code: '+49', label: 'DE' },
  { code: '+33', label: 'FR' },
  { code: '+91', label: 'IN' },
  { code: '+61', label: 'AU' },
  { code: '+81', label: 'JP' },
  { code: '+65', label: 'SG' }
] as const;

function buildFullMobile(countryCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '');
  return `${countryCode}${digits}`;
}

export default function IdentityScreen() {
  const { width } = useWindowDimensions();
  const withSidebar = Platform.OS === 'web' && width >= 1024;

  const walletAddress = useWalletStore((state) => state.walletAddress);
  const wallets = useWalletStore((state) => state.wallets);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const addWallet = useWalletStore((state) => state.addWallet);

  const [mobileNumber, setMobileNumber] = useState('');
  const [countryCode, setCountryCode] = useState<(typeof COUNTRY_OPTIONS)[number]['code']>('+1');
  const [showCountryOptions, setShowCountryOptions] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [walletLabel, setWalletLabel] = useState('Primary Wallet');
  const [requestBusy, setRequestBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [backupMnemonic, setBackupMnemonic] = useState('');
  const [showImportSeed, setShowImportSeed] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [identityLoading, setIdentityLoading] = useState(false);
  const [linkedMobile, setLinkedMobile] = useState('');
  const [linkedVerified, setLinkedVerified] = useState(false);
  const [contactLookupInput, setContactLookupInput] = useState('');
  const [contactLookupBusy, setContactLookupBusy] = useState(false);
  const [contactLookupResult, setContactLookupResult] = useState<WalletLookupResponse | null>(null);

  const fullMobileNumber = buildFullMobile(countryCode, mobileNumber);

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

  useEffect(() => {
    const loadIdentity = async () => {
      if (!walletAddress) {
        setLinkedMobile('');
        setLinkedVerified(false);
        return;
      }

      setIdentityLoading(true);
      try {
        const result = await lookupIdentityByWallet(walletAddress);
        if (!result.identity) {
          setLinkedMobile('');
          setLinkedVerified(false);
          return;
        }

        setLinkedMobile(result.identity.mobileNumber);
        setLinkedVerified(result.identity.verified);
      } catch {
        setLinkedMobile('');
        setLinkedVerified(false);
      } finally {
        setIdentityLoading(false);
      }
    };

    void loadIdentity();
  }, [walletAddress]);

  const requestOtp = async () => {
    if (mobileNumber.replace(/\D/g, '').length < 6) {
      Toast.show({ type: 'error', text1: 'Enter mobile number first' });
      return;
    }

    setRequestBusy(true);
    try {
      const response = await requestMobileVerification(fullMobileNumber);
      setOtpRequested(true);
      setShowCountryOptions(false);
      Toast.show({
        type: 'success',
        text1: 'Access key sent',
        text2: response.devOtpCode ? `Dev OTP: ${response.devOtpCode}` : 'Check your SMS inbox'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to request OTP',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setRequestBusy(false);
    }
  };

  const verifyAndLink = async () => {
    if (mobileNumber.replace(/\D/g, '').length < 6 || !otpCode || !walletAddress) {
      Toast.show({ type: 'error', text1: 'Mobile, OTP and wallet are required' });
      return;
    }

    setVerifyBusy(true);
    try {
      await verifyMobileAndLinkWallet({
        mobileNumber: fullMobileNumber,
        otpCode,
        walletAddress,
        walletLabel
      });
      setLinkedMobile(fullMobileNumber);
      setLinkedVerified(true);
      Toast.show({ type: 'success', text1: 'Wallet linked to mobile identity' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification failed',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setVerifyBusy(false);
    }
  };

  const createWalletLocally = async () => {
    setWalletBusy(true);
    try {
      const account = algosdk.generateAccount();
      const address = account.addr.toString();
      const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

      await saveWalletSecretKey(address, account.sk);
      await savePendingMnemonic(address, mnemonic);
      addWallet(address, `Wallet ${wallets.length + 1}`);
      setWalletAddress(address);
      setBackupMnemonic((await consumePendingMnemonic(address)) ?? '');
      setShowImportSeed(false);
      setImportMnemonic('');
      Toast.show({ type: 'success', text1: 'Wallet added', text2: 'Backup phrase is shown once. Save it now.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to generate wallet',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const importWalletFromMnemonic = async () => {
    if (!importMnemonic.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a 25-word mnemonic first' });
      return;
    }

    setWalletBusy(true);
    try {
      const account = algosdk.mnemonicToSecretKey(importMnemonic.trim().replace(/\s+/g, ' '));
      const importedAddress = account.addr.toString();
      await saveWalletSecretKey(importedAddress, account.sk);
      addWallet(importedAddress, `Imported ${wallets.length + 1}`);
      setWalletAddress(importedAddress);
      await clearPendingMnemonic();
      setBackupMnemonic('');
      setShowImportSeed(false);
      setImportMnemonic('');
      Toast.show({ type: 'success', text1: 'Wallet imported and secured locally' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Invalid mnemonic',
        text2: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setWalletBusy(false);
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

  const copyLinkedIdentifier = async () => {
    if (!linkedMobile) {
      return;
    }

    try {
      await Clipboard.setStringAsync(linkedMobile);
      Toast.show({ type: 'success', text1: 'Mobile identifier copied' });
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to copy identifier' });
    }
  };

  const lookupContactIdentifier = async () => {
    const digits = contactLookupInput.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      Toast.show({ type: 'error', text1: 'Enter a valid mobile identifier' });
      return;
    }

    setContactLookupBusy(true);
    try {
      const result = await lookupWalletsByMobile(contactLookupInput);
      setContactLookupResult(result);

      if (!result.verified || result.wallets.length === 0) {
        Toast.show({ type: 'error', text1: 'Identifier is not linked to a verified wallet' });
        return;
      }

      Toast.show({ type: 'success', text1: 'Contact identifier resolved' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Lookup failed',
        text2: error instanceof Error ? error.message : 'Unknown error'
      });
      setContactLookupResult(null);
    } finally {
      setContactLookupBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#111417', '#131B24', '#111417']} style={styles.screen}>
      <AppChrome activeSection='contacts' />

      <View style={styles.backgroundGlowWrap} pointerEvents='none'>
        <View style={styles.coreGlow} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, withSidebar && styles.contentWithSidebar]}>
        <Animated.View entering={FadeInUp.duration(450).springify()} style={styles.identityNodeWrap}>
          <View style={styles.identityNodeOuter}>
            <View style={styles.identityNodeInner}>
              <MaterialIcons name='fingerprint' size={50} color='#002021' />
            </View>
            <View style={styles.identityOrbitCard}>
              <MaterialIcons name='shield' size={18} color='#00F5FF' />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(500).springify()}>
          <View style={styles.header}>
            <Text style={styles.brand}>GhostPay</Text>
            <Text style={styles.brandSub}>Nexus Identity Protocol</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(72).duration(500).springify()} style={styles.glassCard}>
          <View style={styles.stepHeader}>
            <View>
              <Text style={styles.stepTitle}>Linked Identifier</Text>
              <Text style={styles.stepDesc}>Only linked mobile identities can send and receive</Text>
            </View>
            <Text style={[styles.stepBadge, linkedVerified && styles.stepBadgeSuccess]}>{linkedVerified ? 'Verified' : 'Not Linked'}</Text>
          </View>

          <Text style={styles.mobilePreview}>Active wallet: {walletAddress ? shortAddress(walletAddress, 8, 8) : 'Not selected'}</Text>
          <Text style={styles.mobilePreview}>
            {identityLoading
              ? 'Checking linked identifier...'
              : linkedMobile
                ? `Identifier: ${linkedMobile}`
                : 'No linked mobile identifier for this wallet yet'}
          </Text>

          <View style={styles.linkedActionsRow}>
            <Pressable style={styles.secondaryButtonCompact} onPress={() => void copyLinkedIdentifier()} disabled={!linkedMobile}>
              <Text style={styles.secondaryButtonText}>{linkedMobile ? 'Copy Identifier' : 'No Identifier'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(530).springify()} style={styles.glassCard}>
          <View style={styles.stepMarker} />
          <View style={styles.stepHeader}>
            <View>
              <Text style={styles.stepTitle}>Identity Sync</Text>
              <Text style={styles.stepDesc}>Connect your cellular node</Text>
            </View>
            <Text style={styles.stepBadge}>Step 01</Text>
          </View>

          <View style={styles.mobileRow}>
            <Pressable style={styles.countryChip} onPress={() => setShowCountryOptions((prev) => !prev)}>
              <Text style={styles.countryText}>{countryCode}</Text>
              <MaterialIcons name='expand-more' size={16} color='#B9CACA' />
            </Pressable>
            <TextInput
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder='(555) 000-0000'
              placeholderTextColor='rgba(185,202,202,0.35)'
              keyboardType='phone-pad'
              style={styles.mobileInput}
            />
          </View>

          {showCountryOptions ? (
            <View style={styles.countryOptionsWrap}>
              {COUNTRY_OPTIONS.map((option) => (
                <Pressable
                  key={option.code}
                  style={[styles.countryOptionItem, countryCode === option.code && styles.countryOptionItemActive]}
                  onPress={() => {
                    setCountryCode(option.code);
                    setShowCountryOptions(false);
                  }}
                >
                  <Text style={[styles.countryOptionText, countryCode === option.code && styles.countryOptionTextActive]}>
                    {option.label} {option.code}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.mobilePreview}>Verification target: {fullMobileNumber}</Text>

          {linkedVerified && linkedMobile ? (
            <View style={styles.alreadyLinkedNotice}>
              <Text style={styles.alreadyLinkedText}>This wallet is already linked to a verified mobile number.</Text>
            </View>
          ) : (
            <Pressable style={styles.primaryButton} onPress={() => void requestOtp()} disabled={requestBusy}>
              <LinearGradient colors={['#E9FEFF', '#00DCE5']} style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonText}>{requestBusy ? 'REQUESTING...' : 'REQUEST ACCESS KEY'}</Text>
                <MaterialIcons name='arrow-forward' size={18} color='#002021' />
              </LinearGradient>
            </Pressable>
          )}
        </Animated.View>

        {!linkedVerified ? (
          <Animated.View entering={FadeInDown.delay(120).duration(540).springify()} style={[styles.glassCard, !otpRequested && styles.dimmedCard]}>
          <View style={styles.stepHeader}>
            <View>
              <Text style={styles.stepTitle}>Key Verification</Text>
              <Text style={styles.stepDesc}>Enter the 6-digit pulse sequence</Text>
            </View>
            <Text style={[styles.stepBadge, styles.stepBadgeMuted]}>Step 02</Text>
          </View>

          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder='123456'
            placeholderTextColor='rgba(185,202,202,0.35)'
            keyboardType='number-pad'
            style={styles.otpInput}
            maxLength={6}
          />

          <TextInput
            value={walletLabel}
            onChangeText={setWalletLabel}
            placeholder='Wallet label'
            placeholderTextColor='rgba(185,202,202,0.35)'
            style={styles.walletLabelInput}
          />

          <Pressable style={styles.secondaryButton} onPress={() => void verifyAndLink()} disabled={verifyBusy}>
            <Text style={styles.secondaryButtonText}>{verifyBusy ? 'VERIFYING...' : 'VERIFY + LINK WALLET'}</Text>
          </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(140).duration(550).springify()} style={styles.glassCard}>
          <View style={styles.stepHeader}>
            <View>
              <Text style={styles.stepTitle}>Contact Lookup</Text>
              <Text style={styles.stepDesc}>Verify receiver by mobile identifier before sending</Text>
            </View>
            <Text style={[styles.stepBadge, styles.stepBadgeMuted]}>Directory</Text>
          </View>

          <TextInput
            value={contactLookupInput}
            onChangeText={setContactLookupInput}
            placeholder='+1 555 000 0000'
            placeholderTextColor='rgba(185,202,202,0.35)'
            keyboardType='phone-pad'
            style={styles.walletLabelInput}
          />

          <Pressable style={styles.secondaryButton} onPress={() => void lookupContactIdentifier()} disabled={contactLookupBusy}>
            <Text style={styles.secondaryButtonText}>{contactLookupBusy ? 'LOOKING UP...' : 'LOOKUP IDENTIFIER'}</Text>
          </Pressable>

          {contactLookupResult ? (
            <View style={styles.lookupResultCard}>
              <Text style={styles.lookupResultTitle}>Identifier: {contactLookupResult.mobileNumber}</Text>
              <Text style={styles.lookupResultMeta}>{contactLookupResult.verified ? 'Verified identity' : 'Not verified'}</Text>
              {contactLookupResult.wallets.length === 0 ? (
                <Text style={styles.lookupResultMeta}>No linked wallets found.</Text>
              ) : (
                contactLookupResult.wallets.map((wallet) => (
                  <Text key={wallet.address} style={styles.lookupResultItem}>
                    {wallet.label || 'Wallet'}: {shortAddress(wallet.address, 8, 8)}
                  </Text>
                ))
              )}
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(560).springify()}>
          <View style={styles.actionsHeaderWrap}>
            <View style={styles.actionsLine} />
            <Text style={styles.actionsHeader}>Asset Initialization</Text>
            <View style={styles.actionsLine} />
          </View>

          <Pressable style={styles.actionTile} onPress={() => void createWalletLocally()} disabled={walletBusy}>
            <View style={styles.actionIconPrimary}>
              <MaterialIcons name='add-circle' size={22} color='#00F5FF' />
            </View>
            <View style={styles.actionTileTextCol}>
              <Text style={styles.actionTileTitle}>{wallets.length === 0 ? 'Create Wallet' : 'Add New Wallet'}</Text>
              <Text style={styles.actionTileSub}>{walletBusy ? 'Generating and securing key...' : 'Create a fresh cryptographic node'}</Text>
            </View>
          </Pressable>

          <Pressable style={styles.actionTile} onPress={() => setShowImportSeed((prev) => !prev)}>
            <View style={styles.actionIconSecondary}>
              <MaterialIcons name='vpn-key' size={22} color='#90D5B7' />
            </View>
            <View style={styles.actionTileTextCol}>
              <Text style={styles.actionTileTitle}>Import Seed Phrase</Text>
              <Text style={styles.actionTileSub}>Restore using existing 25 words</Text>
            </View>
          </Pressable>

          {showImportSeed ? (
            <View style={styles.importCard}>
              <Text style={styles.importLabel}>Paste 25-word mnemonic</Text>
              <TextInput
                value={importMnemonic}
                onChangeText={setImportMnemonic}
                placeholder='word1 word2 ... word25'
                placeholderTextColor='rgba(185,202,202,0.35)'
                multiline
                numberOfLines={3}
                style={styles.importInput}
              />
              <Pressable style={styles.importButton} onPress={() => void importWalletFromMnemonic()}>
                <Text style={styles.importButtonText}>{walletBusy ? 'IMPORTING...' : 'IMPORT WALLET'}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.actionTile} onPress={() => void verifyAndLink()} disabled={verifyBusy}>
            <View style={styles.actionIconMuted}>
              <MaterialIcons name='link' size={22} color='#00DCE5' />
            </View>
            <View style={styles.actionTileTextCol}>
              <Text style={styles.actionTileTitle}>Link Mobile Identity</Text>
              <Text style={styles.actionTileSub}>Current wallet: {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Not set'}</Text>
            </View>
          </Pressable>

        </Animated.View>
      </ScrollView>

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
  screen: {
    flex: 1
  },
  backgroundGlowWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  coreGlow: {
    width: 620,
    height: 620,
    borderRadius: 999,
    backgroundColor: 'rgba(0,245,255,0.06)'
  },
  content: {
    paddingTop: CHROME_TOP_HEIGHT + 24,
    paddingHorizontal: 24,
    paddingBottom: 120,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    gap: 14
  },
  contentWithSidebar: {
    paddingLeft: CHROME_SIDEBAR_WIDTH + 24,
    paddingRight: 24
  },
  identityNodeWrap: {
    alignItems: 'center',
    marginTop: 10
  },
  identityNodeOuter: {
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F5FF',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 34,
    elevation: 12
  },
  identityNodeInner: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: '#00DCE5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  identityOrbitCard: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
    backgroundColor: 'rgba(50,53,57,0.85)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 6
  },
  brand: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 40,
    letterSpacing: -0.5
  },
  brandSub: {
    marginTop: 3,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(50,53,57,0.55)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(233,254,255,0.2)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(233,254,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)'
  },
  dimmedCard: {
    opacity: 0.5
  },
  stepMarker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    bottom: 0,
    backgroundColor: '#00F5FF',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12
  },
  stepTitle: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 24
  },
  stepDesc: {
    marginTop: 2,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13
  },
  stepBadge: {
    color: '#00F5FF',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11
  },
  stepBadgeMuted: {
    color: '#B9CACA',
    borderColor: 'rgba(185,202,202,0.25)'
  },
  stepBadgeSuccess: {
    color: '#90D5B7',
    borderColor: 'rgba(144,213,183,0.35)'
  },
  mobileRow: {
    flexDirection: 'row',
    gap: 8
  },
  countryChip: {
    width: 78,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(29,32,35,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2
  },
  countryText: {
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14
  },
  mobileInput: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(50,53,57,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 16
  },
  countryOptionsWrap: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.4)',
    backgroundColor: 'rgba(17,20,23,0.95)',
    overflow: 'hidden'
  },
  countryOptionItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,73,74,0.25)'
  },
  countryOptionItemActive: {
    backgroundColor: 'rgba(0,245,255,0.12)'
  },
  countryOptionText: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  countryOptionTextActive: {
    color: '#00F5FF'
  },
  mobilePreview: {
    marginTop: 8,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12
  },
  primaryButton: {
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden'
  },
  primaryButtonGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryButtonText: {
    color: '#002021',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    letterSpacing: 0.4
  },
  alreadyLinkedNotice: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(144,213,183,0.35)',
    backgroundColor: 'rgba(144,213,183,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  alreadyLinkedText: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  otpInput: {
    borderRadius: 10,
    backgroundColor: 'rgba(50,53,57,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center'
  },
  walletLabelInput: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(50,53,57,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 15
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
    backgroundColor: 'rgba(0,245,255,0.1)',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonCompact: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
    backgroundColor: 'rgba(0,245,255,0.1)',
    height: 40,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  secondaryButtonText: {
    color: '#00F5FF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 0.8
  },
  linkedActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  lookupResultCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(17,20,23,0.7)',
    padding: 10,
    gap: 4
  },
  lookupResultTitle: {
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  lookupResultMeta: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  lookupResultItem: {
    color: '#90D5B7',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12
  },
  actionsHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  actionsLine: {
    height: 1,
    flex: 1,
    backgroundColor: 'rgba(58,73,74,0.35)'
  },
  actionsHeader: {
    color: '#B9CACA',
    fontFamily: 'Rajdhani_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10
  },
  actionTile: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(50,53,57,0.45)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  actionIconPrimary: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,245,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionIconSecondary: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(144,213,183,0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionIconMuted: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,220,229,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionTileTextCol: {
    flex: 1
  },
  actionTileTitle: {
    color: '#E1E2E7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14
  },
  actionTileSub: {
    marginTop: 1,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  importCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(17,20,23,0.75)',
    padding: 10,
    marginBottom: 8
  },
  importLabel: {
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    marginBottom: 6
  },
  importInput: {
    minHeight: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(50,53,57,0.35)',
    color: '#E1E2E7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Rajdhani_500Medium',
    textAlignVertical: 'top'
  },
  importButton: {
    marginTop: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(144,213,183,0.35)',
    backgroundColor: 'rgba(144,213,183,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40
  },
  importButtonText: {
    color: '#90D5B7',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.7
  }
});
