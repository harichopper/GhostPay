import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);
  const mainTabNames = ['index', 'analytics', 'send', 'transactions', 'settings'];

  return (
    <Tabs
      sceneContainerStyle={isDesktop ? styles.desktopSceneContainer : undefined}
      tabBar={({ state, descriptors, navigation }) => {
        const visibleRoutes = state.routes.filter((r) => mainTabNames.includes(r.name));

        if (isDesktop) {
          return (
            <View style={styles.desktopSidebarWrapper}>
              <View>
                {/* Sidebar Brand Header */}
                <View style={styles.sidebarBrandRow}>
                  <Image
                    source={require('../../assets/app_logo/ghostpay-logo-removebg.png')}
                    style={styles.sidebarLogo}
                    resizeMode="contain"
                  />
                </View>

                {/* Vertical Navigation Items */}
                <View style={styles.sidebarNavList}>
                  {visibleRoutes.map((route) => {
                    const { options } = descriptors[route.key];
                    const activeRouteName = state.routes[state.index]?.name;
                    const isFocused = activeRouteName === route.name;

                    const onPress = () => {
                      const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true
                      });

                      if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                      }
                    };

                    return (
                      <Pressable
                        key={route.key}
                        onPress={onPress}
                        style={[
                          styles.sidebarNavItem,
                          isFocused && styles.sidebarNavItemActive
                        ]}
                      >
                        <RenderTabIcon name={route.name} isFocused={isFocused} />
                        <Text style={[styles.sidebarNavText, isFocused && styles.sidebarNavTextActive]}>
                          {options.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Sidebar Bottom Footer */}
              <View style={styles.sidebarFooter}>
                <View style={styles.sidebarStatusBadge}>
                  <View style={styles.sidebarStatusDot} />
                  <Text style={styles.sidebarStatusText}>Algorand Testnet</Text>
                </View>
              </View>
            </View>
          );
        }

        // Mobile Bottom Tab Bar
        return (
          <View style={styles.tabBarWrapper}>
            <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
              {visibleRoutes.map((route, index) => {
                const { options } = descriptors[route.key];
                const activeRouteName = state.routes[state.index]?.name;
                const isFocused = activeRouteName === route.name;

                const onPress = () => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                };

                const isCenter = index === 2 || route.name === 'send';

                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    style={styles.tabButton}
                    accessibilityRole='button'
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={options.title}
                  >
                    {isCenter ? (
                      <View style={styles.centerActiveContainer}>
                        <Ionicons name='qr-code' size={26} color={colors.primaryDark} />
                      </View>
                    ) : (
                      <>
                        <RenderTabIcon name={route.name} isFocused={isFocused} />
                        <Text style={styles.tabLabel}>{options.title}</Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      }}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen name='index' options={{ title: 'Home' }} />
      <Tabs.Screen name='analytics' options={{ title: 'Analytics' }} />
      <Tabs.Screen name='send' options={{ title: 'Scan' }} />
      <Tabs.Screen name='transactions' options={{ title: 'History' }} />
      <Tabs.Screen name='settings' options={{ title: 'Settings' }} />
      <Tabs.Screen name='notification' options={{ href: null, title: 'Notifications' }} />
    </Tabs>
  );
}

function RenderTabIcon({ name, isFocused }: { name: string; isFocused: boolean }) {
  const iconColor = isFocused ? colors.secondary : colors.white;
  const iconSize = 22;

  switch (name) {
    case 'index':
      return <Ionicons name={isFocused ? 'wallet' : 'wallet-outline'} size={iconSize} color={iconColor} />;

    case 'transactions':
      return <Ionicons name={isFocused ? 'receipt' : 'receipt-outline'} size={iconSize} color={iconColor} />;

    case 'analytics':
      return <Ionicons name={isFocused ? 'bar-chart' : 'bar-chart-outline'} size={iconSize} color={iconColor} />;

    case 'settings':
      return <Ionicons name={isFocused ? 'settings' : 'settings-outline'} size={iconSize} color={iconColor} />;

    case 'send':
      return <Ionicons name={isFocused ? 'qr-code' : 'qr-code-outline'} size={iconSize} color={iconColor} />;

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  desktopSceneContainer: {
    marginLeft: 240
  },
  desktopSidebarWrapper: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    backgroundColor: '#172B3E',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    zIndex: 9999
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12
  },
  sidebarLogo: {
    width: 160,
    height: 160
  },
  sidebarNavList: {
    gap: 8
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'transparent'
  },
  sidebarNavItemActive: {
    backgroundColor: 'rgba(5, 218, 147, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(5, 218, 147, 0.3)'
  },
  sidebarNavText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 12
  },
  sidebarNavTextActive: {
    color: colors.secondary,
    fontFamily: 'Inter_700Bold'
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  sidebarStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  sidebarStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginRight: 8
  },
  sidebarStatusText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold'
  },
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    zIndex: 9999
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#172B3E',
    width: '100%',
    height: 72,
    borderRadius: 0, // Flat top and flat edges
    paddingHorizontal: 16,
    borderWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  centerActiveContainer: {
    width: 54,
    height: 54,
    borderRadius: 18, // Smooth squircle button
    backgroundColor: colors.secondary, // #05DA93
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22, // Raised slightly higher above the tab bar line
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 10,
    ...(Platform.OS === 'web' && {
      boxShadow: `0px 6px 20px ${colors.secondary}99`
    })
  },
  tabLabel: {
    color: colors.white, // #FFFFFF
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4
  }
});
