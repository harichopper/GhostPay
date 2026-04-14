import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type WalletQrModalProps = {
  visible: boolean;
  walletAddress: string;
  onClose: () => void;
};

export function WalletQrModal({ visible, walletAddress, onClose }: WalletQrModalProps) {
  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Receive ALGO</Text>
          <Text style={styles.subtitle}>Share this QR to receive payments</Text>

          {walletAddress ? (
            <View style={styles.qrWrap}>
              <QRCode value={walletAddress} size={210} backgroundColor='#FFFFFF' color='#111417' />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Create or import wallet first in Settings</Text>
            </View>
          )}

          <Text style={styles.addressLabel}>Wallet Address</Text>
          <Text style={styles.addressValue}>{walletAddress || 'Not set'}</Text>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(132,255,245,0.32)',
    backgroundColor: 'rgba(17,20,23,0.98)',
    padding: 16
  },
  title: {
    color: '#E9FEFF',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20,
    textAlign: 'center'
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#B9CACA',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13,
    textAlign: 'center'
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF'
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,208,87,0.35)',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(38,32,15,0.6)'
  },
  emptyText: {
    color: '#FFD057',
    fontFamily: 'Rajdhani_700Bold',
    textAlign: 'center'
  },
  addressLabel: {
    marginTop: 12,
    color: '#00F5FF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  addressValue: {
    marginTop: 3,
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13
  },
  closeButton: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(132,255,245,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    backgroundColor: 'rgba(0,245,255,0.1)'
  },
  closeText: {
    color: '#00F5FF',
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 0.6,
    fontSize: 12
  }
});
