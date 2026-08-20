import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { WalletOnboardingCard } from '../../src/components/WalletOnboardingCard';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { walletAddress, transactions, displayCurrency, algoRates } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'week' | 'year'>('month');

  // Compute Today's index (Mon..Sun order)
  const initialTodayIdx = React.useMemo(() => {
    const daysOrdered = [1, 2, 3, 4, 5, 6, 0];
    const currentDay = new Date().getDay();
    const idx = daysOrdered.indexOf(currentDay);
    return idx >= 0 ? idx : 3;
  }, []);

  const [selectedBar, setSelectedBar] = useState<number>(initialTodayIdx);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('Aug 2026');
  const [selectedYear, setSelectedYear] = useState(2026);

  const currencySymbol = displayCurrency === 'INR' ? '₹' : displayCurrency === 'EUR' ? '€' : '$';
  const rate = algoRates ? (algoRates[displayCurrency] || 1) : 1;

  const dynamicAnalytics = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalOutflowAlgo: 0,
        formattedTotalOutflow: `${currencySymbol}0.00`,
        offlineCount: 0,
        offlineSumConverted: '0.00',
        offlinePct: 50,
        onChainCount: 0,
        onChainSumConverted: '0.00',
        onChainPct: 50,
        todayIndex: 3,
        chartData: [
          { day: 'Mon', amount: '0.00', height: 15, isToday: false, index: 0 },
          { day: 'Tue', amount: '0.00', height: 15, isToday: false, index: 1 },
          { day: 'Wed', amount: '0.00', height: 15, isToday: false, index: 2 },
          { day: 'Thu', amount: '0.00', height: 15, isToday: true, index: 3 },
          { day: 'Fri', amount: '0.00', height: 15, isToday: false, index: 4 },
          { day: 'Sat', amount: '0.00', height: 15, isToday: false, index: 5 },
          { day: 'Sun', amount: '0.00', height: 15, isToday: false, index: 6 }
        ],
        categories: [
          {
            id: 'cat-peer',
            name: 'Peer-to-Peer Transfers',
            iconName: 'swap-horizontal' as const,
            iconBg: '#F0EBFB',
            iconColor: '#7F56D9',
            amountConverted: '0.00',
            pct: 0,
            count: 0
          },
          {
            id: 'cat-vault',
            name: 'Offline Vault Payments',
            iconName: 'flash' as const,
            iconBg: '#E4F2EB',
            iconColor: '#12B76A',
            amountConverted: '0.00',
            pct: 0,
            count: 0
          },
          {
            id: 'cat-merchant',
            name: 'Merchant & Node Services',
            iconName: 'cart' as const,
            iconBg: '#FEF3F2',
            iconColor: '#F04438',
            amountConverted: '0.00',
            pct: 0,
            count: 0
          }
        ]
      };
    }

    let totalOutflowAlgo = 0;
    let offlineCount = 0;
    let offlineSumAlgo = 0;
    let onChainCount = 0;
    let onChainSumAlgo = 0;

    const daysSum: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    transactions.forEach((tx) => {
      const isPaid = tx.sender?.toLowerCase() === (walletAddress || '').toLowerCase();
      if (isPaid) {
        totalOutflowAlgo += tx.amount;

        const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
        const dayIdx = isNaN(txDate.getTime()) ? 0 : txDate.getDay();
        daysSum[dayIdx] = (daysSum[dayIdx] || 0) + tx.amount;

        if (tx.status === 'pending' || tx.status === 'syncing') {
          offlineCount++;
          offlineSumAlgo += tx.amount;
        } else {
          onChainCount++;
          onChainSumAlgo += tx.amount;
        }
      }
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysOrdered = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
    const currentDayIdx = new Date().getDay();
    const todayIndex = daysOrdered.indexOf(currentDayIdx);

    const maxDayVal = Math.max(...Object.values(daysSum), 1);

    const chartData = daysOrdered.map((dIdx, idx) => {
      const algoVal = daysSum[dIdx] || 0;
      const convertedVal = algoVal * rate;
      const pct = Math.max(Math.round((algoVal / maxDayVal) * 85), 15);
      const isToday = dIdx === currentDayIdx;
      return {
        day: dayLabels[dIdx],
        amount: convertedVal.toFixed(2),
        height: pct,
        isToday,
        index: idx
      };
    });

    let peerTransfersAlgo = 0;
    let peerTransfersCount = 0;
    let vaultVaultAlgo = 0;
    let vaultVaultCount = 0;
    let merchantAlgo = 0;
    let merchantCount = 0;

    transactions.forEach((tx) => {
      const isPaid = tx.sender?.toLowerCase() === (walletAddress || '').toLowerCase();
      if (isPaid) {
        if (tx.status === 'pending' || tx.status === 'syncing') {
          vaultVaultAlgo += tx.amount;
          vaultVaultCount++;
        } else if (tx.receiver && (tx.receiver.startsWith('+') || tx.receiver.length > 25)) {
          peerTransfersAlgo += tx.amount;
          peerTransfersCount++;
        } else {
          merchantAlgo += tx.amount;
          merchantCount++;
        }
      }
    });

    const safeTotal = totalOutflowAlgo || 1;
    const peerPct = totalOutflowAlgo > 0 ? Math.round((peerTransfersAlgo / safeTotal) * 100) : 0;
    const vaultPct = totalOutflowAlgo > 0 ? Math.round((vaultVaultAlgo / safeTotal) * 100) : 0;
    const merchantPct = totalOutflowAlgo > 0 ? Math.max(0, 100 - peerPct - vaultPct) : 0;

    const categories = [
      {
        id: 'cat-peer',
        name: 'Peer-to-Peer Transfers',
        iconName: 'swap-horizontal' as const,
        iconBg: '#F0EBFB',
        iconColor: '#7F56D9',
        amountConverted: (peerTransfersAlgo * rate).toFixed(2),
        pct: peerPct,
        count: peerTransfersCount
      },
      {
        id: 'cat-vault',
        name: 'Offline Vault Payments',
        iconName: 'flash' as const,
        iconBg: '#E4F2EB',
        iconColor: '#12B76A',
        amountConverted: (vaultVaultAlgo * rate).toFixed(2),
        pct: vaultPct,
        count: vaultVaultCount
      },
      {
        id: 'cat-merchant',
        name: 'Merchant & Node Services',
        iconName: 'cart' as const,
        iconBg: '#FEF3F2',
        iconColor: '#F04438',
        amountConverted: (merchantAlgo * rate).toFixed(2),
        pct: merchantPct,
        count: merchantCount
      }
    ];

    const totalCount = offlineCount + onChainCount || 1;
    const offlinePct = Math.round((offlineCount / totalCount) * 100) || 50;
    const onChainPct = 100 - offlinePct;

    const totalOutflowConverted = (totalOutflowAlgo * rate).toFixed(2);

    return {
      totalOutflowAlgo,
      formattedTotalOutflow: `${currencySymbol}${totalOutflowConverted}`,
      offlineCount,
      offlineSumConverted: (offlineSumAlgo * rate).toFixed(2),
      offlinePct,
      onChainCount,
      onChainSumConverted: (onChainSumAlgo * rate).toFixed(2),
      onChainPct,
      chartData,
      categories,
      todayIndex
    };
  }, [transactions, walletAddress, rate, currencySymbol]);

  const monthsList = [
    'Jan', 'Feb', 'Mar', 'Apr',
    'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const presets = [
    { label: 'This Month', value: 'Aug 2026' },
    { label: 'Last Month', value: 'Jul 2026' },
    { label: 'Q2 2026', value: 'Jun 2026' },
    { label: 'Year 2026', value: 'Year 2026' }
  ];

  useFocusEffect(
    useCallback(() => {
      setAnalyticsKey((prev) => prev + 1);
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={[styles.gradientContainer, isDesktop && styles.gradientContainerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSubtitle}>Financial insights & vault stats</Text>
          </View>

          <Pressable
            style={styles.periodPill}
            onPress={() => setIsDatePickerOpen(true)}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={styles.periodPillText}>{selectedMonth}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.primaryDark} style={{ marginLeft: 2 }} />
          </Pressable>
        </View>

        {!walletAddress ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <WalletOnboardingCard />
          </ScrollView>
        ) : (
          <>
            <ScrollView
          key={analyticsKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Interactive Spending Bar Chart Card (Clean White) */}
          <View style={styles.spendingCardContainer}>
            <LinearGradient
              colors={['#FFFFFF', '#F5FAF7']}
              style={styles.spendingCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.spendingCardHeader}>
                <View>
                  <Text style={styles.spendingCardLabel}>Total Outflows</Text>
                  <Text style={styles.spendingAmountText}>{dynamicAnalytics.formattedTotalOutflow}</Text>
                </View>

                <View style={styles.trendBadge}>
                  <Ionicons name="trending-up" size={12} color="#12B76A" style={{ marginRight: 4 }} />
                  <Text style={styles.trendBadgeText}>Active Node</Text>
                </View>
              </View>

              {/* Interactive Bar Chart */}
              <View style={styles.chartContainer}>
                {dynamicAnalytics.chartData.map((item, index) => {
                  const isSelected = selectedBar === index;
                  return (
                    <Pressable
                      key={item.day}
                      style={styles.chartBarCol}
                      onPress={() => setSelectedBar(index)}
                    >
                      {/* Active Tooltip Pill */}
                      {isSelected && (
                        <View style={styles.chartTooltip}>
                          <Text style={styles.chartTooltipText} numberOfLines={1}>
                            {currencySymbol}{item.amount}
                          </Text>
                        </View>
                      )}

                      <View style={styles.barTrackContainer}>
                        <LinearGradient
                          colors={isSelected ? ['#05DA93', '#00B87A'] : ['#D0D5DD', '#EAECF0']}
                          style={[
                            styles.chartBarFill,
                            { height: `${item.height}%` },
                            isSelected && styles.activeChartBarFill
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                        />
                      </View>
                      <Text style={[styles.chartDayText, isSelected && styles.activeChartDayText, item.isToday && styles.todayChartDayText]}>
                        {item.day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LinearGradient>
          </View>

          {/* Offline Vault vs On-Chain Breakdown */}
          <Animated.View entering={FadeInDown.duration(450).delay(120)} style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Vault Payment Split</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(450).delay(150)} style={styles.splitCardContainer}>
            <View style={styles.splitProgressTrack}>
              <View style={[styles.splitProgressFill, { width: `${dynamicAnalytics.offlinePct}%`, backgroundColor: colors.secondary }]} />
              <View style={[styles.splitProgressFill, { width: `${dynamicAnalytics.onChainPct}%`, backgroundColor: '#7F56D9' }]} />
            </View>

            <View style={styles.splitLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                <View>
                  <Text style={styles.legendTitle}>Offline Vault ({dynamicAnalytics.offlinePct}%)</Text>
                  <Text style={styles.legendSub}>{currencySymbol}{dynamicAnalytics.offlineSumConverted} • {dynamicAnalytics.offlineCount} Payments</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#7F56D9' }]} />
                <View>
                  <Text style={styles.legendTitle}>On-Chain ({dynamicAnalytics.onChainPct}%)</Text>
                  <Text style={styles.legendSub}>{currencySymbol}{dynamicAnalytics.onChainSumConverted} • {dynamicAnalytics.onChainCount} Payments</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Category Breakdown Header */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
          </Animated.View>

          {dynamicAnalytics.categories.map((cat, index) => (
            <Animated.View
              key={cat.id}
              entering={FadeInDown.duration(450).delay(210 + index * 30)}
              style={styles.categoryCard}
            >
              <View style={styles.categoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: cat.iconBg }]}>
                  <Ionicons name={cat.iconName} size={20} color={cat.iconColor} />
                </View>
                <View style={styles.categoryDetails}>
                  <View style={styles.categoryTitleRow}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryAmount}>{currencySymbol}{cat.amountConverted}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${cat.pct}%`, backgroundColor: cat.iconColor }]} />
                  </View>
                  <Text style={styles.categoryPercentText}>
                    {cat.pct}% of total outflow • {cat.count} txns
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
          </>
        )}
      </LinearGradient>

      {/* Date & Month Picker Filter Modal */}
      <Modal
        visible={isDatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDatePickerOpen(false)}
      >
        <View style={styles.datePickerOverlay}>
          <Animated.View entering={ZoomIn.duration(350).springify()} style={styles.datePickerCard}>
            <View style={styles.datePickerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-sharp" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.datePickerTitle}>Filter Analytics</Text>
              </View>

              <Pressable style={styles.datePickerCloseBtn} onPress={() => setIsDatePickerOpen(false)}>
                <Ionicons name="close" size={18} color={colors.primaryDark} />
              </Pressable>
            </View>

            <Text style={styles.datePickerSub}>Select time period or month</Text>

            {/* Quick Presets Chips */}
            <View style={styles.presetsRow}>
              {presets.map((preset) => {
                const isActive = selectedMonth === preset.value;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.presetChip, isActive && styles.presetChipActive]}
                    onPress={() => {
                      setSelectedMonth(preset.value);
                      setIsDatePickerOpen(false);
                      Toast.show({
                        type: 'info',
                        text1: `Filtered by ${preset.label}`,
                        text2: `Showing spending data for ${preset.value}`
                      });
                    }}
                  >
                    <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Year Selector Row */}
            <View style={styles.yearSelectorRow}>
              <Pressable onPress={() => setSelectedYear((prev) => prev - 1)}>
                <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
              </Pressable>
              <Text style={styles.yearTitleText}>{selectedYear}</Text>
              <Pressable onPress={() => setSelectedYear((prev) => prev + 1)}>
                <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
              </Pressable>
            </View>

            {/* Months Grid (12 Months) */}
            <View style={styles.monthsGrid}>
              {monthsList.map((m) => {
                const monthStr = `${m} ${selectedYear}`;
                const isSelected = selectedMonth === monthStr;
                return (
                  <Pressable
                    key={m}
                    style={[styles.monthGridCell, isSelected && styles.monthGridCellActive]}
                    onPress={() => {
                      setSelectedMonth(monthStr);
                      setIsDatePickerOpen(false);
                      Toast.show({
                        type: 'info',
                        text1: `Filter Applied: ${monthStr}`,
                        text2: `Showing analytics for ${monthStr}`
                      });
                    }}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Apply Action Button */}
            <Pressable
              style={styles.applyFilterButton}
              onPress={() => {
                setIsDatePickerOpen(false);
                Toast.show({
                  type: 'success',
                  text1: 'Filter Applied',
                  text2: `Analytics updated for ${selectedMonth}`
                });
              }}
            >
              <Text style={styles.applyFilterButtonText}>Apply Filter</Text>
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
    paddingBottom: 16
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold'
  },
  headerSubtitle: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.12)',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  periodPillText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_700Bold'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  spendingCardContainer: {
    marginTop: 8,
    marginBottom: 20
  },
  spendingCard: {
    borderRadius: 24,
    padding: 22,
    elevation: 4,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.25)'
  },
  spendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  spendingCardLabel: {
    color: '#667085',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(18, 183, 106, 0.3)'
  },
  trendBadgeText: {
    color: '#12B76A',
    fontSize: 11,
    fontFamily: 'Inter_700Bold'
  },
  spendingAmountText: {
    color: colors.primaryDark,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    marginTop: 2
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    marginTop: 14,
    paddingTop: 20,
    paddingHorizontal: 4
  },
  chartBarCol: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative'
  },
  chartTooltip: {
    position: 'absolute',
    top: -26,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chartTooltipText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center'
  },
  barTrackContainer: {
    width: 14,
    height: 95,
    backgroundColor: '#F2F4F7',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 7
  },
  activeChartBarFill: {
    shadowColor: '#05DA93',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.6,
    shadowRadius: 6
  },
  chartDayText: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8
  },
  activeChartDayText: {
    color: '#12B76A',
    fontFamily: 'Inter_700Bold'
  },
  todayChartDayText: {
    color: '#12B76A',
    fontFamily: 'Inter_700Bold'
  },
  spendingPeriodSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 4
  },
  spendingCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 18
  },
  spendingStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  spendingStatItem: {
    flex: 1,
    alignItems: 'center'
  },
  statItemLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2
  },
  statItemValue: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  },
  statVerticalLine: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  sectionHeaderRow: {
    marginBottom: 12
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontFamily: 'Inter_700Bold'
  },
  splitCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  splitProgressTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F2F4F7',
    overflow: 'hidden',
    marginBottom: 16
  },
  splitProgressFill: {
    height: '100%'
  },
  splitLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  legendTitle: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_700Bold'
  },
  legendSub: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 1
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  categoryDetails: {
    flex: 1
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  categoryName: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  categoryAmount: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F2F4F7',
    overflow: 'hidden',
    marginBottom: 4
  },
  barFill: {
    height: '100%',
    borderRadius: 3
  },
  categoryPercentText: {
    color: '#667085',
    fontSize: 10,
    fontFamily: 'Inter_500Medium'
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  datePickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  datePickerTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontFamily: 'Orbitron_700Bold'
  },
  datePickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  datePickerSub: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  presetChip: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  presetChipActive: {
    backgroundColor: '#E4F2EB',
    borderColor: 'rgba(5, 218, 147, 0.4)'
  },
  presetChipText: {
    color: '#667085',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold'
  },
  presetChipTextActive: {
    color: colors.primaryDark,
    fontFamily: 'Inter_700Bold'
  },
  yearSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAF9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14
  },
  yearTitleText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Orbitron_700Bold'
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 20
  },
  monthGridCell: {
    width: '22%',
    paddingVertical: 10,
    backgroundColor: '#F8FAF9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  monthGridCellActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.secondary
  },
  monthCellText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  monthCellTextActive: {
    color: colors.secondary,
    fontFamily: 'Inter_700Bold'
  },
  applyFilterButton: {
    backgroundColor: colors.secondary,
    borderRadius: 18,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  applyFilterButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  }
});
