/**
 * KOL Sync Service
 * Triggers immediate sync of user stats after trades
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Trigger immediate KOL stats sync for a specific user
 * Called after successful swaps to update stats and notify followers
 *
 * @param userId - The user's UUID from the users table
 */
export async function triggerKolSync(
  userId: string | undefined,
): Promise<void> {
  if (!userId) {
    console.log("[KolSync] No user ID provided, skipping sync");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[KolSync] Supabase config missing, skipping sync");
    return;
  }

  try {
    console.log("[KolSync] Triggering sync for user:", userId);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sync-kol-stats`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ user_id: userId }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      console.log("[KolSync] Sync triggered successfully:", result);
    } else {
      console.warn("[KolSync] Sync trigger failed:", response.status);
    }
  } catch (error) {
    // Don't throw - sync failure shouldn't block the UI
    console.warn("[KolSync] Failed to trigger sync:", error);
  }
}

/**
 * Trigger sync with a delay (useful after swaps to allow indexing)
 * Mobula may take a few seconds to index new transactions
 *
 * @param userId - The user's UUID
 * @param delayMs - Delay in milliseconds before triggering sync (default: 5000ms)
 */
export async function triggerKolSyncDelayed(
  userId: string | undefined,
  delayMs: number = 5000,
): Promise<void> {
  if (!userId) return;

  console.log(`[KolSync] Will trigger sync in ${delayMs}ms for user:`, userId);

  setTimeout(() => {
    triggerKolSync(userId);
  }, delayMs);
}
