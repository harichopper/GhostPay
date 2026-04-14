import { Tabs } from 'expo-router';
import { Platform, Text, useWindowDimensions } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const hideTabBar = Platform.OS === 'web' && width >= 900;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: hideTabBar
          ? {
              display: 'none'
            }
          : {
              backgroundColor: '#08111F',
              borderTopColor: 'rgba(132, 255, 245, 0.24)',
              height: 66,
              paddingTop: 8
            },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#7A8EA8',
        tabBarLabelStyle: {
          fontFamily: 'Rajdhani_700Bold',
          fontSize: 13,
          letterSpacing: 0.5
        }
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabEmoji color={color} emoji='🏠' />
        }}
      />
      <Tabs.Screen
        name='send'
        options={{
          title: 'Send',
          tabBarIcon: ({ color }) => <TabEmoji color={color} emoji='⚡' />
        }}
      />
      <Tabs.Screen
        name='transactions'
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <TabEmoji color={color} emoji='⛓️' />
        }}
      />
    </Tabs>
  );
}

function TabEmoji({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ color, fontSize: 15, marginBottom: 2 }}>{emoji}</Text>
  );
}
