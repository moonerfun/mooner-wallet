/**
 * Notification Service
 * Handles push notification registration, permissions, and Supabase sync
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/api/supabase/supabaseClient";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CHANNELS,
  type Notification,
  type NotificationChannel,
  type NotificationData,
  type NotificationPreferences,
  type UnreadNotificationCounts,
} from "@/types/notifications";
import { logger } from "@/utils/logger";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    logger.warn(
      "NotificationService",
      "Push notifications require a physical device",
    );
    return null;
  }

  try {
    // Check existing permission status
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.warn(
        "NotificationService",
        "Permission not granted for push notifications",
      );
      return null;
    }

    // Get the Expo project ID
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      logger.error(
        "NotificationService",
        "No Expo project ID found. Make sure EAS is configured.",
      );
      return null;
    }

    // Get the push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    logger.info(
      "NotificationService",
      `Push token obtained: ${tokenData.data.substring(0, 30)}...`,
    );

    // Set up Android notification channels
    if (Platform.OS === "android") {
      await setupAndroidChannels();
    }

    return tokenData.data;
  } catch (error) {
    logger.error("NotificationService", "Error registering for push", error);
    return null;
  }
}

/**
 * Set up Android notification channels
 */
async function setupAndroidChannels(): Promise<void> {
  const channelEntries = Object.entries(NOTIFICATION_CHANNELS) as [
    NotificationChannel,
    (typeof NOTIFICATION_CHANNELS)[NotificationChannel],
  ][];

  for (const [channelId, config] of channelEntries) {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: config.name,
      description: config.description,
      importance:
        config.importance === "max"
          ? Notifications.AndroidImportance.MAX
          : config.importance === "high"
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
      sound: config.sound ? "default" : undefined,
      vibrationPattern: config.vibration ? [0, 250, 250, 250] : undefined,
      lightColor: "#6366F1",
    });
  }

  logger.info("NotificationService", "Android notification channels set up");
}

/**
 * Save push token to Supabase
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function savePushToken(
  walletAddress: string,
  expoPushToken: string,
  userId?: string,
): Promise<boolean> {
  try {
    const deviceInfo = {
      device_id: Device.deviceName || Device.modelName || "unknown",
      device_name: Device.deviceName || undefined,
      platform: Platform.OS as "ios" | "android",
      app_version: Constants.expoConfig?.version || "1.0.0",
    };

    // Try RPC function first (bypasses RLS)
    const { error: rpcError } = await supabase.rpc("save_push_token_rpc", {
      p_wallet_address: walletAddress,
      p_expo_push_token: expoPushToken,
      p_device_id: deviceInfo.device_id,
      p_device_name: deviceInfo.device_name || null,
      p_platform: deviceInfo.platform,
      p_app_version: deviceInfo.app_version,
      p_user_id: userId || null,
    });

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC save failed, trying direct upsert",
        rpcError,
      );
      // Fall back to direct upsert
      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: userId || null,
          wallet_address: walletAddress,
          expo_push_token: expoPushToken,
          ...deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "expo_push_token",
        },
      );

      if (error) {
        logger.error("NotificationService", "Error saving push token", error);
        return false;
      }
    }

    logger.info("NotificationService", "Push token saved to Supabase");
    return true;
  } catch (error) {
    logger.error("NotificationService", "Error saving push token", error);
    return false;
  }
}

/**
 * Save push token for multiple wallet addresses
 * This ensures the user receives notifications for all their wallets
 * Each wallet gets its own row in push_tokens table
 */
export async function savePushTokenForWallets(
  walletAddresses: string[],
  expoPushToken: string,
  userId?: string,
): Promise<boolean> {
  if (!walletAddresses.length) {
    logger.warn("NotificationService", "No wallet addresses provided for push token registration");
    return false;
  }

  try {
    const deviceInfo = {
      device_id: Device.deviceName || Device.modelName || "unknown",
      device_name: Device.deviceName || undefined,
      platform: Platform.OS as "ios" | "android",
      app_version: Constants.expoConfig?.version || "1.0.0",
    };

    // Deduplicate wallet addresses
    const uniqueWallets = [...new Set(walletAddresses)];

    // Register token for each wallet
    const results = await Promise.all(
      uniqueWallets.map(async (walletAddress) => {
        try {
          // Use composite conflict key: wallet_address + expo_push_token
          const { error } = await supabase.from("push_tokens").upsert(
            {
              user_id: userId || null,
              wallet_address: walletAddress,
              expo_push_token: expoPushToken,
              ...deviceInfo,
              is_active: true,
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              // This requires a unique constraint on (wallet_address, expo_push_token)
              // If it doesn't exist, we'll try inserting individually
              onConflict: "wallet_address,expo_push_token",
              ignoreDuplicates: false,
            },
          );

          if (error) {
            // If conflict key doesn't exist, try with just expo_push_token
            // This will update the existing record's wallet_address
            logger.warn(
              "NotificationService",
              `Multi-wallet upsert failed for ${walletAddress}, trying single save`,
              error,
            );
            return await savePushToken(walletAddress, expoPushToken, userId);
          }
          return true;
        } catch (e) {
          logger.error(
            "NotificationService",
            `Error saving token for wallet ${walletAddress}`,
            e,
          );
          return false;
        }
      }),
    );

    const successCount = results.filter(Boolean).length;
    logger.info(
      "NotificationService",
      `Push token registered for ${successCount}/${uniqueWallets.length} wallets`,
    );

    return successCount > 0;
  } catch (error) {
    logger.error("NotificationService", "Error saving push tokens for wallets", error);
    return false;
  }
}

/**
 * Deactivate push token (on logout)
 */
export async function deactivatePushToken(
  expoPushToken: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("expo_push_token", expoPushToken);

    if (error) {
      logger.error(
        "NotificationService",
        "Error deactivating push token",
        error,
      );
      return false;
    }

    logger.info("NotificationService", "Push token deactivated");
    return true;
  } catch (error) {
    logger.error("NotificationService", "Error deactivating push token", error);
    return false;
  }
}

/**
 * Check if a wallet has an active push token registered
 */
export async function walletHasPushToken(
  walletAddress: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("push_tokens")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      logger.error("NotificationService", "Error checking push token", error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    logger.error("NotificationService", "Error checking push token", error);
    return false;
  }
}

/**
 * Get or create notification preferences for a wallet
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function getNotificationPreferences(
  walletAddress: string,
): Promise<NotificationPreferences | null> {
  try {
    // Use RPC function that handles get-or-create atomically
    const { data, error } = await supabase.rpc(
      "get_or_create_notification_preferences",
      { p_wallet_address: walletAddress },
    );

    if (error) {
      logger.error(
        "NotificationService",
        "Error fetching notification preferences via RPC",
        error,
      );
      // Fall back to direct query (may work if RLS policies are updated)
      return await getNotificationPreferencesFallback(walletAddress);
    }

    return data as NotificationPreferences;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error fetching notification preferences",
      error,
    );
    return null;
  }
}

/**
 * Fallback: Get or create notification preferences using direct table access
 */
async function getNotificationPreferencesFallback(
  walletAddress: string,
): Promise<NotificationPreferences | null> {
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.error(
        "NotificationService",
        "Error fetching notification preferences (fallback)",
        error,
      );
      return null;
    }

    if (!data) {
      // Create default preferences
      return await createDefaultPreferences(walletAddress);
    }

    return data as NotificationPreferences;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error fetching notification preferences (fallback)",
      error,
    );
    return null;
  }
}

/**
 * Create default notification preferences
 */
async function createDefaultPreferences(
  walletAddress: string,
): Promise<NotificationPreferences | null> {
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .insert({
        wallet_address: walletAddress,
        ...DEFAULT_NOTIFICATION_PREFERENCES,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        "NotificationService",
        "Error creating default preferences",
        error,
      );
      return null;
    }

    return data as NotificationPreferences;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error creating default preferences",
      error,
    );
    return null;
  }
}

/**
 * Update notification preferences
 * Uses RPC function for reliable updates with RLS bypass
 */
export async function updateNotificationPreferences(
  walletAddress: string,
  updates: Partial<NotificationPreferences>,
): Promise<boolean> {
  try {
    // Try RPC function first
    const { error: rpcError } = await supabase.rpc(
      "update_notification_preferences_rpc",
      {
        p_wallet_address: walletAddress,
        p_updates: updates,
      },
    );

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC update failed, trying direct update",
        rpcError,
      );
      // Fall back to direct update
      const { error } = await supabase
        .from("notification_preferences")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", walletAddress);

      if (error) {
        logger.error(
          "NotificationService",
          "Error updating notification preferences",
          error,
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error updating notification preferences",
      error,
    );
    return false;
  }
}

/**
 * Get notifications for a wallet
 */
export async function getNotifications(
  walletAddress: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {},
): Promise<Notification[]> {
  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false });

    if (options.unreadOnly) {
      query = query.eq("is_read", false);
    }

    if (options.type) {
      query = query.eq("type", options.type);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 20) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        "NotificationService",
        "Error fetching notifications",
        error,
      );
      return [];
    }

    return (data || []) as Notification[];
  } catch (error) {
    logger.error("NotificationService", "Error fetching notifications", error);
    return [];
  }
}

/**
 * Get unread notification counts
 */
export async function getUnreadCounts(
  walletAddress: string,
): Promise<UnreadNotificationCounts | null> {
  try {
    const { data, error } = await supabase
      .from("unread_notification_counts")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error(
        "NotificationService",
        "Error fetching unread counts",
        error,
      );
      return null;
    }

    return (
      (data as UnreadNotificationCounts) || {
        wallet_address: walletAddress,
        unread_count: 0,
        whale_alerts: 0,
        kol_trades: 0,
        portfolio_alerts: 0,
        copy_trades: 0,
        security_alerts: 0,
      }
    );
  } catch (error) {
    logger.error("NotificationService", "Error fetching unread counts", error);
    return null;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (error) {
      logger.error(
        "NotificationService",
        "Error marking notification as read",
        error,
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error marking notification as read",
      error,
    );
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(
  walletAddress: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("wallet_address", walletAddress)
      .eq("is_read", false);

    if (error) {
      logger.error(
        "NotificationService",
        "Error marking all notifications as read",
        error,
      );
      return false;
    }

    // Clear badge count
    await Notifications.setBadgeCountAsync(0);

    return true;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error marking all notifications as read",
      error,
    );
    return false;
  }
}

/**
 * Follow a KOL for notifications
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function followKol(
  followerWalletAddress: string,
  kolWalletAddress: string,
  options: {
    notify_on_trade?: boolean;
    notify_on_new_position?: boolean;
    notify_on_large_trade?: boolean;
    large_trade_threshold?: number;
  } = {},
): Promise<boolean> {
  try {
    // Validate inputs
    if (!followerWalletAddress || !kolWalletAddress) {
      logger.warn(
        "NotificationService",
        "Cannot follow KOL: missing wallet address",
        { followerWalletAddress, kolWalletAddress },
      );
      return false;
    }

    // Cannot follow yourself
    if (followerWalletAddress === kolWalletAddress) {
      logger.warn("NotificationService", "Cannot follow yourself");
      return false;
    }

    // Try RPC function first (bypasses RLS)
    const { data, error: rpcError } = await supabase.rpc("follow_kol_rpc", {
      p_follower_wallet_address: followerWalletAddress,
      p_kol_wallet_address: kolWalletAddress,
      p_notify_on_trade: options.notify_on_trade ?? true,
      p_notify_on_new_position: options.notify_on_new_position ?? true,
      p_notify_on_large_trade: options.notify_on_large_trade ?? true,
      p_large_trade_threshold: options.large_trade_threshold ?? 5000,
    });

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC follow failed, trying direct upsert",
        rpcError,
      );
      
      // Fall back to direct upsert
      const { error } = await supabase.from("kol_follows").upsert(
        {
          follower_wallet_address: followerWalletAddress,
          kol_wallet_address: kolWalletAddress,
          notify_on_trade: options.notify_on_trade ?? true,
          notify_on_new_position: options.notify_on_new_position ?? true,
          notify_on_large_trade: options.notify_on_large_trade ?? true,
          large_trade_threshold: options.large_trade_threshold ?? 5000,
        },
        {
          onConflict: "follower_wallet_address,kol_wallet_address",
        },
      );

      if (error) {
        logger.error("NotificationService", "Error following KOL", error);
        return false;
      }
    }

    logger.info(
      "NotificationService",
      `Now following KOL: ${kolWalletAddress}`,
    );
    return true;
  } catch (error) {
    logger.error("NotificationService", "Error following KOL", error);
    return false;
  }
}

/**
 * Unfollow a KOL
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function unfollowKol(
  followerWalletAddress: string,
  kolWalletAddress: string,
): Promise<boolean> {
  try {
    // Validate inputs
    if (!followerWalletAddress || !kolWalletAddress) {
      logger.warn(
        "NotificationService",
        "Cannot unfollow KOL: missing wallet address",
        { followerWalletAddress, kolWalletAddress },
      );
      return false;
    }

    // Try RPC function first (bypasses RLS)
    const { data, error: rpcError } = await supabase.rpc("unfollow_kol_rpc", {
      p_follower_wallet_address: followerWalletAddress,
      p_kol_wallet_address: kolWalletAddress,
    });

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC unfollow failed, trying direct delete",
        rpcError,
      );
      
      // Fall back to direct delete
      const { error } = await supabase
        .from("kol_follows")
        .delete()
        .eq("follower_wallet_address", followerWalletAddress)
        .eq("kol_wallet_address", kolWalletAddress);

      if (error) {
        logger.error("NotificationService", "Error unfollowing KOL", error);
        return false;
      }
    }

    logger.info("NotificationService", `Unfollowed KOL: ${kolWalletAddress}`);
    return true;
  } catch (error) {
    logger.error("NotificationService", "Error unfollowing KOL", error);
    return false;
  }
}

/**
 * Check if following a KOL
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function isFollowingKol(
  followerWalletAddress: string,
  kolWalletAddress: string,
): Promise<boolean> {
  try {
    // Validate inputs
    if (!followerWalletAddress || !kolWalletAddress) {
      return false;
    }

    // Try RPC function first (bypasses RLS)
    const { data, error: rpcError } = await supabase.rpc("is_following_kol_rpc", {
      p_follower_wallet_address: followerWalletAddress,
      p_kol_wallet_address: kolWalletAddress,
    });

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC isFollowing check failed, trying direct query",
        rpcError,
      );
      
      // Fall back to direct query
      const { data: directData, error } = await supabase
        .from("kol_follows")
        .select("id")
        .eq("follower_wallet_address", followerWalletAddress)
        .eq("kol_wallet_address", kolWalletAddress)
        .single();

      if (error && error.code !== "PGRST116") {
        logger.error(
          "NotificationService",
          "Error checking KOL follow status",
          error,
        );
        return false;
      }

      return !!directData;
    }

    return data === true;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error checking KOL follow status",
      error,
    );
    return false;
  }
}

/**
 * Get list of followed KOLs
 * Uses RPC function to bypass RLS issues with anonymous auth
 */
export async function getFollowedKols(
  walletAddress: string,
): Promise<string[]> {
  try {
    // Validate input
    if (!walletAddress) {
      return [];
    }

    // Try RPC function first (bypasses RLS)
    const { data, error: rpcError } = await supabase.rpc("get_followed_kols_rpc", {
      p_follower_wallet_address: walletAddress,
    });

    if (rpcError) {
      logger.warn(
        "NotificationService",
        "RPC getFollowedKols failed, trying direct query",
        rpcError,
      );
      
      // Fall back to direct query
      const { data: directData, error } = await supabase
        .from("kol_follows")
        .select("kol_wallet_address")
        .eq("follower_wallet_address", walletAddress);

      if (error) {
        logger.error(
          "NotificationService",
          "Error fetching followed KOLs",
          error,
        );
        return [];
      }

      return (directData || []).map((d) => d.kol_wallet_address);
    }

    return data || [];
  } catch (error) {
    logger.error("NotificationService", "Error fetching followed KOLs", error);
    return [];
  }
}

/**
 * Get followed KOLs with their user IDs (for syncing local state)
 * Joins kol_follows with user_wallets to map wallet -> user_id
 */
export async function getFollowedKolsWithUserIds(
  walletAddress: string,
): Promise<{ kolWalletAddress: string; kolUserId: string | null }[]> {
  try {
    if (!walletAddress) {
      return [];
    }

    // Query kol_follows and join with user_wallets to get user_id
    const { data, error } = await supabase
      .from("kol_follows")
      .select(`
        kol_wallet_address,
        kol_user_id
      `)
      .eq("follower_wallet_address", walletAddress);

    if (error) {
      logger.error(
        "NotificationService",
        "Error fetching followed KOLs with IDs",
        error,
      );
      
      // Fallback: try to match via user_wallets table
      const { data: followData, error: followError } = await supabase
        .from("kol_follows")
        .select("kol_wallet_address")
        .eq("follower_wallet_address", walletAddress);

      if (followError || !followData) {
        return [];
      }

      // Get user IDs for these wallets
      const walletAddresses = followData.map((f) => f.kol_wallet_address);
      const { data: walletData } = await supabase
        .from("user_wallets")
        .select("wallet_address, user_id")
        .in("wallet_address", walletAddresses);

      const walletToUserId = new Map(
        (walletData || []).map((w) => [w.wallet_address, w.user_id])
      );

      return followData.map((f) => ({
        kolWalletAddress: f.kol_wallet_address,
        kolUserId: walletToUserId.get(f.kol_wallet_address) || null,
      }));
    }

    return (data || []).map((d) => ({
      kolWalletAddress: d.kol_wallet_address,
      kolUserId: d.kol_user_id,
    }));
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error fetching followed KOLs with IDs",
      error,
    );
    return [];
  }
}

/**
 * Handle notification response (when user taps on notification)
 */
export function parseNotificationData(
  notification: Notifications.Notification,
): NotificationData | null {
  try {
    const data = notification.request.content
      .data as unknown as NotificationData;
    return data?.type ? data : null;
  } catch {
    return null;
  }
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  delaySeconds: number = 1,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as unknown as Record<string, unknown>,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });

    return id;
  } catch (error) {
    logger.error(
      "NotificationService",
      "Error scheduling local notification",
      error,
    );
    return null;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get current badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
