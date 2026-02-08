/**
 * Supabase Database Types
 * Auto-generated types for the KOL leaderboard tables
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type KolTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type TradeType = "buy" | "sell" | "swap";
export type ChainType = "evm" | "solana";
export type CopyTradeStatus = "pending" | "executed" | "failed";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          twitter_id: string | null;
          twitter_username: string | null;
          twitter_display_name: string | null;
          twitter_avatar_url: string | null;
          twitter_followers_count: number;
          is_verified: boolean;
          is_kol: boolean;
          kol_tier: KolTier | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          twitter_id?: string | null;
          twitter_username?: string | null;
          twitter_display_name?: string | null;
          twitter_avatar_url?: string | null;
          twitter_followers_count?: number;
          is_verified?: boolean;
          is_kol?: boolean;
          kol_tier?: KolTier | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          twitter_id?: string | null;
          twitter_username?: string | null;
          twitter_display_name?: string | null;
          twitter_avatar_url?: string | null;
          twitter_followers_count?: number;
          is_verified?: boolean;
          is_kol?: boolean;
          kol_tier?: KolTier | null;
          updated_at?: string;
        };
      };
      user_wallets: {
        Row: {
          id: string;
          user_id: string;
          wallet_address: string;
          chain_type: ChainType;
          chain: string | null;
          is_primary: boolean;
          nickname: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_address: string;
          chain_type: ChainType;
          chain?: string | null;
          is_primary?: boolean;
          nickname?: string | null;
          created_at?: string;
        };
        Update: {
          chain?: string | null;
          is_primary?: boolean;
          nickname?: string | null;
        };
      };
      kol_trades: {
        Row: {
          id: string;
          user_id: string;
          wallet_id: string | null;
          wallet_address: string;
          tx_hash: string;
          chain: string;
          chain_type: ChainType;
          trade_type: TradeType;
          dex_name: string | null;
          token_in_address: string | null;
          token_in_symbol: string | null;
          token_in_name: string | null;
          token_in_amount: number | null;
          token_in_decimals: number | null;
          token_in_usd_value: number | null;
          token_in_logo: string | null;
          token_out_address: string | null;
          token_out_symbol: string | null;
          token_out_name: string | null;
          token_out_amount: number | null;
          token_out_decimals: number | null;
          token_out_usd_value: number | null;
          token_out_logo: string | null;
          price_usd: number | null;
          gas_used: number | null;
          gas_price: number | null;
          fee_usd: number | null;
          realized_pnl_usd: number;
          unrealized_pnl_usd: number;
          pnl_percentage: number;
          traded_at: string;
          block_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_id?: string | null;
          wallet_address: string;
          tx_hash: string;
          chain: string;
          chain_type: ChainType;
          trade_type: TradeType;
          dex_name?: string | null;
          token_in_address?: string | null;
          token_in_symbol?: string | null;
          token_in_name?: string | null;
          token_in_amount?: number | null;
          token_in_decimals?: number | null;
          token_in_usd_value?: number | null;
          token_in_logo?: string | null;
          token_out_address?: string | null;
          token_out_symbol?: string | null;
          token_out_name?: string | null;
          token_out_amount?: number | null;
          token_out_decimals?: number | null;
          token_out_usd_value?: number | null;
          token_out_logo?: string | null;
          price_usd?: number | null;
          gas_used?: number | null;
          gas_price?: number | null;
          fee_usd?: number | null;
          realized_pnl_usd?: number;
          unrealized_pnl_usd?: number;
          pnl_percentage?: number;
          traded_at: string;
          block_number?: number | null;
          created_at?: string;
        };
        Update: {
          realized_pnl_usd?: number;
          unrealized_pnl_usd?: number;
          pnl_percentage?: number;
        };
      };
      kol_stats: {
        Row: {
          id: string;
          user_id: string;
          total_trades: number;
          total_volume_usd: number;
          total_realized_pnl_usd: number;
          total_unrealized_pnl_usd: number;
          win_rate: number;
          avg_trade_size_usd: number;
          best_trade_pnl_usd: number;
          worst_trade_pnl_usd: number;
          trades_7d: number;
          volume_7d_usd: number;
          pnl_7d_usd: number;
          trades_30d: number;
          volume_30d_usd: number;
          pnl_30d_usd: number;
          rank_overall: number | null;
          rank_7d: number | null;
          rank_30d: number | null;
          current_win_streak: number;
          best_win_streak: number;
          last_trade_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_trades?: number;
          total_volume_usd?: number;
          total_realized_pnl_usd?: number;
          total_unrealized_pnl_usd?: number;
          win_rate?: number;
          avg_trade_size_usd?: number;
          best_trade_pnl_usd?: number;
          worst_trade_pnl_usd?: number;
          trades_7d?: number;
          volume_7d_usd?: number;
          pnl_7d_usd?: number;
          trades_30d?: number;
          volume_30d_usd?: number;
          pnl_30d_usd?: number;
          rank_overall?: number | null;
          rank_7d?: number | null;
          rank_30d?: number | null;
          current_win_streak?: number;
          best_win_streak?: number;
          last_trade_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["kol_stats"]["Insert"]>;
      };
      kol_followers: {
        Row: {
          id: string;
          follower_user_id: string;
          kol_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_user_id: string;
          kol_user_id: string;
          created_at?: string;
        };
        Update: never;
      };
      copy_trades: {
        Row: {
          id: string;
          copier_user_id: string;
          original_trade_id: string | null;
          kol_user_id: string | null;
          tx_hash: string | null;
          status: CopyTradeStatus;
          copy_amount_usd: number | null;
          created_at: string;
          executed_at: string | null;
        };
        Insert: {
          id?: string;
          copier_user_id: string;
          original_trade_id?: string | null;
          kol_user_id?: string | null;
          tx_hash?: string | null;
          status?: CopyTradeStatus;
          copy_amount_usd?: number | null;
          created_at?: string;
          executed_at?: string | null;
        };
        Update: {
          tx_hash?: string | null;
          status?: CopyTradeStatus;
          executed_at?: string | null;
        };
      };
    };
    Views: {
      kol_leaderboard: {
        Row: {
          id: string;
          twitter_username: string | null;
          twitter_display_name: string | null;
          twitter_avatar_url: string | null;
          twitter_followers_count: number;
          is_verified: boolean;
          kol_tier: KolTier | null;
          total_trades: number | null;
          total_volume_usd: number | null;
          total_realized_pnl_usd: number | null;
          win_rate: number | null;
          trades_7d: number | null;
          volume_7d_usd: number | null;
          pnl_7d_usd: number | null;
          trades_30d: number | null;
          volume_30d_usd: number | null;
          pnl_30d_usd: number | null;
          rank_overall: number | null;
          rank_7d: number | null;
          rank_30d: number | null;
          current_win_streak: number | null;
          last_trade_at: string | null;
          followers_count: number | null;
          // Multi-wallet support
          primary_evm_wallet: string | null;
          primary_solana_wallet: string | null;
          evm_trades: number | null;
          solana_trades: number | null;
        };
      };
      kol_recent_trades: {
        Row: {
          id: string;
          user_id: string;
          wallet_address: string;
          tx_hash: string;
          chain: string; // chain_id from Mobula
          chain_type: ChainType;
          trade_type: TradeType;
          dex_name: string | null;
          traded_at: string;
          amount_usd: number | null;

          // Token in (what was spent)
          token_in_address: string | null;
          token_in_symbol: string | null;
          token_in_name: string | null;
          token_in_amount: number | null;
          token_in_usd_value: number | null;
          token_in_logo: string | null;

          // Token out (what was received)
          token_out_address: string | null;
          token_out_symbol: string | null;
          token_out_name: string | null;
          token_out_amount: number | null;
          token_out_usd_value: number | null;
          token_out_logo: string | null;

          price_usd: number | null;

          // PnL from positions cache (position-level PnL for this token)
          realized_pnl_usd: number | null;
          unrealized_pnl_usd: number | null;
          pnl_percentage: number | null;
          total_pnl_usd: number | null;
          avg_buy_price_usd: number | null;
          avg_sell_price_usd: number | null;
          position_buys: number | null;
          position_sells: number | null;

          // User info
          twitter_username: string | null;
          twitter_display_name: string | null;
          twitter_avatar_url: string | null;
          is_verified: boolean;
          kol_tier: KolTier | null;

          // Trader labels
          trader_labels: string[] | null;
        };
      };
    };
  };
}

// Helper types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type UserWallet = Database["public"]["Tables"]["user_wallets"]["Row"];
export type UserWalletInsert =
  Database["public"]["Tables"]["user_wallets"]["Insert"];

export type KolTrade = Database["public"]["Tables"]["kol_trades"]["Row"];
export type KolTradeInsert =
  Database["public"]["Tables"]["kol_trades"]["Insert"];

export type KolStats = Database["public"]["Tables"]["kol_stats"]["Row"];

export type KolFollower = Database["public"]["Tables"]["kol_followers"]["Row"];

export type CopyTrade = Database["public"]["Tables"]["copy_trades"]["Row"];

export type KolLeaderboardEntry =
  Database["public"]["Views"]["kol_leaderboard"]["Row"];
export type KolRecentTrade =
  Database["public"]["Views"]["kol_recent_trades"]["Row"];

// Extended leaderboard entry with Mobula-powered fields
export interface EnhancedKolLeaderboardEntry extends KolLeaderboardEntry {
  // Additional fields from kol_stats_cache
  total_value_usd?: number | null;
  pnl_90d_usd?: number | null;
  holding_tokens_count?: number | null;
  avg_holding_duration_days?: number | null;
  win_rate_distribution?: Record<string, number> | null;
  market_cap_distribution?: Record<string, number> | null;
  best_token_address?: string | null;
  best_token_symbol?: string | null;
  best_token_name?: string | null;
  best_token_logo?: string | null;
  labels?: string[] | null;
  last_synced_at?: string | null;
  is_stale?: boolean;
}
