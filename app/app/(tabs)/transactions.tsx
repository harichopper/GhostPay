import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

interface SampleTx {
  id: string;
  name: string;
  type: 'Received' | 'Paid';
  amount: string;
  isPositive: boolean;
  dateGroup: 'Today' | 'Yesterday' | '19 November';
  iconBg: string;
  iconText?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  avatarUrl?: string;
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
  const { walletAddress, transactions: storeTransactions } = useWalletStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedWalletLabel, setSelectedWalletLabel] = useState('•••• 2872');
  const [focusKey, setFocusKey] = useState(0);

  // Trigger animations every time screen is focused (tab navigation)
  useFocusEffect(
    useCallback(() => {
      setFocusKey((prev) => prev + 1);
    }, [])
  );

  const formattedWalletAddress = useMemo(() => {
    if (!walletAddress) return '•••• 2872';
    return `•••• ${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const displayWalletText = formattedWalletAddress !== '•••• ' ? formattedWalletAddress : selectedWalletLabel;

  // Combine real store transactions with sample data for a complete view
  const allTxList = useMemo(() => {
    if (storeTransactions && storeTransactions.length > 0) {
      const convertedStoreTx: SampleTx[] = storeTransactions.map((tx) => ({
        id: tx.id,
        name: tx.receiver ? `To ${tx.receiver.slice(0, 8)}...` : 'Transfer',
        type: tx.sender === walletAddress ? 'Paid' : 'Received',
        amount: `${tx.sender === walletAddress ? '-' : '+'}${tx.amount} ALGO`,
        isPositive: tx.sender !== walletAddress,
        dateGroup: 'Today',
        iconBg: colors.accent,
        iconName: 'swap-horizontal'
      }));
      return [...convertedStoreTx, ...SAMPLE_TRANSACTIONS];
    }
    return SAMPLE_TRANSACTIONS;
  }, [storeTransactions, walletAddress]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        key={focusKey}
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.header}>
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
        </Animated.View>

        {/* Search Bar Input (toggled on search press) */}
        {isSearchVisible && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.searchBarContainer}>
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
          </Animated.View>
        )}

        {/* Account / Mastercard Pill Indicator */}
        <Animated.View entering={ZoomIn.duration(400).delay(150)} style={styles.pillWrapper}>
          <View style={styles.cardPill}>
            <View style={styles.mastercardDots}>
              <View style={[styles.dot, { backgroundColor: '#EB001B' }]} />
              <View style={[styles.dot, { backgroundColor: '#F79E1B', marginLeft: -6 }]} />
            </View>
            <Text style={styles.cardPillText}>{displayWalletText}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
          </View>
        </Animated.View>

        {/* Grouped Transaction List */}
        <ScrollView
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
                <Animated.Text
                  entering={FadeInDown.duration(300).delay(200 + groupIndex * 100)}
                  style={styles.dateGroupHeader}
                >
                  {dateGroup}
                </Animated.Text>
                {items.map((item) => {
                  const currentIndex = globalTxIndex++;
                  return (
                    <Animated.View
                      key={item.id}
                      entering={FadeInDown.delay(220 + currentIndex * 70).duration(450).springify().damping(15)}
                      style={styles.txCard}
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
                        <View style={styles.txStatusRow}>
                          <Text style={styles.txType}>{item.type}</Text>
                          <Ionicons
                            name={item.type === 'Received' ? 'checkmark-circle' : 'time-outline'}
                            size={14}
                            color="#667085"
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                      </View>

                      {/* Amount */}
                      <Text
                        style={[
                          styles.txAmount,
                          item.isPositive ? styles.amountPositive : styles.amountNegative
                        ]}
                      >
                        {item.amount}
                      </Text>
                    </Animated.View>
                  );
                })}
              </View>
            ))
          )}
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
    backgroundColor: 'rgba(23, 43, 62, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 43, 62, 0.08)',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 42
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
  mastercardDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7
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
    backgroundColor: 'rgba(255, 255, 255, 0.82)', // Frosted glass whitish card
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    elevation: 4,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)'
    })
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
