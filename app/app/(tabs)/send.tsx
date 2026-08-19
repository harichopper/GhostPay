import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useWalletStore } from '../../src/store/walletStore';
import { colors } from '../../src/theme/colors';

const RECENT_CONTACTS = [
  { id: '1', name: 'Eva Novak', phone: '+1 415 555 2872', bg: '#4A3E3D', initial: 'EN' },
  { id: '2', name: 'Henrik Jansen', phone: '+1 212 555 4910', bg: '#3B4B5B', initial: 'HJ' },
  { id: '3', name: 'Matteo Ricci', phone: '+1 312 555 8832', bg: '#2C3E50', initial: 'MR' },
  { id: '4', name: 'Emilia Costa', phone: '+1 650 555 1049', bg: '#6C5CE7', initial: 'EC' }
];

export default function SendScreen() {
  const router = useRouter();
  const { walletAddress, balanceAlgo, enqueueOfflinePayment, isConnected } = useWalletStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const [activeTab, setActiveTab] = useState<'scan' | 'send'>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'ALGO'>('USD');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  // Trigger entrance animations every time screen is focused (tab navigation)
  useFocusEffect(
    useCallback(() => {
      setScanKey((prev) => prev + 1);
    }, [])
  );

  // Scanner beam animation
  const beamY = useSharedValue(0);
  // Pulse animation for permission popup icon
  const pulseScale = useSharedValue(1);
  // Scanner viewport glowing shadow pulse
  const glowOpacity = useSharedValue(0.3);

  React.useEffect(() => {
    beamY.value = withRepeat(
      withSequence(
        withTiming(220, { duration: 1600 }),
        withTiming(0, { duration: 1600 })
      ),
      -1,
      true
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [beamY, pulseScale, glowOpacity]);

  const beamAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: beamY.value }]
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));

  const viewportGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value
  }));

  const handleRequestPermission = async () => {
    try {
      const res = await requestPermission();
      if (res.granted) {
        Toast.show({
          type: 'success',
          text1: 'Camera Access Granted',
          text2: 'You can now scan QR codes'
        });
      } else if (res && !res.canAskAgain) {
        Alert.alert(
          'Permission Blocked in Settings',
          'Camera permission is permanently denied. Please open your device Settings > Apps > GhostPay > Permissions and enable Camera access.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err?.message || 'Could not request camera permission.');
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (data) {
      setRecipient(data);
      setActiveTab('send');
      Toast.show({
        type: 'success',
        text1: 'QR Code Scanned',
        text2: `Recipient set to ${data.slice(0, 12)}...`
      });
    }
  };

  const handlePasteAddress = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text);
        Toast.show({
          type: 'success',
          text1: 'Address Pasted',
          text2: text.slice(0, 16) + '...'
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Paste Error',
        text2: 'Could not read clipboard'
      });
    }
  };

  const handleSendPayment = async () => {
    if (!recipient.trim()) {
      Alert.alert('Missing Recipient', 'Please enter a mobile number or wallet address.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to send.');
      return;
    }

    setIsSubmitting(true);
    try {
      await enqueueOfflinePayment(recipient, numericAmount);
      Toast.show({
        type: 'success',
        text1: isConnected ? 'Payment Sent!' : 'Payment Queued Offline',
        text2: `${numericAmount} ${currencyMode} to ${recipient.slice(0, 10)}...`
      });
      setAmount('');
      setRecipient('');
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message || 'Failed to process payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FBFDFC', '#F0F7F3', '#E4F2EB']}
        style={[styles.gradientContainer, isDesktop && styles.gradientContainerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>

          <Text style={styles.headerTitle}>Pay & Scan</Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Tab Switcher (Scan vs Send) */}
        <View style={styles.tabSwitcherContainer}>
          <Pressable
            style={[styles.switcherTab, activeTab === 'scan' && styles.switcherTabActive]}
            onPress={() => setActiveTab('scan')}
          >
            <Ionicons
              name="qr-code"
              size={18}
              color={activeTab === 'scan' ? colors.primaryDark : 'rgba(23, 43, 62, 0.6)'}
            />
            <Text style={[styles.switcherText, activeTab === 'scan' && styles.switcherTextActive]}>
              Scan QR
            </Text>
          </Pressable>

          <Pressable
            style={[styles.switcherTab, activeTab === 'send' && styles.switcherTabActive]}
            onPress={() => setActiveTab('send')}
          >
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={activeTab === 'send' ? colors.primaryDark : 'rgba(23, 43, 62, 0.6)'}
            />
            <Text style={[styles.switcherText, activeTab === 'send' && styles.switcherTextActive]}>
              Send Money
            </Text>
          </Pressable>
        </View>

        <ScrollView
          key={scanKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {activeTab === 'scan' ? (
            /* SCAN QR MODE */
            <View style={styles.scanModeContainer}>
              <Text style={styles.sectionSubtitle}>
                Align QR Code within the frame to scan automatically
              </Text>

              {/* Camera Frame Box */}
              <Animated.View
                entering={ZoomIn.duration(450).springify().damping(13)}
                style={[styles.scannerViewport, viewportGlowStyle]}
              >
                {permission?.granted ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    enableTorch={isFlashOn}
                    onBarcodeScanned={handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr']
                    }}
                  />
                ) : (
                  <View style={styles.noCameraView}>
                    <Ionicons name="camera-outline" size={48} color={colors.primaryDark} />
                    <Text style={styles.noCameraText}>Camera Access Required</Text>
                    <Pressable style={styles.permissionButton} onPress={handleRequestPermission}>
                      <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </Pressable>
                  </View>
                )}

                {/* Viewfinder Target Overlay Corners */}
                <View style={[styles.cornerMarker, styles.topLeft]} />
                <View style={[styles.cornerMarker, styles.topRight]} />
                <View style={[styles.cornerMarker, styles.bottomLeft]} />
                <View style={[styles.cornerMarker, styles.bottomRight]} />

                {/* Scanning Beam Line */}
                <Animated.View style={[styles.scanBeam, beamAnimatedStyle]} />
              </Animated.View>

              {/* Scanner Control Actions */}
              <View style={styles.scannerActionsRow}>
                <Pressable
                  style={styles.actionPill}
                  onPress={() => setIsFlashOn(!isFlashOn)}
                >
                  <Ionicons
                    name={isFlashOn ? 'flash' : 'flash-outline'}
                    size={20}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.actionPillText}>{isFlashOn ? 'Flash On' : 'Flash Off'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* SEND MONEY MODE */
            <View style={styles.sendModeContainer}>
              {/* Recipient Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>RECIPIENT (MOBILE OR WALLET)</Text>
                <View style={styles.inputCard}>
                  <Ionicons name="person-outline" size={20} color={colors.primaryDark} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter phone number or 58-char address..."
                    placeholderTextColor="rgba(23, 43, 62, 0.4)"
                    value={recipient}
                    onChangeText={setRecipient}
                  />
                  {recipient.length > 0 && (
                    <Pressable onPress={() => setRecipient('')}>
                      <Ionicons name="close-circle" size={18} color="rgba(23, 43, 62, 0.4)" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Quick Contacts */}
              <View style={styles.quickContactsSection}>
                <Text style={styles.sectionMiniHeader}>RECENT CONTACTS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
                  {RECENT_CONTACTS.map((contact) => (
                    <Pressable
                      key={contact.id}
                      style={styles.contactItem}
                      onPress={() => setRecipient(contact.phone)}
                    >
                      <View style={[styles.contactAvatar, { backgroundColor: contact.bg }]}>
                        <Text style={styles.contactInitial}>{contact.initial}</Text>
                      </View>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {contact.name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Amount Entry Display */}
              <View style={styles.amountSection}>
                <View style={styles.amountHeaderRow}>
                  <Text style={styles.inputLabel}>AMOUNT</Text>
                  <Pressable
                    style={styles.currencyTogglePill}
                    onPress={() => setCurrencyMode(currencyMode === 'USD' ? 'ALGO' : 'USD')}
                  >
                    <Text style={styles.currencyToggleText}>
                      Mode: <Text style={{ color: colors.secondary, fontWeight: '700' }}>{currencyMode}</Text>
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.amountDisplayCard}>
                  <Text style={styles.currencyPrefix}>{currencyMode === 'USD' ? '$' : '🄐'}</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="rgba(23, 43, 62, 0.3)"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>

                {/* Preset Amount Chips */}
                <View style={styles.presetChipsRow}>
                  {['10', '25', '50', '100'].map((val) => (
                    <Pressable
                      key={val}
                      style={styles.chip}
                      onPress={() => setAmount(val)}
                    >
                      <Text style={styles.chipText}>+${val}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={[styles.chip, styles.maxChip]}
                    onPress={() => setAmount(balanceAlgo ? balanceAlgo.toFixed(2) : '100')}
                  >
                    <Text style={styles.maxChipText}>MAX</Text>
                  </Pressable>
                </View>
              </View>

              {/* Submit Payment Button */}
              <Pressable
                style={[styles.sendSubmitButton, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSendPayment}
                disabled={isSubmitting}
              >
                <Text style={styles.sendSubmitText}>
                  {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={colors.primaryDark} style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* Animated Camera Permission Request Popup Overlay */}
      {activeTab === 'scan' && Boolean(permission && !permission.granted) && (
        <Modal transparent animationType="fade" visible={Boolean(permission && !permission.granted)}>
          <View style={styles.modalOverlay}>
            <Animated.View entering={ZoomIn.duration(400).springify().damping(14)} style={styles.permissionPopupCard}>
              <Animated.View style={[styles.permissionIconBadge, pulseAnimatedStyle]}>
                <Ionicons name="camera" size={32} color={colors.primaryDark} />
              </Animated.View>

              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                GhostPay needs camera permission to scan recipient QR codes for instant payments and wallet transfers.
              </Text>

              <Pressable style={styles.grantAccessButton} onPress={handleRequestPermission}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.grantAccessButtonText}>Grant Camera Access</Text>
              </Pressable>

              <Pressable style={styles.cancelAccessButton} onPress={() => setActiveTab('send')}>
                <Text style={styles.cancelAccessText}>Enter Address Manually</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  permissionPopupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16
  },
  permissionIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E4F2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.secondary
  },
  permissionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    textAlign: 'center',
    marginBottom: 8
  },
  permissionDesc: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  grantAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 18,
    width: '100%',
    height: 50,
    marginBottom: 10,
    elevation: 3,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  grantAccessButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontFamily: 'Inter_700Bold'
  },
  cancelAccessButton: {
    paddingVertical: 10
  },
  cancelAccessText: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryDark
  },
  gradientContainer: {
    flex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 88,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  gradientContainerDesktop: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 8
  },
  headerTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: -0.3
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  tabSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(23, 43, 62, 0.08)',
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 12
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20
  },
  switcherTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6
  },
  switcherText: {
    color: 'rgba(23, 43, 62, 0.6)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 6
  },
  switcherTextActive: {
    color: colors.primaryDark
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24
  },
  scanModeContainer: {
    alignItems: 'center',
    paddingTop: 8
  },
  sectionSubtitle: {
    color: '#5C768D',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 20
  },
  scannerViewport: {
    width: 300,
    height: 300,
    borderRadius: 28,
    backgroundColor: '#0F1A24',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(5, 218, 147, 0.5)'
  },
  noCameraView: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  noCameraText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 10,
    marginBottom: 14,
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16
  },
  permissionButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  cornerMarker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.secondary,
    borderWidth: 4
  },
  topLeft: {
    top: 16,
    left: 16,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12
  },
  topRight: {
    top: 16,
    right: 16,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12
  },
  bottomLeft: {
    bottom: 16,
    left: 16,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12
  },
  bottomRight: {
    bottom: 16,
    right: 16,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12
  },
  scanBeam: {
    position: 'absolute',
    top: 30,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8
  },
  scannerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  actionPillText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8
  },
  sendModeContainer: {
    paddingTop: 8
  },
  inputGroup: {
    marginBottom: 20
  },
  inputLabel: {
    color: '#5C768D',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    elevation: 2,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  textInput: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: 'Inter_500Medium'
  },
  quickContactsSection: {
    marginBottom: 24
  },
  sectionMiniHeader: {
    color: '#5C768D',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  contactsScroll: {
    flexDirection: 'row'
  },
  contactItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 60
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  contactInitial: {
    color: colors.white,
    fontSize: 15,
    fontFamily: 'Inter_700Bold'
  },
  contactName: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center'
  },
  amountSection: {
    marginBottom: 28
  },
  amountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  currencyTogglePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 1
  },
  currencyToggleText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold'
  },
  amountDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 72,
    elevation: 3,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  currencyPrefix: {
    color: colors.secondary,
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginRight: 8
  },
  amountInput: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 36,
    fontFamily: 'Inter_700Bold'
  },
  presetChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14
  },
  chip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  maxChip: {
    backgroundColor: colors.primaryDark
  },
  maxChipText: {
    color: colors.secondary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold'
  },
  sendSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 22,
    height: 56,
    elevation: 4,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  sendSubmitText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontFamily: 'Inter_700Bold'
  }
});
