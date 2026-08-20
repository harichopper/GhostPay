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

export interface NotificationDetailItem {
  id: string;
  type: 'payment' | 'system' | 'security' | 'reward';
  title: string;
  message: string;
  time: string;
  isUnread: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}

interface NotificationDetailModalProps {
  visible: boolean;
  onClose: () => void;
  notification: NotificationDetailItem | null;
}

export default function NotificationDetailModal({
  visible,
  onClose,
  notification
}: NotificationDetailModalProps) {
  if (!notification) return null;

  const handleCopyMessage = async () => {
    await Clipboard.setStringAsync(notification.message);
    Toast.show({
      type: 'success',
      text1: 'Notification Copied',
      text2: 'Message copied to clipboard'
    });
  };

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

          {/* Icon Header Circle */}
          <View style={styles.iconWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: notification.iconBg }]}>
              <Ionicons name={notification.iconName} size={32} color={notification.iconColor} />
            </View>
          </View>

          {/* Type Badge */}
          <View style={styles.typeBadgeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: notification.iconBg }]}>
              <Text style={[styles.typeBadgeText, { color: notification.iconColor }]}>
                {notification.type.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Title & Time */}
          <Text style={styles.titleText}>{notification.title}</Text>
          <Text style={styles.timeText}>{notification.time}</Text>

          {/* Message Card */}
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{notification.message}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.copyButton} onPress={handleCopyMessage}>
              <Ionicons name="copy-outline" size={18} color={colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.copyButtonText}>Copy Text</Text>
            </Pressable>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    alignItems: 'center',
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
    marginBottom: 20
  },
  iconWrapper: {
    marginBottom: 12
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeBadgeContainer: {
    marginBottom: 8
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8
  },
  titleText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: 4
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#667085',
    marginBottom: 16
  },
  messageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(23, 43, 62, 0.08)',
    marginBottom: 20
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#334155',
    lineHeight: 22,
    textAlign: 'center'
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%'
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F1F5F9'
  },
  copyButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primaryDark
  },
  closeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.secondary
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  }
});
