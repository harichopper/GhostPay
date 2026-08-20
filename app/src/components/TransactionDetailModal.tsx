import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { GhostTransaction } from '../types/transaction';

interface TransactionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: GhostTransaction | null;
}

export default function TransactionDetailModal({
  visible,
  onClose,
  transaction
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const isPositive = transaction.amount >= 0;
  const formattedAmount = `${isPositive ? '+' : ''}${transaction.amount.toFixed(7)} ALGO`;
  const senderShort = transaction.sender
    ? `${transaction.sender.slice(0, 8)}...${transaction.sender.slice(-4)}`
    : 'GBRNCKUL...CCB2';
  const txHashShort = transaction.txHash
    ? `[${transaction.txHash.slice(0, 6)}....${transaction.txHash.slice(-4)}]`
    : '[6e26....4fc2]';

  const txDate = transaction.timestamp ? new Date(transaction.timestamp) : new Date();
  const dateFormatted = isNaN(txDate.getTime())
    ? 'Recently'
    : txDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = isNaN(txDate.getTime())
    ? ''
    : txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const handleCopy = (text: string, label: string) => {
    void Clipboard.setStringAsync(text);
    Toast.show({
      type: 'success',
      text1: 'Copied to Clipboard',
      text2: `${label} copied successfully`
    });
  };

  const isConfirmed = transaction.status === 'confirmed';
  const isFailed = transaction.status === 'failed';
  const statusIconName = isConfirmed ? 'checkmark' : isFailed ? 'close' : 'time-outline';
  const statusBgColor = isConfirmed ? '#12B76A' : isFailed ? '#F04438' : '#F79E1B';
  const statusHaloColor = isConfirmed ? 'rgba(18, 183, 106, 0.15)' : isFailed ? 'rgba(240, 68, 56, 0.15)' : 'rgba(247, 158, 27, 0.15)';

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

          {/* Top Icon Circle */}
          <View style={styles.iconCircleWrapper}>
            <View style={[styles.iconCircleOuter, { backgroundColor: statusHaloColor }]}>
              <View style={[styles.iconCircleInner, { backgroundColor: statusBgColor }]}>
                <Ionicons name={statusIconName} size={32} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Header Title & Amount */}
          <Text style={styles.titleText}>
            {isConfirmed ? 'Payment Successful' : isFailed ? 'Payment Failed' : 'Payment Processing'}
          </Text>
          <Text style={styles.amountText}>{formattedAmount}</Text>

          {/* Structured Detail Box (Light Card) */}
          <View style={styles.detailCard}>
            {/* Row 1: Date & Time */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Date & Time:</Text>
              <View style={styles.dateTimeGroup}>
                <Text style={styles.rowValue}>{dateFormatted}</Text>
                {Boolean(timeFormatted) && <Text style={styles.rowSubValue}>{timeFormatted}</Text>}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Row 2: Status */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Status:</Text>
              <Pressable
                style={styles.rowValueGroup}
                onPress={() => handleCopy(transaction.status, 'Status')}
              >
                <Text style={styles.rowValueBold}>
                  {transaction.status === 'confirmed' ? 'Confirmed on Ledger' : 'Syncing to Network'}
                </Text>
                <Ionicons name="copy-outline" size={16} color="#5C768D" style={styles.copyIcon} />
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Row 3: Sender */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Sender:</Text>
              <Pressable
                style={styles.rowValueGroup}
                onPress={() => handleCopy(transaction.sender || 'GBRNCKUL...CCB2', 'Sender address')}
              >
                <Text style={styles.rowValueBold}>{senderShort}</Text>
                <Ionicons name="copy-outline" size={16} color="#5C768D" style={styles.copyIcon} />
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Row 4: Transaction Hash */}
            <View style={styles.detailRow}>
              <Text style={styles.rowLabel}>Transaction Hash</Text>
              <Pressable
                style={styles.rowValueGroup}
                onPress={() => handleCopy(transaction.txHash || '6e264fc2', 'Transaction Hash')}
              >
                <Text style={styles.rowValueBold}>{txHashShort}</Text>
                <Ionicons name="copy-outline" size={16} color="#5C768D" style={styles.copyIcon} />
              </Pressable>
            </View>
          </View>

          {/* Close Button in Theme Color */}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.2)'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)'
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(23, 43, 62, 0.15)',
    marginBottom: 20
  },
  iconCircleWrapper: {
    marginBottom: 14
  },
  iconCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(18, 183, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(18, 183, 106, 0.25)'
  },
  iconCircleInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#12B76A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleText: {
    color: colors.primaryDark,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6
  },
  amountText: {
    color: colors.primaryDark,
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    marginBottom: 24,
    letterSpacing: -0.5
  },
  detailCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)'
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  rowLabel: {
    color: '#5C768D',
    fontSize: 14,
    fontFamily: 'Inter_500Medium'
  },
  dateTimeGroup: {
    alignItems: 'flex-end'
  },
  rowValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold'
  },
  rowSubValue: {
    color: '#5C768D',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowValueBold: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_700Bold'
  },
  copyIcon: {
    marginLeft: 8
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.06)',
    width: '100%'
  },
  closeBtn: {
    width: '100%',
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  closeBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Inter_700Bold'
  }
});
