import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Home Content Card with #E0E3E7 Light Gray Background and Rounded Bottom Corners */}
      <View style={styles.contentCard}>
        <View style={styles.headerArea}>
          <Text style={styles.title}>Home Screen</Text>
          <Text style={styles.subtitle}>Light gray layout card with rounded bottom corners</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryDark // #172B3E Navy Blue outer background
  },
  contentCard: {
    flex: 1,
    backgroundColor: colors.lightGray, // #E0E3E7 Light Gray card background
    borderBottomLeftRadius: 32, // Rounded bottom-left corner
    borderBottomRightRadius: 32, // Rounded bottom-right corner
    padding: 24,
    marginBottom: 88, // Space above bottom navigation bar
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
    color: colors.primaryDark, // #172B3E Navy Blue text
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 8
  },
  subtitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Rajdhani_500Medium',
    textAlign: 'center'
  }
});
