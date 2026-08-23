import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import TransactionDetailModal from '../../src/components/TransactionDetailModal';
import { WalletOnboardingCard } from '../../src/components/WalletOnboardingCard';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import { GhostTransaction } from '../../src/types/transaction';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SampleTx {
  id: string;
  name: string;
  type: 'Received' | 'Paid';
  amount: string;
  fiatSubText?: string;
  isPositive: boolean;
  dateGroup: string;
  iconBg: string;
  iconText?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  avatarUrl?: string;
  statusText?: string;
  formattedTime?: string;
}

const SAMPLE_TRANSACTIONS: SampleTx[] = [
  {
    id: '1',
    name: 'Eva Novak',
    type: 'Received',
    amount: '+$5,710.20',
    isPositive: true,
    dateGroup: 'Today',
    iconBg: '#4A3E3D',
    iconText: 'EN'
  },
  {
    id: '2',
    name: 'Binance',
    type: 'Received',
    amount: '+$714.00',
    isPositive: true,
    dateGroup: 'Today',
    iconBg: '#F0B90B',
    iconName: 'logo-bitcoin'
  },
  {
    id: '3',
    name: 'Henrik Jansen',
    type: 'Received',
    amount: '+$428.00',
    isPositive: true,
    dateGroup: 'Yesterday',
    iconBg: '#3B4B5B',
    iconText: 'HJ'
  },
  {
    id: '4',
    name: 'Multiplex',
    type: 'Paid',
    amount: '-$124.55',
    isPositive: false,
    dateGroup: 'Yesterday',
    iconBg: '#E50914',
    iconName: 'film'
  },
  {
    id: '5',
    name: 'Nike',
    type: 'Paid',
    amount: '-$328.96',
    isPositive: false,
    dateGroup: 'Yesterday',
    iconBg: '#111111',
    iconName: 'fitness'
  },
  {
    id: '6',
    name: 'Matteo Ricci',
    type: 'Received',
    amount: '+$548.00',
    isPositive: true,
    dateGroup: '19 November',
    iconBg: '#2C3E50',
    iconText: 'MR'
  },
  {
    id: '7',
    name: 'Megogo',
    type: 'Received',
    amount: '-$847.20',
    isPositive: false,
    dateGroup: '19 November',
    iconBg: '#00A896',
    iconName: 'play-circle'
  },
  {
    id: '8',
    name: 'Emilia Costa',
    type: 'Received',
    amount: '+$147.00',
    isPositive: true,
    dateGroup: '19 November',
    iconBg: '#6C5CE7',
    iconText: 'EC'
  }
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { walletAddress, wallets, transactions: storeTransactions, displayCurrency, algoRates } = useWalletStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState(walletAddress);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [listKey, setListKey] = useState(0);

  const [selectedTx, setSelectedTx] = useState<GhostTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setSelectedWalletAddress(walletAddress);
  }, [walletAddress]);

  const selectedWallet = wallets.find((wallet) => wallet.address === selectedWalletAddress);

  const handleOpenDetail = (item: SampleTx) => {
    const matchedStoreTx = storeTransactions?.find((t) => t.id === item.id);
    if (matchedStoreTx) {
      setSelectedTx(matchedStoreTx);
    } else {
      setSelectedTx({
        id: item.id,
        sender: item.isPositive ? 'GBRNCKUL...CCB2' : (selectedWalletAddress || 'GBRNCKUL...CCB2'),
        receiver: item.isPositive ? (selectedWalletAddress || 'GBRNCKUL...CCB2') : 'GBRNCKUL...CCB2',
        amount: parseFloat(item.amount.replace(/[^0-9.]/g, '')) || 50,
        timestamp: item.dateGroup === 'Today' ? 'Tuesday, Feb 3, 2026 • 11:32 PM' : 'Nov 19, 2025 • 4:15 PM',
        status: 'confirmed',
        txHash: '6e268a9b1c0d4fe2'
      });
    }
    setIsModalOpen(true);
  };

  // Refresh list animation when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setListKey((prev) => prev + 1);
    }, [])
  );

  const formattedWalletAddress = useMemo(() => {
    if (!selectedWalletAddress) return '•••• 2872';
    return `•••• ${selectedWalletAddress.slice(-4)}`;
  }, [selectedWalletAddress]);

  const displayWalletText = selectedWallet?.label || formattedWalletAddress;

  // Show real store transactions for the connected wallet
  const allTxList = useMemo(() => {
    const selectedAddress = (selectedWalletAddress || '').toLowerCase();
    const selectedTransactions = (storeTransactions || []).filter((tx) =>
      tx.sender?.toLowerCase() === selectedAddress || tx.receiver?.toLowerCase() === selectedAddress
    );

    if (selectedTransactions.length > 0) {
      const convertedStoreTx: SampleTx[] = selectedTransactions.map((tx) => {
        const isPaid = tx.sender?.toLowerCase() === selectedAddress;
        const target = isPaid ? (tx.receiver || 'Recipient') : (tx.sender || 'Sender');
        const isPhone = target.replace(/\D/g, '').length >= 8 && target.length < 50;
        const displayName = isPhone
          ? target
          : `${target.substring(0, 6)}...${target.substring(target.length - 4)}`;

        const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
        const today = new Date();
        const isToday = txDate.toDateString() === today.toDateString();
        const dateGroup = isToday ? 'Today' : txDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const formattedTime = isNaN(txDate.getTime())
          ? 'Recently'
          : txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const statusText =
          tx.status === 'confirmed'
            ? 'Confirmed'
            : tx.status === 'syncing'
              ? 'Syncing...'
              : tx.status === 'failed'
                ? 'Failed'
                : 'Queued (Offline)';

        const currentCurrency = displayCurrency || 'USD';
        const rate = algoRates?.[currentCurrency] || (currentCurrency === 'INR' ? 15.25 : currentCurrency === 'EUR' ? 0.165 : 0.18);
        const currencySymbol = currentCurrency === 'INR' ? '₹' : currentCurrency === 'EUR' ? '€' : '$';
        const fiatVal = (tx.amount * rate).toFixed(2);
        const iconBg =
          tx.status === 'pending'
            ? '#F79E1B'
            : tx.status === 'syncing'
              ? '#2E90FA'
              : tx.status === 'failed'
                ? '#F04438'
                : isPaid
                  ? '#172B3E'
                  : '#05DA93';

        const iconName: keyof typeof Ionicons.glyphMap =
          tx.status === 'pending'
            ? 'time'
            : tx.status === 'syncing'
              ? 'sync'
              : tx.status === 'failed'
                ? 'alert-circle'
                : isPaid
                  ? 'arrow-up-circle'
                  : 'arrow-down-circle';

        return {
          id: tx.id,
          name: isPaid ? `To ${displayName}` : `From ${displayName}`,
          type: isPaid ? 'Paid' : 'Received',
          amount: `${isPaid ? '-' : '+'}${tx.amount.toFixed(2)} ALGO`,
          fiatSubText: `≈ ${currencySymbol}${fiatVal} ${currentCurrency}`,
          isPositive: !isPaid,
          dateGroup,
          iconBg,
          iconName,
          statusText,
          formattedTime
        };
      });
      return convertedStoreTx;
    }
    return selectedWalletAddress ? [] : SAMPLE_TRANSACTIONS;
  }, [storeTransactions, selectedWalletAddress, displayCurrency, algoRates]);

  const filteredTxList = useMemo(() => {
    if (!searchQuery.trim()) return allTxList;
    return allTxList.filter(
      (tx) =>
        tx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.includes(searchQuery)
    );
  }, [allTxList, searchQuery]);

  const groupedTx = useMemo(() => {
    const groups: { [key: string]: SampleTx[] } = {};
    filteredTxList.forEach((tx) => {
      if (!groups[tx.dateGroup]) {
        groups[tx.dateGroup] = [];
      }
      groups[tx.dateGroup].push(tx);
    });
    return groups;
  }, [filteredTxList]);

  let globalTxIndex = 0;
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={[styles.gradientContainer, isDesktop && styles.gradientContainerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar (Static - No Fade Animation) */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>

          <Text style={styles.headerTitle}>Transactions</Text>

          <Pressable
            style={styles.iconButton}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <Ionicons name="search-outline" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>

        {!walletAddress ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <WalletOnboardingCard />
          </ScrollView>
        ) : (
          <>
            {/* Search Bar Input */}
            {isSearchVisible && (
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={18} color={colors.primaryDark} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or amount..."
                  placeholderTextColor="rgba(23, 43, 62, 0.45)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.primaryDark} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Account / Algorand Pill Indicator */}
            <View style={styles.pillWrapper}>
              <Pressable
                style={styles.cardPill}
                onPress={() => setIsWalletDropdownOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="Choose wallet transaction history"
              >
                <Image
                  source={require('../../assets/branding/algorand-logo.webp')}
                  style={styles.algorandPillLogo}
                  resizeMode="contain"
                />
                <Text style={styles.cardPillText}>{displayWalletText}</Text>
                <Ionicons name={isWalletDropdownOpen ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
              </Pressable>
              {isWalletDropdownOpen && wallets.length > 1 && (
                <View style={styles.walletDropdown}>
                  {wallets.map((wallet) => {
                    const isSelected = wallet.address === selectedWalletAddress;
                    return (
                      <Pressable
                        key={wallet.address}
                        style={[styles.walletOption, isSelected && styles.walletOptionSelected]}
                        onPress={() => {
                          setSelectedWalletAddress(wallet.address);
                          setIsWalletDropdownOpen(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.walletOptionLabel}>
                            {wallet.label || 'Wallet'}{isSelected ? '  (Selected)' : ''}
                          </Text>
                          <Text style={styles.walletOptionAddress} numberOfLines={1} ellipsizeMode="middle">
                            {wallet.address}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.secondary} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Grouped Transaction List (ONLY the list animates) */}
            <ScrollView
              key={listKey}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {Object.keys(groupedTx).length === 0 ? (
                <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No transactions found</Text>
                </Animated.View>
              ) : (
                Object.entries(groupedTx).map(([dateGroup, items], groupIndex) => (
                  <View key={dateGroup} style={styles.sectionGroup}>
                    <Text style={styles.dateGroupHeader}>{dateGroup}</Text>
                    {items.map((item, index) => (
                      <AnimatedPressable
                        key={item.id}
                        entering={FadeInDown.duration(300).delay(index * 60)}
                        style={styles.txCard}
                        onPress={() => handleOpenDetail(item)}
                      >
                        {/* Avatar / Brand Badge */}
                        <View style={[styles.avatarContainer, { backgroundColor: item.iconBg }]}>
                          {item.iconName ? (
                            <Ionicons name={item.iconName} size={20} color={colors.white} />
                          ) : (
                            <Text style={styles.avatarText}>{item.iconText}</Text>
                          )}
                        </View>

                        {/* Details */}
                        <View style={styles.txDetails}>
                          <Text style={styles.txName}>{item.name}</Text>
                          <Text style={styles.txType}>
                            {item.statusText ? `${item.statusText} • ${item.formattedTime}` : item.type}
                          </Text>
                        </View>

                        {/* Amount Column */}
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={[
                              styles.txAmount,
                              item.isPositive ? styles.amountPositive : styles.amountNegative
                            ]}
                          >
                            {item.amount}
                          </Text>
                          {Boolean(item.fiatSubText) && (
                            <Text style={{ fontSize: 11, color: '#667085', marginTop: 2, fontWeight: '600' }}>
                              {item.fiatSubText}
                            </Text>
                          )}
                        </View>
                      </AnimatedPressable>
                    ))}
                  </View>
                ))
              )
              }
            </ScrollView>
          </>
        )}
      </LinearGradient>

      <TransactionDetailModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
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
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF', // Pure White button background
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Pure White search container background
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 44,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_500Medium'
  },
  pillWrapper: {
    alignItems: 'center',
    marginVertical: 12
  },
  cardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172B3E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  walletDropdown: {
    width: '86%',
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7'
  },
  walletOptionSelected: {
    backgroundColor: '#ECFDF5'
  },
  walletOptionLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  walletOptionAddress: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  algorandPillLogo: {
    width: 60,
    height: 16,
    tintColor: '#FFFFFF',
    marginRight: 6
  },
  cardPillText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  sectionGroup: {
    marginBottom: 12
  },
  dateGroupHeader: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginVertical: 10
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // 100% Pure Solid White Card
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
    color: '#172B3E', // Dark Navy text inside white card
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2
  },
  txStatusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  txType: {
    color: '#667085', // Dark Gray muted text
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  txAmount: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2
  },
  amountPositive: {
    color: '#12B76A' // Vibrant Green for received
  },
  amountNegative: {
    color: '#D92D20' // Vibrant Red for paid
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 12
  }
});
