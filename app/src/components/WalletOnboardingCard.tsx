import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../store/walletStore';
import { colors } from '../theme/colors';
import { MnemonicBackupModal } from './MnemonicBackupModal';

export function WalletOnboardingCard() {
  const { generateWalletAddress, importWalletFromMnemonic } = useWalletStore();
  const [onboardingMode, setOnboardingMode] = useState<'welcome' | 'import'>('welcome');
  const [loading, setLoading] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [createdMnemonic, setCreatedMnemonic] = useState('');
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);

  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      const generated = await generateWalletAddress();
      setCreatedMnemonic(generated.mnemonic);
      setShowMnemonicModal(true);
      Toast.show({
        type: 'success',
        text1: 'Wallet Created',
        text2: 'Save your mnemonic phrase now.'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: 'Could not create new wallet.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!importMnemonic.trim()) {
      Alert.alert('Error', 'Please enter your mnemonic seed phrase');
      return;
    }
    try {
      setLoading(true);
      const res = await importWalletFromMnemonic(importMnemonic, walletLabel);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Wallet Imported',
          text2: 'Switched to imported wallet.'
        });
        setImportMnemonic('');
        setWalletLabel('');
        setOnboardingMode('welcome');
      } else {
        Alert.alert('Import Error', res.error || 'Failed to import wallet');
      }
    } catch {
      Alert.alert('Import Error', 'Failed to import wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMnemonic = async () => {
    if (!createdMnemonic) return;
    await Clipboard.setStringAsync(createdMnemonic);
    Toast.show({
      type: 'success',
      text1: 'Copied to Clipboard',
      text2: 'Store your 25 words in a safe offline location.'
    });
  };

  return (
    <View style={styles.onboardingWrapper}>
      {/* Brand Header */}
      <View style={styles.onboardingLogoWrapper}>
        <Image
          source={require('../../assets/app_logo/ghostPay-logo-index.png')}
          style={styles.onboardingBrandLogo}
          resizeMode="contain"
        />
        <Text style={styles.onboardingBrandText}>
          <Text style={{ color: colors.primaryDark }}>GHOST</Text>
          <Text style={{ color: colors.secondary }}>PAY</Text>
        </Text>
      </View>

      {onboardingMode === 'welcome' ? (
        <>
          <View style={styles.actionFormCard}>
            {/* Centered Modern Header Layout */}
            <View style={styles.centeredHeaderWrapper}>
              <Text style={styles.centeredFormTitle}>Initialize GhostPay</Text>
              <Text style={styles.centeredFormSubtitle}>
                Create or link your wallet to authorize secure zero-data payments.
              </Text>
            </View>

            {/* 3-Column Feature Highlights Box */}
            <View style={styles.featureHighlightsBox}>
              <View style={styles.featureCol}>
                <Ionicons name="shield-outline" size={24} color="#0E9F6E" style={{ marginBottom: 6 }} />
                <Text style={styles.featureTitle}>Secure</Text>
                <Text style={styles.featureSubtitle}>Zero-data vault protection</Text>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureCol}>
                <Ionicons name="flash-outline" size={24} color="#0E9F6E" style={{ marginBottom: 6 }} />
                <Text style={styles.featureTitle}>Instant</Text>
                <Text style={styles.featureSubtitle}>Algorand powered</Text>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureCol}>
                <Ionicons name="lock-closed-outline" size={24} color="#0E9F6E" style={{ marginBottom: 6 }} />
                <Text style={styles.featureTitle}>Private</Text>
                <Text style={styles.featureSubtitle}>You control your assets</Text>
              </View>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#05DA93" style={styles.loader} />
            ) : (
              <View style={styles.buttonGroup}>
                <Pressable style={styles.primaryThemeButton} onPress={handleCreateWallet}>
                  <Ionicons name="wallet-outline" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryThemeButtonText}>Create New Wallet</Text>
                </Pressable>

                <Pressable style={styles.secondaryThemeButton} onPress={() => setOnboardingMode('import')}>
                  <Ionicons name="download-outline" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryThemeButtonText}>Import Seed Phrase</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* AI Protection Bottom Banner */}
          <View style={styles.aiProtectionCard}>
            <View style={styles.aiIconBadge}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.aiTextContainer}>
              <Text style={styles.aiTitle}>AI-Powered Payment Protection</Text>
              <Text style={styles.aiSubtitle}>GhostPay uses AI + x402 to keep your payments safe.</Text>
            </View>
            <View style={styles.aiActiveBadge}>
              <View style={styles.aiDotGreen} />
              <Text style={styles.aiActiveText}>Active</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.actionFormCard}>
          <View style={styles.backRow}>
            <Pressable onPress={() => setOnboardingMode('welcome')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={16} color="#667085" style={{ marginRight: 4 }} />
              <Text style={styles.backText}>Go Back</Text>
            </Pressable>
          </View>

          <Text style={styles.formTitle}>Import Existing Keys</Text>
          <Text style={styles.formSubtitle}>
            Enter your 25-word Algorand recovery seed phrase.
          </Text>

          <TextInput
            style={styles.textArea}
            placeholder="word1 word2 word3..."
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={4}
            value={importMnemonic}
            onChangeText={setImportMnemonic}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Wallet Label (e.g. Primary Account)"
            placeholderTextColor="#98A2B3"
            value={walletLabel}
            onChangeText={setWalletLabel}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#05DA93" style={styles.loader} />
          ) : (
            <Pressable style={styles.primaryButton} onPress={handleImportWallet}>
              <Text style={styles.primaryButtonText}>Import Wallet</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Mnemonic Reveal Modal */}
      <MnemonicBackupModal
        visible={showMnemonicModal}
        mnemonic={createdMnemonic}
        onCopy={handleCopyMnemonic}
        onDone={() => setShowMnemonicModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  onboardingWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10
  },
  onboardingLogoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  onboardingBrandLogo: {
    width: 120,
    height: 120
  },
  onboardingBrandText: {
    color: colors.primaryDark,
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 2,
    marginTop: 8
  },
  centeredHeaderWrapper: {
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 8
  },
  centeredFormTitle: {
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8
  },
  centeredFormSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#000000ff',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '96%'
  },
  actionFormCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    marginBottom: 20
  },
  featureHighlightsBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginVertical: 18,
    alignItems: 'center'
  },
  featureCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  featureTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    marginBottom: 2
  },
  featureSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    textAlign: 'center',
    lineHeight: 14
  },
  featureDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#EAECF0'
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center'
  },
  primaryThemeButton: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  primaryThemeButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center'
  },
  secondaryThemeButton: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    marginTop: 12
  },
  secondaryThemeButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center'
  },
  aiProtectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    marginTop: 16,
    width: '100%'
  },
  aiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  aiTextContainer: {
    flex: 1
  },
  aiTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#065F46',
    marginBottom: 2
  },
  aiSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#047857'
  },
  aiActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FADF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  aiDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 5
  },
  aiActiveText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#065F46'
  },
  backRow: {
    flexDirection: 'row',
    marginBottom: 16
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#667085'
  },
  formTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginBottom: 6
  },
  formSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    lineHeight: 20,
    marginBottom: 20
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#101828',
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 16
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#101828',
    marginBottom: 20
  },
  primaryButton: {
    backgroundColor: '#05DA93',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2
  },
  primaryButtonText: {
    color: '#0D1E2F',
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  loader: {
    marginVertical: 12
  }
});
