import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { statusColors } from '../theme/colors';
import type { TxStatus } from '../types/transaction';

const statusEmoji: Record<TxStatus, string> = {
  pending: '🟡',
  syncing: '🔵',
  confirmed: '🟢',
  failed: '🔴'
};

type StatusBadgeProps = {
  status: TxStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { borderColor: statusColors[status] }]}>
      <Text style={[styles.label, { color: statusColors[status] }]}>
        {statusEmoji[status]} {status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(7, 12, 24, 0.8)'
  },
  label: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    letterSpacing: 0.8
  }
});
