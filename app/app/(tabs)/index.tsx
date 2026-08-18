import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={styles.contentCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerArea}>
          <Text style={styles.title}>Home Screen</Text>
          <Text style={styles.subtitle}>Soft gradient layout card with rounded bottom corners</Text>
        </View>
      </LinearGradient>
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
    borderBottomLeftRadius: 32, // Rounded bottom-left corner
    borderBottomRightRadius: 32, // Rounded bottom-right corner
    padding: 24,
    marginBottom: 88, // Space above bottom navigation bar
    overflow: 'hidden',
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
    fontFamily: 'Inter_500Medium',
    textAlign: 'center'
  }
});
