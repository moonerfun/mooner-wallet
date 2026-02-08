/**
 * useNotifications Hook
 * Manages push notification registration, listeners, and state
 */

import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  deactivatePushToken,
  getNotificationPreferences,
  getUnreadCounts,
  parseNotificationData,
  registerForPushNotifications,
  savePushToken,
  savePushTokenForWallets,
  walletHasPushToken,
} from "@/lib/services/notificationService";
import {
  type NotificationData,
  type NotificationPreferences,
  type UnreadNotificationCounts,
} from "@/types/notifications";
import { logger } from "@/utils/logger";

interface UseNotificationsOptions {
  walletAddress: string | null;
  /** Optional: All wallet addresses to register for notifications (for multi-wallet support) */
  allWalletAddresses?: string[];
  userId?: string;
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationPressed?: (data: NotificationData) => void;
}

interface UseNotificationsResult {
  // Push token
  expoPushToken: string | null;
  isRegistered: boolean;
  isRegistering: boolean;

  // Permissions
  permissionStatus: Notifications.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
  /** Request permission with user-friendly prompt - opens settings if previously denied */
  requestPermissionWithPrompt: () => Promise<boolean>;

  // Preferences
  preferences: NotificationPreferences | null;
  isLoadingPreferences: boolean;
  refreshPreferences: () => Promise<void>;

  // Unread counts
  unreadCounts: UnreadNotificationCounts | null;
  refreshUnreadCounts: () => Promise<void>;

  // Last received notification
  lastNotification: Notifications.Notification | null;

  // Actions
  deactivateToken: () => Promise<void>;
}

export function useNotifications({
  walletAddress,
  allWalletAddresses,
  userId,
  onNotificationReceived,
  onNotificationPressed,
}: UseNotificationsOptions): UseNotificationsResult {
  const router = useRouter();

  // State
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [unreadCounts, setUnreadCounts] =
    useState<UnreadNotificationCounts | null>(null);
  const [lastNotification, setLastNotification] =
    useState<Notifications.Notification | null>(null);

  // Refs for listeners
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Track if registration has been attempted this session to prevent loops
  const registrationAttemptedRef = useRef(false);

  // Register for push notifications
  // If allWalletAddresses is provided, register for all wallets
  const register = useCallback(async () => {
    logger.info(
      "useNotifications",
      `Register called - walletAddress: ${walletAddress}, isRegistering: ${isRegistering}`,
    );
    if (!walletAddress || isRegistering) return;

    setIsRegistering(true);
    try {
      logger.info(
        "useNotifications",
        "Calling registerForPushNotifications...",
      );
      const token = await registerForPushNotifications();
      logger.info(
        "useNotifications",
        `Got token: ${token ? token.substring(0, 30) + "..." : "null"}`,
      );
      if (token) {
        setExpoPushToken(token);

        let saved = false;

        // If we have multiple wallet addresses, register for all of them
        if (allWalletAddresses && allWalletAddresses.length > 0) {
          saved = await savePushTokenForWallets(
            allWalletAddresses,
            token,
            userId,
          );
          if (saved) {
            logger.info(
              "useNotifications",
              `Registered push notifications for ${allWalletAddresses.length} wallets`,
            );
          }
        } else {
          // Fall back to single wallet registration
          saved = await savePushToken(walletAddress, token, userId);
          if (saved) {
            logger.info(
              "useNotifications",
              "Successfully registered for push notifications",
            );
          }
        }

        setIsRegistered(saved);
      }
    } catch (error) {
      logger.error("useNotifications", "Error registering for push", error);
    } finally {
      setIsRegistering(false);
    }
  }, [walletAddress, allWalletAddresses, userId, isRegistering]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      return status === "granted";
    } catch (error) {
      logger.error("useNotifications", "Error requesting permission", error);
      return false;
    }
  }, []);

  // Request permission with user-friendly prompt - handles denied state by opening settings
  const requestPermissionWithPrompt =
    useCallback(async (): Promise<boolean> => {
      try {
        // First check current status
        const { status: currentStatus } =
          await Notifications.getPermissionsAsync();

        if (currentStatus === "granted") {
          setPermissionStatus(currentStatus);
          return true;
        }

        // If undetermined, request directly
        if (currentStatus === "undetermined") {
          const { status } = await Notifications.requestPermissionsAsync();
          setPermissionStatus(status);
          return status === "granted";
        }

        // If denied, we need to direct user to settings
        // On iOS, we can't re-request after denial, must open settings
        const { Alert, Linking, Platform } = require("react-native");

        return new Promise((resolve) => {
          Alert.alert(
            "Enable Notifications",
            "Push notifications are disabled. To receive alerts for whale trades, KOL activity, and portfolio updates, please enable notifications in your device settings.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Open Settings",
                onPress: async () => {
                  if (Platform.OS === "ios") {
                    await Linking.openURL("app-settings:");
                  } else {
                    await Linking.openSettings();
                  }
                  // Check status again after user returns (they may have enabled it)
                  // Note: This won't update immediately, user needs to return to app
                  resolve(false);
                },
              },
            ],
          );
        });
      } catch (error) {
        logger.error(
          "useNotifications",
          "Error requesting permission with prompt",
          error,
        );
        return false;
      }
    }, []);

  // Load preferences
  const refreshPreferences = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoadingPreferences(true);
    try {
      const prefs = await getNotificationPreferences(walletAddress);
      setPreferences(prefs);
    } catch (error) {
      logger.error("useNotifications", "Error loading preferences", error);
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [walletAddress]);

  // Load unread counts
  const refreshUnreadCounts = useCallback(async () => {
    if (!walletAddress) return;

    try {
      const counts = await getUnreadCounts(walletAddress);
      setUnreadCounts(counts);
    } catch (error) {
      logger.error("useNotifications", "Error loading unread counts", error);
    }
  }, [walletAddress]);

  // Deactivate token (on logout)
  const deactivateToken = useCallback(async () => {
    if (expoPushToken) {
      await deactivatePushToken(expoPushToken);
      setExpoPushToken(null);
      setIsRegistered(false);
    }
  }, [expoPushToken]);

  // Handle notification press - navigate to appropriate screen
  const handleNotificationPress = useCallback(
    (data: NotificationData) => {
      // Call custom handler if provided
      if (onNotificationPressed) {
        onNotificationPressed(data);
        return;
      }

      // Default navigation based on notification type
      switch (data.type) {
        case "whale_alert":
        case "kol_trade":
          if (data.kol_wallet || data.wallet_address) {
            // Navigate to KOL profile or transaction
            router.push({
              pathname: "/(main)/token/[address]" as any,
              params: { address: data.token_address || "" },
            });
          }
          break;

        case "kol_new_position":
        case "kol_tier_change":
          if (data.kol_wallet) {
            // Navigate to KOL profile
            // router.push(`/kol/${data.kol_wallet}`);
          }
          break;

        case "portfolio_alert":
        case "price_alert":
        case "pnl_alert":
          if (data.token_address) {
            router.push({
              pathname: "/(main)/token/[address]" as any,
              params: { address: data.token_address },
            });
          }
          break;

        case "copy_trade_executed":
        case "copy_trade_failed":
          // Navigate to copy trade history
          // router.push("/copy-trades");
          break;

        case "new_follower":
        case "new_copy_trader":
          // Navigate to followers list
          // router.push("/profile/followers");
          break;

        case "leaderboard":
          // Navigate to leaderboard
          router.push("/(main)/(tabs)" as any);
          break;

        default:
          // Navigate to notifications center
          // router.push("/notifications");
          break;
      }
    },
    [router, onNotificationPressed],
  );

  // Track if we've shown the permission prompt this session
  const hasShownPermissionPromptRef = useRef(false);

  // Check initial permission status and prompt for permission on app startup
  useEffect(() => {
    const checkAndRequestPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      logger.info(
        "useNotifications",
        `Initial permission status: ${status}, walletAddress: ${walletAddress}`,
      );
      setPermissionStatus(status);

      // If we have a wallet and permission is not granted, prompt the user
      // This runs on every app startup to remind users who haven't enabled notifications
      if (
        walletAddress &&
        status !== "granted" &&
        !hasShownPermissionPromptRef.current
      ) {
        hasShownPermissionPromptRef.current = true;

        if (status === "undetermined") {
          // First time - request permission directly (shows system dialog)
          logger.info(
            "useNotifications",
            "Permission undetermined, requesting...",
          );
          const { status: newStatus } =
            await Notifications.requestPermissionsAsync();
          logger.info(
            "useNotifications",
            `New permission status after request: ${newStatus}`,
          );
          setPermissionStatus(newStatus);
        } else if (status === "denied") {
          // Previously denied - show prompt to open settings
          logger.info(
            "useNotifications",
            "Permission denied, showing settings prompt...",
          );
          // Small delay to let the app fully load before showing alert
          setTimeout(() => {
            requestPermissionWithPrompt();
          }, 1500);
        }
      }
    };

    checkAndRequestPermission();
  }, [walletAddress, requestPermissionWithPrompt]);

  // Register when wallet address is available and permission granted
  // Uses a ref to prevent multiple registration attempts in a single session
  useEffect(() => {
    const checkAndRegister = async () => {
      // Skip if no wallet or permission not granted
      if (!walletAddress || permissionStatus !== "granted") {
        logger.info(
          "useNotifications",
          `Registration check - wallet: ${!!walletAddress}, permission: ${permissionStatus}, skipping`,
        );
        return;
      }

      // Skip if already registered or already attempted this session
      if (isRegistered || registrationAttemptedRef.current) {
        logger.info(
          "useNotifications",
          `Registration check - already registered: ${isRegistered}, attempted: ${registrationAttemptedRef.current}, skipping`,
        );
        return;
      }

      // Mark as attempted to prevent loops
      registrationAttemptedRef.current = true;

      // Check if wallet already has token in DB
      const hasToken = await walletHasPushToken(walletAddress);
      if (hasToken) {
        logger.info(
          "useNotifications",
          "Wallet already has push token in DB, marking as registered",
        );
        setIsRegistered(true);
        return;
      }

      logger.info("useNotifications", "Calling register()");
      register();
    };

    checkAndRegister();
  }, [walletAddress, permissionStatus]); // Removed isRegistered and register from deps to prevent loops

  // Load preferences when wallet changes
  useEffect(() => {
    if (walletAddress) {
      refreshPreferences();
      refreshUnreadCounts();
    } else {
      setPreferences(null);
      setUnreadCounts(null);
    }
  }, [walletAddress, refreshPreferences, refreshUnreadCounts]);

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setLastNotification(notification);

        // Refresh unread counts
        refreshUnreadCounts();

        // Call custom handler
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }

        logger.info(
          "useNotifications",
          `Notification received: ${notification.request.content.title}`,
        );
      });

    // Listener for when user taps on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = parseNotificationData(response.notification);
        if (data) {
          handleNotificationPress(data);
        }

        logger.info("useNotifications", "Notification tapped");
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [onNotificationReceived, handleNotificationPress, refreshUnreadCounts]);

  return {
    expoPushToken,
    isRegistered,
    isRegistering,
    permissionStatus,
    requestPermission,
    requestPermissionWithPrompt,
    preferences,
    isLoadingPreferences,
    refreshPreferences,
    unreadCounts,
    refreshUnreadCounts,
    lastNotification,
    deactivateToken,
  };
}

/**
 * Hook to subscribe to real-time notification updates
 */
export function useNotificationSubscription(walletAddress: string | null) {
  const [newNotification, setNewNotification] = useState<any>(null);

  useEffect(() => {
    if (!walletAddress) return;

    // Subscribe to real-time notifications from Supabase
    const { supabase } = require("@/lib/api/supabase/supabaseClient");

    const subscription = supabase
      .channel(`notifications:${walletAddress}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload: any) => {
          setNewNotification(payload.new);
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletAddress]);

  return { newNotification };
}
