import React, { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { useWalletStore } from '../src/store/walletStore';
import { colors } from '../src/theme/colors';
import { MnemonicBackupModal } from '../src/components/MnemonicBackupModal';
import { requestMobileVerification, verifyMobileAndLinkWallet, lookupIdentityByWallet } from '../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    walletAddress,
    wallets,
    isConnected,
    demoMode,
    generateWalletAddress,
    importWalletFromMnemonic,
    verifiedPhone,
    setVerifiedPhone
  } = useWalletStore();
  const isOnline = isConnected && !demoMode?.simulateOffline;

  // Identity / Phone verification states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);


  // Onboarding local state if wallet is not connected in Profile
  const [onboardingMode, setOnboardingMode] = useState<'welcome' | 'import'>('welcome');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [walletLabel, setWalletLabel] = useState('');

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      const { address, mnemonic } = await generateWalletAddress();
      setGeneratedMnemonic(mnemonic);
      setShowBackupModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate wallet address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!importMnemonic.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Mnemonic Required',
        text2: 'Please enter your 25-word recovery phrase.'
      });
      return;
    }

    setLoading(true);
    const result = await importWalletFromMnemonic(importMnemonic, walletLabel || undefined);
    setLoading(false);

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Wallet Imported',
        text2: 'Successfully imported and linked your wallet.'
      });
    } else {
      Alert.alert('Import Failed', result.error || 'Invalid seed phrase.');
    }
  };

  const handleCopyMnemonic = async () => {
    await Clipboard.setStringAsync(generatedMnemonic);
    Toast.show({
      type: 'success',
      text1: 'Phrase Copied',
      text2: 'Recovery phrase copied to clipboard.'
    });
  };

  const handleDoneBackup = () => {
    setShowBackupModal(false);
  };

  useEffect(() => {
    if (verifiedPhone) {
      setPhone(verifiedPhone);
    }
  }, [verifiedPhone]);

  // Load existing wallet identity from backend on mount
  useEffect(() => {
    async function loadIdentity() {
      if (walletAddress && isOnline) {
        try {
          const res = await lookupIdentityByWallet(walletAddress);
          if (res && res.identity && res.identity.verified) {
            setVerifiedPhone(res.identity.mobileNumber);
            setPhone(res.identity.mobileNumber);
          }
        } catch (err) {
          // Ignore lookup errors
        }
      }
    }
    void loadIdentity();
  }, [walletAddress, isOnline]);

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Phone Required',
        text2: 'Please enter a valid mobile number.'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await requestMobileVerification(phone);
      if (res.verificationSent) {
        setIsOtpSent(true);
        Toast.show({
          type: 'success',
          text1: 'OTP Dispatched',
          text2: 'OTP code sent to your mobile number.'
        });
        // Auto-fill OTP in development mode for convenience
        if (res.devOtpCode) {
          setOtp(res.devOtpCode);
        }
      } else {
        Alert.alert('Verification Failed', 'Could not send verification code.');
      }
    } catch (err: any) {
      Alert.alert('Verification Error', err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Toast.show({
        type: 'error',
        text1: 'OTP Required',
        text2: 'Please enter the 6-digit OTP code.'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await verifyMobileAndLinkWallet({
        mobileNumber: phone,
        otpCode: otp,
        walletAddress
      });

      if (res.verified) {
        setVerifiedPhone(phone);
        setIsOtpSent(false);
        setOtp('');
        Toast.show({
          type: 'success',
          text1: 'Identity Verified',
          text2: 'Phone number successfully linked to your wallet!'
        });
      } else {
        Alert.alert('Error', 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async (addr: string) => {
    await Clipboard.setStringAsync(addr);
    Toast.show({
      type: 'success',
      text1: 'Address Copied',
      text2: 'Wallet address saved to clipboard.'
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.primaryDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {walletAddress ? (
              <>
                {/* User Badge Card */}
                <View style={styles.profileCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>GP</Text>
                    <View style={[styles.activeDot, { backgroundColor: isOnline ? '#12B76A' : '#F79E1B' }]} />
                  </View>
                  <View style={styles.profileDetails}>
                    <Text style={styles.profileName}>GhostPay User</Text>
                    <Text style={styles.profileStatus}>
                      {verifiedPhone ? 'Verified Vault Member' : 'Anonymous Account'}
                    </Text>
                  </View>
                  {verifiedPhone && (
                    <View style={styles.verifiedShield}>
                      <Ionicons name="shield-checkmark" size={24} color={colors.secondary} />
                    </View>
                  )}
                </View>

                {/* Section: Linked Wallet details */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>PRIMARY ALGORAND WALLET</Text>
                  <Pressable style={styles.walletRow} onPress={() => handleCopyAddress(walletAddress)}>
                    <View style={styles.walletInfo}>
                      <Ionicons name="wallet-outline" size={22} color={colors.primaryDark} style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.walletLabel}>Primary Wallet</Text>
                        <Text style={styles.walletAddress} numberOfLines={1} ellipsizeMode="middle">
                          {walletAddress || 'No Wallet Configured'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="copy-outline" size={16} color="#667085" />
                  </Pressable>

                  {wallets.length > 1 && (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.sectionTitleSub}>SECONDARY WALLETS</Text>
                      {wallets
                        .filter((w) => w.address !== walletAddress)
                        .map((w, idx) => (
                          <Pressable key={idx} style={styles.walletRowSub} onPress={() => handleCopyAddress(w.address)}>
                            <View style={styles.walletInfo}>
                              <Ionicons name="link-outline" size={18} color="#667085" style={{ marginRight: 10 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.walletLabelSub}>{w.label || `Wallet ${idx + 2}`}</Text>
                                <Text style={styles.walletAddressSub} numberOfLines={1} ellipsizeMode="middle">
                                  {w.address}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="copy-outline" size={14} color="#98A2B3" />
                          </Pressable>
                        ))}
                    </>
                  )}
                </View>

                {/* Section: Identity / Phone Link (Verification) */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>MOBILE IDENTITY VERIFICATION</Text>
                  <Text style={styles.description}>
                    Link your verified phone number to easily send/receive funds using your contact number instead of long public keys.
                  </Text>

                  {verifiedPhone ? (
                    <View style={styles.verifiedContainer}>
                      <Ionicons name="checkmark-circle" size={24} color="#12B76A" style={{ marginRight: 10 }} />
                      <View>
                        <Text style={styles.verifiedTitle}>Linked Phone Number</Text>
                        <Text style={styles.verifiedValue}>{verifiedPhone}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.formContainer}>
                      {!isOtpSent ? (
                        <>
                          <TextInput
                            style={styles.input}
                            placeholder="Mobile Number (e.g. +1234567890)"
                            placeholderTextColor="#98A2B3"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                          />
                          {loading ? (
                            <ActivityIndicator size="small" color="#05DA93" style={styles.loader} />
                          ) : (
                            <Pressable style={styles.primaryButton} onPress={handleRequestOtp}>
                              <Text style={styles.primaryButtonText}>Send OTP Code</Text>
                            </Pressable>
                          )}
                        </>
                      ) : (
                        <>
                          <Text style={styles.otpNotice}>Enter the 6-digit OTP code sent to {phone}:</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="6-Digit OTP Code"
                            placeholderTextColor="#98A2B3"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                          />
                          {loading ? (
                            <ActivityIndicator size="small" color="#05DA93" style={styles.loader} />
                          ) : (
                            <View style={styles.buttonRow}>
                              <Pressable style={styles.secondaryButton} onPress={() => setIsOtpSent(false)}>
                                <Text style={styles.secondaryButtonText}>Back</Text>
                              </Pressable>
                              <Pressable style={styles.primaryButtonHalf} onPress={handleVerifyOtp}>
                                <Text style={styles.primaryButtonText}>Verify & Link</Text>
                              </Pressable>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              </>
            ) : (
              /* Onboarding Action Card Form Area if no Wallet */
              onboardingMode === 'welcome' ? (
                <View style={styles.actionFormCard}>
                  <Text style={styles.formTitle}>Initialize GhostPay Account</Text>
                  <Text style={styles.formSubtitle}>
                    Create a new Algorand address or link your existing wallet to authorize zero-data vault payments securely.
                  </Text>

                  {loading ? (
                    <ActivityIndicator size="large" color="#05DA93" style={styles.loader} />
                  ) : (
                    <View style={styles.buttonGroup}>
                      <Pressable style={styles.primaryButton} onPress={handleCreateWallet}>
                        <Ionicons name="wallet-outline" size={20} color="#0D1E2F" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryButtonText}>Create New Wallet</Text>
                      </Pressable>

                      <Pressable style={styles.secondaryButton} onPress={() => setOnboardingMode('import')}>
                        <Ionicons name="download-outline" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                        <Text style={styles.secondaryButtonText}>Import Seed Phrase</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
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
              )
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <MnemonicBackupModal
        visible={showBackupModal}
        mnemonic={generatedMnemonic}
        onCopy={handleCopyMnemonic}
        onDone={handleDoneBackup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F7F3'
  },
  gradientContainer: {
    flex: 1
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold'
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginTop: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 14
  },
  avatarInitial: {
    color: colors.secondary,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold'
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    color: colors.primaryDark,
    fontSize: 17,
    fontFamily: 'Inter_700Bold'
  },
  profileStatus: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  verifiedShield: {
    padding: 6
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    letterSpacing: 0.2,
    marginBottom: 14
  },
  sectionTitleSub: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#667085',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 10
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    lineHeight: 20,
    marginBottom: 18
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  walletRowSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },
  walletLabel: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold'
  },
  walletAddress: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  walletLabelSub: {
    color: '#344054',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  walletAddressSub: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F4F7',
    marginVertical: 12
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#D1FADF',
    borderRadius: 16,
    padding: 14
  },
  verifiedTitle: {
    color: '#027B49',
    fontSize: 12,
    fontFamily: 'Inter_700Bold'
  },
  verifiedValue: {
    color: '#027B49',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2
  },
  formContainer: {
    width: '100%'
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    color: colors.primaryDark,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 16
  },
  primaryButton: {
    backgroundColor: '#05DA93',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1
  },
  primaryButtonHalf: {
    backgroundColor: '#05DA93',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    elevation: 1
  },
  primaryButtonText: {
    color: '#0D1E2F',
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 0.5
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10
  },
  otpNotice: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primaryDark,
    marginBottom: 8
  },
  loader: {
    marginVertical: 8
  },
  actionFormCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    marginBottom: 20
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
  buttonGroup: {
    gap: 12
  },
  buttonIcon: {
    marginRight: 8
  },
  backRow: {
    flexDirection: 'row',
    marginBottom: 16
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  backText: {
    color: '#667085',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    color: colors.primaryDark,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12
  }
});
