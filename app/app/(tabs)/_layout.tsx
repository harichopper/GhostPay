import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => (
        <View style={styles.tabBarWrapper}>
          <View
            style={[
              styles.tabBarContainer,
              { paddingBottom: bottomPadding },
              isDesktop && styles.desktopTabBar
            ]}
          >
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

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
      )}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen name='index' options={{ title: 'Home' }} />
      <Tabs.Screen name='transactions' options={{ title: 'History' }} />
      <Tabs.Screen name='send' options={{ title: 'Scan' }} />
      <Tabs.Screen name='identity' options={{ title: 'Favorites' }} />
      <Tabs.Screen name='settings' options={{ title: 'Settings' }} />
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

    case 'identity':
      return <Ionicons name={isFocused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={iconSize} color={iconColor} />;

    case 'settings':
      return <Ionicons name={isFocused ? 'settings' : 'settings-outline'} size={iconSize} color={iconColor} />;

    default:
      return null;
  }
}

const styles = StyleSheet.create({
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
  desktopTabBar: {
    maxWidth: 480,
    borderRadius: 16,
    marginBottom: 16
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
