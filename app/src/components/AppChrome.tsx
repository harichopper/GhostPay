import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { colors } from '../theme/colors';
import { useWalletStore } from '../store/walletStore';
import { shortAddress } from '../utils/format';
import { WalletQrModal } from './WalletQrModal';

export const CHROME_TOP_HEIGHT = 76;
export const CHROME_SIDEBAR_WIDTH = 256;

type AppChromeSection = 'dashboard' | 'pay' | 'activity' | 'contacts' | 'settings';

type AppChromeProps = {
  activeSection: AppChromeSection;
};

function tabRoute(tab: AppChromeSection): '/(tabs)' | '/(tabs)/send' | '/(tabs)/transactions' | '/identity' | '/settings' {
  if (tab === 'dashboard') {
    return '/(tabs)';
  }

  if (tab === 'pay') {
    return '/(tabs)/send';
  }

  if (tab === 'contacts') {
    return '/identity';
  }

  if (tab === 'settings') {
    return '/settings';
  }

  return '/(tabs)/transactions';
}

export function AppChrome({ activeSection }: AppChromeProps) {
  const { width } = useWindowDimensions();
  const [qrVisible, setQrVisible] = useState(false);
  const walletAddress = useWalletStore((state) => state.walletAddress);
  const profileInitial = walletAddress ? walletAddress.slice(0, 1).toUpperCase() : 'W';
  const profileTitle = walletAddress ? 'PRIMARY WALLET' : 'NO WALLET LINKED';
  const profileSub = walletAddress ? shortAddress(walletAddress, 8, 6) : 'Create or import in Settings';
  const showDesktopLinks = Platform.OS === 'web' && width >= 900;
  const showSidebar = Platform.OS === 'web' && width >= 1024;
  const pulse = useRef(new Animated.Value(0.6)).current;

  const tabs: { id: AppChromeSection; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-view' },
    { id: 'pay', label: 'Pay', icon: 'sensors' },
    { id: 'activity', label: 'Activity', icon: 'history' },
    { id: 'contacts', label: 'Contacts', icon: 'group' }
  ];

  const sideTabs: { id: AppChromeSection; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    ...tabs,
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <>
      <View style={styles.topNav}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>GhostPay</Text>
          <View style={styles.liveChip}>
            <Animated.View style={[styles.liveDotPulse, { transform: [{ scale: pulse }], opacity: pulse }]} />
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NETWORK</Text>
          </View>
        </View>

        {showDesktopLinks ? (
          <View style={styles.topLinksRow}>
            {tabs.map((tab) => (
              <Pressable key={tab.id} onPress={() => router.replace(tabRoute(tab.id))}>
                <Text style={[styles.topLink, activeSection === tab.id && styles.topLinkActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.navActions}>
          <Pressable style={styles.navActionButton} onPress={() => setQrVisible(true)}>
            <MaterialIcons name='qr-code-scanner' size={20} color='#E1E2E7' />
          </Pressable>
          <Pressable style={styles.navActionButton} onPress={() => router.replace('/settings')}>
            <MaterialIcons name='account-balance-wallet' size={20} color='#E1E2E7' />
          </Pressable>
        </View>
      </View>

      {showSidebar ? (
        <View style={styles.sidebar}>
          <View style={styles.sidebarProfile}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{profileInitial}</Text>
            </View>
            <View>
              <Text style={styles.profileTitle}>{profileTitle}</Text>
              <Text style={styles.profileSub}>{profileSub}</Text>
            </View>
          </View>

          <View style={styles.sidebarLinks}>
            {sideTabs.map((tab) => (
              <Pressable
                key={tab.id}
                style={[styles.sidebarLink, activeSection === tab.id && styles.sidebarLinkActive]}
                onPress={() => router.replace(tabRoute(tab.id))}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={16}
                  color={activeSection === tab.id ? colors.accent : 'rgba(225,226,231,0.4)'}
                />
                <Text style={[styles.sidebarLinkLabel, activeSection === tab.id && styles.sidebarLinkLabelActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.newTxButton} onPress={() => router.replace('/(tabs)/send')}>
            <Text style={styles.newTxLabel}>NEW TRANSACTION</Text>
          </Pressable>
        </View>
      ) : null}

      <WalletQrModal visible={qrVisible} walletAddress={walletAddress} onClose={() => setQrVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  topNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    minHeight: CHROME_TOP_HEIGHT,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,73,74,0.35)',
    backgroundColor: 'rgba(17, 20, 23, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  brand: {
    color: colors.textPrimary,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 24,
    letterSpacing: 0.5
  },
  liveChip: {
    borderWidth: 1,
    borderColor: 'rgba(132, 255, 245, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(12, 14, 18, 0.9)'
  },
  liveDotPulse: {
    position: 'absolute',
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors.confirmed
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.confirmed
  },
  liveText: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 0.8
  },
  topLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24
  },
  topLink: {
    color: 'rgba(225,226,231,0.6)',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    letterSpacing: 0.5
  },
  topLinkActive: {
    color: colors.accent
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  navActionButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(132, 255, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: CHROME_SIDEBAR_WIDTH,
    paddingHorizontal: 16,
    paddingTop: CHROME_TOP_HEIGHT + 14,
    paddingBottom: 16,
    backgroundColor: '#111417',
    borderRightWidth: 1,
    borderRightColor: 'rgba(58,73,74,0.22)',
    zIndex: 40
  },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 16,
    marginBottom: 10
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 220, 229, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(132, 255, 245, 0.3)'
  },
  profileAvatarText: {
    color: colors.accent,
    fontFamily: 'Orbitron_700Bold'
  },
  profileTitle: {
    color: colors.accent,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.9
  },
  profileSub: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11
  },
  sidebarLinks: {
    gap: 6
  },
  sidebarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  sidebarLinkActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    borderColor: 'rgba(0, 245, 255, 0.35)'
  },
  sidebarLinkLabel: {
    color: 'rgba(225,226,231,0.55)',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  sidebarLinkLabelActive: {
    color: colors.accent
  },
  newTxButton: {
    marginTop: 'auto',
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  newTxLabel: {
    color: '#002021',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.9
  }
});
