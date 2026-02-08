/**
 * Supabase Client Configuration
 * Handles connection to Supabase for KOL leaderboard feature
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured");
}

// Create untyped client to avoid complex generic issues
// Tables will be accessed dynamically
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Helper function to set wallet address in session for RLS
export async function setWalletSession(walletAddress: string) {
  // Store wallet address for RLS policies
  await AsyncStorage.setItem("kol_wallet_address", walletAddress);
}

// Get current wallet address
export async function getWalletSession(): Promise<string | null> {
  return AsyncStorage.getItem("kol_wallet_address");
}
