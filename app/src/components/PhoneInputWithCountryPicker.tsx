import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export type CountryItem = {
  flag: string;
  code: string;
  name: string;
};

export const COUNTRY_CODES: CountryItem[] = [
  { flag: '🇮🇳', code: '+91', name: 'India' },
  { flag: '🇺🇸', code: '+1', name: 'United States' },
  { flag: '🇬🇧', code: '+44', name: 'United Kingdom' },
  { flag: '🇨🇦', code: '+1', name: 'Canada' },
  { flag: '🇦🇺', code: '+61', name: 'Australia' },
  { flag: '🇦🇪', code: '+971', name: 'United Arab Emirates' },
  { flag: '🇸🇬', code: '+65', name: 'Singapore' },
  { flag: '🇩🇪', code: '+49', name: 'Germany' },
  { flag: '🇫🇷', code: '+33', name: 'France' },
  { flag: '🇯🇵', code: '+81', name: 'Japan' }
];

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  selectedCountry: CountryItem;
  onSelectCountry: (country: CountryItem) => void;
  error?: string;
  placeholder?: string;
}

export const PhoneInputWithCountryPicker: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  selectedCountry,
  onSelectCountry,
  error,
  placeholder = 'Mobile Number'
}) => {
  const [showCountryModal, setShowCountryModal] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.phoneInputRow}>
        <Pressable style={styles.countryPickerButton} onPress={() => setShowCountryModal(true)}>
          <Text style={styles.countryFlagText}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
          <Ionicons name="chevron-down" size={14} color="#667085" style={{ marginLeft: 2 }} />
        </Pressable>

        <TextInput
          style={[styles.input, Boolean(error) && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          keyboardType="phone-pad"
          value={value}
          onChangeText={onChangeText}
        />
      </View>

      {Boolean(error) && <Text style={styles.fieldErrorText}>{error}</Text>}

      {/* Country Code Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCountryModal(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <Pressable onPress={() => setShowCountryModal(false)}>
                <Ionicons name="close" size={20} color={colors.primaryDark} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {COUNTRY_CODES.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={[
                    styles.countryOptionRow,
                    selectedCountry.code === item.code && selectedCountry.name === item.name && styles.countryOptionSelected
                  ]}
                  onPress={() => {
                    onSelectCountry(item);
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                  <Text style={styles.countryOptionName}>{item.name}</Text>
                  <Text style={styles.countryOptionCode}>{item.code}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0'
  },
  countryFlagText: {
    fontSize: 18,
    marginRight: 6
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.primaryDark
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primaryDark
  },
  inputError: {
    borderColor: '#FDA29B',
    backgroundColor: '#FFFBFA'
  },
  fieldErrorText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#D92D20',
    marginTop: 4,
    marginLeft: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 62, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#172B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: colors.primaryDark
  },
  countryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4
  },
  countryOptionSelected: {
    backgroundColor: '#ECFDF5'
  },
  countryOptionFlag: {
    fontSize: 20,
    marginRight: 12
  },
  countryOptionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primaryDark
  },
  countryOptionCode: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#05DA93'
  }
});
