import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import TransactionDetailModal from '../../src/components/TransactionDetailModal';
import { MnemonicBackupModal } from '../../src/components/MnemonicBackupModal';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import { GhostTransaction } from '../../src/types/transaction';

// Smooth Count-Up Animated Counter for Total Balance
const AnimatedCounter = ({
  targetValue,
  isHidden,
  refreshKey = 0,
  symbol = '$'
}: {
  targetValue: number;
  isHidden: boolean;
  refreshKey?: number;
  symbol?: string;
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (isHidden) return;
      let animationFrameId: number;
      const duration = 750;
      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Cubic ease-out curve
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = targetValue * easeOut;
        setDisplayValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    }, [targetValue, isHidden, refreshKey])
  );

  if (isHidden) {
    return <Text style={styles.balanceAmountText}>{symbol} • • • • •</Text>;
  }

  return (
    <Text style={styles.balanceAmountText}>
      {symbol}{displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </Text>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const {
    walletAddress,
    balanceAlgo,
    transactions,
    isConnected,
    demoMode,
    toggleDemoOffline,
    generateWalletAddress,
    importWalletFromMnemonic,
    refreshBalance,
    displayCurrency,
    algoRates
  } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const isOnline = isConnected && !demoMode?.simulateOffline;

  // Onboarding local state if wallet is not connected
  const [loading, setLoading] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      if (walletAddress) {
        void refreshBalance();
      }
    }, [walletAddress])
  );
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const handleManualRefresh = async () => {
    if (!walletAddress) return;
    setIsRefreshingBalance(true);
    try {
      await refreshBalance();
      setRefreshKey((prev) => prev + 1);
      Toast.show({
        type: 'success',
        text1: 'Balance Refreshed',
        text2: 'Wallet details have been synced.'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Refresh Failed',
        text2: 'Failed to fetch updated balance.'
      });
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  const [selectedTx, setSelectedTx] = useState<GhostTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenTxDetail = (name: string, amountNum: number, isPositive: boolean) => {
    setSelectedTx({
      id: 'tx-' + Date.now(),
      sender: isPositive ? 'EVA2874...99A1' : (walletAddress || 'GBRNCKUL...CCB2'),
      receiver: isPositive ? (walletAddress || 'GBRNCKUL...CCB2') : 'GBRNCKUL...CCB2',
      amount: amountNum,
      timestamp: 'Tuesday, Feb 3, 2026 • 11:32 PM',
      status: 'confirmed',
      txHash: '6e268a9b1c0d4fe2'
    });
    setIsModalOpen(true);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (walletAddress) {
      void refreshBalance().finally(() => {
        setRefreshing(false);
        setRefreshKey((prev) => prev + 1);
      });
    } else {
      setTimeout(() => {
        setRefreshing(false);
        setRefreshKey((prev) => prev + 1);
      }, 1000);
    }
  }, [walletAddress]);

  const formattedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '•••• 2872';

  const getCurrencyDetails = (ccy: 'USD' | 'INR' | 'EUR') => {
    const rates = algoRates || { USD: 0.15, INR: 12.5, EUR: 0.14 };
    switch (ccy) {
      case 'INR': return { symbol: '₹', rate: rates.INR || 12.5 };
      case 'EUR': return { symbol: '€', rate: rates.EUR || 0.14 };
      default: return { symbol: '$', rate: rates.USD || 0.15 };
    }
  };
  const { symbol: currencySymbol, rate: currencyRate } = getCurrencyDetails(displayCurrency || 'USD');
  const numericBalance = balanceAlgo !== null ? balanceAlgo : 0.00;
  const usdBalance = numericBalance * currencyRate;

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await Clipboard.getStringAsync();
      Toast.show({
        type: 'success',
        text1: 'Address Copied',
        text2: 'Wallet address saved to clipboard'
      });
    } else {
      Toast.show({
        type: 'info',
        text1: 'Address Copied',
        text2: 'GhostPay Testnet Address Copied'
      });
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
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          {walletAddress ? (
            <>
              <Pressable style={styles.userProfileGroup} onPress={() => router.push('/profile')}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>GP</Text>
                  <View style={[styles.activeDot, { backgroundColor: isOnline ? '#12B76A' : '#F79E1B' }]} />
                </View>
                <View style={styles.greetingTextGroup}>
                  <Text style={styles.greetingSub}>Welcome back,</Text>
                  <Text style={styles.greetingTitle}>GhostPay User</Text>
                </View>
              </Pressable>

              <View style={styles.headerActionsGroup}>
                <Pressable
                  style={[styles.networkStatusPill, isOnline ? styles.onlinePill : styles.offlinePill]}
                  onPress={() => {
                    toggleDemoOffline();
                    Toast.show({
                      type: 'info',
                      text1: isOnline ? 'Offline Mode Active' : 'Online Mode Active',
                      text2: isOnline ? 'Simulating zero-data vault payments' : 'Connected to Algorand Testnet'
                    });
                  }}
                >
                  <Ionicons
                    name={isOnline ? 'globe-outline' : 'cloud-offline-outline'}
                    size={14}
                    color={isOnline ? '#027A48' : '#B54708'}
                    style={{ marginRight: 5 }}
                  />
                  <View style={[styles.networkDot, { backgroundColor: isOnline ? '#12B76A' : '#F79E1B' }]} />
                  <Text style={[styles.networkStatusText, { color: isOnline ? '#027A48' : '#B54708' }]}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.iconCircleButton}
                  onPress={() => router.push('/notification')}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.primaryDark} />
                  <View style={styles.notifBadge} />
                </Pressable>
              </View>
            </>
          ) : (
            <>

            </>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryDark}
              colors={[colors.secondary, colors.primaryDark]}
            />
          }
        >
          {/* Main Digital Card Display (Only rendered when wallet is connected) */}
          {walletAddress && (
            <View style={styles.digitalCardContainer}>
              {/* Top Stacked Card Peeking Layer (Neon Mint #05DA93) */}
              <LinearGradient
                colors={['#05DA93', '#00B87A']}
                style={styles.cardStackTopLayer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />

              {/* Bottom Stacked Card Layer 1 (Furthest Gold/Yellow) */}
              <LinearGradient
                colors={['#FFE033', '#F79E1B']}
                style={styles.cardStackBottomLayer1}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />

              {/* Bottom Stacked Card Layer 2 (Soft Yellow Accent) */}
              <LinearGradient
                colors={['#FFF066', '#FFC700']}
                style={styles.cardStackBottomLayer2}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />

              {/* Main Front Digital Card */}
              <LinearGradient
                colors={['#172B3E', '#0D1E2F', '#172B3E']}
                style={styles.digitalCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Card Top Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardBrandGroup}>
                    <Ionicons name="flash-sharp" size={18} color={colors.secondary} />
                    <Text style={styles.cardBrandText}>GHOSTPAY</Text>
                  </View>

                  <View style={styles.cardHeaderActions}>
                    <Pressable onPress={handleManualRefresh} style={{ marginRight: 14 }} disabled={isRefreshingBalance}>
                      {isRefreshingBalance ? (
                        <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.7)" />
                      ) : (
                        <Ionicons name="refresh-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
                      )}
                    </Pressable>
                    <Pressable onPress={() => setIsBalanceHidden(!isBalanceHidden)}>
                      <Ionicons
                        name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="rgba(255, 255, 255, 0.7)"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Card Middle Row */}
                <View style={styles.balanceContainer}>
                  <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                  <View style={styles.balanceRow}>
                    <AnimatedCounter targetValue={usdBalance} isHidden={isBalanceHidden} refreshKey={refreshKey} symbol={currencySymbol} />
                    {!isBalanceHidden && (
                      <Text style={styles.algoEquivalentText}>
                        ≈ {numericBalance.toFixed(2)} ALGO
                      </Text>
                    )}
                  </View>
                </View>

                {/* Card Footer Row */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.cardAddressGroup}>
                    <Text style={styles.cardAddressLabel}>ACCOUNT WALLET</Text>
                    <Text style={styles.cardAddressValue}>{formattedAddress}</Text>
                  </View>

                  <Image
                    source={require('../../assets/branding/algorand-logo.webp')}
                    style={styles.algorandWhiteLogo}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
            </View>
          )}
          {walletAddress ? (
            <>
              {/* Dual Promo Row (Pay Super-Fast & Scan & Pay) */}
              <View style={styles.dualPromoRow}>
                {/* Left Card: Pay Super-Fast / Offline Vault */}
                <Pressable style={styles.promoCardLeft} onPress={toggleDemoOffline}>
                  <View style={styles.promoIconWrapper}>
                    <Ionicons name="flash" size={18} color="#05DA93" />
                  </View>
                  <View style={styles.promoTextGroup}>
                    <Text style={styles.promoSubtext}>Pay super-fast!</Text>
                    <View style={styles.promoTitleRow}>
                      <Text style={styles.promoMainTitle}>OFFLINE VAULT</Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.primaryDark} />
                    </View>
                  </View>
                </Pressable>

                {/* Right Card: Scan & Pay */}
                <Pressable style={styles.promoCardRight} onPress={() => router.push('/send')}>
                  <View style={styles.scanIconBox}>
                    <Ionicons name="qr-code" size={22} color={colors.secondary} />
                  </View>
                  <Text style={styles.scanPayText}>Scan & Pay</Text>
                </Pressable>
              </View>

              {/* Quick Action Grid (Send, Receive, History, Others) */}
              <View style={styles.actionGridContainer}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/send')}>
                  <View style={[styles.actionIconCircle, { backgroundColor: '#E4F2EB' }]}>
                    <Ionicons name="paper-plane" size={22} color={colors.primaryDark} />
                  </View>
                  <Text style={styles.actionItemText}>Send</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={handleCopyAddress}>
                  <View style={[styles.actionIconCircle, { backgroundColor: '#EBF4FE' }]}>
                    <Ionicons name="arrow-down-circle" size={22} color="#2F80ED" />
                  </View>
                  <Text style={styles.actionItemText}>Receive</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => router.push('/transactions')}>
                  <View style={[styles.actionIconCircle, { backgroundColor: '#FEF0C7' }]}>
                    <Ionicons name="receipt" size={22} color="#DC6803" />
                  </View>
                  <Text style={styles.actionItemText}>History</Text>
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => router.push('/settings')}>
                  <View style={[styles.actionIconCircle, { backgroundColor: '#F0EBFB' }]}>
                    <Ionicons name="apps" size={22} color="#7F56D9" />
                  </View>
                  <Text style={styles.actionItemText}>Others</Text>
                </Pressable>
              </View>

              {/* Dual Action Pill Bar: My QR Code | GHOST ID + Copy */}
              <View style={styles.idPillBar}>
                {/* Left side: My QR code > */}
                <Pressable style={styles.idPillLeft} onPress={() => setIsQrModalOpen(true)}>
                  <Ionicons name="qr-code-outline" size={17} color={colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={styles.idPillLeftText}>My QR code</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primaryDark} style={{ marginLeft: 2 }} />
                </Pressable>

                {/* Vertical Divider Line */}
                <View style={styles.idPillDivider} />

                {/* Right side: GHOST ID: ghostpay@algo + Copy */}
                <Pressable style={styles.idPillRight} onPress={handleCopyAddress}>
                  <Text style={styles.idPillRightText}>GHOST ID: ghostpay@algo</Text>
                  <Ionicons name="copy-outline" size={15} color={colors.primaryDark} style={{ marginLeft: 6 }} />
                </Pressable>
              </View>

              {/* Recent Activity Section Header */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Recent Activity</Text>
                <Pressable onPress={() => router.push('/transactions')}>
                  <Text style={styles.seeAllLinkText}>See All</Text>
                </Pressable>
              </View>

              {/* Recent Transactions List Preview */}
              <View>
                {/* Tx 1 */}
                <Pressable style={styles.txCard} onPress={() => handleOpenTxDetail('Eva Novak', 450.0, true)}>
                  <View style={[styles.avatarContainer, { backgroundColor: '#172B3E' }]}>
                    <Text style={styles.avatarText}>EN</Text>
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txName}>Eva Novak</Text>
                    <Text style={styles.txType}>Received • Today, 2:45 PM</Text>
                  </View>
                  <Text style={[styles.txAmount, styles.amountPositive]}>+$450.00</Text>
                </Pressable>

                {/* Tx 2 */}
                <Pressable style={styles.txCard} onPress={() => handleOpenTxDetail('Binance Exchange', -820.0, false)}>
                  <View style={[styles.avatarContainer, { backgroundColor: '#F0B90B' }]}>
                    <Ionicons name="logo-bitcoin" size={20} color={colors.white} />
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txName}>Binance Exchange</Text>
                    <Text style={styles.txType}>Sent • Yesterday, 6:12 PM</Text>
                  </View>
                  <Text style={[styles.txAmount, styles.amountNegative]}>-$820.00</Text>
                </Pressable>

                {/* Tx 3 */}
                <Pressable style={styles.txCard} onPress={() => handleOpenTxDetail('Multiplex Cinema', -124.55, false)}>
                  <View style={[styles.avatarContainer, { backgroundColor: '#E50914' }]}>
                    <Ionicons name="film" size={20} color={colors.white} />
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txName}>Multiplex Cinema</Text>
                    <Text style={styles.txType}>Paid • 15 Aug, 9:30 PM</Text>
                  </View>
                  <Text style={[styles.txAmount, styles.amountNegative]}>-$124.55</Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* Onboarding Action Card Form Area */
            <View style={styles.onboardingWrapper}>
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

                      <Text style={styles.centeredFormSubtitle}>
                        Create a new Algorand address or link your existing wallet to authorize zero-data vault payments securely.
                      </Text>
                    </View>

                    {/* 3-Column Feature Highlights Box */}
                    <View style={styles.featureHighlightsBox}>
                      {/* Col 1: Secure */}
                      <View style={styles.featureCol}>
                        <Ionicons name="shield-outline" size={24} color="#0E9F6E" style={{ marginBottom: 6 }} />
                        <Text style={styles.featureTitle}>Secure</Text>
                        <Text style={styles.featureSubtitle}>Zero-data vault protection</Text>
                      </View>

                      <View style={styles.featureDivider} />

                      {/* Col 2: Instant */}
                      <View style={styles.featureCol}>
                        <Ionicons name="flash-outline" size={24} color="#0E9F6E" style={{ marginBottom: 6 }} />
                        <Text style={styles.featureTitle}>Instant</Text>
                        <Text style={styles.featureSubtitle}>Algorand powered</Text>
                      </View>

                      <View style={styles.featureDivider} />

                      {/* Col 3: Private */}
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

                  {/* AI-Powered Payment Protection Bottom Banner */}
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
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      <TransactionDetailModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
      />

      {/* Receive QR Modal */}
      <Modal
        visible={isQrModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsQrModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.qrModalCard}>
            <Pressable style={styles.modalCloseButton} onPress={() => setIsQrModalOpen(false)}>
              <Ionicons name="close" size={20} color={colors.primaryDark} />
            </Pressable>

            <Text style={styles.modalTitle}>My QR Code</Text>
            <Text style={styles.modalSub}>Scan QR code to transfer funds to this wallet</Text>

            {/* Dummy QR Code Box */}
            <View style={styles.qrBox}>
              <Ionicons name="qr-code" size={150} color={colors.primaryDark} />
            </View>

            <Text style={styles.qrAddressText}>GHOST ID: ghostpay@algo</Text>

            <Pressable style={styles.copyAddressButton} onPress={handleCopyAddress}>
              <Ionicons name="copy-outline" size={18} color={colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.copyAddressButtonText}>Copy Wallet ID</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 12
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  avatarInitial: {
    color: colors.secondary,
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold'
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#12B76A',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  greetingTextGroup: {
    marginLeft: 12
  },
  greetingSub: {
    color: '#5C768D',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  greetingTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontFamily: 'Inter_700Bold'
  },
  brandHeaderDisconnected: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  brandHeaderText: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 1.5
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconCircleButton: {
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
    shadowRadius: 6,
    position: 'relative'
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F04438',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  digitalCardContainer: {
    marginTop: 16,
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center'
  },
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
  headerPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10
  },
  headerPillText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#047857',
    letterSpacing: 0.8
  },
  centeredFormTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
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
  cardStackTopLayer: {
    position: 'absolute',
    top: -10,
    width: '84%',
    height: 24,
    borderRadius: 18,
    opacity: 0.85,
    elevation: 3,
    shadowColor: '#05DA93',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.35,
    shadowRadius: 8
  },
  cardStackBottomLayer1: {
    position: 'absolute',
    bottom: -15,
    width: '74%',
    height: 22,
    borderRadius: 14,
    opacity: 0.9,
    elevation: 2,
    shadowColor: '#F79E1B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8
  },
  cardStackBottomLayer2: {
    position: 'absolute',
    bottom: -8,
    width: '85%',
    height: 22,
    borderRadius: 16,
    opacity: 0.8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  digitalCard: {
    width: '100%',
    borderRadius: 26,
    padding: 22,
    elevation: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  cardBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardBrandText: {
    color: colors.secondary,
    fontSize: 12,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 1,
    marginLeft: 6
  },
  balanceContainer: {
    marginBottom: 24
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.93)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  balanceAmountText: {
    color: colors.white,
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap'
  },
  algoEquivalentText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 4,
    alignSelf: 'baseline'
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardAddressGroup: {},
  cardAddressLabel: {
    color: 'rgba(255, 255, 255, 0.93)',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5
  },
  cardAddressValue: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2
  },
  algorandWhiteLogo: {
    width: 100,
    height: 26,
    tintColor: '#FFFFFF'
  },
  actionGridContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  actionItem: {
    alignItems: 'center',
    flex: 1
  },
  actionIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  actionItemText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  dualPromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20
  },
  promoCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.12)',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  promoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#172B3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  promoTextGroup: {
    flex: 1
  },
  promoSubtext: {
    color: '#667085',
    fontSize: 10,
    fontFamily: 'Inter_500Medium'
  },
  promoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  promoMainTitle: {
    color: colors.primaryDark,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    marginRight: 2
  },
  promoCardRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172B3E',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  scanIconBox: {
    marginRight: 10
  },
  scanPayText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold'
  },
  idPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F2EB',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.3)',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  idPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8
  },
  idPillLeftText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  idPillDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(23, 43, 62, 0.15)',
    marginHorizontal: 4
  },
  idPillRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6
  },
  idPillRightText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionHeaderTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold'
  },
  seeAllLinkText: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  },
  txDetails: {
    flex: 1
  },
  txName: {
    color: '#172B3E',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2
  },
  txType: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  txAmount: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2
  },
  amountPositive: {
    color: '#12B76A'
  },
  amountNegative: {
    color: '#D92D20'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  receiveModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    position: 'relative',
    elevation: 10
  },
  qrModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    position: 'relative',
    elevation: 10
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(23, 43, 62, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    marginTop: 8,
    marginBottom: 4
  },
  modalSub: {
    color: '#5C768D',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 16
  },
  qrBox: {
    padding: 16,
    backgroundColor: '#F0F7F3',
    borderRadius: 20,
    marginBottom: 16
  },
  qrAddressText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
    textAlign: 'center'
  },
  copyAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 18,
    width: '100%',
    height: 48
  },
  copyAddressButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  },
  networkStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8
  },
  onlinePill: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1.5,
    borderColor: 'rgba(18, 183, 106, 0.4)',
    shadowColor: '#12B76A'
  },
  offlinePill: {
    backgroundColor: '#FEF0C7',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 158, 27, 0.5)',
    shadowColor: '#F79E1B'
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6
  },
  networkStatusText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  buttonIcon: {
    marginRight: 8
  },
  loader: {
    marginVertical: 12
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
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    color: colors.primaryDark,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    height: 46,
    paddingHorizontal: 12,
    marginBottom: 20
  }
});
