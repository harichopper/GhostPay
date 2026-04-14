import React, { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppChrome, CHROME_SIDEBAR_WIDTH, CHROME_TOP_HEIGHT } from '../../src/components/AppChrome';
import { GlassCard } from '../../src/components/GlassCard';
import { NeonButton } from '../../src/components/NeonButton';
import { TransactionItem } from '../../src/components/TransactionItem';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

export default function TransactionsScreen() {
  const { width } = useWindowDimensions();
  const transactions = useWalletStore((state) => state.transactions);
  const syncPendingTransactions = useWalletStore((state) => state.syncPendingTransactions);
  const isSyncing = useWalletStore((state) => state.isSyncing);
  const isConnected = useWalletStore((state) => state.isConnected);
  const demoMode = useWalletStore((state) => state.demoMode);

  const effectiveOnline = useMemo(() => isConnected && !demoMode.simulateOffline, [demoMode.simulateOffline, isConnected]);
  const withSidebar = Platform.OS === 'web' && width >= 1120;

  return (
    <LinearGradient colors={['#04060A', '#071524', '#0C1F30']} style={styles.screen}>
      <AppChrome activeSection='activity' />

      <View style={[styles.contentWrap, withSidebar && styles.contentWrapSidebar]}>
        <View style={styles.header}>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>Pending {'->'} Syncing {'->'} Confirmed/Failed</Text>
        </View>

        <GlassCard style={styles.syncCard}>
          <Text style={styles.syncText}>Auto sync on reconnect is active.</Text>
          <NeonButton
            label='Sync Now'
            onPress={() => void syncPendingTransactions()}
            disabled={!effectiveOnline || isSyncing}
          />
        </GlassCard>

        <ScrollView contentContainerStyle={styles.listContent}>
          {transactions.length === 0 ? <Text style={styles.empty}>No transactions yet. Create one from Send.</Text> : null}
          {transactions.map((item) => (
            <TransactionItem key={item.id} transaction={item} />
          ))}
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  contentWrap: {
    flex: 1,
    paddingTop: CHROME_TOP_HEIGHT + 16,
    paddingHorizontal: 18
  },
  contentWrapSidebar: {
    paddingLeft: CHROME_SIDEBAR_WIDTH + 18,
    paddingRight: 18
  },
  header: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    marginBottom: 10
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 30,
    letterSpacing: 1
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 16
  },
  syncCard: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    marginBottom: 10
  },
  syncText: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    marginBottom: 10,
    fontSize: 14
  },
  listContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingBottom: 120
  },
  empty: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_500Medium',
    marginTop: 40,
    textAlign: 'center'
  }
});
