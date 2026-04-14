import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors } from '../theme/colors';

type NeonButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NeonButton({ label, onPress, disabled = false, variant = 'primary' }: NeonButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(disabled ? 0.45 : 1, { duration: 180 })
  }));

  const gradient =
    variant === 'secondary'
      ? ['#0E2E55', '#1578FF']
      : variant === 'danger'
        ? ['#431126', '#8C1A48']
        : ['#054A5B', '#12D9FF'];

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 220 });
      }}
      style={[styles.wrapper, animatedStyle]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        <View style={styles.innerGlow} />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%'
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  label: {
    color: colors.textPrimary,
    fontSize: 16,
    letterSpacing: 1.1,
    fontFamily: 'Orbitron_700Bold'
  }
});
