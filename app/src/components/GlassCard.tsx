import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '../theme/colors';
import { radii } from '../theme/styles';

export function GlassCard({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 3
  }
});
