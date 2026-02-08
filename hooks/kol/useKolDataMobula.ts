/**
 * useKolDataMobula - Improved hooks using Mobula wallet APIs
 * Replaces manual trade tracking with Mobula's pre-calculated analytics
 */

import { getBlockchainName as getCentralizedBlockchainName } from "@/constants/chains";
import { KOL_DEFAULT_LIMIT } from "@/constants/pagination";
import { KOL_CACHE_TTL } from "@/constants/time";
import {
  getKolStats,
  getKolStatsMultiPeriod,
  getWalletActivity,
  getWalletPositions,
  getWalletTrades,
  MobulaKolStats,
  MobulaWalletActivity,
  MobulaWalletPosition,
  MobulaWalletTrade,
} from "@/lib/api/mobula/mobulaWalletService";
import { supabase } from "@/lib/api/supabase/supabaseClient";
import type {
  KolLeaderboardEntry,
  KolRecentTrade,
} from "@/lib/api/supabase/supabaseTypes";
import { useKolStore } from "@/store/kolStore";
import { logger } from "@/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";

// Cache TTL - use longer duration since backend cron handles syncing
const CACHE_TTL_MS = KOL_CACHE_TTL;

/**
 * Map chain_type from database to Mobula blockchain name
 */
function getBlockchainName(chainType: string): string {
  return getCentralizedBlockchainName(chainType);
}

// ============================================
// Types for improved KOL data
// ============================================

export interface EnrichedKolEntry extends Omit<
  KolLeaderboardEntry,
  "pnl_7d_usd"
> {
  // Enhanced stats from Mobula
  pnl_7d_usd: number | null;
  pnl_30d_usd: number | null;
  win_rate: number | null;
  total_volume_usd: number | null;
  holding_tokens_count: number | null;
  labels: string[];
  win_rate_distribution: MobulaKolStats["winRateDistribution"] | null;
  market_cap_distribution: MobulaKolStats["marketCapDistribution"] | null;
  best_token: MobulaKolStats["winToken"] | null;
  // Cache info
  last_synced_at: string | null;
  is_stale: boolean;
}

export interface EnrichedTradeEntry {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  chain_id: string;
  trade_type: "buy" | "sell";
  traded_at: string;
  amount_usd: number;
  // Base token (token being bought/sold)
  base_token: {
    address: string;
    symbol: string;
    name: string;
    logo: string | null;
    price_usd: number;
    liquidity_usd: number;
    market_cap_usd: number;
    price_change_24h: number;
  };
  // Quote token (usually stablecoin)
  quote_token: {
    address: string;
    symbol: string;
    name: string;
    logo: string | null;
  };
  // Platform
  platform: string | null;
  labels: string[];
  // User info (joined from cache)
  twitter_username: string | null;
  twitter_display_name: string | null;
  twitter_avatar_url: string | null;
  is_verified: boolean;
  kol_tier: string | null;
}

// ============================================
// Hook: Fetch and sync KOL leaderboard with Mobula
// ============================================

export function useKolLeaderboardMobula() {
  const setLeaderboard = useKolStore((s) => s.setLeaderboard);
  const leaderboard = useKolStore((s) => s.leaderboard);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  /**
   * Fetch leaderboard from Supabase cache
   */
  const fetchFromCache = useCallback(
    async (force: boolean = false) => {
      if (fetchingRef.current && !force) {
        logger.log("[useKolLeaderboardMobula] Already fetching, skipping...");
        return;
      }
      fetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        logger.log("[useKolLeaderboardMobula] Fetching from cache...");
        const { data, error: dbError } = await supabase
          .from("kol_leaderboard")
          .select("*")
          .order("pnl_7d_usd", { ascending: false, nullsFirst: false })
          .limit(100);

        if (dbError) throw dbError;

        logger.log(
          "[useKolLeaderboardMobula] Got",
          data?.length || 0,
          "entries",
        );

        // Check for stale entries
        const enrichedData = (data || []).map((entry) => ({
          ...entry,
          is_stale: isEntryStale(entry.last_synced_at),
        }));

        setLeaderboard(enrichedData as KolLeaderboardEntry[]);
        return enrichedData;
      } catch (err: any) {
        logger.error(
          "[useKolLeaderboardMobula] Cache fetch error:",
          err.message,
        );
        setError(err.message);
        return [];
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [setLeaderboard],
  );

  /**
   * Sync a single KOL's stats from Mobula and update cache
   */
  const syncKolStats = useCallback(
    async (
      userId: string,
      walletAddress: string,
      chainType: "evm" | "solana" | "multi" = "solana",
    ) => {
      try {
        logger.log(
          `[syncKolStats] Syncing stats for ${walletAddress} on ${chainType}`,
        );

        // Map chain type to Mobula blockchain name
        const blockchain = getBlockchainName(chainType);

        // Fetch multi-period stats from Mobula
        const { stats7d, stats30d, stats90d } = await getKolStatsMultiPeriod(
          walletAddress,
          { blockchain },
        );

        // Upsert to cache
        const { error: upsertError } = await supabase
          .from("kol_stats_cache")
          .upsert(
            {
              user_id: userId,
              wallet_address: walletAddress,
              chain_type: chainType,
              total_value_usd: stats7d.totalValue,
              pnl_7d_usd: stats7d.realizedPnlUsd,
              pnl_30d_usd: stats30d.realizedPnlUsd,
              pnl_90d_usd: stats90d.realizedPnlUsd,
              realized_pnl_usd: stats7d.realizedPnlUsd,
              unrealized_pnl_usd: stats7d.unrealizedPnlUsd,
              total_trades: stats7d.totalTrades,
              trades_7d: stats7d.totalTrades,
              trades_30d: stats30d.totalTrades,
              buys_7d: stats7d.totalTrades, // Mobula combines buys in totalTrades
              sells_7d: 0,
              volume_buy_usd: stats7d.volumeBuy,
              volume_sell_usd: stats7d.volumeSell,
              total_volume_usd: stats7d.totalVolume,
              volume_7d_usd: stats7d.totalVolume,
              volume_30d_usd: stats30d.totalVolume,
              win_rate: stats7d.winRate,
              win_count: stats7d.winCount,
              holding_tokens_count: stats7d.holdingTokensCount,
              avg_holding_duration_days: stats7d.avgHoldingDuration,
              win_rate_distribution: stats7d.winRateDistribution,
              market_cap_distribution: stats7d.marketCapDistribution,
              period_pnl_data: stats7d.periodPnl,
              best_token_address: stats7d.winToken?.address || null,
              best_token_symbol: stats7d.winToken?.symbol || null,
              best_token_name: stats7d.winToken?.name || null,
              best_token_logo: stats7d.winToken?.logo || null,
              best_token_chain: stats7d.winToken?.chainId || null,
              labels: stats7d.labels,
              last_synced_at: new Date().toISOString(),
              sync_period: "7d",
            },
            { onConflict: "user_id" },
          );

        if (upsertError) throw upsertError;

        logger.log(`[syncKolStats] Successfully synced ${walletAddress}`);
        return true;
      } catch (err: any) {
        logger.error(
          `[syncKolStats] Error syncing ${walletAddress}:`,
          err.message,
        );
        return false;
      }
    },
    [],
  );

  /**
   * Sync all stale KOL entries from Mobula
   */
  const syncStaleEntries = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // Get entries that need syncing
      const { data: staleEntries, error: fetchError } = await supabase
        .from("kol_stats_cache")
        .select("user_id, wallet_address, chain_type, last_synced_at")
        .or(
          `last_synced_at.is.null,last_synced_at.lt.${new Date(Date.now() - CACHE_TTL_MS).toISOString()}`,
        );

      if (fetchError) throw fetchError;

      if (!staleEntries || staleEntries.length === 0) {
        logger.log("[syncStaleEntries] No stale entries to sync");
        return;
      }

      logger.log(
        `[syncStaleEntries] Syncing ${staleEntries.length} stale entries`,
      );

      // Sync in parallel with rate limiting (max 5 concurrent)
      const batchSize = 5;
      for (let i = 0; i < staleEntries.length; i += batchSize) {
        const batch = staleEntries.slice(i, i + batchSize);
        await Promise.all(
          batch.map((entry) =>
            syncKolStats(
              entry.user_id,
              entry.wallet_address,
              entry.chain_type as "evm" | "solana" | "multi",
            ),
          ),
        );
      }

      // Refresh leaderboard after sync
      await fetchFromCache();
    } catch (err: any) {
      logger.error("[syncStaleEntries] Error:", err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncKolStats, fetchFromCache]);

  /**
   * Force refresh all KOL stats from Mobula
   */
  const forceRefresh = useCallback(async () => {
    setIsSyncing(true);

    try {
      // Get all wallets
      const { data: allEntries, error: fetchError } = await supabase
        .from("kol_stats_cache")
        .select("user_id, wallet_address, chain_type");

      if (fetchError) throw fetchError;

      if (!allEntries || allEntries.length === 0) {
        logger.log("[forceRefresh] No entries to refresh");
        return;
      }

      logger.log(`[forceRefresh] Refreshing ${allEntries.length} entries`);

      // Sync all entries
      const batchSize = 5;
      for (let i = 0; i < allEntries.length; i += batchSize) {
        const batch = allEntries.slice(i, i + batchSize);
        await Promise.all(
          batch.map((entry) =>
            syncKolStats(
              entry.user_id,
              entry.wallet_address,
              entry.chain_type as "evm" | "solana" | "multi",
            ),
          ),
        );
      }

      // Update rankings
      await supabase.rpc("update_kol_rankings");

      // Refresh leaderboard
      await fetchFromCache();
    } catch (err: any) {
      logger.error("[forceRefresh] Error:", err.message);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [syncKolStats, fetchFromCache]);

  return {
    leaderboard,
    isLoading,
    isSyncing,
    error,
    refetch: fetchFromCache,
    syncStaleEntries,
    forceRefresh,
    syncKolStats,
  };
}

// ============================================
// Hook: Fetch KOL trades from Mobula
// ============================================

export function useKolTradesMobula(limit: number = 50) {
  const setRecentTrades = useKolStore((s) => s.setRecentTrades);
  const recentTrades = useKolStore((s) => s.recentTrades);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  /**
   * Fetch trades from Supabase cache
   */
  const fetchFromCache = useCallback(
    async (force: boolean = false) => {
      if (fetchingRef.current && !force) {
        logger.log("[useKolTradesMobula] Already fetching, skipping...");
        return;
      }
      fetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        logger.log("[useKolTradesMobula] Fetching from cache...");
        const { data, error: dbError } = await supabase
          .from("kol_recent_trades")
          .select("*")
          .order("traded_at", { ascending: false })
          .limit(limit);

        if (dbError) throw dbError;

        logger.log("[useKolTradesMobula] Got", data?.length || 0, "trades");

        setRecentTrades((data as KolRecentTrade[]) || []);
        return data;
      } catch (err: any) {
        logger.error("[useKolTradesMobula] Cache fetch error:", err.message);
        setError(err.message);
        return [];
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [limit, setRecentTrades],
  );

  /**
   * Sync trades for a wallet from Mobula and update cache
   */
  const syncWalletTrades = useCallback(
    async (userId: string, walletAddress: string) => {
      try {
        logger.log(`[syncWalletTrades] Syncing trades for ${walletAddress}`);

        // Fetch trades from Mobula
        const trades = await getWalletTrades(walletAddress, {
          limit: KOL_DEFAULT_LIMIT,
          order: "desc",
        });

        if (!trades || trades.length === 0) {
          logger.log(`[syncWalletTrades] No trades found for ${walletAddress}`);
          return true;
        }

        // Transform and upsert to cache
        const tradesToInsert = trades.map((trade) => {
          // Determine quote token from the trade data
          // The quote is the token being used as the price reference
          const isToken0Quote = trade.quote === trade.token0_address;

          // Calculate amount_usd if API returns 0 (common for illiquid tokens)
          // Use amount_base * base_token_price_usd as fallback
          let calculatedAmountUsd = trade.amount_usd || 0;
          if (
            calculatedAmountUsd === 0 &&
            trade.base_token?.priceUSD &&
            trade.amount_base
          ) {
            calculatedAmountUsd = trade.amount_base * trade.base_token.priceUSD;
          }
          // Also try using quote amount if still 0
          if (calculatedAmountUsd === 0 && trade.amount_quote) {
            // If quote is a stablecoin (price ~$1), use quote amount directly
            const quotePriceUsd = isToken0Quote
              ? trade.price_usd_token0
              : trade.price_usd_token1;
            if (quotePriceUsd > 0.9 && quotePriceUsd < 1.1) {
              calculatedAmountUsd = trade.amount_quote * quotePriceUsd;
            }
          }

          return {
            user_id: userId,
            wallet_address: walletAddress,
            tx_hash: trade.transaction_hash,
            chain_id: trade.chain_id,
            trade_type: trade.side,
            traded_at: trade.date,
            amount_usd: calculatedAmountUsd,
            amount_base: trade.amount_base,
            amount_quote: trade.amount_quote,
            base_token_address: trade.base_token?.address || trade.base,
            base_token_symbol: trade.base_token?.symbol || "Unknown",
            base_token_name: trade.base_token?.name || "Unknown",
            base_token_logo: trade.base_token?.logo || null,
            base_token_price_usd: trade.base_token?.priceUSD || 0,
            base_token_liquidity_usd: trade.base_token?.liquidityUSD || 0,
            base_token_market_cap_usd: trade.base_token?.marketCapUSD || 0,
            base_token_price_change_24h:
              trade.base_token?.priceChange24hPercentage || 0,
            quote_token_address: trade.quote,
            // Use the correct token info based on which is the quote
            quote_token_symbol: isToken0Quote
              ? trade.price_usd_token0 > 0.99 && trade.price_usd_token0 < 1.01
                ? "USDC"
                : "Unknown"
              : trade.price_usd_token1 > 0.99 && trade.price_usd_token1 < 1.01
                ? "USDC"
                : "Unknown",
            quote_token_name: isToken0Quote
              ? trade.price_usd_token0 > 0.99 && trade.price_usd_token0 < 1.01
                ? "USD Coin"
                : "Quote Token"
              : trade.price_usd_token1 > 0.99 && trade.price_usd_token1 < 1.01
                ? "USD Coin"
                : "Quote Token",
            quote_token_logo: null,
            platform: trade.platform,
            pool_address: trade.pool_address,
            trader_labels: trade.labels,
            synced_at: new Date().toISOString(),
          };
        });

        // Upsert (ignore conflicts on tx_hash + chain_id)
        const { error: upsertError } = await supabase
          .from("kol_trades_cache")
          .upsert(tradesToInsert, {
            onConflict: "tx_hash,chain_id",
            ignoreDuplicates: true,
          });

        if (upsertError) throw upsertError;

        logger.log(
          `[syncWalletTrades] Synced ${tradesToInsert.length} trades for ${walletAddress}`,
        );
        return true;
      } catch (err: any) {
        logger.error(
          `[syncWalletTrades] Error syncing ${walletAddress}:`,
          err.message,
        );
        return false;
      }
    },
    [],
  );

  /**
   * Sync positions with PnL for a wallet from Mobula and update cache
   * This provides realizedPnlUSD, unrealizedPnlUSD, totalPnlUSD per token
   */
  const syncWalletPositions = useCallback(
    async (
      userId: string,
      walletAddress: string,
      blockchain: string = "Solana",
    ) => {
      try {
        logger.log(
          `[syncWalletPositions] Syncing positions for ${walletAddress} on ${blockchain}`,
        );

        // Fetch positions from Mobula - requires blockchain parameter
        const positions = await getWalletPositions(walletAddress, {
          blockchain,
        });

        if (!positions || positions.length === 0) {
          logger.log(
            `[syncWalletPositions] No positions found for ${walletAddress}`,
          );
          return true;
        }

        // Transform and upsert to cache
        const positionsToInsert = positions.map((pos) => ({
          user_id: userId,
          wallet_address: walletAddress,
          token_address: pos.token.address,
          token_chain_id: pos.token.chainId,
          token_symbol: pos.token.symbol,
          token_name: pos.token.name,
          token_logo: pos.token.logo,
          token_decimals: pos.token.decimals,
          token_price_usd: pos.token.priceUSD,
          token_liquidity_usd: pos.token.liquidityUSD,
          token_market_cap_usd: pos.token.marketCapUSD,
          token_price_change_24h: pos.token.priceChange24hPercentage,
          balance: pos.balance,
          amount_usd: pos.amountUSD,
          buys: pos.buys,
          sells: pos.sells,
          volume_buy_usd: pos.volumeBuy,
          volume_sell_usd: pos.volumeSell,
          avg_buy_price_usd: pos.avgBuyPriceUSD,
          avg_sell_price_usd: pos.avgSellPriceUSD,
          realized_pnl_usd: pos.realizedPnlUSD,
          unrealized_pnl_usd: pos.unrealizedPnlUSD,
          total_pnl_usd: pos.totalPnlUSD,
          first_trade_date: pos.firstDate,
          last_trade_date: pos.lastDate,
          synced_at: new Date().toISOString(),
        }));

        // Upsert (update on conflict)
        const { error: upsertError } = await supabase
          .from("kol_positions_cache")
          .upsert(positionsToInsert, {
            onConflict: "wallet_address,token_address,token_chain_id",
          });

        if (upsertError) throw upsertError;

        logger.log(
          `[syncWalletPositions] Synced ${positionsToInsert.length} positions for ${walletAddress}`,
        );
        return true;
      } catch (err: any) {
        logger.error(
          `[syncWalletPositions] Error syncing ${walletAddress}:`,
          err.message,
        );
        return false;
      }
    },
    [],
  );

  /**
   * Sync trades and positions for all KOLs in the database
   */
  const syncAllTrades = useCallback(async () => {
    try {
      logger.log(
        "[syncAllTrades] Starting trades & positions sync for all KOLs...",
      );

      // Get all KOL wallets from the stats cache
      const { data: kolWallets, error: fetchError } = await supabase
        .from("kol_stats_cache")
        .select("user_id, wallet_address, chain_type");

      if (fetchError) throw fetchError;

      if (!kolWallets || kolWallets.length === 0) {
        logger.log("[syncAllTrades] No KOL wallets to sync");
        return;
      }

      logger.log(
        `[syncAllTrades] Syncing trades & positions for ${kolWallets.length} KOLs`,
      );

      // Sync trades and positions in batches
      const batchSize = 3; // Smaller batch for rate limiting
      for (let i = 0; i < kolWallets.length; i += batchSize) {
        const batch = kolWallets.slice(i, i + batchSize);
        await Promise.all(
          batch.flatMap((kol) => {
            const blockchain = getBlockchainName(kol.chain_type || "solana");
            return [
              syncWalletTrades(kol.user_id, kol.wallet_address),
              syncWalletPositions(kol.user_id, kol.wallet_address, blockchain),
            ];
          }),
        );
      }

      // Refresh from cache
      await fetchFromCache();

      logger.log("[syncAllTrades] Trades & positions sync complete");
    } catch (err: any) {
      logger.error("[syncAllTrades] Error:", err.message);
    }
  }, [syncWalletTrades, syncWalletPositions, fetchFromCache]);

  return {
    trades: recentTrades,
    isLoading,
    error,
    refetch: fetchFromCache,
    syncWalletTrades,
    syncAllTrades,
  };
}

// ============================================
// Hook: Fetch single KOL's detailed stats
// ============================================

export function useKolDetailsMobula(
  walletAddress: string | null,
  chainType: "evm" | "solana" | "multi" = "solana",
) {
  const [stats, setStats] = useState<MobulaKolStats | null>(null);
  const [positions, setPositions] = useState<MobulaWalletPosition[]>([]);
  const [trades, setTrades] = useState<MobulaWalletTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blockchain = getBlockchainName(chainType);

  const fetchDetails = useCallback(async () => {
    if (!walletAddress) {
      setStats(null);
      setPositions([]);
      setTrades([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [statsData, positionsData, tradesData] = await Promise.all([
        getKolStats(walletAddress, { blockchain, period: "7d" }),
        getWalletPositions(walletAddress, { blockchain }).catch(() => []),
        getWalletTrades(walletAddress, {
          blockchain,
          limit: KOL_DEFAULT_LIMIT,
        }).catch(() => []),
      ]);

      setStats(statsData);
      setPositions(positionsData);
      setTrades(tradesData);
    } catch (err: any) {
      logger.error("[useKolDetailsMobula] Error:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, blockchain]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    stats,
    positions,
    trades,
    isLoading,
    error,
    refetch: fetchDetails,
  };
}

// ============================================
// Hook: Fetch wallet activity (unified feed)
// ============================================

export function useWalletActivityMobula(
  walletAddress: string | null,
  chainType: "evm" | "solana" | "multi" = "solana",
) {
  const [activity, setActivity] = useState<MobulaWalletActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const blockchain = getBlockchainName(chainType);

  const fetchActivity = useCallback(
    async (reset = false) => {
      if (!walletAddress) {
        setActivity([]);
        return;
      }

      if (reset) {
        offsetRef.current = 0;
        setHasMore(true);
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, pagination } = await getWalletActivity(walletAddress, {
          blockchains: blockchain,
          limit: KOL_DEFAULT_LIMIT,
          offset: offsetRef.current,
          order: "desc",
          filterSpam: true,
          backfillTransfers: false,
        });

        if (reset) {
          setActivity(data);
        } else {
          setActivity((prev) => [...prev, ...data]);
        }

        offsetRef.current += data.length;
        setHasMore(data.length >= KOL_DEFAULT_LIMIT);
      } catch (err: any) {
        logger.error("[useWalletActivityMobula] Error:", err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, blockchain],
  );

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchActivity(false);
    }
  }, [fetchActivity, isLoading, hasMore]);

  useEffect(() => {
    fetchActivity(true);
  }, [walletAddress, blockchain]);

  return {
    activity,
    isLoading,
    error,
    hasMore,
    refetch: () => fetchActivity(true),
    loadMore,
  };
}

// ============================================
// Helper functions
// ============================================

function isEntryStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const syncTime = new Date(lastSyncedAt).getTime();
  return Date.now() - syncTime > CACHE_TTL_MS;
}
