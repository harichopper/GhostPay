import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const { walletAddress, balanceAlgo, transactions, isConnected, demoMode, toggleDemoOffline } = useWalletStore();

  const isOnline = isConnected && !demoMode?.simulateOffline;
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [homeKey, setHomeKey] = useState(0);

  // Trigger entrance animations every time home screen is focused
  useFocusEffect(
    useCallback(() => {
      setHomeKey((prev) => prev + 1);
    }, [])
  );

  const formattedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '•••• 2872';

  const displayBalance = balanceAlgo !== null ? balanceAlgo.toFixed(2) : '12,480.50';

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
          key={homeKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Digital Card Display */}
          <Animated.View entering={FadeInDown.duration(450).delay(60)} style={styles.digitalCardContainer}>
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
                  <Text style={styles.cardBrandText}>GHOSTPAY PASS</Text>
                </View>

                <Pressable onPress={() => setIsBalanceHidden(!isBalanceHidden)}>
                  <Ionicons
                    name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                </Pressable>
              </View>

              {/* Balance Amount */}
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                <Text style={styles.balanceAmountText}>
                  {isBalanceHidden ? '$ • • • • •' : `$${displayBalance}`}
                </Text>
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
          </Animated.View>

          {/* Quick Action Grid (Send, Favorites, Scan, History) */}
          <Animated.View entering={FadeInDown.duration(450).delay(120)} style={styles.actionGridContainer}>
            <Pressable style={styles.actionItem} onPress={() => router.push('/send')}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#E4F2EB' }]}>
                <Ionicons name="paper-plane" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.actionItemText}>Send</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => router.push('/identity')}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#EBF4FE' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#2F80ED" />
              </View>
              <Text style={styles.actionItemText}>Favorites</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => router.push('/send')}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#F0EBFB' }]}>
                <Ionicons name="scan-sharp" size={22} color="#7F56D9" />
              </View>
              <Text style={styles.actionItemText}>Scan</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => router.push('/transactions')}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF0C7' }]}>
                <Ionicons name="receipt" size={22} color="#DC6803" />
              </View>
              <Text style={styles.actionItemText}>History</Text>
            </Pressable>
          </Animated.View>

          {/* Quick Stats Pill Banner */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={styles.bannerPillCard}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerBadge}>
                <Ionicons name="trending-up" size={16} color="#12B76A" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.bannerTitle}>Offline Vault Shield Active</Text>
                <Text style={styles.bannerSubtitle}>Zero-latency payments without cellular data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
          </Animated.View>

          {/* Recent Activity Section Header */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Recent Activity</Text>
            <Pressable onPress={() => router.push('/transactions')}>
              <Text style={styles.seeAllLinkText}>See All</Text>
            </Pressable>
          </Animated.View>

          {/* Recent Transactions List Preview */}
          <Animated.View entering={FadeInDown.duration(450).delay(300)}>
            {/* Tx 1 */}
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#4A3E3D' }]}>
                <Text style={styles.avatarText}>EN</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Eva Novak</Text>
                <Text style={styles.txType}>Received</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountPositive]}>+$5,710.20</Text>
            </View>

            {/* Tx 2 */}
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#F0B90B' }]}>
                <Ionicons name="logo-bitcoin" size={20} color={colors.white} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Binance</Text>
                <Text style={styles.txType}>Received</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountPositive]}>+$714.00</Text>
            </View>

            {/* Tx 3 */}
            <View style={styles.txCard}>
              <View style={[styles.avatarContainer, { backgroundColor: '#E50914' }]}>
                <Ionicons name="film" size={20} color={colors.white} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>Multiplex</Text>
                <Text style={styles.txType}>Paid</Text>
              </View>
              <Text style={[styles.txAmount, styles.amountNegative]}>-$124.55</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
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
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F04438'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  digitalCardContainer: {
    marginTop: 8,
    marginBottom: 20
  },
  digitalCard: {
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
  bannerPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  bannerBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  bannerSubtitle: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 1
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
