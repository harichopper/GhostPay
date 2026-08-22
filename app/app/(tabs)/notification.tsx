import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import TransactionDetailModal from '../../src/components/TransactionDetailModal';
import NotificationDetailModal from '../../src/components/NotificationDetailModal';
import { WalletOnboardingCard } from '../../src/components/WalletOnboardingCard';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';
import { GhostTransaction } from '../../src/types/transaction';
import { useSecurityStore } from '../../src/store/securityStore';
import { fetchNotificationsFromApi, clearNotificationsInApi, markNotificationReadInApi } from '../../src/services/api';

interface NotificationItem {
  id: string;
  type: 'payment' | 'system' | 'security' | 'reward';
  title: string;
  message: string;
  time: string;
  isUnread: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  rawTx?: GhostTransaction;
}

export default function NotificationScreen() {
  const router = useRouter();
  const { walletAddress, transactions, verifiedPhone, notificationsClearedAt, setNotificationsClearedAt, readTxIds, markTxAsRead } = useWalletStore();
  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const dynamicNotifications = React.useMemo(() => {
    const items: NotificationItem[] = [];

    // Generate real payment notifications from transactions (Received payments only)
    if (transactions && transactions.length > 0) {
      transactions.forEach((tx) => {
        const isPaid = tx.sender?.toLowerCase() === (walletAddress || '').toLowerCase();
        // Only display Receive payments in notifications; skip Send payments
        if (isPaid) return;

        const target = tx.sender || 'Sender';
        const isPhone = target.replace(/\D/g, '').length >= 8 && target.length < 50;
        const displayName = isPhone
          ? target
          : `${target.substring(0, 6)}...${target.substring(target.length - 4)}`;

        const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
        const timeFormatted = isNaN(txDate.getTime())
          ? 'Recently'
          : txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        items.push({
          id: `notif-tx-${tx.id}`,
          type: 'payment',
          title: 'Payment Received',
          message: `Received +${tx.amount.toFixed(2)} ALGO from ${displayName}.`,
          time: timeFormatted,
          isUnread: !readTxIds.includes(tx.id),
          iconName: 'arrow-down-circle',
          iconBg: '#ECFDF3',
          iconColor: '#12B76A',
          rawTx: tx
        });
      });
    }

    // Dynamic identity & security notifications
    if (verifiedPhone) {
      items.push({
        id: 'notif-identity-linked',
        type: 'security',
        title: 'Mobile Identity Linked',
        message: `Your wallet is linked & verified for mobile number ${verifiedPhone}.`,
        time: 'Verified',
        isUnread: false,
        iconName: 'shield-checkmark',
        iconBg: '#F0EBFB',
        iconColor: '#7F56D9'
      });
    }

    if (appLockEnabled) {
      items.push({
        id: 'notif-app-lock',
        type: 'security',
        title: 'Security PIN Active',
        message: '4-Digit PIN passcode lock is enabled for application access.',
        time: 'Active',
        isUnread: false,
        iconName: 'lock-closed',
        iconBg: '#EBF4FE',
        iconColor: '#2F80ED'
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'notif-system-welcome',
        type: 'system',
        title: 'GhostPay Network Ready',
        message: 'Zero-data vault payment network is active and connected to Algorand Testnet.',
        time: 'Just now',
        isUnread: false,
        iconName: 'checkmark-circle',
        iconBg: '#EBF4FE',
        iconColor: '#2F80ED'
      });
    }

    return items;
  }, [transactions, walletAddress, verifiedPhone, appLockEnabled]);

  const [dbNotifications, setDbNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (walletAddress) {
      void fetchNotificationsFromApi(walletAddress).then((list) => {
        if (list && list.length > 0) {
          const mapped: NotificationItem[] = list.map((item: any) => ({
            id: item._id || item.id,
            type: item.type || 'system',
            title: item.title,
            message: item.message,
            time: item.time || 'MongoDB DB',
            isUnread: item.isUnread ?? true,
            iconName: item.type === 'payment' ? 'wallet' : item.type === 'security' ? 'shield-checkmark' : 'notifications',
            iconBg: item.type === 'payment' ? '#ECFDF3' : item.type === 'security' ? '#F0EBFB' : '#EBF4FE',
            iconColor: item.type === 'payment' ? '#12B76A' : item.type === 'security' ? '#7F56D9' : '#2F80ED'
          }));
          setDbNotifications(mapped);
        }
      });
    }
  }, [walletAddress]);

  const [readStateMap, setReadStateMap] = useState<{ [id: string]: boolean }>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'payment' | 'security' | 'system'>('all');
  const [cleared, setCleared] = useState(false);

  const notifications = React.useMemo(() => {
    if (cleared) return [];
    const combined = [...dynamicNotifications, ...dbNotifications];
    const uniqueMap = new Map<string, NotificationItem>();
    combined.forEach((n) => uniqueMap.set(n.id, n));

    const clearedTime = notificationsClearedAt ? new Date(notificationsClearedAt).getTime() : 0;

    return Array.from(uniqueMap.values())
      .filter((item) => {
        if (!clearedTime) return true;
        if (item.rawTx && item.rawTx.timestamp) {
          const t = new Date(item.rawTx.timestamp).getTime();
          return isNaN(t) || t > clearedTime;
        }
        return false;
      })
      .map((item) => {
        if (readStateMap[item.id] !== undefined) {
          return { ...item, isUnread: !readStateMap[item.id] };
        }
        return item;
      });
  }, [dynamicNotifications, dbNotifications, readStateMap, cleared, notificationsClearedAt]);

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  const [selectedTx, setSelectedTx] = useState<GhostTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const handleItemPress = (item: NotificationItem) => {
    setReadStateMap((prev) => ({ ...prev, [item.id]: true }));
    if (item.rawTx) {
      markTxAsRead(item.rawTx.id);
      setSelectedTx(item.rawTx);
      setIsModalOpen(true);
    } else {
      if (!item.id.startsWith('notif-')) {
        void markNotificationReadInApi(item.id);
      }
      setSelectedNotif(item);
      setIsNotifModalOpen(true);
    }
  };

  const handleMarkAllRead = () => {
    const newMap: { [id: string]: boolean } = {};
    notifications.forEach((n) => {
      newMap[n.id] = true;
      if (!n.id.startsWith('notif-')) {
        void markNotificationReadInApi(n.id);
      }
    });
    setReadStateMap(newMap);
    Toast.show({
      type: 'success',
      text1: 'All Marked as Read',
      text2: 'All notifications have been updated'
    });
  };

  const handleToggleRead = (id: string) => {
    setReadStateMap((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
    if (!id.startsWith('notif-')) {
      void markNotificationReadInApi(id);
    }
  };

  const handleClearAll = () => {
    setCleared(true);
    setNotificationsClearedAt(new Date().toISOString());
    if (walletAddress) {
      void clearNotificationsInApi(walletAddress);
    }
    Toast.show({
      type: 'info',
      text1: 'Notifications Cleared',
      text2: 'Notification inbox is now empty'
    });
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
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          {unreadCount > 0 ? (
            <Pressable style={styles.markReadBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={15} color="#00B87A" style={{ marginRight: 5 }} />
              <Text style={styles.markReadBtnText}>Mark all read</Text>
            </Pressable>
          ) : (
            <View style={styles.allReadBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#12B76A" style={{ marginRight: 4 }} />
              <Text style={styles.allReadBadgeText}>All read</Text>
            </View>
          )}
        </View>

        {!walletAddress ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <WalletOnboardingCard />
          </ScrollView>
        ) : (
          <>
            {/* Filter Categories Row */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {[
                  { id: 'all', label: `All (${notifications.length})` },
                  { id: 'payment', label: 'Payments' },
                  { id: 'security', label: 'Security' },
                  { id: 'system', label: 'System' }
                ].map((tab) => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setActiveFilter(tab.id as any)}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Main Notifications Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="notifications-off-outline" size={38} color="#98A2B3" />
                  </View>
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptySub}>You are all caught up! Check back later for update alerts.</Text>
                </View>
              ) : (
                <>
                  {filteredNotifications.map((item) => (
                    <View key={item.id}>
                      <Pressable
                        style={[styles.notifCard, item.isUnread && styles.notifCardUnread]}
                        onPress={() => handleItemPress(item)}
                      >
                        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.iconName} size={22} color={item.iconColor} />
                        </View>

                        <View style={styles.notifContent}>
                          <View style={styles.notifHeaderRow}>
                            <Text style={styles.notifTitle}>{item.title}</Text>
                            <View style={styles.notifTimeGroup}>
                              <Text style={styles.notifTime}>{item.time}</Text>
                              {item.isUnread && <View style={styles.unreadDotBadge} />}
                            </View>
                          </View>
                          <Text style={styles.notifMessage}>{item.message}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}

                  {/* Clear All Option */}
                  <Pressable style={styles.clearAllButton} onPress={handleClearAll}>
                    <Ionicons name="trash-outline" size={16} color="#667085" style={{ marginRight: 6 }} />
                    <Text style={styles.clearAllText}>Clear All Notifications</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </>
        )}
      </LinearGradient>

      <TransactionDetailModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
      />

      <NotificationDetailModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notification={selectedNotif}
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
    paddingBottom: 14
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
  },
  unreadCountBadge: {
    backgroundColor: '#F04438',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#F04438',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  unreadCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 218, 147, 0.4)',
    elevation: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6
  },
  markReadBtnText: {
    color: '#00B87A',
    fontSize: 12,
    fontFamily: 'Inter_700Bold'
  },
  allReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 183, 106, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(18, 183, 106, 0.2)'
  },
  allReadBadgeText: {
    color: '#12B76A',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  filterRow: {
    paddingBottom: 12
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    marginRight: 6
  },
  filterChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark
  },
  filterChipText: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: 'Inter_700Bold'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.06)',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    position: 'relative'
  },
  notifCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(5, 218, 147, 0.4)',
    borderWidth: 1.5
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  notifContent: {
    flex: 1
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8
  },
  notifTitle: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginRight: 6
  },
  notifTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0
  },
  notifTime: {
    color: '#98A2B3',
    fontSize: 11,
    fontFamily: 'Inter_500Medium'
  },
  notifMessage: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18
  },
  unreadDotBadge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.secondary
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 6
  },
  emptySub: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    maxWidth: 280
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12
  },
  clearAllText: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  }
});
