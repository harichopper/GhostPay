import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { useWalletStore } from '../src/store/walletStore';
import { colors } from '../src/theme/colors';
import { MnemonicBackupModal } from '../src/components/MnemonicBackupModal';
import { PhoneInputWithCountryPicker, COUNTRY_CODES, CountryItem } from '../src/components/PhoneInputWithCountryPicker';
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
    setVerifiedPhone,
    userName,
    setUserName,
    refreshBalance
  } = useWalletStore();
  const isOnline = isConnected && !demoMode?.simulateOffline;

  // Identity / Phone verification states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  // Field-level validation error states
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');

  const handleOpenPhoneModal = () => {
    setNameError('');
    setPhoneError('');
    setOtpError('');
    setIsPhoneModalOpen(true);
  };

  const handleClosePhoneModal = () => {
    setIsPhoneModalOpen(false);
    setNameError('');
    setPhoneError('');
    setOtpError('');
    setIsOtpSent(false);
    setOtp('');
  };

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
      await importWalletFromMnemonic(mnemonic, walletLabel || 'Main Wallet');
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
    if (walletAddress && isOnline) {
      refreshBalance();
    }
  }, [walletAddress, isOnline]);

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

  const getFullMobileNumber = () => {
    const digitsOnly = phone.replace(/\D/g, '');
    const countryDigits = selectedCountry.code.replace(/\D/g, '');
    if (!digitsOnly) return '';

    if (digitsOnly.startsWith(countryDigits)) {
      return `+${digitsOnly}`;
    }
    return `+${countryDigits}${digitsOnly}`;
  };

  const handleRequestOtp = async () => {
    let isValid = true;
    setNameError('');
    setPhoneError('');

    if (!fullName.trim()) {
      setNameError('Full Name is required');
      isValid = false;
    }

    const fullMobileNumber = getFullMobileNumber();
    const digitsCount = fullMobileNumber.replace(/\D/g, '').length;

    if (!phone.trim()) {
      setPhoneError('Mobile Number is required');
      isValid = false;
    } else if (digitsCount < 8 || digitsCount > 15) {
      setPhoneError('Please enter a valid mobile number (8-15 digits)');
      isValid = false;
    }

    if (!isValid) return;

    setLoading(true);
    try {
      const res = await requestMobileVerification(fullMobileNumber);
      if (res.verificationSent) {
        setIsOtpSent(true);
        // Auto-fill OTP in development mode for convenience
        if (res.devOtpCode) {
          setOtp(res.devOtpCode);
        }
      } else {
        setPhoneError('Could not send verification code. Try again.');
      }
    } catch (err: any) {
      setPhoneError(err.message || 'Verification error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError('');

    if (!otp.trim() || otp.trim().length < 6) {
      setOtpError('Please enter the full 6-digit OTP code');
      return;
    }

    const fullMobileNumber = getFullMobileNumber();

    setLoading(true);
    try {
      const res = await verifyMobileAndLinkWallet({
        mobileNumber: fullMobileNumber,
        otpCode: otp,
        walletAddress,
        name: fullName.trim()
      });

      if (res.verified) {
        setVerifiedPhone(fullMobileNumber);
        if (fullName.trim()) {
          setUserName(fullName.trim());
        }
        handleClosePhoneModal();
        Toast.show({
          type: 'success',
          text1: 'Identity Verified',
          text2: 'Mobile identity successfully linked to your wallet!'
        });
      } else {
        setOtpError('Invalid or expired OTP code');
      }
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed');
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

  const qrRef = useRef<any>(null);
  const cardShotRef = useRef<any>(null);

  const handleShareWallet = async () => {
    if (!walletAddress) return;

    const shareMessage = `GhostPay Algorand Wallet Address:\n${walletAddress}\n\nSend Zero-Data Vault payments securely.`;

    const shareFallbackText = async () => {
      await Share.share({
        title: 'GhostPay Algorand Wallet',
        message: shareMessage
      });
    };

    try {
      if (cardShotRef.current && typeof cardShotRef.current.capture === 'function') {
        const imageUri = await cardShotRef.current.capture();

        if (Platform.OS === 'web') {
          await shareFallbackText();
          return;
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(imageUri, {
            mimeType: 'image/png',
            dialogTitle: 'Share GhostPay Wallet Card',
            UTI: 'public.png'
          });
          Toast.show({
            type: 'success',
            text1: 'GhostPay Card Shared',
            text2: 'Branded QR card image and wallet address shared successfully.'
          });
        } else {
          await shareFallbackText();
        }
      } else {
        await shareFallbackText();
      }
    } catch {
      await shareFallbackText();
    }
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
                {/* 1. If Phone Number IS connected -> Show Verified User Badge Card */}
                {Boolean(verifiedPhone) && (
                  <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>
                        {userName
                          ? userName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()
                          : 'GP'}
                      </Text>
                      <View style={[styles.activeDot, { backgroundColor: isOnline ? '#12B76A' : '#F79E1B' }]} />
                    </View>
                    <View style={styles.profileDetails}>
                      <Text style={styles.profileName}>{userName || 'GhostPay User'}</Text>
                      <Text style={styles.profileStatus}>Verified Vault Member</Text>
                    </View>
                    <View style={styles.verifiedShield}>
                      <Ionicons name="shield-checkmark" size={24} color={colors.secondary} />
                    </View>
                  </View>
                )}

                {/* 2. Prominent Connect Mobile Banner Card (Shown at top when phone is NOT connected) */}
                {!verifiedPhone && (
                  <Pressable style={styles.phoneConnectBanner} onPress={handleOpenPhoneModal}>
                    <View style={styles.phoneBannerIconCircle}>
                      <Ionicons name="call" size={22} color="#05DA93" />
                    </View>
                    <View style={styles.phoneBannerContent}>
                      <Text style={styles.phoneBannerTitle}>Connect Wallet with Phone</Text>
                      <Text style={styles.phoneBannerSub}>
                        Link your phone number to authorize zero-data payments seamlessly.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#05DA93" />
                  </Pressable>
                )}

                {/* Section: Linked Algorand Wallet details */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>ALGORAND WALLET</Text>
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

                  {/* Linked Mobile Identity Row (Embedded in Algorand Wallet Card) */}
                  {Boolean(verifiedPhone) && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.linkedPhoneRow}>
                        <Ionicons name="checkmark-circle" size={18} color="#12B76A" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.walletLabel}>Linked Mobile Identity</Text>
                          <Text style={styles.walletAddress}>{verifiedPhone}</Text>
                        </View>
                      </View>
                    </>
                  )}

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

                {/* My Wallet QR Code Card (Placed below Primary Wallet Card) */}
                <ViewShot ref={cardShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                  <View style={styles.qrCardContainer}>
                    {/* GhostPay Branding Header (Stacked vertical like Index page) */}
                    <View style={styles.qrBrandHeaderWrapper}>
                      <Image
                        source={require('../assets/app_logo/ghostPay-logo-index.png')}
                        style={styles.qrBrandLogoStacked}
                        resizeMode="contain"
                      />
                      <Text style={styles.qrBrandTextStacked}>
                        <Text style={{ color: colors.primaryDark }}>GHOST</Text>
                        <Text style={{ color: colors.secondary }}>PAY</Text>
                      </Text>
                    </View>

                    {/* Header Title & ID */}
                    <Pressable style={styles.qrCardHeaderRow} onPress={() => handleCopyAddress(walletAddress)}>
                      <Ionicons name="wallet-outline" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                      <Text style={styles.qrCardWalletTitle}>Algorand Vault Wallet</Text>
                      <Ionicons name="chevron-forward" size={16} color="#667085" />
                    </Pressable>

                    <Pressable style={styles.qrCardIdRow} onPress={() => handleCopyAddress(walletAddress)}>
                      <Text style={styles.qrCardIdText}>
                        WALLET ID: {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}` : ''}
                      </Text>
                      <Ionicons name="copy-outline" size={13} color="#667085" style={{ marginLeft: 4 }} />
                    </Pressable>

                    {/* Center QR Code Display */}
                    <View style={styles.qrCodeWrapper}>
                      {walletAddress ? (
                        <QRCode
                          value={walletAddress}
                          size={170}
                          color={colors.primaryDark}
                          backgroundColor="#FFFFFF"
                          getRef={(ref) => (qrRef.current = ref)}
                        />
                      ) : (
                        <Ionicons name="qr-code" size={140} color={colors.primaryDark} />
                      )}
                    </View>

                    {/* Action Buttons Row */}
                    <View style={styles.qrActionsRow}>
                      <Pressable
                        style={styles.qrActionButton}
                        onPress={handleShareWallet}
                      >
                        <Text style={styles.qrActionButtonText}>Share Card</Text>
                        <Ionicons name="share-social-outline" size={16} color="#344054" style={{ marginLeft: 6 }} />
                      </Pressable>

                      <Pressable
                        style={styles.qrActionButton}
                        onPress={() => handleCopyAddress(walletAddress)}
                      >
                        <Text style={styles.qrActionButtonText}>Copy Address</Text>
                        <Ionicons name="copy-outline" size={16} color="#344054" style={{ marginLeft: 6 }} />
                      </Pressable>
                    </View>

                    {/* Bottom Footer Row */}
                    <View style={styles.qrCardFooterRow}>
                      <View style={styles.qrFooterLeft}>
                        <Ionicons name="shield-checkmark" size={18} color="#12B76A" style={{ marginRight: 6 }} />
                        <Text style={styles.qrFooterTitle}>
                          GhostPay Vault • <Text style={{ color: '#12B76A', fontFamily: 'Inter_700Bold' }}>Verified & Encrypted</Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                </ViewShot>
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

      {/* Mobile Identity Verification Modal */}
      <Modal
        visible={isPhoneModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClosePhoneModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.phoneModalCard}>
            <Pressable style={styles.modalCloseButton} onPress={handleClosePhoneModal}>
              <Ionicons name="close" size={20} color={colors.primaryDark} />
            </Pressable>

            <View style={styles.phoneModalIconCircle}>
              <Ionicons name="call" size={28} color="#05DA93" />
            </View>

            <Text style={styles.phoneModalTitle}>Mobile Identity Link</Text>
            <Text style={styles.phoneModalSub}>
              Link your verified phone number to easily send/receive funds using your mobile number instead of long public keys.
            </Text>

            {!isOtpSent ? (
              <View style={{ width: '100%', marginTop: 16 }}>
                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={[styles.input, Boolean(nameError) && styles.inputError]}
                    placeholder="Full Name"
                    placeholderTextColor="#98A2B3"
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      if (nameError) setNameError('');
                    }}
                  />
                  {Boolean(nameError) && (
                    <Text style={styles.fieldErrorText}>{nameError}</Text>
                  )}
                </View>

                <PhoneInputWithCountryPicker
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (phoneError) setPhoneError('');
                  }}
                  selectedCountry={selectedCountry}
                  onSelectCountry={setSelectedCountry}
                  error={phoneError}
                  placeholder="Mobile Number"
                />

                {loading ? (
                  <ActivityIndicator size="small" color="#05DA93" style={styles.loader} />
                ) : (
                  <Pressable style={styles.primaryButton} onPress={handleRequestOtp}>
                    <Text style={styles.primaryButtonText}>Send OTP Code</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={{ width: '100%', marginTop: 16 }}>
                {/* Green OTP Dispatched Success Banner inside Modal */}
                <View style={styles.otpSuccessBanner}>
                  <Ionicons name="checkmark-circle" size={22} color="#12B76A" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.otpSuccessTitle}>OTP Dispatched!</Text>
                    <Text style={styles.otpSuccessSub}>Verification code sent to {getFullMobileNumber()}</Text>
                  </View>
                </View>

                <Text style={styles.otpNotice}>Enter the 6-digit OTP code:</Text>
                <View style={{ marginBottom: 16 }}>
                  <TextInput
                    style={[styles.input, Boolean(otpError) && styles.inputError]}
                    placeholder="6-Digit OTP Code"
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text);
                      if (otpError) setOtpError('');
                    }}
                  />
                  {Boolean(otpError) && (
                    <Text style={styles.fieldErrorText}>{otpError}</Text>
                  )}
                </View>

                {loading ? (
                  <ActivityIndicator size="small" color="#05DA93" style={styles.loader} />
                ) : (
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setIsOtpSent(false);
                        setOtpError('');
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                    <Pressable style={styles.primaryButtonHalf} onPress={handleVerifyOtp}>
                      <Text style={styles.primaryButtonText}>Verify & Link</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
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
  },
  qrCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginBottom: 20,
    alignItems: 'center'
  },
  qrBrandHeaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  qrBrandLogoStacked: {
    width: 70,
    height: 70
  },
  qrBrandTextStacked: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 2,
    marginTop: 4
  },
  qrCardTopPillRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10
  },
  primaryBadgePill: {
    backgroundColor: '#12B76A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold'
  },
  qrCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  qrCardWalletTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginRight: 4
  },
  qrCardIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  qrCardIdText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085'
  },
  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  qrActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16
  },
  qrActionButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrActionButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#344054'
  },
  qrCardFooterRow: {
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  qrFooterTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#475569'
  },
  phoneConnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#05DA93',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  phoneBannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  phoneBannerContent: {
    flex: 1,
    paddingRight: 6
  },
  phoneBannerTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginBottom: 2
  },
  phoneBannerSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    lineHeight: 17
  },
  phoneModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  phoneModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  phoneModalTitle: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: 6
  },
  phoneModalSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  linkedPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  linkedPhoneLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#667085',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  linkedPhoneValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginTop: 2
  },
  inputError: {
    borderColor: '#FDA29B',
    backgroundColor: '#FFFBFA'
  },
  fieldErrorText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#D92D20',
    marginTop: 4,
    marginLeft: 4
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0'
  },
  countryFlagText: {
    fontSize: 18,
    marginRight: 6
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  },
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  countryModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  countryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  countryModalTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.primaryDark
  },
  countryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4
  },
  countryOptionSelected: {
    backgroundColor: '#ECFDF5'
  },
  countryOptionFlag: {
    fontSize: 20,
    marginRight: 12
  },
  countryOptionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primaryDark
  },
  countryOptionCode: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#05DA93'
  },
  otpSuccessBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16
  },
  otpSuccessTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#027A48'
  },
  otpSuccessSub: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#065F46',
    marginTop: 2
  }
});
