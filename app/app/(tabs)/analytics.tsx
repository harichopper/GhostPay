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
import { colors } from '../../src/theme/colors';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'week' | 'year'>('month');
  const [selectedBar, setSelectedBar] = useState(2); // Wed ($450)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('Aug 2026');
  const [selectedYear, setSelectedYear] = useState(2026);

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

  const chartData = [
    { day: 'Mon', amount: 240, height: 55 },
    { day: 'Tue', amount: 120, height: 30 },
    { day: 'Wed', amount: 450, height: 95 },
    { day: 'Thu', amount: 180, height: 45 },
    { day: 'Fri', amount: 310, height: 70 },
    { day: 'Sat', amount: 90, height: 22 },
    { day: 'Sun', amount: 34, height: 12 }
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
                  <Text style={styles.spendingAmountText}>$1,424.55</Text>
                </View>

                <View style={styles.trendBadge}>
                  <Ionicons name="trending-up" size={12} color="#12B76A" style={{ marginRight: 4 }} />
                  <Text style={styles.trendBadgeText}>+12.4%</Text>
                </View>
              </View>

              {/* Interactive Bar Chart */}
              <View style={styles.chartContainer}>
                {chartData.map((item, index) => {
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
                          <Text style={styles.chartTooltipText}>${item.amount}</Text>
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
                      <Text style={[styles.chartDayText, isSelected && styles.activeChartDayText]}>
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
              <View style={[styles.splitProgressFill, { width: '68%', backgroundColor: colors.secondary }]} />
              <View style={[styles.splitProgressFill, { width: '32%', backgroundColor: '#7F56D9' }]} />
            </View>

            <View style={styles.splitLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                <View>
                  <Text style={styles.legendTitle}>Offline Vault (68%)</Text>
                  <Text style={styles.legendSub}>$968.69 • 19 Payments</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#7F56D9' }]} />
                <View>
                  <Text style={styles.legendTitle}>On-Chain (32%)</Text>
                  <Text style={styles.legendSub}>$455.86 • 9 Payments</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Category Breakdown Header */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
          </Animated.View>

          {/* Category 1: Transfers */}
          <Animated.View entering={FadeInDown.duration(450).delay(210)} style={styles.categoryCard}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryIconCircle, { backgroundColor: '#F0EBFB' }]}>
                <Ionicons name="swap-horizontal" size={20} color="#7F56D9" />
              </View>
              <View style={styles.categoryDetails}>
                <View style={styles.categoryTitleRow}>
                  <Text style={styles.categoryName}>Transfers & Exchanges</Text>
                  <Text style={styles.categoryAmount}>$820.00</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: '57%', backgroundColor: '#7F56D9' }]} />
                </View>
                <Text style={styles.categoryPercentText}>57.5% of total outflow</Text>
              </View>
            </View>
          </Animated.View>

          {/* Category 2: Shopping & Retail */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={styles.categoryCard}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryIconCircle, { backgroundColor: '#E4F2EB' }]}>
                <Ionicons name="cart" size={20} color="#12B76A" />
              </View>
              <View style={styles.categoryDetails}>
                <View style={styles.categoryTitleRow}>
                  <Text style={styles.categoryName}>Shopping & Retail</Text>
                  <Text style={styles.categoryAmount}>$480.00</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: '34%', backgroundColor: '#12B76A' }]} />
                </View>
                <Text style={styles.categoryPercentText}>33.7% of total outflow</Text>
              </View>
            </View>
          </Animated.View>

          {/* Category 3: Entertainment */}
          <Animated.View entering={FadeInDown.duration(450).delay(270)} style={styles.categoryCard}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryIconCircle, { backgroundColor: '#FEF3F2' }]}>
                <Ionicons name="film" size={20} color="#F04438" />
              </View>
              <View style={styles.categoryDetails}>
                <View style={styles.categoryTitleRow}>
                  <Text style={styles.categoryName}>Entertainment & Movies</Text>
                  <Text style={styles.categoryAmount}>$124.55</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: '9%', backgroundColor: '#F04438' }]} />
                </View>
                <Text style={styles.categoryPercentText}>8.8% of total outflow</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
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
    top: -22,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 5
  },
  chartTooltipText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'Inter_700Bold'
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
