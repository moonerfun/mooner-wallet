/**
 * Notification Store - Manages notification state and preferences
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  Notification,
  NotificationPreferences,
  UnreadNotificationCounts,
} from "@/types/notifications";

interface NotificationState {
  // Push token
  expoPushToken: string | null;
  isRegistered: boolean;

  // Preferences (synced with Supabase)
  preferences: NotificationPreferences | null;
  isLoadingPreferences: boolean;

  // Unread counts
  unreadCounts: UnreadNotificationCounts | null;

  // Notifications list (cached)
  notifications: Notification[];
  isLoadingNotifications: boolean;
  hasMoreNotifications: boolean;

  // Last notification received (for showing in-app)
  lastReceivedNotification: Notification | null;

  // Actions
  setExpoPushToken: (token: string | null) => void;
  setIsRegistered: (registered: boolean) => void;
  setPreferences: (prefs: NotificationPreferences | null) => void;
  setIsLoadingPreferences: (loading: boolean) => void;
  setUnreadCounts: (counts: UnreadNotificationCounts | null) => void;
  setNotifications: (notifications: Notification[]) => void;
  appendNotifications: (notifications: Notification[]) => void;
  prependNotification: (notification: Notification) => void;
  setIsLoadingNotifications: (loading: boolean) => void;
  setHasMoreNotifications: (hasMore: boolean) => void;
  setLastReceivedNotification: (notification: Notification | null) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  reset: () => void;
}

const initialState = {
  expoPushToken: null,
  isRegistered: false,
  preferences: null,
  isLoadingPreferences: false,
  unreadCounts: null,
  notifications: [],
  isLoadingNotifications: false,
  hasMoreNotifications: true,
  lastReceivedNotification: null,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setExpoPushToken: (token) => set({ expoPushToken: token }),

      setIsRegistered: (registered) => set({ isRegistered: registered }),

      setPreferences: (prefs) => set({ preferences: prefs }),

      setIsLoadingPreferences: (loading) =>
        set({ isLoadingPreferences: loading }),

      setUnreadCounts: (counts) => set({ unreadCounts: counts }),

      setNotifications: (notifications) => set({ notifications }),

      appendNotifications: (newNotifications) =>
        set((state) => ({
          notifications: [...state.notifications, ...newNotifications],
        })),

      prependNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCounts: state.unreadCounts
            ? {
                ...state.unreadCounts,
                unread_count: state.unreadCounts.unread_count + 1,
              }
            : null,
        })),

      setIsLoadingNotifications: (loading) =>
        set({ isLoadingNotifications: loading }),

      setHasMoreNotifications: (hasMore) =>
        set({ hasMoreNotifications: hasMore }),

      setLastReceivedNotification: (notification) =>
        set({ lastReceivedNotification: notification }),

      markNotificationRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n,
          ),
          unreadCounts: state.unreadCounts
            ? {
                ...state.unreadCounts,
                unread_count: Math.max(0, state.unreadCounts.unread_count - 1),
              }
            : null,
        })),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            is_read: true,
            read_at: n.read_at || new Date().toISOString(),
          })),
          unreadCounts: state.unreadCounts
            ? {
                ...state.unreadCounts,
                unread_count: 0,
                whale_alerts: 0,
                kol_trades: 0,
                portfolio_alerts: 0,
                copy_trades: 0,
                security_alerts: 0,
              }
            : null,
        })),

      clearNotifications: () =>
        set({
          notifications: [],
          hasMoreNotifications: true,
        }),

      reset: () => set(initialState),
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist essential state
        expoPushToken: state.expoPushToken,
        isRegistered: state.isRegistered,
        // Don't persist notifications - they should be fetched fresh
      }),
    },
  ),
);

// Selector hooks for common use cases
export const useUnreadCount = () =>
  useNotificationStore((state) => state.unreadCounts?.unread_count ?? 0);

export const useNotificationPreferences = () =>
  useNotificationStore((state) => state.preferences);

export const useIsNotificationsEnabled = () =>
  useNotificationStore(
    (state) => state.preferences?.notifications_enabled ?? true,
  );
