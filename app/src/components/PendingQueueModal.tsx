import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useWalletStore } from '../store/walletStore';
import { colors } from '../theme/colors';

interface PendingQueueModalProps {
  visible: boolean;
  onClose: () => void;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
}

export default function PendingQueueModal({
  visible,
  onClose,
  onSyncAll,
  isSyncing
}: PendingQueueModalProps) {
  const { transactions, walletAddress, displayCurrency, algoRates } = useWalletStore();

  const pendingList = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(
      (tx) => tx.status === 'pending' || tx.status === 'syncing'
    );
  }, [transactions]);

  const currencySymbol = displayCurrency === 'INR' ? '₹' : displayCurrency === 'EUR' ? '€' : '$';
  const rate = algoRates ? (algoRates[displayCurrency] || 1) : 1;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={[
            styles.backdrop,
            Platform.OS === 'web' && ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any)
          ]}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Top Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.iconCircle}>
                <Ionicons name="time" size={22} color="#F79E1B" />
              </View>
              <View>
                <Text style={styles.titleText}>Pending Offline Queue</Text>
                <Text style={styles.subtitleText}>
                  {pendingList.length} transaction(s) queued
                </Text>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.primaryDark} />
            </Pressable>
          </View>

          {/* Queue List */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {pendingList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle" size={40} color="#12B76A" />
                <Text style={styles.emptyTitle}>Queue Clean & Synced</Text>
                <Text style={styles.emptySub}>All offline vault transactions have been broadcasted.</Text>
              </View>
            ) : (
              pendingList.map((tx) => {
                const isPaid = tx.sender?.toLowerCase() === (walletAddress || '').toLowerCase();
                const target = isPaid ? (tx.receiver || 'Recipient') : (tx.sender || 'Sender');
                const isPhone = target.replace(/\D/g, '').length >= 8 && target.length < 50;
                const displayName = isPhone
                  ? target
                  : `${target.substring(0, 6)}...${target.substring(target.length - 4)}`;

                const convertedVal = (tx.amount * rate).toFixed(2);
                const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
                const timeFormatted = isNaN(txDate.getTime())
                  ? 'Recently'
                  : txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                return (
                  <View key={tx.id} style={styles.txCard}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#FFFAEB' }]}>
                      <Ionicons name="cloud-offline-outline" size={20} color="#B54708" />
                    </View>

                    <View style={styles.txContent}>
                      <Text style={styles.txName}>{isPaid ? `To ${displayName}` : `From ${displayName}`}</Text>
                      <View style={styles.statusBadgeRow}>
                        <View style={styles.pendingDot} />
                        <Text style={styles.statusText}>Pending Sync • {timeFormatted}</Text>
                      </View>
                    </View>

                    <View style={styles.amountCol}>
                      <Text style={styles.amountAlgo}>-{tx.amount.toFixed(2)} ALGO</Text>
                      <Text style={styles.amountFiat}>{currencySymbol}{convertedVal}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Action Footer */}
          {pendingList.length > 0 && (
            <View style={styles.footerActionRow}>
              <Pressable
                style={[styles.syncAllButton, isSyncing && { opacity: 0.6 }]}
                onPress={async () => {
                  await onSyncAll();
                  onClose();
                }}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator color={colors.primaryDark} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="sync" size={18} color={colors.primaryDark} style={{ marginRight: 6 }} />
                )}
                <Text style={styles.syncAllText}>
                  {isSyncing ? 'Syncing Queue...' : `Broadcast ${pendingList.length} Transactions Now`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23, 43, 62, 0.6)'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
    elevation: 20,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E7EC',
    alignSelf: 'center',
    marginBottom: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF0C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  titleText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollList: {
    maxHeight: 320
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    marginTop: 10
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#667085',
    marginTop: 4,
    textAlign: 'center'
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  txContent: {
    flex: 1
  },
  txName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primaryDark
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F79E1B',
    marginRight: 6
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#B54708'
  },
  amountCol: {
    alignItems: 'flex-end'
  },
  amountAlgo: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#D92D20'
  },
  amountFiat: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    marginTop: 2
  },
  footerActionRow: {
    marginTop: 16
  },
  syncAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.secondary
  },
  syncAllText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  }
});
