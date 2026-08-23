import algosdk from 'algosdk';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { PaymentPinScreen } from '../../src/components/security/PaymentPinScreen';
import { WalletOnboardingCard } from '../../src/components/WalletOnboardingCard';
import { useSecurityStore } from '../../src/store/securityStore';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import {
  lookupWalletsByMobile,
  lookupIdentityByWallet,
  fetchWalletRiskScore,
  validateReceiverMerchant,
  analyzeTransactionFraud
} from '../../src/services/api';
import type { GhostTransaction } from '../../src/types/transaction';

export function parsePaymentQr(qrData: string) {
  let address = '';
  let phone = '';
  let amount = '';
  let note = '';

  const cleanData = qrData.trim();

  if (cleanData.startsWith('algorand://')) {
    const raw = cleanData.replace('algorand://', '');
    const [addrPart, queryPart] = raw.split('?');
    address = addrPart || '';
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      if (params.has('amount')) amount = params.get('amount') || '';
      if (params.has('note')) note = params.get('note') || '';
    }
  } else if (cleanData.startsWith('ghostpay://')) {
    const queryPart = cleanData.includes('?') ? cleanData.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    if (params.has('address')) address = params.get('address') || '';
    if (params.has('phone')) phone = params.get('phone') || '';
    if (params.has('amount')) amount = params.get('amount') || '';
  } else if (/^[A-Z2-7]{58}$/i.test(cleanData)) {
    address = cleanData;
  } else if (cleanData.replace(/\D/g, '').length >= 8 && cleanData.length < 50) {
    phone = cleanData;
  }

  return { address, phone, amount, note };
}

const isPhoneLike = (value: string) => {
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.replace(/\D/g, '').length >= 8 && cleaned.length < 50 && !cleaned.startsWith('0x');
};

const isValidAlgorandAddress = (value: string) => {
  const cleaned = value.trim();
  return Boolean(cleaned) && algosdk.isValidAddress(cleaned);
};

const resolveSupportedPhoneAddress = async (phone: string): Promise<string | null> => {
  const cleanPhone = phone.trim();
  if (!isPhoneLike(cleanPhone)) return null;

  try {
    const res = await lookupWalletsByMobile(cleanPhone);
    if (res && res.verified && Array.isArray(res.wallets) && res.wallets.length > 0) {
      const primary = res.wallets.find((wallet) => wallet.isDefault) || res.wallets[0];
      const candidate = primary?.address?.trim();
      if (candidate && isValidAlgorandAddress(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const isUnsupportedQrPayload = (rawData: string) => {
  const value = rawData.trim();
  if (!value) return true;
  const lower = value.toLowerCase();

  if (value.startsWith('algorand://') || value.startsWith('ghostpay://')) {
    return false;
  }

  if (
    lower.includes('google pay') ||
    lower.includes('gpay') ||
    lower.includes('upi') ||
    lower.includes('phonepe') ||
    lower.includes('paytm') ||
    lower.startsWith('bitcoin:') ||
    lower.startsWith('ethereum:') ||
    lower.startsWith('solana:') ||
    lower.startsWith('matic:') ||
    lower.startsWith('eth:')
  ) {
    return true;
  }

  return !isValidAlgorandAddress(value) && !isPhoneLike(value);
};

const AVATAR_COLORS = ['#4A3E3D', '#3B4B5B', '#2C3E50', '#6C5CE7', '#027A48', '#B54708', '#7F56D9'];

function getDynamicRecentContacts(transactions: GhostTransaction[], currentWallet: string) {
  const map = new Map<string, { id: string; name: string; phone: string; bg: string; initial: string }>();

  // Extract targets strictly from user's real transactions
  if (transactions && transactions.length > 0) {
    transactions.forEach((tx, idx) => {
      const rawTarget = tx.receiver?.trim();
      if (!rawTarget || map.has(rawTarget)) return;

      const isPhone = rawTarget.replace(/\D/g, '').length >= 8 && rawTarget.length < 50;
      const displayName = isPhone
        ? rawTarget
        : `${rawTarget.substring(0, 4)}...${rawTarget.substring(rawTarget.length - 4)}`;

      const initial = isPhone ? '📱' : rawTarget.substring(0, 2).toUpperCase();

      map.set(rawTarget, {
        id: `dynamic-${idx}-${rawTarget}`,
        name: displayName,
        phone: rawTarget,
        bg: AVATAR_COLORS[map.size % AVATAR_COLORS.length],
        initial
      });
    });
  }

  return Array.from(map.values());
}

export default function SendScreen() {
  const router = useRouter();
  const { walletAddress, balanceAlgo, enqueueOfflinePayment, isConnected, transactions, displayCurrency, algoRates } = useWalletStore();
  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const dynamicRecentContacts = useMemo(
    () => getDynamicRecentContacts(transactions, walletAddress),
    [transactions, walletAddress]
  );

  const [activeTab, setActiveTab] = useState<'scan' | 'send'>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyMode, setCurrencyMode] = useState<'FIAT' | 'ALGO'>('FIAT');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  // Recipient resolution state
  const [recipientIdentity, setRecipientIdentity] = useState<{
    name?: string;
    verified: boolean;
    primaryAddress?: string;
  } | null>(null);
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);

  const resolveRecipientIdentity = async (input: string) => {
    const cleanInput = input.trim();
    if (!cleanInput) {
      setRecipientIdentity(null);
      return;
    }

    const isPhone = cleanInput.replace(/\D/g, '').length >= 8 && !cleanInput.startsWith('0x') && cleanInput.length < 50;
    if (isPhone) {
      setIsResolvingRecipient(true);
      try {
        const res = await lookupWalletsByMobile(cleanInput);
        if (res && res.verified && res.wallets.length > 0) {
          const primary = res.wallets.find((w) => w.isDefault) || res.wallets[0];
          setRecipientIdentity({
            name: res.name || 'Verified Vault Member',
            verified: true,
            primaryAddress: primary.address
          });
        } else {
          setRecipientIdentity({
            verified: false
          });
        }
      } catch (err) {
        setRecipientIdentity(null);
      } finally {
        setIsResolvingRecipient(false);
      }
    } else if (cleanInput.length >= 50) {
      setIsResolvingRecipient(true);
      try {
        const res = await lookupIdentityByWallet(cleanInput);
        if (res && res.identity && res.identity.verified) {
          setRecipientIdentity({
            name: res.identity.name || 'Verified Vault Member',
            verified: true,
            primaryAddress: cleanInput
          });
        } else {
          setRecipientIdentity({
            verified: true,
            primaryAddress: cleanInput
          });
        }
      } catch (err) {
        setRecipientIdentity(null);
      } finally {
        setIsResolvingRecipient(false);
      }
    } else {
      setRecipientIdentity(null);
    }
  };

  // Trigger entrance animations every time screen is focused (tab navigation)
  useFocusEffect(
    useCallback(() => {
      setScanKey((prev) => prev + 1);
    }, [])
  );

  // Scanner beam animation
  const beamY = useSharedValue(0);
  // Pulse animation for permission popup icon
  const pulseScale = useSharedValue(1);
  // Scanner viewport glowing shadow pulse
  const glowOpacity = useSharedValue(0.3);

  React.useEffect(() => {
    beamY.value = withRepeat(
      withSequence(
        withTiming(220, { duration: 1600 }),
        withTiming(0, { duration: 1600 })
      ),
      -1,
      true
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [beamY, pulseScale, glowOpacity]);

  const beamAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: beamY.value }]
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));

  const viewportGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value
  }));

  const handleRequestPermission = async () => {
    try {
      const res = await requestPermission();
      if (res.granted) {
        Toast.show({
          type: 'success',
          text1: 'Camera Access Granted',
          text2: 'You can now scan QR codes'
        });
      } else if (res && !res.canAskAgain) {
        Alert.alert(
          'Permission Blocked in Settings',
          'Camera permission is permanently denied. Please open your device Settings > Apps > GhostPay > Permissions and enable Camera access.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err?.message || 'Could not request camera permission.');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!data) return;

    if (isUnsupportedQrPayload(data)) {
      setErrorModalMessage('Unsupported QR Code — GhostPay currently supports Algorand/GhostPay payment QR codes only');
      return;
    }

    const parsed = parsePaymentQr(data);

    if (parsed.address && !isValidAlgorandAddress(parsed.address)) {
      setErrorModalMessage('Invalid Algorand wallet address');
      return;
    }

    if (parsed.phone) {
      const resolvedAddress = await resolveSupportedPhoneAddress(parsed.phone);
      if (!resolvedAddress) {
        setErrorModalMessage('This phone number is not linked to a supported Algorand wallet');
        return;
      }

      setRecipient(parsed.phone);
      setRecipientIdentity({
        name: 'Verified Vault Member',
        verified: true,
        primaryAddress: resolvedAddress
      });
      if (parsed.amount) {
        setAmount(parsed.amount);
      }
      setActiveTab('send');
      Toast.show({
        type: 'success',
        text1: 'QR Code Scanned',
        text2: `Target: ${resolvedAddress.slice(0, 16)}...`
      });
      return;
    }

    if (!parsed.address) {
      setErrorModalMessage('Unsupported QR Code — GhostPay currently supports Algorand/GhostPay payment QR codes only');
      return;
    }

    setRecipient(parsed.address);
    if (parsed.amount) {
      setAmount(parsed.amount);
    }
    setActiveTab('send');
    Toast.show({
      type: 'success',
      text1: 'QR Code Scanned',
      text2: `Target: ${parsed.address.slice(0, 16)}...`
    });
    await resolveRecipientIdentity(parsed.address);
  };

  const handlePasteAddress = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text);
        Toast.show({
          type: 'success',
          text1: 'Address Pasted',
          text2: text.slice(0, 16) + '...'
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Paste Error',
        text2: 'Could not read clipboard'
      });
    }
  };

  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [isPaymentPinVisible, setIsPaymentPinVisible] = useState(false);

  const clearPaymentForm = () => {
    setAmount('');
    setRecipient('');
    setRecipientIdentity(null);
    setIsPaymentPinVisible(false);
  };

  const handleConfirmPaymentPress = async () => {
    if (isSubmitting) return;

    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) {
      setErrorModalMessage('Please enter a mobile number or wallet address.');
      return;
    }

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) {
      setErrorModalMessage('Please enter a valid amount to send.');
      return;
    }

    let targetAddress = recipientIdentity?.primaryAddress?.trim() || trimmedRecipient;

    if (isPhoneLike(trimmedRecipient)) {
      const resolvedPhoneAddress = await resolveSupportedPhoneAddress(trimmedRecipient);
      if (!resolvedPhoneAddress) {
        setErrorModalMessage('This phone number is not linked to a supported Algorand wallet');
        return;
      }
      targetAddress = resolvedPhoneAddress;
      setRecipientIdentity((prev) => ({
        name: prev?.name || 'Verified Vault Member',
        verified: true,
        primaryAddress: resolvedPhoneAddress
      }));
    } else if (!isValidAlgorandAddress(trimmedRecipient)) {
      setErrorModalMessage('Invalid Algorand wallet address');
      return;
    }

    if (!isValidAlgorandAddress(targetAddress)) {
      setErrorModalMessage('Invalid Algorand wallet address');
      return;
    }

    if (targetAddress === walletAddress) {
      setErrorModalMessage('You cannot send a payment to your own wallet');
      return;
    }

    if (appLockEnabled) {
      setIsPaymentPinVisible(true);
      return;
    }

    void handleSendPayment();
  };

  const handleSendPayment = async () => {
    if (isSubmitting) return;

    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) {
      setErrorModalMessage('Please enter a mobile number or wallet address.');
      return;
    }

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) {
      setErrorModalMessage('Please enter a valid amount to send.');
      return;
    }

    let targetAddress = recipientIdentity?.primaryAddress?.trim() || trimmedRecipient;

    if (isPhoneLike(trimmedRecipient)) {
      const resolvedPhoneAddress = await resolveSupportedPhoneAddress(trimmedRecipient);
      if (!resolvedPhoneAddress) {
        setErrorModalMessage('This phone number is not linked to a supported Algorand wallet');
        return;
      }
      targetAddress = resolvedPhoneAddress;
      setRecipientIdentity((prev) => ({
        name: prev?.name || 'Verified Vault Member',
        verified: true,
        primaryAddress: resolvedPhoneAddress
      }));
    } else if (!isValidAlgorandAddress(trimmedRecipient)) {
      setErrorModalMessage('Invalid Algorand wallet address');
      return;
    }

    if (!isValidAlgorandAddress(targetAddress)) {
      setErrorModalMessage('Invalid Algorand wallet address');
      return;
    }

    if (targetAddress === walletAddress) {
      setErrorModalMessage('You cannot send a payment to your own wallet');
      return;
    }

    const currentCurrency = displayCurrency || 'USD';
    const rate = algoRates?.[currentCurrency] || (currentCurrency === 'INR' ? 15.25 : currentCurrency === 'EUR' ? 0.165 : 0.18);
    const numericAmount = currencyMode === 'FIAT' ? inputAmount / rate : inputAmount;

    setIsSubmitting(true);

    try {
      const X402_MERCHANT_VAULT = 'EI5WNOWDB2S5MOHNVZXNVUULCKBMUG4BC5AZUAL2S5T2PZ5DW2FCF4KYCA';

      // Step 1: Execute On-Chain 0.005 ALGO x402 Micro-Payment Transfer
      setProcessingStatus('x402 Micro-Fee: Deducting 0.005 ALGO...');
      await enqueueOfflinePayment(X402_MERCHANT_VAULT, 0.005);

      // Step 2: Parallel x402 Security Verification (All 3 API checks run concurrently)
      setProcessingStatus('Verifying x402 AI Security Shield...');
      const [merchantCheck, riskAssessment, fraudCheck] = await Promise.all([
        validateReceiverMerchant(targetAddress, walletAddress),
        fetchWalletRiskScore(walletAddress, targetAddress),
        analyzeTransactionFraud({
          senderWallet: walletAddress,
          receiverWallet: targetAddress,
          amount: numericAmount,
          asset: currencyMode === 'FIAT' ? (displayCurrency || 'USD') : 'ALGO'
        })
      ]);

      if (merchantCheck && merchantCheck.data && merchantCheck.data.merchantVerified === false) {
        throw new Error('Security Alert: Unverified or flagged receiver merchant identity.');
      }
      if (riskAssessment && riskAssessment.data && riskAssessment.data.canMakePayment === false) {
        throw new Error(`Security Alert: High risk detected for recipient. Risk score: ${riskAssessment.data.riskScore}/10.`);
      }
      if (fraudCheck && fraudCheck.data && fraudCheck.data.recommendation === 'REJECT') {
        throw new Error('Security Alert: Fraud detector flagged this payment as suspicious.');
      }

      // Final Step: Executing Main Payment Transfer on Algorand Blockchain
      setProcessingStatus('Processing Algorand Payment...');
      await enqueueOfflinePayment(targetAddress, numericAmount);

      Toast.show({
        type: 'success',
        text1: isConnected ? 'Payment Confirmed!' : 'Payment Queued Offline',
        text2: `${numericAmount} ${currencyMode} sent with 3x x402 AI Protection`
      });
    } catch (err: any) {
      setErrorModalMessage(err?.message || 'Failed to process payment.');
    } finally {
      clearPaymentForm();
      setIsSubmitting(false);
      setProcessingStatus(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={[styles.gradientContainer, isDesktop && styles.gradientContainerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>

          <Text style={styles.headerTitle}>Pay & Scan</Text>

          <View style={{ width: 40 }} />
        </View>

        {!walletAddress ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <WalletOnboardingCard />
          </ScrollView>
        ) : (
          <>
            {/* Tab Switcher (Scan vs Send) */}
            <View style={styles.tabSwitcherContainer}>
              <Pressable
                style={[styles.switcherTab, activeTab === 'scan' && styles.switcherTabActive]}
                onPress={() => setActiveTab('scan')}
              >
                <Ionicons
                  name="qr-code"
                  size={18}
                  color={activeTab === 'scan' ? colors.primaryDark : 'rgba(23, 43, 62, 0.6)'}
                />
                <Text style={[styles.switcherText, activeTab === 'scan' && styles.switcherTextActive]}>
                  Scan QR
                </Text>
              </Pressable>

              <Pressable
                style={[styles.switcherTab, activeTab === 'send' && styles.switcherTabActive]}
                onPress={() => setActiveTab('send')}
              >
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color={activeTab === 'send' ? colors.primaryDark : 'rgba(23, 43, 62, 0.6)'}
                />
                <Text style={[styles.switcherText, activeTab === 'send' && styles.switcherTextActive]}>
                  Send Money
                </Text>
              </Pressable>
            </View>

            <ScrollView
              key={scanKey}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {activeTab === 'scan' ? (
                /* SCAN QR MODE */
                <View style={styles.scanModeContainer}>
                  <Text style={styles.sectionSubtitle}>
                    Align QR Code within the frame to scan automatically
                  </Text>

                  {/* Camera Frame Box */}
                  <Animated.View
                    entering={ZoomIn.duration(450).springify().damping(13)}
                    style={[styles.scannerViewport, viewportGlowStyle]}
                  >
                    {permission?.granted ? (
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        enableTorch={isFlashOn}
                        onBarcodeScanned={handleBarCodeScanned}
                        barcodeScannerSettings={{
                          barcodeTypes: ['qr']
                        }}
                      />
                    ) : (
                      <View style={styles.noCameraView}>
                        <Ionicons name="camera-outline" size={48} color={colors.primaryDark} />
                        <Text style={styles.noCameraText}>Camera Access Required</Text>
                        <Pressable style={styles.permissionButton} onPress={handleRequestPermission}>
                          <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Viewfinder Target Overlay Corners */}
                    <View style={[styles.cornerMarker, styles.topLeft]} />
                    <View style={[styles.cornerMarker, styles.topRight]} />
                    <View style={[styles.cornerMarker, styles.bottomLeft]} />
                    <View style={[styles.cornerMarker, styles.bottomRight]} />

                    {/* Scanning Beam Line */}
                    <Animated.View style={[styles.scanBeam, beamAnimatedStyle]} />
                  </Animated.View>

                  {/* Scanner Control Actions */}
                  <View style={styles.scannerActionsRow}>
                    <Pressable
                      style={styles.actionPill}
                      onPress={() => setIsFlashOn(!isFlashOn)}
                    >
                      <Ionicons
                        name={isFlashOn ? 'flash' : 'flash-outline'}
                        size={20}
                        color={colors.primaryDark}
                      />
                      <Text style={styles.actionPillText}>{isFlashOn ? 'Flash On' : 'Flash Off'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* SEND MONEY MODE */
                <View style={styles.sendModeContainer}>
                  {/* Recipient Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>RECIPIENT (MOBILE OR WALLET)</Text>
                    <View style={styles.inputCard}>
                      <Ionicons name="person-outline" size={20} color={colors.primaryDark} style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter phone number or 58-char address..."
                        placeholderTextColor="rgba(23, 43, 62, 0.4)"
                        value={recipient}
                        onChangeText={(text) => {
                          setRecipient(text);
                          void resolveRecipientIdentity(text);
                        }}
                      />
                      {recipient.length > 0 && (
                        <Pressable onPress={() => { setRecipient(''); setRecipientIdentity(null); }}>
                          <Ionicons name="close-circle" size={18} color="rgba(23, 43, 62, 0.4)" />
                        </Pressable>
                      )}
                    </View>

                    {/* Live Recipient Resolution Badge */}
                    {isResolvingRecipient ? (
                      <View style={styles.resolvingContainer}>
                        <ActivityIndicator size="small" color="#05DA93" style={{ marginRight: 8 }} />
                        <Text style={styles.resolvingText}>Resolving GhostPay identity...</Text>
                      </View>
                    ) : recipientIdentity ? (
                      <View style={[styles.recipientBadgeCard, recipientIdentity.verified ? styles.badgeVerified : styles.badgeUnverified]}>
                        <Ionicons
                          name={recipientIdentity.verified ? 'shield-checkmark' : 'time-outline'}
                          size={18}
                          color={recipientIdentity.verified ? '#027A48' : '#B54708'}
                          style={{ marginRight: 8 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.badgeTitle, { color: recipientIdentity.verified ? '#027A48' : '#B54708' }]}>
                            {recipientIdentity.name ? recipientIdentity.name : (recipientIdentity.verified ? 'Verified Vault Member' : 'Unlinked Mobile Number')}
                          </Text>
                          {Boolean(recipientIdentity.primaryAddress) && (
                            <Text style={styles.badgeSub} numberOfLines={1} ellipsizeMode="middle">
                              Address: {recipientIdentity.primaryAddress}
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Quick Contacts */}
                  <View style={styles.quickContactsSection}>
                    <Text style={styles.sectionMiniHeader}>RECENT ACCOUNTS & CONTACTS</Text>
                    {dynamicRecentContacts.length === 0 ? (
                      <View style={styles.emptyContactsPill}>
                        <Ionicons name="people-outline" size={20} color="#98A2B3" style={{ marginRight: 6 }} />
                        <Text style={styles.emptyContactsText}>No recent accounts</Text>
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
                        {dynamicRecentContacts.map((contact: { id: string; name: string; phone: string; bg: string; initial: string }) => (
                          <Pressable
                            key={contact.id}
                            style={styles.contactItem}
                            onPress={() => {
                              setRecipient(contact.phone);
                              void resolveRecipientIdentity(contact.phone);
                            }}
                          >
                            <View style={[styles.contactAvatar, { backgroundColor: contact.bg }]}>
                              <Text style={styles.contactInitial}>{contact.initial}</Text>
                            </View>
                            <Text style={styles.contactName} numberOfLines={1}>
                              {contact.name.split(' ')[0]}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>

                  {/* Amount Entry Display */}
                  <View style={styles.amountSection}>
                    <View style={styles.amountHeaderRow}>
                      <Text style={styles.inputLabel}>AMOUNT</Text>
                      <Pressable
                        style={styles.currencyTogglePill}
                        onPress={() => setCurrencyMode(currencyMode === 'FIAT' ? 'ALGO' : 'FIAT')}
                      >
                        <Text style={styles.currencyToggleText}>
                          Mode: <Text style={{ color: colors.secondary, fontWeight: '700' }}>{currencyMode === 'FIAT' ? (displayCurrency || 'USD') : 'ALGO'}</Text>
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.amountDisplayCard}>
                      <Text style={[styles.currencyPrefix, currencyMode === 'ALGO' && { fontSize: 22 }]}>
                        {currencyMode === 'FIAT'
                          ? (displayCurrency === 'INR' ? '₹' : displayCurrency === 'EUR' ? '€' : '$')
                          : 'ALGO'}
                      </Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        placeholderTextColor="rgba(23, 43, 62, 0.3)"
                        keyboardType="decimal-pad"
                        value={amount}
                        onChangeText={setAmount}
                      />
                    </View>

                    {/* Dynamic Conversion Subtitle */}
                    {Boolean(amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) && (
                      <View style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, color: '#027A48', fontWeight: '600' }}>
                          {currencyMode === 'FIAT'
                            ? `≈ ${(parseFloat(amount) / (algoRates?.[displayCurrency || 'USD'] || (displayCurrency === 'INR' ? 15.25 : displayCurrency === 'EUR' ? 0.165 : 0.18))).toFixed(3)} ALGO on-chain`
                            : `≈ ${(displayCurrency === 'INR' ? '₹' : displayCurrency === 'EUR' ? '€' : '$')}${(parseFloat(amount) * (algoRates?.[displayCurrency || 'USD'] || (displayCurrency === 'INR' ? 15.25 : displayCurrency === 'EUR' ? 0.165 : 0.18))).toFixed(2)} ${displayCurrency || 'USD'}`}
                        </Text>
                      </View>
                    )}

                    {/* Preset Amount Chips */}
                    <View style={styles.presetChipsRow}>
                      {['10', '25', '50', '100'].map((val) => (
                        <Pressable
                          key={val}
                          style={styles.chip}
                          onPress={() => setAmount(val)}
                        >
                          <Text style={styles.chipText}>+{currencyMode === 'FIAT' ? (displayCurrency === 'INR' ? '₹' : displayCurrency === 'EUR' ? '€' : '$') : ''}{val}</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        style={[styles.chip, styles.maxChip]}
                        onPress={() => setAmount(balanceAlgo ? (currencyMode === 'FIAT' ? (balanceAlgo * (algoRates?.[displayCurrency || 'USD'] || (displayCurrency === 'INR' ? 15.25 : displayCurrency === 'EUR' ? 0.165 : 0.18))).toFixed(2) : balanceAlgo.toFixed(2)) : '100')}
                      >
                        <Text style={styles.maxChipText}>MAX</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Submit Payment Button */}
                  <Pressable
                    style={[styles.sendSubmitButton, isSubmitting && { opacity: 0.6 }]}
                    onPress={() => void handleConfirmPaymentPress()}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.sendSubmitText}>
                      {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.primaryDark} style={{ marginLeft: 8 }} />
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </LinearGradient>

      {/* Animated Camera Permission Request Popup Overlay */}
      {activeTab === 'scan' && Boolean(permission && !permission.granted) && (
        <Modal transparent animationType="fade" visible={Boolean(permission && !permission.granted)}>
          <View style={styles.modalOverlay}>
            <Animated.View entering={ZoomIn.duration(400).springify().damping(14)} style={styles.permissionPopupCard}>
              <Animated.View style={[styles.permissionIconBadge, pulseAnimatedStyle]}>
                <Ionicons name="camera" size={32} color={colors.primaryDark} />
              </Animated.View>

              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                GhostPay needs camera permission to scan recipient QR codes for instant payments and wallet transfers.
              </Text>

              <Pressable style={styles.grantAccessButton} onPress={handleRequestPermission}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.grantAccessButtonText}>Grant Camera Access</Text>
              </Pressable>

              <Pressable style={styles.cancelAccessButton} onPress={() => setActiveTab('send')}>
                <Text style={styles.cancelAccessText}>Enter Address Manually</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Custom Payment Processing Modal */}
      <Modal
        visible={Boolean(processingStatus)}
        transparent
        animationType="fade"
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.processingModalCard}>
            <View style={styles.processingIconBadge}>
              <ActivityIndicator size="large" color="#05DA93" />
            </View>
            <Text style={styles.processingModalTitle}>AI Guard Active</Text>
            <Text style={styles.processingModalBody}>{processingStatus}</Text>
          </View>
        </View>
      </Modal>

      <PaymentPinScreen
        visible={isPaymentPinVisible}
        amount={amount}
        currencyMode={currencyMode}
        displayCurrency={displayCurrency}
        onAuthorized={() => {
          setIsPaymentPinVisible(false);
          void handleSendPayment();
        }}
        onCancel={() => setIsPaymentPinVisible(false)}
      />

      {/* Custom Payment Error Alert Modal */}
      <Modal
        visible={Boolean(errorModalMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalMessage(null)}
      >
        <View style={styles.errorModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setErrorModalMessage(null)} />
          <View style={styles.errorModalCard}>
            <View style={styles.errorIconBadge}>
              <Ionicons name="warning" size={32} color="#D92D20" />
            </View>

            <Text style={styles.errorModalTitle}>
              {errorModalMessage?.includes('Watch-Only') ? 'Watch-Only Account' : 'Payment Error'}
            </Text>
            <Text style={styles.errorModalBody}>{errorModalMessage}</Text>

            {errorModalMessage?.includes('Watch-Only') ? (
              <>
                <Pressable
                  style={styles.primaryModalBtnAction}
                  onPress={() => {
                    setErrorModalMessage(null);
                    router.push('/settings');
                  }}
                >
                  <Ionicons name="key-outline" size={18} color="#172B3E" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryModalBtnActionText}>Import 25-Word Mnemonic</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryModalBtnAction}
                  onPress={() => setErrorModalMessage(null)}
                >
                  <Text style={styles.secondaryModalBtnActionText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.errorModalBtn}
                onPress={() => setErrorModalMessage(null)}
              >
                <Text style={styles.errorModalBtnText}>Got it</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  permissionPopupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16
  },
  permissionIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E4F2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.secondary
  },
  permissionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    textAlign: 'center',
    marginBottom: 8
  },
  permissionDesc: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  grantAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 18,
    width: '100%',
    height: 50,
    marginBottom: 10,
    elevation: 3,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  grantAccessButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_700Bold'
  },
  cancelAccessButton: {
    paddingVertical: 10
  },
  cancelAccessText: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryDark
  },
  gradientContainer: {
    flex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 88,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  gradientContainerDesktop: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
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
  tabSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(23, 43, 62, 0.08)',
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 12
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20
  },
  switcherTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6
  },
  switcherText: {
    color: 'rgba(23, 43, 62, 0.6)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 6
  },
  switcherTextActive: {
    color: colors.primaryDark
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  scanModeContainer: {
    alignItems: 'center',
    paddingTop: 8
  },
  sectionSubtitle: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 20
  },
  scannerViewport: {
    width: 300,
    height: 300,
    borderRadius: 28,
    backgroundColor: '#0F1A24',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(5, 218, 147, 0.5)'
  },
  noCameraView: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  noCameraText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 10,
    marginBottom: 14,
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16
  },
  permissionButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  cornerMarker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.secondary,
    borderWidth: 4
  },
  topLeft: {
    top: 16,
    left: 16,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12
  },
  topRight: {
    top: 16,
    right: 16,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12
  },
  bottomLeft: {
    bottom: 16,
    left: 16,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12
  },
  bottomRight: {
    bottom: 16,
    right: 16,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12
  },
  scanBeam: {
    position: 'absolute',
    top: 30,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8
  },
  scannerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  actionPillText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8
  },
  sendModeContainer: {
    paddingTop: 8
  },
  inputGroup: {
    marginBottom: 20
  },
  inputLabel: {
    color: '#5C768D',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  textInput: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_500Medium'
  },
  quickContactsSection: {
    marginBottom: 24
  },
  sectionMiniHeader: {
    color: '#5C768D',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    marginBottom: 15
  },
  contactsScroll: {
    flexDirection: 'row'
  },
  contactItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 60
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  contactInitial: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Inter_700Bold'
  },
  contactName: {
    color: colors.primaryDark,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center'
  },
  emptyContactsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  emptyContactsText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#98A2B3'
  },
  resolvingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4
  },
  resolvingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085'
  },
  recipientBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
    borderWidth: 1
  },
  badgeVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  badgeUnverified: {
    backgroundColor: '#FFFAEB',
    borderColor: '#FEDF89'
  },
  badgeTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  badgeSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#475467',
    marginTop: 2
  },
  amountSection: {
    marginBottom: 28
  },
  amountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  currencyTogglePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 1
  },
  currencyToggleText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  amountDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 72,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  currencyPrefix: {
    color: colors.secondary,
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginRight: 8
  },
  amountInput: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 36,
    fontFamily: 'Inter_700Bold'
  },
  presetChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14
  },
  chip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  maxChip: {
    backgroundColor: colors.primaryDark
  },
  maxChipText: {
    color: colors.secondary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  sendSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 22,
    height: 56,
    elevation: 4,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  sendSubmitText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontFamily: 'Inter_700Bold'
  },
  /* Error Alert Modal Styles */
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  errorModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 43, 62, 0.65)',
    paddingHorizontal: 24,
    zIndex: 100000,
    elevation: 100000
  },
  errorModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20
  },
  errorIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  errorModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#101828',
    textAlign: 'center'
  },
  errorModalBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20
  },
  errorModalBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorModalBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF'
  },
  primaryModalBtnAction: {
    flexDirection: 'row',
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#05DA93',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  processingModalCard: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#172B3E',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.3)',
    elevation: 10
  },
  processingIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  processingModalTitle: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  processingModalBody: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#05DA93',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20
  },
  primaryModalBtnActionText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#172B3E'
  },
  secondaryModalBtnAction: {
    width: '100%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryModalBtnActionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#667085'
  }
});
