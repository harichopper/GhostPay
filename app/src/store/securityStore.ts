import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from '../storage/platformStorage';

export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

type SecurityState = {
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  lastUnlockTime: number | null;
  sessionTimeout: number;
  enableAppLock: () => void;
  disableAppLock: () => void;
  enableBiometric: () => void;
  disableBiometric: () => void;
  unlock: () => void;
  lock: () => void;
  shouldRequireAuthentication: () => boolean;
  initialize: () => void;
  reset: () => void;
};

const initialSecurityState = {
  appLockEnabled: false,
  biometricEnabled: false,
  lastUnlockTime: null,
  sessionTimeout: SESSION_TIMEOUT_MS
};

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      ...initialSecurityState,

      enableAppLock: () => {
        set({ appLockEnabled: true, biometricEnabled: false, lastUnlockTime: Date.now() });
      },

      disableAppLock: () => {
        set({ appLockEnabled: false, biometricEnabled: false, lastUnlockTime: null });
      },

      enableBiometric: () => {
        set({ biometricEnabled: true });
      },

      disableBiometric: () => {
        set({ biometricEnabled: false });
      },

      unlock: () => {
        set({ lastUnlockTime: Date.now() });
      },

      lock: () => {
        set({ lastUnlockTime: null });
      },

      shouldRequireAuthentication: () => {
        const { appLockEnabled, lastUnlockTime, sessionTimeout } = get();

        return appLockEnabled && (!lastUnlockTime || Date.now() - lastUnlockTime >= sessionTimeout);
      },

      initialize: () => {},

      reset: () => {
        set(initialSecurityState);
      }
    }),
    {
      name: 'ghostpay-security-storage',
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({
        appLockEnabled: state.appLockEnabled,
        biometricEnabled: state.biometricEnabled,
        lastUnlockTime: state.lastUnlockTime,
        sessionTimeout: state.sessionTimeout
      })
    }
  )
);
