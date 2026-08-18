import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
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

  return (
    <LinearGradient
      colors={['#E8F6F0', '#CFECE0', '#BDE4D4']}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Background Ambient Glow Effects */}
      <View style={styles.topGlowEffect} />
      <View style={styles.bottomGlowEffect} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
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

        {/* Search Bar Input (toggled on search press) */}
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

        {/* Account / Mastercard Pill Indicator */}
        <View style={styles.pillWrapper}>
          <View style={styles.cardPill}>
            <View style={styles.mastercardDots}>
              <View style={[styles.dot, { backgroundColor: '#EB001B' }]} />
              <View style={[styles.dot, { backgroundColor: '#F79E1B', marginLeft: -6 }]} />
            </View>
            <Text style={styles.cardPillText}>{displayWalletText}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
          </View>
        </View>

        {/* Grouped Transaction List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {Object.keys(groupedTx).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          ) : (
            Object.entries(groupedTx).map(([dateGroup, items]) => (
              <View key={dateGroup} style={styles.sectionGroup}>
                <Text style={styles.dateGroupHeader}>{dateGroup}</Text>
                {items.map((item) => (
                  <View key={item.id} style={styles.txCard}>
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
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1
  },
  topGlowEffect: {
    position: 'absolute',
    top: -80,
    left: '20%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FFFFFF',
    opacity: 0.5,
    transform: [{ scaleX: 1.5 }]
  },
  bottomGlowEffect: {
    position: 'absolute',
    bottom: 40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#A8E2CC',
    opacity: 0.4
  },
  safeArea: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 0.5
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
    fontFamily: 'Rajdhani_500Medium'
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
    fontFamily: 'Rajdhani_600SemiBold',
    letterSpacing: 0.5
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110 // Ensures smooth scrolling above bottom floating navigation bar
  },
  sectionGroup: {
    marginBottom: 12
  },
  dateGroupHeader: {
    color: '#5C768D',
    fontSize: 14,
    fontFamily: 'Rajdhani_600SemiBold',
    textAlign: 'center',
    marginVertical: 10
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Bright solid White Card
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8
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
    fontSize: 15,
    fontFamily: 'Rajdhani_700Bold'
  },
  txDetails: {
    flex: 1
  },
  txName: {
    color: '#172B3E', // Dark Navy text inside white card
    fontSize: 16,
    fontFamily: 'Rajdhani_600SemiBold',
    marginBottom: 2
  },
  txStatusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  txType: {
    color: '#667085', // Dark Gray muted text
    fontSize: 13,
    fontFamily: 'Rajdhani_500Medium'
  },
  txAmount: {
    fontSize: 17,
    fontFamily: 'Rajdhani_700Bold',
    letterSpacing: 0.3
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
    fontSize: 15,
    fontFamily: 'Rajdhani_500Medium',
    marginTop: 12
  }
});
