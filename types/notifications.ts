/**
 * Notification Types
 * Type definitions for push notifications system
 */

// Notification types that can be sent
export type NotificationType =
  | "whale_alert"
  | "kol_trade"
  | "kol_new_position"
  | "kol_tier_change"
  | "portfolio_alert"
  | "price_alert"
  | "pnl_alert"
  | "copy_trade_executed"
  | "copy_trade_failed"
  | "new_follower"
  | "new_copy_trader"
  | "leaderboard"
  | "trending_token"
  | "new_listing"
  | "security"
  | "system";

// Notification categories for Android channels
export type NotificationChannel =
  | "default"
  | "trades"
  | "kol"
  | "portfolio"
  | "social"
  | "security";

// Push token stored in database
export interface PushToken {
  id: string;
  user_id: string | null;
  wallet_address: string;
  expo_push_token: string;
  device_id: string | null;
  device_name: string | null;
  platform: "ios" | "android";
  app_version: string | null;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

// User notification preferences
export interface NotificationPreferences {
  id: string;
  user_id: string | null;
  wallet_address: string;

  // Master toggle
  notifications_enabled: boolean;

  // Whale alerts
  whale_alerts_enabled: boolean;
  whale_alert_threshold: number;

  // KOL activity
  kol_activity_enabled: boolean;
  kol_trade_notifications: boolean;
  kol_new_position_notifications: boolean;
  kol_tier_change_notifications: boolean;

  // Portfolio alerts
  portfolio_alerts_enabled: boolean;
  price_change_threshold: number;
  pnl_alerts_enabled: boolean;

  // Copy trading
  copy_trade_enabled: boolean;
  copy_trade_executed: boolean;
  copy_trade_failed: boolean;

  // Social
  new_follower_notifications: boolean;
  new_copy_trader_notifications: boolean;
  leaderboard_notifications: boolean;

  // Market alerts
  trending_token_alerts: boolean;
  new_listing_alerts: boolean;

  // Security (always on)
  security_notifications: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;

  created_at: string;
  updated_at: string;
}

// Notification record from database
export interface Notification {
  id: string;
  user_id: string | null;
  wallet_address: string;
  type: NotificationType;
  category: string | null;
  title: string;
  body: string;
  image_url: string | null;
  data: NotificationData;
  status: "pending" | "sent" | "delivered" | "failed" | "clicked";
  expo_receipt_id: string | null;
  error_message: string | null;
  is_read: boolean;
  read_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

// Data payload for notifications (for deep linking)
export interface NotificationData {
  type: NotificationType;
  // Whale alert data
  trade_id?: string;
  wallet_address?: string;
  trader_username?: string;
  trade_type?: "buy" | "sell" | "swap";
  token_symbol?: string;
  token_address?: string;
  usd_value?: number;
  tx_hash?: string;
  chain?: string;
  // KOL data
  kol_wallet?: string;
  kol_username?: string;
  kol_user_id?: string;
  // Portfolio data
  position_id?: string;
  price_change_percent?: number;
  pnl_usd?: number;
  // Copy trade data
  copy_trade_id?: string;
  error_reason?: string;
  // Navigation
  screen?: string;
  params?: Record<string, string>;
}

// KOL follow relationship
export interface KolFollow {
  id: string;
  follower_user_id: string | null;
  follower_wallet_address: string;
  kol_user_id: string | null;
  kol_wallet_address: string;
  notify_on_trade: boolean;
  notify_on_new_position: boolean;
  notify_on_large_trade: boolean;
  large_trade_threshold: number;
  copy_trade_enabled: boolean;
  copy_trade_percentage: number;
  copy_trade_max_amount: number | null;
  created_at: string;
  updated_at: string;
}

// Unread counts view
export interface UnreadNotificationCounts {
  wallet_address: string;
  unread_count: number;
  whale_alerts: number;
  kol_trades: number;
  portfolio_alerts: number;
  copy_trades: number;
  security_alerts: number;
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferences,
  "id" | "user_id" | "wallet_address" | "created_at" | "updated_at"
> = {
  notifications_enabled: true,
  whale_alerts_enabled: true,
  whale_alert_threshold: 1000,
  kol_activity_enabled: true,
  kol_trade_notifications: true,
  kol_new_position_notifications: true,
  kol_tier_change_notifications: true,
  portfolio_alerts_enabled: true,
  price_change_threshold: 10,
  pnl_alerts_enabled: true,
  copy_trade_enabled: true,
  copy_trade_executed: true,
  copy_trade_failed: true,
  new_follower_notifications: true,
  new_copy_trader_notifications: true,
  leaderboard_notifications: true,
  trending_token_alerts: false,
  new_listing_alerts: false,
  security_notifications: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  quiet_hours_timezone: "UTC",
};

// Notification channel configurations for Android
export const NOTIFICATION_CHANNELS: Record<
  NotificationChannel,
  {
    name: string;
    description: string;
    importance: "default" | "high" | "max";
    sound: boolean;
    vibration: boolean;
  }
> = {
  default: {
    name: "General",
    description: "General notifications",
    importance: "default",
    sound: true,
    vibration: true,
  },
  trades: {
    name: "Trade Alerts",
    description: "Whale alerts and large trades",
    importance: "high",
    sound: true,
    vibration: true,
  },
  kol: {
    name: "KOL Activity",
    description: "Notifications from KOLs you follow",
    importance: "high",
    sound: true,
    vibration: true,
  },
  portfolio: {
    name: "Portfolio",
    description: "Price alerts and PnL notifications",
    importance: "high",
    sound: true,
    vibration: true,
  },
  social: {
    name: "Social",
    description: "Followers and social updates",
    importance: "default",
    sound: true,
    vibration: false,
  },
  security: {
    name: "Security",
    description: "Security alerts and warnings",
    importance: "max",
    sound: true,
    vibration: true,
  },
};

// Map notification type to channel
export function getChannelForType(type: NotificationType): NotificationChannel {
  switch (type) {
    case "whale_alert":
      return "trades";
    case "kol_trade":
    case "kol_new_position":
    case "kol_tier_change":
      return "kol";
    case "portfolio_alert":
    case "price_alert":
    case "pnl_alert":
      return "portfolio";
    case "copy_trade_executed":
    case "copy_trade_failed":
      return "trades";
    case "new_follower":
    case "new_copy_trader":
    case "leaderboard":
      return "social";
    case "security":
      return "security";
    default:
      return "default";
  }
}
