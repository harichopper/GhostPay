import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
                      <Ionicons name='scan-outline' size={24} color={colors.primaryDark} />
                    </View>
                  ) : (
                    <RenderTabIcon name={route.name} isFocused={isFocused} />
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
  const iconSize = 20;

  if (name === 'index') {
    return <Ionicons name='home' size={iconSize} color={iconColor} />;
  }

  if (name === 'transactions') {
    return <Ionicons name='book' size={iconSize} color={iconColor} />;
  }

  if (name === 'identity') {
    return <Ionicons name='star' size={iconSize} color={iconColor} />;
  }

  if (name === 'settings') {
    return <Ionicons name='settings' size={iconSize} color={iconColor} />;
  }

  return null;
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
    width: 48,
    height: 48,
    borderRadius: 16, // Smooth squircle matching reference image
    backgroundColor: colors.secondary, // #05DA93
    alignItems: 'center',
    justifyContent: 'center'
  }
});
