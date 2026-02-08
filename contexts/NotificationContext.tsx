/**
 * Notification Provider
 * Wraps the app to handle push notification registration and listeners
 */

import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useNotifications } from "@/hooks";
import {
  followKol,
  getFollowedKols,
  getFollowedKolsWithUserIds,
  getNotifications,
  isFollowingKol,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  unfollowKol,
  updateNotificationPreferences,
} from "@/lib/services/notificationService";
import { useKolStore } from "@/store/kolStore";
import { useNotificationStore } from "@/store/notificationStore";
import type {
  Notification,
  NotificationPreferences,
} from "@/types/notifications";
import { logger } from "@/utils/logger";

interface NotificationContextType {
  // Push token status
  expoPushToken: string | null;
  isRegistered: boolean;
  isRegistering: boolean;
  permissionStatus: Notifications.PermissionStatus | null;

  // Actions
  requestPermission: () => Promise<boolean>;
  /** Request permission with user-friendly prompt - opens settings if previously denied */
  requestPermissionWithPrompt: () => Promise<boolean>;

  // Preferences
  preferences: NotificationPreferences | null;
  isLoadingPreferences: boolean;
  updatePreferences: (
    updates: Partial<NotificationPreferences>,
  ) => Promise<boolean>;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  isLoadingNotifications: boolean;
  hasMoreNotifications: boolean;
  loadNotifications: (options?: { refresh?: boolean }) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;

  // KOL following
  followKolForNotifications: (
    kolWalletAddress: string,
    options?: {
      notify_on_trade?: boolean;
      notify_on_new_position?: boolean;
    },
  ) => Promise<boolean>;
  unfollowKolForNotifications: (kolWalletAddress: string) => Promise<boolean>;
  isFollowingKolWallet: (kolWalletAddress: string) => Promise<boolean>;
  getFollowedKolWallets: () => Promise<string[]>;

  // Sync follows from database
  syncFollowsFromDatabase: () => Promise<void>;
  isSyncingFollows: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

interface NotificationProviderProps {
  children: React.ReactNode;
  walletAddress: string | null;
  /** All wallet addresses for multi-wallet notification support */
  allWalletAddresses?: string[];
  userId?: string;
}

export function NotificationProvider({
  children,
  walletAddress,
  allWalletAddresses,
  userId,
}: NotificationProviderProps) {
  // Store
  const store = useNotificationStore();
  const { leaderboard, setFollowingIds } = useKolStore();

  // Sync state
  const [isSyncingFollows, setIsSyncingFollows] = useState(false);

  // Use the notifications hook for registration and listeners
  const {
    expoPushToken,
    isRegistered,
    isRegistering,
    permissionStatus,
    requestPermission,
    requestPermissionWithPrompt,
    preferences,
    isLoadingPreferences,
    unreadCounts,
    refreshUnreadCounts,
    lastNotification,
  } = useNotifications({
    walletAddress,
    allWalletAddresses,
    userId,
    onNotificationReceived: (notification) => {
      // A notification was received while app is in foreground
      logger.info(
        "NotificationProvider",
        `Received: ${notification.request.content.title}`,
      );
    },
    onNotificationPressed: (data) => {
      // User tapped on a notification - navigation is handled in the hook
      logger.info("NotificationProvider", `Pressed: ${data.type}`);
    },
  });

  // Sync state to store
  useEffect(() => {
    store.setExpoPushToken(expoPushToken);
    store.setIsRegistered(isRegistered);
  }, [expoPushToken, isRegistered]);

  useEffect(() => {
    store.setPreferences(preferences);
    store.setIsLoadingPreferences(isLoadingPreferences);
  }, [preferences, isLoadingPreferences]);

  useEffect(() => {
    store.setUnreadCounts(unreadCounts);
  }, [unreadCounts]);

  // Load notifications
  const loadNotifications = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!walletAddress) return;

      const { refresh = false } = options || {};

      store.setIsLoadingNotifications(true);
      try {
        const offset = refresh ? 0 : store.notifications.length;
        const limit = 20;

        const notifications = await getNotifications(walletAddress, {
          limit,
          offset,
        });

        if (refresh) {
          store.setNotifications(notifications);
        } else {
          store.appendNotifications(notifications);
        }

        store.setHasMoreNotifications(notifications.length === limit);
      } catch (error) {
        logger.error(
          "NotificationProvider",
          "Error loading notifications",
          error,
        );
      } finally {
        store.setIsLoadingNotifications(false);
      }
    },
    [walletAddress, store.notifications.length],
  );

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      store.markNotificationRead(notificationId);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!walletAddress) return;

    const success = await markAllNotificationsAsRead(walletAddress);
    if (success) {
      store.markAllRead();
    }
  }, [walletAddress]);

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
      if (!walletAddress) {
        logger.warn(
          "NotificationProvider",
          "Cannot update preferences: no wallet address",
        );
        return false;
      }

      logger.info(
        "NotificationProvider",
        `Updating preferences for ${walletAddress}`,
        updates,
      );

      const success = await updateNotificationPreferences(
        walletAddress,
        updates,
      );

      logger.info("NotificationProvider", `Update result: ${success}`);

      if (success && preferences) {
        store.setPreferences({
          ...preferences,
          ...updates,
        } as NotificationPreferences);
      }
      return success;
    },
    [walletAddress, preferences],
  );

  // Follow KOL for notifications
  const followKolForNotifications = useCallback(
    async (
      kolWalletAddress: string,
      options?: {
        notify_on_trade?: boolean;
        notify_on_new_position?: boolean;
      },
    ): Promise<boolean> => {
      if (!walletAddress) return false;
      return followKol(walletAddress, kolWalletAddress, options);
    },
    [walletAddress],
  );

  // Unfollow KOL
  const unfollowKolForNotifications = useCallback(
    async (kolWalletAddress: string): Promise<boolean> => {
      if (!walletAddress) return false;
      return unfollowKol(walletAddress, kolWalletAddress);
    },
    [walletAddress],
  );

  // Check if following KOL
  const isFollowingKolWallet = useCallback(
    async (kolWalletAddress: string): Promise<boolean> => {
      if (!walletAddress) return false;
      return isFollowingKol(walletAddress, kolWalletAddress);
    },
    [walletAddress],
  );

  // Get followed KOLs
  const getFollowedKolWallets = useCallback(async (): Promise<string[]> => {
    if (!walletAddress) return [];
    return getFollowedKols(walletAddress);
  }, [walletAddress]);

  // Sync follows from database to local state
  // Maps kol_wallet_address -> user_id using leaderboard data or user_wallets
  const syncFollowsFromDatabase = useCallback(async () => {
    if (!walletAddress) {
      setFollowingIds([]);
      return;
    }

    setIsSyncingFollows(true);
    try {
      // Get follows from database with user IDs
      const follows = await getFollowedKolsWithUserIds(walletAddress);

      if (follows.length === 0) {
        logger.info("NotificationProvider", "No follows found in database");
        setFollowingIds([]);
        return;
      }

      // Build wallet -> userId map from leaderboard
      const walletToUserIdMap = new Map<string, string>();
      for (const kol of leaderboard) {
        if (kol.primary_evm_wallet) {
          walletToUserIdMap.set(kol.primary_evm_wallet, kol.id);
        }
        if (kol.primary_solana_wallet) {
          walletToUserIdMap.set(kol.primary_solana_wallet, kol.id);
        }
      }

      // Map follows to user IDs
      const userIds: string[] = [];
      for (const follow of follows) {
        // First try kol_user_id from database
        if (follow.kolUserId) {
          userIds.push(follow.kolUserId);
        } else {
          // Fall back to leaderboard mapping
          const userId = walletToUserIdMap.get(follow.kolWalletAddress);
          if (userId) {
            userIds.push(userId);
          } else {
            logger.warn(
              "NotificationProvider",
              `Could not map wallet to user ID: ${follow.kolWalletAddress.slice(0, 8)}...`,
            );
          }
        }
      }

      logger.info(
        "NotificationProvider",
        `Synced ${userIds.length} follows from database`,
      );
      setFollowingIds(userIds);
    } catch (error) {
      logger.error(
        "NotificationProvider",
        "Error syncing follows from database",
        error,
      );
    } finally {
      setIsSyncingFollows(false);
    }
  }, [walletAddress, leaderboard, setFollowingIds]);

  // Load initial notifications and sync follows when wallet changes
  useEffect(() => {
    if (walletAddress) {
      loadNotifications({ refresh: true });
      // Sync follows from database
      syncFollowsFromDatabase();
    } else {
      store.clearNotifications();
      setFollowingIds([]);
    }
  }, [walletAddress]);

  // Re-sync when leaderboard loads (to map wallets that weren't available before)
  useEffect(() => {
    if (walletAddress && leaderboard.length > 0 && !isSyncingFollows) {
      // Only re-sync if we have a wallet and leaderboard just loaded
      syncFollowsFromDatabase();
    }
  }, [leaderboard.length > 0]); // Only trigger when leaderboard becomes available

  const value: NotificationContextType = {
    expoPushToken,
    isRegistered,
    isRegistering,
    permissionStatus,
    requestPermission,
    requestPermissionWithPrompt,
    preferences,
    isLoadingPreferences,
    updatePreferences,
    notifications: store.notifications,
    unreadCount: store.unreadCounts?.unread_count ?? 0,
    isLoadingNotifications: store.isLoadingNotifications,
    hasMoreNotifications: store.hasMoreNotifications,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    followKolForNotifications,
    unfollowKolForNotifications,
    isFollowingKolWallet,
    getFollowedKolWallets,
    syncFollowsFromDatabase,
    isSyncingFollows,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider",
    );
  }
  return context;
}

// Export a hook that can be used when context might not be available
export function useNotificationContextOptional() {
  return useContext(NotificationContext);
}
