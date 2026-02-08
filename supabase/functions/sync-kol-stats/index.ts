// Supabase Edge Function: sync-kol-stats
//
// Periodically syncs KOL wallet stats from Mobula API to Supabase cache.
// Deploy with: supabase functions deploy sync-kol-stats
//
// Schedule via Supabase Dashboard > Database > Extensions > pg_cron
// or see docs/supabase-schema-improved.sql for cron setup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// Types for Mobula API responses
interface MobulaWalletAnalysis {
  winRateDistribution: Record<string, number>;
  marketCapDistribution: Record<string, number>;
  periodTimeframes: Array<{ date: string; realized: number }>;
  stat: {
    totalValue: number;
    periodTotalPnlUSD: number;
    periodRealizedPnlUSD: number;
    periodRealizedRate: number;
    periodActiveTokensCount: number;
    periodWinCount: number;
    periodVolumeBuy: number;
    periodVolumeSell: number;
    periodBuys: number;
    periodSells: number;
    holdingTokensCount: number;
    holdingDuration: number;
    winRealizedPnl: number;
    winRealizedPnlRate: number;
    winToken?: {
      address: string;
      chainId: string;
      name: string;
      symbol: string;
      logo: string;
      decimals: number;
    };
  };
  labels: string[];
}

interface MobulaWalletTrade {
  chain_id: string;
  date: string;
  amount_usd: number;
  transaction_hash: string;
  base: string;
  quote: string;
  side: "buy" | "sell";
  amount_quote: number;
  amount_base: number;
  platform: string | null;
  pool_address: string;
  base_token: {
    symbol: string;
    name: string;
    address: string;
    priceUSD: number;
    liquidityUSD: number;
    marketCapUSD: number;
    priceChange24hPercentage: number;
    logo: string | null;
  };
  labels: string[];
}

// Config
const MOBULA_API_BASE =
  Deno.env.get("MOBULA_API_URL") || "https://api.mobula.io";
const MOBULA_API_KEY = Deno.env.get("MOBULA_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Rate limiting: max 5 requests per minute to /wallet/analysis
const ANALYSIS_RATE_LIMIT = 5;
const ANALYSIS_WINDOW_MS = 60 * 1000;

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Check if a chain type is Solana
 */
function isSolana(chainType: string): boolean {
  return chainType.toLowerCase() === "solana";
}

/**
 * EVM blockchains to query for wallet analysis
 * Mobula API requires the blockchain parameter for EVM chains
 */
const EVM_BLOCKCHAINS = ["BNB Smart Chain (BEP20)", "Ethereum", "Base"];

/**
 * Get Mobula blockchain parameter based on chain type
 * - Solana: Use "solana:solana" for Solana-specific analysis
 * - EVM: Returns array of blockchain strings to query
 */
function getBlockchainParam(chainType: string): string | undefined {
  if (isSolana(chainType)) {
    return "solana:solana";
  }
  // For EVM wallets, return undefined - we'll handle multi-chain separately
  return undefined;
}

/**
 * Get all blockchain params to query for a chain type
 * - Solana: Returns ["solana:solana"]
 * - EVM: Returns array of EVM blockchain names
 */
function getBlockchainsToQuery(chainType: string): string[] {
  if (isSolana(chainType)) {
    return ["solana:solana"];
  }
  // For EVM wallets, query each EVM chain separately
  return EVM_BLOCKCHAINS;
}

/**
 * Aggregate analysis results from multiple chains into a single result
 */
function aggregateAnalysisResults(
  results: MobulaWalletAnalysis[],
): MobulaWalletAnalysis {
  if (results.length === 0) {
    throw new Error("Cannot aggregate empty results");
  }

  if (results.length === 1) {
    return results[0];
  }

  // Find the best performing token across all chains
  let bestWinToken = results[0].stat.winToken;
  let bestWinPnl = results[0].stat.winRealizedPnl || 0;

  for (const result of results) {
    if ((result.stat.winRealizedPnl || 0) > bestWinPnl) {
      bestWinPnl = result.stat.winRealizedPnl || 0;
      bestWinToken = result.stat.winToken;
    }
  }

  // Aggregate stats by summing numeric values
  const aggregatedStat = {
    totalValue: results.reduce((sum, r) => sum + (r.stat.totalValue || 0), 0),
    periodTotalPnlUSD: results.reduce(
      (sum, r) => sum + (r.stat.periodTotalPnlUSD || 0),
      0,
    ),
    periodRealizedPnlUSD: results.reduce(
      (sum, r) => sum + (r.stat.periodRealizedPnlUSD || 0),
      0,
    ),
    periodRealizedRate:
      results.reduce((sum, r) => sum + (r.stat.periodRealizedRate || 0), 0) /
      results.length,
    periodActiveTokensCount: results.reduce(
      (sum, r) => sum + (r.stat.periodActiveTokensCount || 0),
      0,
    ),
    periodWinCount: results.reduce(
      (sum, r) => sum + (r.stat.periodWinCount || 0),
      0,
    ),
    periodVolumeBuy: results.reduce(
      (sum, r) => sum + (r.stat.periodVolumeBuy || 0),
      0,
    ),
    periodVolumeSell: results.reduce(
      (sum, r) => sum + (r.stat.periodVolumeSell || 0),
      0,
    ),
    periodBuys: results.reduce((sum, r) => sum + (r.stat.periodBuys || 0), 0),
    periodSells: results.reduce((sum, r) => sum + (r.stat.periodSells || 0), 0),
    holdingTokensCount: results.reduce(
      (sum, r) => sum + (r.stat.holdingTokensCount || 0),
      0,
    ),
    holdingDuration:
      results.reduce((sum, r) => sum + (r.stat.holdingDuration || 0), 0) /
      results.length,
    winRealizedPnl: bestWinPnl,
    winRealizedPnlRate:
      results.reduce((sum, r) => sum + (r.stat.winRealizedPnlRate || 0), 0) /
      results.length,
    winToken: bestWinToken,
  };

  // Merge win rate distributions
  const mergedWinRateDistribution: Record<string, number> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(
      result.winRateDistribution || {},
    )) {
      mergedWinRateDistribution[key] =
        (mergedWinRateDistribution[key] || 0) + value;
    }
  }

  // Merge market cap distributions
  const mergedMarketCapDistribution: Record<string, number> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(
      result.marketCapDistribution || {},
    )) {
      mergedMarketCapDistribution[key] =
        (mergedMarketCapDistribution[key] || 0) + value;
    }
  }

  // Merge period timeframes (combine and sort by date)
  const allTimeframes = results.flatMap((r) => r.periodTimeframes || []);
  const timeframeMap = new Map<string, number>();
  for (const tf of allTimeframes) {
    timeframeMap.set(tf.date, (timeframeMap.get(tf.date) || 0) + tf.realized);
  }
  const mergedTimeframes = Array.from(timeframeMap.entries())
    .map(([date, realized]) => ({ date, realized }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Merge labels (unique)
  const mergedLabels = [...new Set(results.flatMap((r) => r.labels || []))];

  return {
    stat: aggregatedStat,
    winRateDistribution: mergedWinRateDistribution,
    marketCapDistribution: mergedMarketCapDistribution,
    periodTimeframes: mergedTimeframes,
    labels: mergedLabels,
  };
}

/**
 * Fetch wallet analysis from Mobula API
 * @param wallet - Wallet address
 * @param blockchain - Optional blockchain (undefined for cross-chain EVM analysis)
 * @param period - Analysis period
 */
async function fetchWalletAnalysis(
  wallet: string,
  blockchain: string | undefined,
  period: "7d" | "30d" | "90d" = "7d",
): Promise<MobulaWalletAnalysis | null> {
  try {
    const params = new URLSearchParams({
      wallet,
      period,
    });

    // Only add blockchain param if specified (for Solana)
    // Omitting it for EVM gets cross-chain analysis
    if (blockchain) {
      params.set("blockchain", blockchain);
    }

    const url = `${MOBULA_API_BASE}/api/2/wallet/analysis?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: MOBULA_API_KEY ? `Bearer ${MOBULA_API_KEY}` : "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Mobula API error for ${wallet}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching analysis for ${wallet}:`, error);
    return null;
  }
}

/**
 * Fetch wallet trades from Mobula API
 * Note: The trades endpoint returns all trades across all chains - no blockchain filter needed
 * @param wallets - Array of wallet addresses (can include both Solana and EVM wallets)
 * @param limit - Number of trades to fetch
 */
async function fetchWalletTrades(
  wallets: string[],
  limit: number = 50,
): Promise<MobulaWalletTrade[]> {
  try {
    const params = new URLSearchParams({
      wallets: wallets.join(","),
      limit: limit.toString(),
      order: "desc",
    });

    const url = `${MOBULA_API_BASE}/api/1/wallet/trades?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: MOBULA_API_KEY ? `Bearer ${MOBULA_API_KEY}` : "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Mobula API error for trades ${wallets.join(",")}: ${response.status}`,
      );
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching trades for ${wallets.join(",")}:`, error);
    return [];
  }
}

/**
 * Get all wallets for a user (both Solana and EVM) - addresses only
 */
async function getUserWallets(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_wallets")
    .select("wallet_address")
    .eq("user_id", userId);

  if (error) {
    console.error(`Failed to fetch wallets for user ${userId}:`, error);
    return [];
  }

  return (data || []).map((w) => w.wallet_address);
}

/**
 * Get all wallets for a user with chain type and primary flag
 */
async function getUserWalletsWithChainType(
  userId: string,
): Promise<
  Array<{ wallet_address: string; chain_type: string; is_primary: boolean }>
> {
  const { data, error } = await supabase
    .from("user_wallets")
    .select("wallet_address, chain_type, is_primary")
    .eq("user_id", userId);

  if (error) {
    console.error(`Failed to fetch wallets for user ${userId}:`, error);
    return [];
  }

  return data || [];
}

/**
 * Sync a single KOL's stats to Supabase cache
 * Fetches ALL wallets for a user (both Solana and EVM) and aggregates stats
 * - Solana: Uses blockchain=solana:solana
 * - EVM: Queries BNB Smart Chain, Ethereum, and Base separately
 */
async function syncKolStats(
  userId: string,
  _primaryWalletAddress: string,
  _primaryChainType: string,
): Promise<boolean> {
  // Get ALL wallets for this user
  const userWallets = await getUserWalletsWithChainType(userId);

  if (userWallets.length === 0) {
    console.log(`No wallets found for user ${userId}`);
    return false;
  }

  console.log(
    `Syncing stats for user ${userId} with ${userWallets.length} wallet(s): ${userWallets.map((w) => `${w.wallet_address} (${w.chain_type})`).join(", ")}`,
  );

  // Aggregate stats from all wallets
  const allAnalysis7d: MobulaWalletAnalysis[] = [];
  const allAnalysis30d: MobulaWalletAnalysis[] = [];
  let primaryWallet = _primaryWalletAddress;
  let primaryChainType = _primaryChainType;

  for (const wallet of userWallets) {
    const blockchainsToQuery = getBlockchainsToQuery(wallet.chain_type);

    if (isSolana(wallet.chain_type)) {
      // Single query for Solana
      const [analysis7d, analysis30d] = await Promise.all([
        fetchWalletAnalysis(wallet.wallet_address, blockchainsToQuery[0], "7d"),
        fetchWalletAnalysis(
          wallet.wallet_address,
          blockchainsToQuery[0],
          "30d",
        ),
      ]);
      if (analysis7d) allAnalysis7d.push(analysis7d);
      if (analysis30d) allAnalysis30d.push(analysis30d);
    } else {
      // For EVM, fetch from each chain
      for (const blockchain of blockchainsToQuery) {
        const [result7d, result30d] = await Promise.all([
          fetchWalletAnalysis(wallet.wallet_address, blockchain, "7d"),
          fetchWalletAnalysis(wallet.wallet_address, blockchain, "30d"),
        ]);
        if (result7d) allAnalysis7d.push(result7d);
        if (result30d) allAnalysis30d.push(result30d);

        // Small delay between chain queries
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Track primary wallet for storage
    if (wallet.is_primary) {
      primaryWallet = wallet.wallet_address;
      primaryChainType = wallet.chain_type;
    }
  }

  // Aggregate all results
  const analysis7d =
    allAnalysis7d.length > 0 ? aggregateAnalysisResults(allAnalysis7d) : null;
  const analysis30d =
    allAnalysis30d.length > 0 ? aggregateAnalysisResults(allAnalysis30d) : null;

  if (!analysis7d) {
    console.error(`Failed to fetch 7d analysis for user ${userId}`);
    return false;
  }

  const {
    stat,
    winRateDistribution,
    marketCapDistribution,
    labels,
    periodTimeframes,
  } = analysis7d;
  const stat30d = analysis30d?.stat;

  // Calculate win rate
  const totalTrades = (stat.periodBuys || 0) + (stat.periodSells || 0);
  const winRate =
    totalTrades > 0 ? ((stat.periodWinCount || 0) / totalTrades) * 100 : 0;

  // Determine chain_type for storage (multi if user has both)
  const hasSolana = userWallets.some((w) => isSolana(w.chain_type));
  const hasEvm = userWallets.some((w) => !isSolana(w.chain_type));
  const chainType =
    hasSolana && hasEvm ? "multi" : hasSolana ? "solana" : "evm";

  console.log(
    `Fetched aggregated stats: ${totalTrades} trades, ${winRate.toFixed(1)}% win rate`,
  );

  // Upsert to kol_stats_cache
  const { error } = await supabase.from("kol_stats_cache").upsert(
    {
      user_id: userId,
      wallet_address: primaryWallet,
      chain_type: chainType,
      total_value_usd: stat.totalValue || 0,
      pnl_7d_usd: stat.periodRealizedPnlUSD || 0,
      pnl_30d_usd: stat30d?.periodRealizedPnlUSD || 0,
      realized_pnl_usd: stat.periodRealizedPnlUSD || 0,
      unrealized_pnl_usd:
        (stat.periodTotalPnlUSD || 0) - (stat.periodRealizedPnlUSD || 0),
      total_trades: totalTrades,
      trades_7d: totalTrades,
      trades_30d: (stat30d?.periodBuys || 0) + (stat30d?.periodSells || 0),
      buys_7d: stat.periodBuys || 0,
      sells_7d: stat.periodSells || 0,
      volume_buy_usd: stat.periodVolumeBuy || 0,
      volume_sell_usd: stat.periodVolumeSell || 0,
      total_volume_usd:
        (stat.periodVolumeBuy || 0) + (stat.periodVolumeSell || 0),
      volume_7d_usd: (stat.periodVolumeBuy || 0) + (stat.periodVolumeSell || 0),
      volume_30d_usd:
        (stat30d?.periodVolumeBuy || 0) + (stat30d?.periodVolumeSell || 0),
      win_rate: winRate,
      win_count: stat.periodWinCount || 0,
      holding_tokens_count: stat.holdingTokensCount || 0,
      avg_holding_duration_days: stat.holdingDuration || 0,
      win_rate_distribution: winRateDistribution || {},
      market_cap_distribution: marketCapDistribution || {},
      period_pnl_data: periodTimeframes || [],
      best_token_address: stat.winToken?.address || null,
      best_token_symbol: stat.winToken?.symbol || null,
      best_token_name: stat.winToken?.name || null,
      best_token_logo: stat.winToken?.logo || null,
      best_token_chain: stat.winToken?.chainId || null,
      labels: labels || [],
      last_synced_at: new Date().toISOString(),
      sync_period: "7d",
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error(`Failed to upsert stats for user ${userId}:`, error);
    return false;
  }

  console.log(
    `Successfully synced stats for user ${userId} (${userWallets.length} wallets aggregated)`,
  );
  return true;
}

/**
 * Sync trades for a user
 * Fetches all wallets (Solana + EVM) and queries trades for all of them in a single API call
 */
async function syncKolTrades(
  userId: string,
  _walletAddress: string,
  _chainType: string,
): Promise<number> {
  // Get all wallets for this user (both Solana and EVM)
  const userWallets = await getUserWallets(userId);

  if (userWallets.length === 0) {
    console.log(`No wallets found for user ${userId}`);
    return 0;
  }

  console.log(
    `Syncing trades for user ${userId} with ${userWallets.length} wallets: ${userWallets.join(", ")}`,
  );

  const allTrades = await fetchWalletTrades(userWallets, 50);

  if (allTrades.length === 0) {
    console.log(`No trades found for ${_walletAddress}`);
    return 0;
  }

  console.log(`Found ${allTrades.length} trades`);

  // Transform trades for cache
  const tradesToInsert = allTrades.map((trade) => ({
    user_id: userId,
    wallet_address: trade.transaction_sender_address,
    tx_hash: trade.transaction_hash,
    chain_id: trade.chain_id,
    trade_type: trade.side,
    traded_at: trade.date,
    amount_usd: trade.amount_usd,
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
    quote_token_symbol: "USDC",
    quote_token_name: "USD Coin",
    quote_token_logo: null,
    platform: trade.platform,
    pool_address: trade.pool_address,
    trader_labels: trade.labels,
    synced_at: new Date().toISOString(),
  }));

  // Upsert trades (ignore duplicates)
  const { error } = await supabase
    .from("kol_trades_cache")
    .upsert(tradesToInsert, {
      onConflict: "tx_hash,chain_id",
      ignoreDuplicates: true,
    });

  if (error) {
    console.error(`Failed to upsert trades for ${_walletAddress}:`, error);
    return 0;
  }

  console.log(`Synced ${tradesToInsert.length} trades for ${_walletAddress}`);
  return tradesToInsert.length;
}

/**
 * Update leaderboard rankings
 */
async function updateRankings(): Promise<void> {
  console.log("Updating leaderboard rankings...");

  const { error } = await supabase.rpc("update_kol_rankings");

  if (error) {
    console.error("Failed to update rankings:", error);
  } else {
    console.log("Rankings updated successfully");
  }
}

/**
 * Get stale entries that need syncing
 */
async function getStaleEntries(): Promise<
  Array<{
    user_id: string;
    wallet_address: string;
    chain_type: string;
  }>
> {
  const staleThreshold = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("kol_stats_cache")
    .select("user_id, wallet_address, chain_type, last_synced_at")
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleThreshold}`)
    .limit(ANALYSIS_RATE_LIMIT); // Respect rate limit

  if (error) {
    console.error("Failed to fetch stale entries:", error);
    return [];
  }

  return data || [];
}

/**
 * Get all wallets that need initial sync (new users)
 * Returns unique users who don't have cached stats yet
 */
async function getWalletsNeedingSync(): Promise<
  Array<{
    user_id: string;
    wallet_address: string;
    chain_type: string;
  }>
> {
  // First get all user_ids that already have cached stats
  const { data: cachedUsers, error: cacheError } = await supabase
    .from("kol_stats_cache")
    .select("user_id");

  if (cacheError) {
    console.error("Failed to fetch cached users:", cacheError);
    return [];
  }

  const cachedUserIds = (cachedUsers || []).map((u) => u.user_id);

  // Get primary wallets for users without cached stats
  // We only return one entry per user here, but syncKolStats will fetch all their wallets
  let query = supabase
    .from("user_wallets")
    .select(
      `
      user_id,
      wallet_address,
      chain_type
    `,
    )
    .eq("is_primary", true)
    .limit(ANALYSIS_RATE_LIMIT);

  // Filter out users who already have cached stats
  if (cachedUserIds.length > 0) {
    query = query.not("user_id", "in", `(${cachedUserIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch wallets needing sync:", error);
    return [];
  }

  return data || [];
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    // Also allow scheduled invocations
    const isScheduled = req.headers.get("x-supabase-cron") === "true";
    if (!isScheduled && !authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  console.log("Starting KOL stats sync...");
  const startTime = Date.now();

  try {
    // Check for immediate sync request (specific user)
    let body: { user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON - proceed with normal batch sync
    }

    // If user_id is provided, sync just that user immediately
    if (body.user_id) {
      console.log(`Immediate sync requested for user: ${body.user_id}`);

      // Get user's primary wallet
      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("wallet_address, chain_type")
        .eq("user_id", body.user_id)
        .eq("is_primary", true)
        .single();

      if (!wallet) {
        return new Response(
          JSON.stringify({ success: false, error: "User wallet not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const statsSuccess = await syncKolStats(
        body.user_id,
        wallet.wallet_address,
        wallet.chain_type,
      );

      if (statsSuccess) {
        await syncKolTrades(
          body.user_id,
          wallet.wallet_address,
          wallet.chain_type,
        );
        await updateRankings();
      }

      return new Response(
        JSON.stringify({ success: statsSuccess, user_id: body.user_id }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Normal batch sync
    // Get entries needing sync
    const [staleEntries, newEntries] = await Promise.all([
      getStaleEntries(),
      getWalletsNeedingSync(),
    ]);

    // Prioritize NEW users over stale entries (new users should appear in leaderboard quickly)
    const allEntries = [...newEntries, ...staleEntries].slice(
      0,
      ANALYSIS_RATE_LIMIT,
    );

    console.log(
      `Found ${allEntries.length} entries to sync (${newEntries.length} new, ${staleEntries.length} stale)`,
    );

    let successCount = 0;
    let tradeCount = 0;

    // Sync each entry (respecting rate limit)
    for (const entry of allEntries) {
      const statsSuccess = await syncKolStats(
        entry.user_id,
        entry.wallet_address,
        entry.chain_type,
      );

      if (statsSuccess) {
        successCount++;

        // Also sync trades
        const syncedTrades = await syncKolTrades(
          entry.user_id,
          entry.wallet_address,
          entry.chain_type,
        );
        tradeCount += syncedTrades;
      }

      // Small delay to be nice to Mobula API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Update rankings after sync
    if (successCount > 0) {
      await updateRankings();
    }

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      synced: successCount,
      trades: tradeCount,
      total: allEntries.length,
      durationMs: duration,
    };

    console.log("Sync complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
