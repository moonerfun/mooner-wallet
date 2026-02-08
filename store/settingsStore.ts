/**
 * Settings Store - Persisted app settings and preferences
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_SLIPPAGE,
  SMALL_BALANCE_THRESHOLD,
} from "@/constants/defaults";
import { MAX_PULSE_TOKENS } from "@/constants/pagination";

// 8-bit avatar IDs
export type PixelAvatarId =
  | "alien"
  | "robot"
  | "ghost"
  | "skull"
  | "rocket"
  | "diamond"
  | "fire"
  | "money"
  | "nerd"
  | "cool"
  | "clown"
  | "monkey"
  | "frog"
  | "unicorn"
  | "poop"
  | "whale";

// Avatar source preference
export type AvatarSource = "twitter" | "pixel";

export interface SettingsState {
  // Hydration state (for persist middleware)
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Notifications
  notificationsEnabled: boolean;

  // Wallet settings
  selectedWalletId: string | null;

  // Profile avatar (8-bit style)
  selectedAvatarId: PixelAvatarId | null;
  // Whether to use Twitter avatar or pixel avatar (even if Twitter is connected)
  avatarSource: AvatarSource;

  // Trading settings
  defaultSlippage: number; // percentage
  priorityFee: "low" | "medium" | "high" | "custom";
  customPriorityFee: number; // in lamports/gwei

  // Display settings
  currency: "USD" | "EUR" | "GBP" | "JPY";
  hideSmallBalances: boolean;
  smallBalanceThreshold: number; // in USD

  // Privacy
  hideBalances: boolean;

  // Pulse settings
  pulseAutoRefresh: boolean;
  pulseMaxTokens: number;

  // Actions
  setNotificationsEnabled: (enabled: boolean) => void;
  setSelectedWalletId: (walletId: string | null) => void;
  setSelectedAvatarId: (avatarId: PixelAvatarId | null) => void;
  setAvatarSource: (source: AvatarSource) => void;
  setDefaultSlippage: (slippage: number) => void;
  setPriorityFee: (fee: "low" | "medium" | "high" | "custom") => void;
  setCustomPriorityFee: (fee: number) => void;
  setCurrency: (currency: "USD" | "EUR" | "GBP" | "JPY") => void;
  setHideSmallBalances: (hide: boolean) => void;
  setSmallBalanceThreshold: (threshold: number) => void;
  setHideBalances: (hide: boolean) => void;
  setPulseAutoRefresh: (autoRefresh: boolean) => void;
  setPulseMaxTokens: (max: number) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  _hasHydrated: false,
  notificationsEnabled: true,
  selectedWalletId: null as string | null,
  selectedAvatarId: null as PixelAvatarId | null,
  avatarSource: "twitter" as AvatarSource,
  defaultSlippage: DEFAULT_SLIPPAGE,
  priorityFee: "medium" as const,
  customPriorityFee: 0,
  currency: "USD" as const,
  hideSmallBalances: false,
  smallBalanceThreshold: SMALL_BALANCE_THRESHOLD,
  hideBalances: false,
  pulseAutoRefresh: true,
  pulseMaxTokens: MAX_PULSE_TOKENS,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      setSelectedWalletId: (walletId) => set({ selectedWalletId: walletId }),

      setSelectedAvatarId: (avatarId) => set({ selectedAvatarId: avatarId }),

      setAvatarSource: (source) => set({ avatarSource: source }),

      setDefaultSlippage: (slippage) => set({ defaultSlippage: slippage }),

      setPriorityFee: (fee) => set({ priorityFee: fee }),

      setCustomPriorityFee: (fee) => set({ customPriorityFee: fee }),

      setCurrency: (currency) => set({ currency }),

      setHideSmallBalances: (hide) => set({ hideSmallBalances: hide }),

      setSmallBalanceThreshold: (threshold) =>
        set({ smallBalanceThreshold: threshold }),

      setHideBalances: (hide) => set({ hideBalances: hide }),

      setPulseAutoRefresh: (autoRefresh) =>
        set({ pulseAutoRefresh: autoRefresh }),

      setPulseMaxTokens: (max) => set({ pulseMaxTokens: max }),

      resetSettings: () => set({ ...DEFAULT_SETTINGS, _hasHydrated: true }),
    }),
    {
      name: "app-settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Called when rehydration finishes
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        // Don't persist the hydration state itself
        notificationsEnabled: state.notificationsEnabled,
        selectedWalletId: state.selectedWalletId,
        selectedAvatarId: state.selectedAvatarId,
        avatarSource: state.avatarSource,
        defaultSlippage: state.defaultSlippage,
        priorityFee: state.priorityFee,
        customPriorityFee: state.customPriorityFee,
        currency: state.currency,
        hideSmallBalances: state.hideSmallBalances,
        smallBalanceThreshold: state.smallBalanceThreshold,
        hideBalances: state.hideBalances,
        pulseAutoRefresh: state.pulseAutoRefresh,
        pulseMaxTokens: state.pulseMaxTokens,
      }),
    },
  ),
);
