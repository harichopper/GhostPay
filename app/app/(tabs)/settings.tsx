import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    walletAddress,
    isConnected,
    demoMode,
    toggleDemoOffline,
    syncPendingTransactions,
    transactions
  } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const isOfflineDemo = demoMode?.simulateOffline ?? false;
  const pendingCount = transactions
    ? transactions.filter((t) => t.status === 'pending' || t.status === 'syncing').length
    : 0;

  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [ghostModeEnabled, setGhostModeEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);

  // Trigger smooth entrance animation every time tab is focused
  useFocusEffect(
    useCallback(() => {
      setSettingsKey((prev) => prev + 1);
    }, [])
  );

  const formattedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : '0xGhost...2872';

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      Toast.show({
        type: 'success',
        text1: 'Address Copied',
        text2: 'Wallet address saved to clipboard'
      });
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingTransactions();
      Toast.show({
        type: 'success',
        text1: 'Sync Completed',
        text2: 'Pending offline transactions synced with testnet'
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Sync Failed',
        text2: 'Could not connect to Algorand Node'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectWallet = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your GhostPay account? Make sure your recovery seed phrase is backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            Toast.show({
              type: 'info',
              text1: 'Wallet Disconnected',
              text2: 'Please sign in or restore seed phrase'
            });
          }
        }
      ]
    );
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
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>

          <Text style={styles.headerTitle}>Settings</Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          key={settingsKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* User Profile Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.profileCard}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>GP</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#12B76A' : '#F79E1B' }]} />
            </View>

            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>GhostPay User</Text>
              <Pressable style={styles.addressPill} onPress={handleCopyAddress}>
                <Text style={styles.addressText}>{formattedAddress}</Text>
                <Ionicons name="duplicate-outline" size={14} color="#667085" style={{ marginLeft: 4 }} />
              </Pressable>
            </View>

            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={18} color={colors.secondary} />
            </View>
          </Animated.View>

          {/* Network & Offline Status Banner */}
          <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons
                  name={isOfflineDemo ? 'cloud-offline' : 'globe'}
                  size={22}
                  color={isOfflineDemo ? '#F79E1B' : '#12B76A'}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.statusTitle}>
                    {isOfflineDemo ? 'Offline Mode (Simulation)' : 'Algorand Testnet Connected'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {pendingCount > 0
                      ? `${pendingCount} transaction(s) pending sync`
                      : 'Real-time node sync active'}
                  </Text>
                </View>
              </View>

              <Switch
                value={isOfflineDemo}
                onValueChange={toggleDemoOffline}
                trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                thumbColor={colors.white}
              />
            </View>

            {pendingCount > 0 && (
              <Pressable
                style={[styles.syncButton, isSyncing && { opacity: 0.6 }]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                <Ionicons name="sync" size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                <Text style={styles.syncButtonText}>
                  {isSyncing ? 'Syncing...' : 'Sync Pending Queue Now'}
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Group 1: Security & Privacy */}
          <Animated.View entering={FadeInDown.duration(400).delay(180)} style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>SECURITY & PRIVACY</Text>

            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#EBF4FE' }]}>
                    <Ionicons name="finger-print" size={20} color="#2F80ED" />
                  </View>
                  <Text style={styles.settingLabel}>Biometric Unlock</Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={setBiometricsEnabled}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0EBFB' }]}>
                    <Ionicons name="eye-off" size={20} color="#7F56D9" />
                  </View>
                  <Text style={styles.settingLabel}>Ghost Stealth Mode</Text>
                </View>
                <Switch
                  value={ghostModeEnabled}
                  onValueChange={setGhostModeEnabled}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={() => Alert.alert('Backup Seed Phrase', 'Your 24-word recovery seed is encrypted.')}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEF0C7' }]}>
                    <Ionicons name="key" size={20} color="#DC6803" />
                  </View>
                  <Text style={styles.settingLabel}>Backup Mnemonic Phrase</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
            </View>
          </Animated.View>

          {/* Group 2: Preferences */}
          <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>PREFERENCES</Text>

            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#ECFDF3' }]}>
                    <Ionicons name="notifications" size={20} color="#12B76A" />
                  </View>
                  <Text style={styles.settingLabel}>Push Payment Alerts</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: 'rgba(23, 43, 62, 0.15)', true: colors.secondary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={() => Toast.show({ type: 'info', text1: 'Default Currency', text2: 'USD ($) set as default display' })}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="cash" size={20} color="#026AA7" />
                  </View>
                  <Text style={styles.settingLabel}>Display Currency</Text>
                </View>
                <View style={styles.settingRightPill}>
                  <Text style={styles.settingRightText}>USD ($)</Text>
                  <Ionicons name="chevron-forward" size={16} color="#98A2B3" style={{ marginLeft: 4 }} />
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Group 3: Support & Disconnect */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.sectionGroup}>
            <Text style={styles.groupHeaderTitle}>ABOUT & ACCOUNT</Text>

            <View style={styles.settingsCard}>
              <Pressable style={styles.settingRow} onPress={() => Toast.show({ type: 'info', text1: 'Help Center', text2: 'Opening support documentation...' })}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F4F5F7' }]}>
                    <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
                  </View>
                  <Text style={styles.settingLabel}>Help Center & FAQ</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.settingRow} onPress={handleDisconnectWallet}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEE4E2' }]}>
                    <Ionicons name="log-out" size={20} color="#D92D20" />
                  </View>
                  <Text style={[styles.settingLabel, { color: '#D92D20', fontFamily: 'Inter_700Bold' }]}>
                    Disconnect Wallet
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D92D20" />
              </Pressable>
            </View>
          </Animated.View>

          {/* App Version Tag */}
          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>GhostPay v1.0.4 • Algorand Testnet</Text>
          </View>
        </ScrollView>
      </LinearGradient>
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
    paddingBottom: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold'
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    color: colors.primaryDark,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  addressText: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_500Medium'
  },
  verifiedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#172B3E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8
  },
  statusTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2
  },
  statusSubtitle: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 12
  },
  syncButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  sectionGroup: {
    marginBottom: 20
  },
  groupHeaderTitle: {
    color: '#5C768D',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginLeft: 4
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  settingLabel: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold'
  },
  settingRightPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingRightText: {
    color: '#667085',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.06)',
    marginLeft: 52
  },
  versionFooter: {
    alignItems: 'center',
    paddingVertical: 16
  },
  versionText: {
    color: '#667085',
    fontSize: 12,
    fontFamily: 'Inter_500Medium'
  }
});
