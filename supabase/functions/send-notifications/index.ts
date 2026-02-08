// Supabase Edge Function: send-notifications
//
// Processes the notification queue and sends push notifications via Expo Push Service.
// This function can be triggered by:
// 1. Database webhook when notification_queue gets a new entry
// 2. Scheduled cron job (e.g., every minute)
// 3. Direct HTTP call from other edge functions
//
// Deploy with: supabase functions deploy send-notifications

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Expo Push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Types
interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | { critical?: boolean; name?: string; volume?: number };
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
  expiration?: number;
  categoryId?: string;
}

interface NotificationQueueItem {
  id: string;
  target_type: "specific" | "followers" | "all" | "whale_subscribers";
  target_wallets: string[] | null;
  target_kol_wallet: string | null;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  scheduled_for: string;
}

interface PushToken {
  expo_push_token: string;
  wallet_address: string;
}

interface NotificationPreference {
  wallet_address: string;
  notifications_enabled: boolean;
  // Whale alerts
  whale_alerts_enabled: boolean;
  whale_alert_threshold: number;
  // KOL activity
  kol_activity_enabled: boolean;
  kol_trade_notifications: boolean;
  kol_new_position_notifications: boolean;
  kol_tier_change_notifications: boolean;
  // Portfolio
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
  // Market
  trending_token_alerts: boolean;
  new_listing_alerts: boolean;
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
}

interface KolFollow {
  follower_wallet_address: string;
  notify_on_trade: boolean;
}

// Deno types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

// Create Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Main handler
Deno.serve(async (req: Request) => {
  const supabase = getSupabaseClient();

  try {
    // Check for direct notification request
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const body = await req.json();

        // Direct send request
        if (body.wallet_addresses && body.title && body.body) {
          const result = await sendDirectNotifications(supabase, body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // Process notification queue
    const result = await processNotificationQueue(supabase);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-notifications:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * Process pending items in the notification queue
 */
async function processNotificationQueue(
  supabase: ReturnType<typeof createClient>,
) {
  // Get pending queue items
  const { data: queueItems, error: queueError } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10);

  if (queueError) {
    console.error("Error fetching queue:", queueError);
    return { success: false, error: queueError.message, processed: 0 };
  }

  if (!queueItems || queueItems.length === 0) {
    return { success: true, message: "No pending notifications", processed: 0 };
  }

  let processedCount = 0;
  let failedCount = 0;

  for (const item of queueItems as NotificationQueueItem[]) {
    try {
      // Mark as processing
      await supabase
        .from("notification_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      // Get target wallets based on target_type
      const wallets = await getTargetWallets(supabase, item);

      if (wallets.length === 0) {
        await supabase
          .from("notification_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processed_count: 0,
          })
          .eq("id", item.id);
        continue;
      }

      // Get push tokens for target wallets
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("expo_push_token, wallet_address")
        .in("wallet_address", wallets)
        .eq("is_active", true);

      if (!tokens || tokens.length === 0) {
        await supabase
          .from("notification_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processed_count: 0,
          })
          .eq("id", item.id);
        continue;
      }

      // Filter tokens based on preferences
      const eligibleTokens = await filterByPreferences(
        supabase,
        tokens as PushToken[],
        item.notification_type,
        item.data,
      );

      if (eligibleTokens.length === 0) {
        await supabase
          .from("notification_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processed_count: 0,
          })
          .eq("id", item.id);
        continue;
      }

      // Send notifications
      const sendResult = await sendPushNotifications(
        eligibleTokens,
        item.title,
        item.body,
        item.data,
        getChannelForType(item.notification_type),
      );

      // Save notification records
      await saveNotificationRecords(
        supabase,
        eligibleTokens,
        item.notification_type,
        item.title,
        item.body,
        item.data,
      );

      // Handle failed tokens
      await handleFailedTokens(supabase, sendResult.failedTokens);

      // Update queue item
      await supabase
        .from("notification_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          processed_count: sendResult.successCount,
          failed_count: sendResult.failedCount,
        })
        .eq("id", item.id);

      processedCount++;
    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);

      await supabase
        .from("notification_queue")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", item.id);

      failedCount++;
    }
  }

  return {
    success: true,
    processed: processedCount,
    failed: failedCount,
  };
}

/**
 * Get target wallet addresses based on notification target type
 */
async function getTargetWallets(
  supabase: ReturnType<typeof createClient>,
  item: NotificationQueueItem,
): Promise<string[]> {
  switch (item.target_type) {
    case "specific":
      return item.target_wallets || [];

    case "followers":
      if (!item.target_kol_wallet) return [];
      const { data: follows } = await supabase
        .from("kol_follows")
        .select("follower_wallet_address")
        .eq("kol_wallet_address", item.target_kol_wallet)
        .eq("notify_on_trade", true);
      return ((follows as KolFollow[]) || []).map(
        (f) => f.follower_wallet_address,
      );

    case "whale_subscribers":
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("wallet_address, whale_alert_threshold")
        .eq("notifications_enabled", true)
        .eq("whale_alerts_enabled", true);

      // Filter by threshold if usd_value is in data
      const usdValue = (item.data?.usd_value as number) || 0;
      return (prefs || [])
        .filter((p: any) => p.whale_alert_threshold <= usdValue)
        .map((p: any) => p.wallet_address as string);

    case "all":
      const { data: allTokens } = await supabase
        .from("push_tokens")
        .select("wallet_address")
        .eq("is_active", true);
      return [
        ...new Set(
          (allTokens || []).map((t: any) => t.wallet_address as string),
        ),
      ];

    default:
      return [];
  }
}

/**
 * Filter tokens based on user preferences and quiet hours
 */
async function filterByPreferences(
  supabase: ReturnType<typeof createClient>,
  tokens: PushToken[],
  notificationType: string,
  data: Record<string, unknown>,
): Promise<PushToken[]> {
  const walletAddresses = tokens.map((t) => t.wallet_address);

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("*")
    .in("wallet_address", walletAddresses);

  const prefsMap = new Map<string, NotificationPreference>(
    (preferences || []).map((p: NotificationPreference) => [
      p.wallet_address,
      p,
    ]),
  );

  return tokens.filter((token) => {
    const prefs = prefsMap.get(token.wallet_address);

    // If no preferences, default to sending
    if (!prefs) return true;

    // Master toggle
    if (!prefs.notifications_enabled) return false;

    // Check quiet hours
    if (prefs.quiet_hours_enabled) {
      if (isInQuietHours(prefs)) return false;
    }

    // Check type-specific preferences
    switch (notificationType) {
      case "whale_alert":
        if (!prefs.whale_alerts_enabled) return false;
        const usdValue = (data?.usd_value as number) || 0;
        if (usdValue < prefs.whale_alert_threshold) return false;
        break;

      case "kol_trade":
        if (!prefs.kol_activity_enabled) return false;
        if (!prefs.kol_trade_notifications) return false;
        break;

      case "kol_new_position":
        if (!prefs.kol_activity_enabled) return false;
        if (!prefs.kol_new_position_notifications) return false;
        break;

      case "kol_tier_change":
        if (!prefs.kol_activity_enabled) return false;
        if (!prefs.kol_tier_change_notifications) return false;
        break;

      case "portfolio_alert":
      case "price_alert":
        if (!prefs.portfolio_alerts_enabled) return false;
        break;

      case "pnl_alert":
        if (!prefs.portfolio_alerts_enabled) return false;
        if (!prefs.pnl_alerts_enabled) return false;
        break;

      case "copy_trade_executed":
        if (!prefs.copy_trade_enabled) return false;
        if (!prefs.copy_trade_executed) return false;
        break;

      case "copy_trade_failed":
        if (!prefs.copy_trade_enabled) return false;
        if (!prefs.copy_trade_failed) return false;
        break;

      case "new_follower":
        if (!prefs.new_follower_notifications) return false;
        break;

      case "new_copy_trader":
        if (!prefs.new_copy_trader_notifications) return false;
        break;

      case "leaderboard":
        if (!prefs.leaderboard_notifications) return false;
        break;

      case "trending_token":
        if (!prefs.trending_token_alerts) return false;
        break;

      case "new_listing":
        if (!prefs.new_listing_alerts) return false;
        break;

      case "security":
        // Security notifications are always sent
        break;

      case "system":
        // System notifications are always sent
        break;
    }

    return true;
  });
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(prefs: NotificationPreference): boolean {
  try {
    // Get current time in user's timezone
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      timeZone: prefs.quiet_hours_timezone || "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const currentMinutes = timeStringToMinutes(timeString);
    const startMinutes = timeStringToMinutes(prefs.quiet_hours_start);
    const endMinutes = timeStringToMinutes(prefs.quiet_hours_end);

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return false;
  }
}

function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Send push notifications via Expo Push Service
 */
async function sendPushNotifications(
  tokens: PushToken[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId: string,
): Promise<{
  successCount: number;
  failedCount: number;
  failedTokens: string[];
}> {
  const messages: PushMessage[] = tokens.map((token) => ({
    to: token.expo_push_token,
    title,
    body,
    data,
    sound: "default",
    channelId,
    priority: "high",
    ttl: 86400, // 24 hours
  }));

  // Expo recommends sending in batches of 100
  const BATCH_SIZE = 100;
  const results: {
    successCount: number;
    failedCount: number;
    failedTokens: string[];
  } = {
    successCount: 0,
    failedCount: 0,
    failedTokens: [],
  };

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      const responseData = await response.json();

      if (responseData.data) {
        for (let j = 0; j < responseData.data.length; j++) {
          const ticketData = responseData.data[j];
          if (ticketData.status === "ok") {
            results.successCount++;
          } else if (ticketData.status === "error") {
            results.failedCount++;
            if (
              ticketData.details?.error === "DeviceNotRegistered" ||
              ticketData.details?.error === "InvalidCredentials"
            ) {
              results.failedTokens.push(batch[j].to);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending batch:", error);
      results.failedCount += batch.length;
    }
  }

  return results;
}

/**
 * Save notification records to database
 */
async function saveNotificationRecords(
  supabase: ReturnType<typeof createClient>,
  tokens: PushToken[],
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const records = tokens.map((token) => ({
    wallet_address: token.wallet_address,
    type,
    title,
    body,
    data,
    status: "sent",
    sent_at: new Date().toISOString(),
  }));

  // Insert in batches to avoid hitting limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await supabase.from("notifications").insert(batch);
  }
}

/**
 * Deactivate failed push tokens
 */
async function handleFailedTokens(
  supabase: ReturnType<typeof createClient>,
  failedTokens: string[],
): Promise<void> {
  if (failedTokens.length === 0) return;

  await supabase
    .from("push_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("expo_push_token", failedTokens);

  console.log(`Deactivated ${failedTokens.length} invalid tokens`);
}

/**
 * Send notifications directly (not from queue)
 */
async function sendDirectNotifications(
  supabase: ReturnType<typeof createClient>,
  params: {
    wallet_addresses: string[];
    title: string;
    body: string;
    type?: string;
    data?: Record<string, unknown>;
    channel_id?: string;
  },
): Promise<{ success: boolean; sent: number; failed: number }> {
  const {
    wallet_addresses,
    title,
    body,
    type = "system",
    data = {},
    channel_id = "default",
  } = params;

  // Get push tokens
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token, wallet_address")
    .in("wallet_address", wallet_addresses)
    .eq("is_active", true);

  if (!tokens || tokens.length === 0) {
    return { success: false, sent: 0, failed: 0 };
  }

  // Filter by preferences
  const eligibleTokens = await filterByPreferences(
    supabase,
    tokens as PushToken[],
    type,
    data,
  );

  if (eligibleTokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  // Send notifications
  const result = await sendPushNotifications(
    eligibleTokens,
    title,
    body,
    { ...data, type },
    channel_id,
  );

  // Save notification records
  await saveNotificationRecords(
    supabase,
    eligibleTokens,
    type,
    title,
    body,
    data,
  );

  // Handle failed tokens
  await handleFailedTokens(supabase, result.failedTokens);

  return {
    success: true,
    sent: result.successCount,
    failed: result.failedCount,
  };
}

/**
 * Map notification type to Android channel
 */
function getChannelForType(type: string): string {
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
