import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function IdentityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Identity Canvas</Text>
      <Text style={styles.subtitle}>Ready for step-by-step UI design guidance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 8
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Rajdhani_500Medium'
  }
});
