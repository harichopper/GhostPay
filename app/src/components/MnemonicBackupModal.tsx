import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors } from '../theme/colors';

type MnemonicBackupModalProps = {
  visible: boolean;
  mnemonic: string;
  onCopy: () => void;
  onDone: () => void;
};

export function MnemonicBackupModal({
  visible,
  mnemonic,
  onCopy,
  onDone
}: MnemonicBackupModalProps) {
  const [step, setStep] = useState<'reveal' | 'verify'>('reveal');
  const [copied, setCopied] = useState(false);

  // Parse words array
  const words = useMemo(() => {
    return mnemonic.trim().split(/\s+/).filter(Boolean);
  }, [mnemonic]);

  // Pick 3 random positions for MetaMask-style verification
  const verificationTargets = useMemo(() => {
    if (words.length < 3) return [0, 1, 2];
    const indices: number[] = [];
    while (indices.length < 3) {
      const rand = Math.floor(Math.random() * words.length);
      if (!indices.includes(rand)) {
        indices.push(rand);
      }
    }
    return indices.sort((a, b) => a - b);
  }, [words, step]);

  // Selected words by the user for the 3 target slots
  const [selectedWords, setSelectedWords] = useState<(string | null)[]>([null, null, null]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pool of selectable candidate options (3 target words + distractors)
  const candidateOptions = useMemo(() => {
    if (words.length < 3) return [];
    const targetWords = verificationTargets.map((idx) => words[idx]);
    const otherWords = words.filter((_, idx) => !verificationTargets.includes(idx));
    // Pick 5 random distractors
    const shuffledOthers = [...otherWords].sort(() => Math.random() - 0.5).slice(0, 5);
    const pool = [...targetWords, ...shuffledOthers];
    return pool.sort(() => Math.random() - 0.5);
  }, [verificationTargets, words]);

  // Reset state when modal opens or step changes
  useEffect(() => {
    if (visible) {
      setStep('reveal');
      setCopied(false);
      setSelectedWords([null, null, null]);
      setErrorMessage(null);
    }
  }, [visible, mnemonic]);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSelectCandidate = (word: string) => {
    setErrorMessage(null);
    const nextSlots = [...selectedWords];
    const emptyIndex = nextSlots.indexOf(null);
    if (emptyIndex !== -1 && !nextSlots.includes(word)) {
      nextSlots[emptyIndex] = word;
      setSelectedWords(nextSlots);
    }
  };

  const handleDeselectSlot = (slotIndex: number) => {
    setErrorMessage(null);
    const nextSlots = [...selectedWords];
    nextSlots[slotIndex] = null;
    setSelectedWords(nextSlots);
  };

  // Check if all 3 slots match the correct target words
  const isVerified = useMemo(() => {
    if (selectedWords.includes(null)) return false;
    return verificationTargets.every((targetIdx, i) => selectedWords[i] === words[targetIdx]);
  }, [selectedWords, verificationTargets, words]);

  const handleVerifySubmit = () => {
    if (!isVerified) {
      setErrorMessage('Word selection does not match your recovery phrase. Please check and try again.');
      return;
    }
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Step Progress Bar */}
          <View style={styles.progressBarRow}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, step === 'verify' && styles.progressStepActive]} />
          </View>

          {step === 'reveal' ? (
            /* STEP 1: REVEAL & COPY PHRASE */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
              <View style={styles.headerGroup}>
                <View style={styles.iconCircleBadge}>
                  <Ionicons name="key" size={24} color="#05DA93" />
                </View>
                <Text style={styles.title}>Secret Recovery Phrase</Text>
                <Text style={styles.subtitle}>
                  Save these 25 words in order. Store them in a safe offline location. Do not share them with anyone.
                </Text>
              </View>

              {/* Numbered Word Grid */}
              <View style={styles.wordsGridContainer}>
                {words.map((w, idx) => (
                  <View key={idx} style={styles.wordChip}>
                    <Text style={styles.wordIndex}>{idx + 1}.</Text>
                    <Text style={styles.wordText}>{w}</Text>
                  </View>
                ))}
              </View>

              {/* Copy Phrase Button */}
              <Pressable style={styles.copyButton} onPress={handleCopy}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={copied ? '#05DA93' : colors.primaryDark}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.copyButtonText, copied && { color: '#05DA93' }]}>
                  {copied ? 'Phrase Copied to Clipboard!' : 'Copy Seed Phrase'}
                </Text>
              </Pressable>

              {/* Step 1 Actions */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.primaryActionButton}
                  onPress={() => {
                    setSelectedWords([null, null, null]);
                    setErrorMessage(null);
                    setStep('verify');
                  }}
                >
                  <Text style={styles.primaryActionButtonText}>Continue to Verification</Text>
                  <Ionicons name="arrow-forward" size={16} color="#0D1E2F" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            /* STEP 2: METAMASK 3-WORD VERIFICATION */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
              <View style={styles.headerGroup}>
                <View style={styles.iconCircleBadgeVerify}>
                  <Ionicons name="shield-checkmark" size={24} color="#05DA93" />
                </View>
                <Text style={styles.title}>Confirm Secret Phrase</Text>
                <Text style={styles.subtitle}>
                  Select the correct words for slot #{verificationTargets[0] + 1}, #{verificationTargets[1] + 1}, and #{verificationTargets[2] + 1} to verify your backup.
                </Text>
              </View>

              {/* 3 Verification Slots */}
              <View style={styles.slotsRow}>
                {verificationTargets.map((targetIdx, slotIdx) => {
                  const filledWord = selectedWords[slotIdx];
                  return (
                    <Pressable
                      key={slotIdx}
                      style={[
                        styles.slotCard,
                        filledWord ? styles.slotCardFilled : styles.slotCardEmpty
                      ]}
                      onPress={() => filledWord && handleDeselectSlot(slotIdx)}
                    >
                      <Text style={styles.slotLabel}>Word #{targetIdx + 1}</Text>
                      <Text style={styles.slotValue}>
                        {filledWord || 'Tap option below'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Error Warning */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#F04438" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Success Banner */}
              {isVerified && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.successText}>Verification Match Confirmed!</Text>
                </View>
              )}

              {/* Candidate Word Options Bank */}
              <Text style={styles.optionsHeaderLabel}>Select Words in Order:</Text>
              <View style={styles.candidatesBank}>
                {candidateOptions.map((word, idx) => {
                  const isSelected = selectedWords.includes(word);
                  return (
                    <Pressable
                      key={idx}
                      disabled={isSelected}
                      style={[styles.candidateChip, isSelected && styles.candidateChipSelected]}
                      onPress={() => handleSelectCandidate(word)}
                    >
                      <Text style={[styles.candidateText, isSelected && styles.candidateTextSelected]}>
                        {word}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Step 2 Actions */}
              <View style={styles.actionsRow}>
                <Pressable style={styles.backButton} onPress={() => setStep('reveal')}>
                  <Ionicons name="arrow-back" size={16} color="#667085" style={{ marginRight: 4 }} />
                  <Text style={styles.backButtonText}>Back to Phrase</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.primaryActionButton,
                    !isVerified && styles.primaryActionButtonDisabled
                  ]}
                  disabled={!isVerified}
                  onPress={handleVerifySubmit}
                >
                  <Text style={styles.primaryActionButtonText}>Complete Setup</Text>
                  <Ionicons name="checkmark-sharp" size={16} color="#0D1E2F" style={{ marginLeft: 6 }} />
                </Pressable>
              </View>
            </ScrollView>
          )}
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
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)'
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#FFFFFF',
    padding: 20,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0'
  },
  progressStepActive: {
    backgroundColor: '#05DA93'
  },
  scrollContainer: {
    paddingBottom: 10
  },
  headerGroup: {
    alignItems: 'center',
    marginBottom: 16
  },
  iconCircleBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  iconCircleBadgeVerify: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  title: {
    color: '#0F172A',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8
  },
  wordsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16
  },
  wordChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  wordIndex: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#94A3B8',
    marginRight: 4,
    minWidth: 20
  },
  wordText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A'
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  copyButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  slotCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64
  },
  slotCardEmpty: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderStyle: 'dashed'
  },
  slotCardFilled: {
    borderColor: '#05DA93',
    backgroundColor: '#ECFDF5'
  },
  slotLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  slotValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#991B1B',
    flex: 1
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  successText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#065F46'
  },
  optionsHeaderLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#475569',
    marginBottom: 8
  },
  candidatesBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  candidateChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  candidateChipSelected: {
    backgroundColor: '#E2E8F0',
    borderColor: '#94A3B8',
    opacity: 0.4
  },
  candidateText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A'
  },
  candidateTextSelected: {
    color: '#94A3B8'
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  backButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#667085'
  },
  primaryActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#05DA93',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#05DA93',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  primaryActionButtonDisabled: {
    backgroundColor: '#CBD5E1',
    elevation: 0,
    shadowOpacity: 0
  },
  primaryActionButtonText: {
    color: '#0D1E2F',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    letterSpacing: 0.4
  }
});
