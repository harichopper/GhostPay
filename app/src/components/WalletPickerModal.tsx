import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import type { WalletIdentityItem } from '../types/transaction';

type WalletPickerModalProps = {
  visible: boolean;
  wallets: WalletIdentityItem[];
  mobileNumber: string;
  onSelect: (wallet: WalletIdentityItem) => void;
  onClose: () => void;
};

export function WalletPickerModal({ visible, wallets, mobileNumber, onSelect, onClose }: WalletPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose Receiver Wallet</Text>
          <Text style={styles.subtitle}>Mobile: {mobileNumber}</Text>

          <ScrollView style={styles.list}>
            {wallets.map((wallet) => (
              <Pressable key={wallet.address} style={styles.walletItem} onPress={() => onSelect(wallet)}>
                <Text style={styles.walletLabel}>{wallet.label || 'Wallet'}</Text>
                <Text style={styles.walletAddress}>{wallet.address}</Text>
                <Text style={styles.walletMeta}>{wallet.isDefault ? 'Default' : 'Secondary'}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 18
  },
  card: {
    backgroundColor: 'rgba(10, 17, 31, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(132,255,245,0.4)',
    borderRadius: 18,
    padding: 16,
    maxHeight: '75%'
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16,
    letterSpacing: 0.8
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    marginTop: 5,
    marginBottom: 10,
    fontSize: 14
  },
  list: {
    marginBottom: 10
  },
  walletItem: {
    borderWidth: 1,
    borderColor: 'rgba(132,255,245,0.28)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(5, 9, 17, 0.85)'
  },
  walletLabel: {
    color: colors.accent,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14
  },
  walletAddress: {
    color: colors.textPrimary,
    fontFamily: 'Rajdhani_500Medium',
    marginTop: 2,
    fontSize: 13
  },
  walletMeta: {
    marginTop: 3,
    color: colors.accentSecondary,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  closeText: {
    color: colors.textPrimary,
    fontFamily: 'Rajdhani_700Bold'
  }
});
