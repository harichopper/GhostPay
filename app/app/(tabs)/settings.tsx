import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.contentCard}>
        <View style={styles.headerArea}>
          <Text style={styles.title}>Settings Screen</Text>
          <Text style={styles.subtitle}>Light gray layout card with rounded bottom corners</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryDark
  },
  contentCard: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    padding: 24,
    marginBottom: 88,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  headerArea: {
    marginTop: 12,
    alignItems: 'center'
  },
  title: {
    color: colors.primaryDark,
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 8
  },
  subtitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center'
  }
});
