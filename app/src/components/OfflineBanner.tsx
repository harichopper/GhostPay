import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type OfflineBannerProps = {
  online: boolean;
  simulatedOffline: boolean;
};

export function OfflineBanner({ online, simulatedOffline }: OfflineBannerProps) {
  const label = simulatedOffline
    ? 'Demo Mode: OFFLINE simulation active'
    : online
      ? 'ONLINE: auto-sync armed'
      : 'OFFLINE: transactions will queue locally';

  const accent = simulatedOffline ? colors.warning : online ? colors.confirmed : colors.warning;

  return (
    <View style={[styles.container, { borderColor: accent }]}>
      <Text style={[styles.text, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(5, 7, 11, 0.8)'
  },
  text: {
    fontFamily: 'Rajdhani_700Bold',
    letterSpacing: 0.8,
    fontSize: 14
  }
});
