import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

// Smooth Count-Up Animated Counter for Total Balance
const AnimatedCounter = ({ targetValue, isHidden }: { targetValue: number; isHidden: boolean }) => {
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
    }, [targetValue, isHidden])
  );

  if (isHidden) {
    return <Text style={styles.balanceAmountText}>$ • • • • •</Text>;
  }

  return (
    <Text style={styles.balanceAmountText}>
      ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </Text>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { walletAddress, balanceAlgo, transactions, isConnected, demoMode, toggleDemoOffline } = useWalletStore();

  const isOnline = isConnected && !demoMode?.simulateOffline;
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const formattedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '•••• 2872';

  const numericBalance = balanceAlgo !== null ? balanceAlgo : 12480.50;

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
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <Pressable style={styles.userProfileGroup} onPress={() => router.push('/settings')}>
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
              onPress={() => Toast.show({ type: 'info', text1: 'Notifications', text2: 'No unread alerts' })}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.primaryDark} />
              <View style={styles.notifBadge} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Digital Card Display */}
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

                <Pressable onPress={() => setIsBalanceHidden(!isBalanceHidden)}>
                  <Ionicons
                    name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                </Pressable>
              </View>

              {/* Balance Amount with Smooth Count-Up Animation */}
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                <AnimatedCounter targetValue={numericBalance} isHidden={isBalanceHidden} />
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
              <Text style={styles.scanPayText}>Scan & pay</Text>
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
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#172B3E' }]}>
                <Text style={styles.avatarText}>EN</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Eva Novak</Text>
                <Text style={styles.txType}>Received • Today, 2:45 PM</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountPositive]}>+$450.00</Text>
            </View>

            {/* Tx 2 */}
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#F0B90B' }]}>
                <Ionicons name="logo-bitcoin" size={20} color={colors.white} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Binance Exchange</Text>
                <Text style={styles.txType}>Sent • Yesterday, 6:12 PM</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountNegative]}>-$820.00</Text>
            </View>

            {/* Tx 3 */}
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#E50914' }]}>
                <Ionicons name="film" size={20} color={colors.white} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Multiplex Cinema</Text>
                <Text style={styles.txType}>Paid • 15 Aug, 9:30 PM</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountNegative]}>-$124.55</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

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
    color: 'rgba(255, 255, 255, 0.6)',
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
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardAddressGroup: {},
  cardAddressLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
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
  }
});
