import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { GlassCard } from './GlassCard';
import { StatusBadge } from './StatusBadge';
import { colors } from '../theme/colors';
import { formatDate, shortAddress } from '../utils/format';
import type { GhostTransaction } from '../types/transaction';

type TransactionItemProps = {
  transaction: GhostTransaction;
};

export function TransactionItem({ transaction }: TransactionItemProps) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (transaction.status === 'syncing') {
      pulse.value = withRepeat(
        withTiming(1, {
          duration: 700,
          easing: Easing.inOut(Easing.ease)
        }),
        -1,
        true
      );

      return;
    }

    cancelAnimation(pulse);
    pulse.value = 0.4;
  }, [pulse, transaction.status]);

  const animatedGlow = useAnimatedStyle(() => ({
    shadowOpacity: pulse.value,
    borderColor: transaction.status === 'syncing' ? colors.syncing : colors.border
  }));

  return (
    <Animated.View style={animatedGlow}>
      <GlassCard style={styles.container}>
        <View style={styles.row}>
          <StatusBadge status={transaction.status} />
          <Text style={styles.amount}>{transaction.amount.toFixed(3)} ALGO</Text>
        </View>

        <Text style={styles.meta}>From: {shortAddress(transaction.sender)}</Text>
        <Text style={styles.meta}>To: {shortAddress(transaction.receiver)}</Text>
        <Text style={styles.meta}>Time: {formatDate(transaction.timestamp)}</Text>
        {transaction.network ? <Text style={styles.meta}>Network: {transaction.network.toUpperCase()}</Text> : null}
        {transaction.contractVerified !== undefined ? (
          <Text style={styles.meta}>Contract: {transaction.contractVerified ? 'Verified' : 'Not used'}</Text>
        ) : null}

        {transaction.txHash ? <Text style={styles.hash}>TX: {transaction.txHash}</Text> : null}
        {transaction.explorerUrl ? (
          <Pressable onPress={() => void Linking.openURL(transaction.explorerUrl ?? '')}>
            <Text style={styles.link}>Open in Explorer</Text>
          </Pressable>
        ) : null}
        {transaction.error ? <Text style={styles.error}>Error: {transaction.error}</Text> : null}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: colors.syncing,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16,
    letterSpacing: 0.7
  },
  meta: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14,
    marginTop: 2,
    letterSpacing: 0.4
  },
  hash: {
    marginTop: 8,
    color: colors.confirmed,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  },
  link: {
    marginTop: 5,
    color: colors.accent,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    textDecorationLine: 'underline'
  },
  error: {
    marginTop: 8,
    color: colors.danger,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  }
});
