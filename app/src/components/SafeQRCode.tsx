import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';

type SafeQRCodeProps = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

export function SafeQRCode({
  value,
  size = 170,
  color = '#172B3E',
  backgroundColor = '#FFFFFF'
}: SafeQRCodeProps) {
  try {
    return (
      <QRCodeSVG
        value={value || 'ghostpay://pay?demo=true'}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        enableLinearGradient={false}
      />
    );
  } catch {
    return (
      <View
        style={[
          styles.fallbackContainer,
          { width: size, height: size, backgroundColor }
        ]}
      />
    );
  }
}

const styles = StyleSheet.create({
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E3E7'
  }
});
