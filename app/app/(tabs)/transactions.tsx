import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function TransactionsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Transactions Screen Canvas</Text>
        <Text style={styles.subtitle}>Ready for step-by-step UI design guidance</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flex: 1,
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
