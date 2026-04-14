import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type MnemonicBackupModalProps = {
  visible: boolean;
  mnemonic: string;
  onCopy: () => void;
  onDone: () => void;
};

export function MnemonicBackupModal({ visible, mnemonic, onCopy, onDone }: MnemonicBackupModalProps) {
  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Backup Phrase</Text>
          <Text style={styles.subtitle}>Save these 25 words now. This popup is shown only once.</Text>

          <View style={styles.mnemonicWrap}>
            <Text style={styles.mnemonicText}>{mnemonic}</Text>
          </View>

          <Text style={styles.note}>Copy the phrase or take a screenshot, then store it in a safe offline place.</Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={onCopy}>
              <Text style={styles.secondaryButtonText}>Copy Words</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onDone}>
              <Text style={styles.primaryButtonText}>I Stored It</Text>
            </Pressable>
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.72)'
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,208,87,0.4)',
    backgroundColor: 'rgba(17,20,23,0.98)',
    padding: 16
  },
  title: {
    color: '#FFD057',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20,
    textAlign: 'center'
  },
  subtitle: {
    marginTop: 6,
    color: '#E1E2E7',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13,
    textAlign: 'center'
  },
  mnemonicWrap: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,208,87,0.35)',
    backgroundColor: 'rgba(38,32,15,0.78)',
    padding: 12
  },
  mnemonicText: {
    color: '#FFFFFF',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 15,
    lineHeight: 22
  },
  note: {
    marginTop: 10,
    color: '#FFD057',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  primaryButton: {
    flex: 1,
    minWidth: 120,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFD057',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: '#2A2106',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 0.6
  },
  secondaryButton: {
    flex: 1,
    minWidth: 120,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,208,87,0.45)',
    backgroundColor: 'rgba(255,208,87,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: '#FFD057',
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13
  }
});
