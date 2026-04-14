import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { colors } from '../theme/colors';

type QRScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (address: string) => void;
};

export function QRScannerModal({ visible, onClose, onScanned }: QRScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();

  const shouldShowWebFallback = Platform.OS === 'web';

  return (
    <Modal visible={visible} animationType='slide' transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>Scan Receiver QR</Text>

          {shouldShowWebFallback ? (
            <Text style={styles.hint}>QR scanning is available in native builds. For web demo, paste address manually.</Text>
          ) : permission?.granted ? (
            <CameraView
              style={styles.camera}
              facing='back'
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result: BarcodeScanningResult) => {
                onScanned(result.data);
                onClose();
              }}
            />
          ) : (
            <Pressable onPress={requestPermission} style={styles.permissionButton}>
              <Text style={styles.permissionLabel}>Grant Camera Permission</Text>
            </Pressable>
          )}

          <Pressable onPress={onClose} style={styles.closeButton}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  container: {
    width: '100%',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Orbitron_700Bold',
    marginBottom: 10,
    fontSize: 16
  },
  hint: {
    color: colors.textMuted,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 15,
    marginVertical: 20
  },
  camera: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden'
  },
  permissionButton: {
    marginVertical: 24,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent
  },
  permissionLabel: {
    color: colors.accent,
    textAlign: 'center',
    fontFamily: 'Rajdhani_700Bold'
  },
  closeButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  closeText: {
    color: colors.textPrimary,
    fontFamily: 'Rajdhani_700Bold'
  }
});
