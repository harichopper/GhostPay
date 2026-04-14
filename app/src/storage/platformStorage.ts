import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

const webStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(name);
  }
};

const nativeStorage: StateStorage = {
  getItem: async (name) => AsyncStorage.getItem(name),
  setItem: async (name, value) => AsyncStorage.setItem(name, value),
  removeItem: async (name) => AsyncStorage.removeItem(name)
};

export const platformStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
