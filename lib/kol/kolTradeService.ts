/**
 * KOL Trade Service
 * Handles recording trades to Supabase for the KOL leaderboard
 * Supports multi-wallet (EVM + Solana) per user
 */

import { getWalletType } from "@/constants/chains";
import { supabase } from "@/lib/api/supabase/supabaseClient";
import type {
  ChainType,
  KolTradeInsert,
} from "@/lib/api/supabase/supabaseTypes";

// Solana chains (including variants)
const SOLANA_CHAINS = ["solana", "sol"];

/**
 * Determine chain type from chain name
 */
export function getChainType(chain: string): ChainType {
  const normalizedChain = chain.toLowerCase();
  if (SOLANA_CHAINS.includes(normalizedChain)) {
    return "solana";
  }
  // Use centralized chain configuration
  const walletType = getWalletType(normalizedChain);
  return walletType;
}

interface TradeParams {
  walletAddress: string;
  txHash: string;
  chain: string;
  tradeType: "buy" | "sell" | "swap";
  dexName?: string;
  blockNumber?: number;
  tokenIn?: {
    address?: string;
    symbol?: string;
    name?: string;
    amount?: number;
    decimals?: number;
    usdValue?: number;
    logo?: string;
  };
  tokenOut?: {
    address?: string;
    symbol?: string;
    name?: string;
    amount?: number;
    decimals?: number;
    usdValue?: number;
    logo?: string;
  };
  priceUsd?: number;
  gasUsed?: number;
  gasPrice?: number;
  feeUsd?: number;
  tradedAt?: Date;
}

/**
 * Get or create user wallet association
 * Returns the user_id and wallet_id
 */
async function getOrCreateUserWallet(
  walletAddress: string,
  chainType: ChainType,
): Promise<{ userId: string; walletId: string } | null> {
  // First, check if this wallet is already linked to a user
  const { data: existingWallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("id, user_id")
    .eq("wallet_address", walletAddress)
    .eq("chain_type", chainType)
    .single();

  if (existingWallet) {
    return { userId: existingWallet.user_id, walletId: existingWallet.id };
  }

  if (walletError && walletError.code !== "PGRST116") {
    console.error("Error checking wallet:", walletError);
    return null;
  }

  // Wallet not found - create a new user and wallet association
  // Note: In production, you might want to check if the user already exists
  // by some other identifier (like auth session) before creating a new one
  const { data: newUser, error: createUserError } = await supabase
    .from("users")
    .insert({})
    .select("id")
    .single();

  if (createUserError || !newUser) {
    console.error("Error creating user:", createUserError);
    return null;
  }

  // Create wallet association
  const { data: newWallet, error: createWalletError } = await supabase
    .from("user_wallets")
    .insert({
      user_id: newUser.id,
      wallet_address: walletAddress,
      chain_type: chainType,
      is_primary: true, // First wallet of this type is primary
    })
    .select("id")
    .single();

  if (createWalletError || !newWallet) {
    console.error("Error creating wallet:", createWalletError);
    return null;
  }

  return { userId: newUser.id, walletId: newWallet.id };
}

/**
 * Link an additional wallet to an existing user
 */
export async function linkWalletToUser(
  userId: string,
  walletAddress: string,
  chainType: ChainType,
  isPrimary: boolean = false,
): Promise<string | null> {
  // Check if wallet already exists (ignore chain type for uniqueness)
  const { data: existing } = await supabase
    .from("user_wallets")
    .select("id, user_id, chain_type")
    .eq("wallet_address", walletAddress)
    .single();

  if (existing) {
    console.log(
      "[linkWalletToUser] Wallet already linked to user:",
      existing.user_id,
      "chain:",
      existing.chain_type,
    );
    return existing.id;
  }

  // If setting as primary, first unset other primary wallets of this type
  if (isPrimary) {
    await supabase
      .from("user_wallets")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("chain_type", chainType);
  }

  const { data: wallet, error } = await supabase
    .from("user_wallets")
    .insert({
      user_id: userId,
      wallet_address: walletAddress,
      chain_type: chainType,
      is_primary: isPrimary,
    })
    .select("id, user_id")
    .single();

  if (error) {
    // Handle duplicate key - wallet exists but we couldn't read it (RLS issue)
    if (error.code === "23505") {
      console.log(
        "[linkWalletToUser] Wallet already exists (constraint), fetching directly...",
      );
      // Try to get it without RLS by querying again
      const { data: existingWallet } = await supabase
        .from("user_wallets")
        .select("id, user_id")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (existingWallet) {
        console.log(
          "[linkWalletToUser] Found existing wallet for user:",
          existingWallet.user_id,
        );
        return existingWallet.id;
      }
      // Still can't read it - RLS is blocking SELECT too
      console.warn(
        "[linkWalletToUser] Cannot read existing wallet - RLS issue",
      );
      return null;
    }
    console.error("Error linking wallet:", error);
    return null;
  }

  if (wallet) {
    console.log(
      "[linkWalletToUser] Successfully linked new wallet:",
      walletAddress.slice(0, 10) + "...",
      chainType,
      "to user:",
      userId,
    );
  }

  return wallet?.id ?? null;
}

/**
 * Get all wallets for a user
 */
export async function getUserWallets(userId: string) {
  const { data, error } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("Error fetching user wallets:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Calculate cost basis for a token based on previous buys
 * Uses FIFO (First In First Out) method
 */
async function calculateCostBasis(
  userId: string,
  tokenAddress: string,
  amountToSell: number,
): Promise<number> {
  try {
    // Get all buy trades for this token (where token_out_address matches)
    const { data: buyTrades, error } = await supabase
      .from("kol_trades")
      .select("token_out_amount, token_in_usd_value, traded_at")
      .eq("user_id", userId)
      .eq("token_out_address", tokenAddress)
      .order("traded_at", { ascending: true }); // FIFO

    if (error || !buyTrades || buyTrades.length === 0) {
      console.log(
        "[CostBasis] No buy trades found for token:",
        tokenAddress.slice(0, 10),
      );
      return 0;
    }

    // Calculate weighted average cost basis
    let totalCost = 0;
    let totalAmount = 0;

    for (const trade of buyTrades) {
      const amount = parseFloat(trade.token_out_amount) || 0;
      const cost = parseFloat(trade.token_in_usd_value) || 0;
      totalCost += cost;
      totalAmount += amount;
    }

    if (totalAmount === 0) return 0;

    // Average cost per token
    const avgCostPerToken = totalCost / totalAmount;

    // Cost basis for the amount being sold
    const costBasis = avgCostPerToken * amountToSell;

    console.log(
      `[CostBasis] Token: ${tokenAddress.slice(0, 10)}... Avg cost: $${avgCostPerToken.toFixed(6)} Amount: ${amountToSell} Basis: $${costBasis.toFixed(2)}`,
    );

    return costBasis;
  } catch (error) {
    console.error("[CostBasis] Error calculating:", error);
    return 0;
  }
}

/**
 * Record a trade to Supabase
 * Call this after a successful swap/trade transaction
 */
export async function recordTrade(params: TradeParams): Promise<void> {
  try {
    const chainType = getChainType(params.chain);

    // Get or create user + wallet
    const userWallet = await getOrCreateUserWallet(
      params.walletAddress,
      chainType,
    );

    if (!userWallet) {
      console.error("Failed to get/create user wallet");
      return;
    }

    // Calculate realized PnL for sells
    // If selling a token (token_in is NOT a base currency), calculate PnL
    const baseCurrencies = ["SOL", "ETH", "USDC", "USDT", "WETH", "WSOL"];
    const tokenInSymbol = params.tokenIn?.symbol?.toUpperCase() || "";
    const tokenOutSymbol = params.tokenOut?.symbol?.toUpperCase() || "";
    const isSellingToken =
      !baseCurrencies.includes(tokenInSymbol) &&
      baseCurrencies.includes(tokenOutSymbol);

    let realizedPnl = 0;
    let pnlPercentage = 0;

    if (isSellingToken && params.tokenIn?.address) {
      // This is a sell - try to calculate PnL based on previous buys
      const amountToSell =
        typeof params.tokenIn.amount === "number"
          ? params.tokenIn.amount
          : parseFloat(String(params.tokenIn.amount || 0));

      const costBasis = await calculateCostBasis(
        userWallet.userId,
        params.tokenIn.address,
        amountToSell,
      );

      if (costBasis > 0) {
        const sellValue =
          typeof params.tokenOut?.usdValue === "number"
            ? params.tokenOut.usdValue
            : parseFloat(String(params.tokenOut?.usdValue || 0));
        realizedPnl = sellValue - costBasis;
        pnlPercentage =
          costBasis > 0 ? ((sellValue - costBasis) / costBasis) * 100 : 0;
        console.log(
          `[Trade] Sell PnL: $${realizedPnl.toFixed(2)} (${pnlPercentage.toFixed(1)}%)`,
        );
      }
    }

    // Insert the trade
    const tradeData: KolTradeInsert = {
      user_id: userWallet.userId,
      wallet_id: userWallet.walletId,
      wallet_address: params.walletAddress,
      tx_hash: params.txHash,
      chain: params.chain,
      chain_type: chainType,
      trade_type: params.tradeType,
      dex_name: params.dexName ?? null,
      block_number: params.blockNumber ?? null,
      token_in_address: params.tokenIn?.address ?? null,
      token_in_symbol: params.tokenIn?.symbol ?? null,
      token_in_name: params.tokenIn?.name ?? null,
      token_in_amount: params.tokenIn?.amount ?? null,
      token_in_decimals: params.tokenIn?.decimals ?? null,
      token_in_usd_value: params.tokenIn?.usdValue ?? null,
      token_in_logo: params.tokenIn?.logo ?? null,
      token_out_address: params.tokenOut?.address ?? null,
      token_out_symbol: params.tokenOut?.symbol ?? null,
      token_out_name: params.tokenOut?.name ?? null,
      token_out_amount: params.tokenOut?.amount ?? null,
      token_out_decimals: params.tokenOut?.decimals ?? null,
      token_out_usd_value: params.tokenOut?.usdValue ?? null,
      token_out_logo: params.tokenOut?.logo ?? null,
      price_usd: params.priceUsd ?? null,
      gas_used: params.gasUsed ?? null,
      gas_price: params.gasPrice ?? null,
      fee_usd: params.feeUsd ?? null,
      realized_pnl_usd: realizedPnl,
      pnl_percentage: pnlPercentage,
      traded_at: (params.tradedAt || new Date()).toISOString(),
    };

    const { error: tradeError } = await supabase
      .from("kol_trades")
      .insert(tradeData);

    if (tradeError) {
      // Ignore duplicate (tx_hash, chain) errors
      if (tradeError.code === "23505") {
        console.log("Trade already recorded:", params.txHash);
        return;
      }
      console.error("Error recording trade:", tradeError);
      throw tradeError;
    }

    console.log(
      "Trade recorded successfully:",
      params.txHash,
      `(${chainType}/${params.chain})`,
    );

    // Update user stats
    await updateUserStats(userWallet.userId);
  } catch (error) {
    console.error("Failed to record trade:", error);
    // Don't throw - we don't want trade recording failures to break the app
  }
}

/**
 * Update kol_stats for a user after a trade
 */
async function updateUserStats(userId: string): Promise<void> {
  try {
    // Get all trades for this user
    const { data: trades, error: tradesError } = await supabase
      .from("kol_trades")
      .select("*")
      .eq("user_id", userId);

    if (tradesError || !trades || trades.length === 0) {
      console.log("[Stats] No trades found for user:", userId);
      return;
    }

    // Calculate stats
    const totalTrades = trades.length;
    const totalVolumeUsd = trades.reduce(
      (sum, t) => sum + (parseFloat(t.token_out_usd_value) || 0),
      0,
    );
    const totalPnlUsd = trades.reduce(
      (sum, t) => sum + (parseFloat(t.realized_pnl_usd) || 0),
      0,
    );
    const winningTrades = trades.filter(
      (t) => parseFloat(t.realized_pnl_usd) > 0,
    ).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgTradeSizeUsd = totalTrades > 0 ? totalVolumeUsd / totalTrades : 0;

    // Calculate 7d and 30d PnL
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trades7d = trades.filter(
      (t) => new Date(t.traded_at) >= sevenDaysAgo,
    );
    const trades30d = trades.filter(
      (t) => new Date(t.traded_at) >= thirtyDaysAgo,
    );

    const pnl7d = trades7d.reduce(
      (sum, t) => sum + (parseFloat(t.realized_pnl_usd) || 0),
      0,
    );
    const volume7d = trades7d.reduce(
      (sum, t) => sum + (parseFloat(t.token_out_usd_value) || 0),
      0,
    );

    const pnl30d = trades30d.reduce(
      (sum, t) => sum + (parseFloat(t.realized_pnl_usd) || 0),
      0,
    );
    const volume30d = trades30d.reduce(
      (sum, t) => sum + (parseFloat(t.token_out_usd_value) || 0),
      0,
    );

    // Get last trade timestamp
    const lastTradeAt = trades.reduce((latest, t) => {
      const tradeDate = new Date(t.traded_at);
      return tradeDate > latest ? tradeDate : latest;
    }, new Date(0));

    // Find best trade
    const bestTrade = trades.reduce(
      (best, t) => {
        const pnl = parseFloat(t.realized_pnl_usd) || 0;
        return pnl > (best?.pnl || 0)
          ? { pnl, token: t.token_out_symbol }
          : best;
      },
      { pnl: 0, token: null as string | null },
    );

    // Upsert stats
    const { error: upsertError } = await supabase.from("kol_stats").upsert(
      {
        user_id: userId,
        total_trades: totalTrades,
        total_volume_usd: totalVolumeUsd,
        total_realized_pnl_usd: totalPnlUsd,
        win_rate: winRate,
        avg_trade_size_usd: avgTradeSizeUsd,
        trades_7d: trades7d.length,
        volume_7d_usd: volume7d,
        pnl_7d_usd: pnl7d,
        trades_30d: trades30d.length,
        volume_30d_usd: volume30d,
        pnl_30d_usd: pnl30d,
        last_trade_at: lastTradeAt.toISOString(),
        best_trade_pnl_usd: bestTrade.pnl,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (upsertError) {
      console.error("[Stats] Error upserting stats:", upsertError);
    } else {
      console.log(
        "[Stats] Updated stats for user:",
        userId,
        "trades:",
        totalTrades,
        "volume:",
        totalVolumeUsd.toFixed(2),
      );
    }
  } catch (error) {
    console.error("[Stats] Failed to update stats:", error);
  }
}

/**
 * Get KOL trades for a specific wallet from Supabase
 */
export async function getKolWalletTrades(
  walletAddress: string,
  chainType?: ChainType,
  limit: number = 50,
) {
  let query = supabase
    .from("kol_trades")
    .select("*")
    .eq("wallet_address", walletAddress)
    .order("traded_at", { ascending: false })
    .limit(limit);

  if (chainType) {
    query = query.eq("chain_type", chainType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching wallet trades:", error);
    throw error;
  }

  return data;
}

/**
 * Get trades for a user across all their wallets
 */
export async function getUserTrades(userId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from("kol_trades")
    .select("*")
    .eq("user_id", userId)
    .order("traded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching user trades:", error);
    throw error;
  }

  return data;
}

/**
 * Calculate PnL for a trade (simplified version)
 * In production, this would need current prices and more sophisticated logic
 */
export async function updateTradePnL(
  tradeId: string,
  currentPrice: number,
): Promise<void> {
  const { data: trade, error: fetchError } = await supabase
    .from("kol_trades")
    .select("*")
    .eq("id", tradeId)
    .single();

  if (fetchError || !trade) {
    console.error("Error fetching trade for PnL update:", fetchError);
    return;
  }

  // Calculate unrealized PnL based on current price vs entry price
  if (trade.price_usd && trade.token_out_amount) {
    const entryValue = trade.token_out_amount * trade.price_usd;
    const currentValue = trade.token_out_amount * currentPrice;
    const unrealizedPnl = currentValue - entryValue;
    const pnlPercentage =
      entryValue > 0 ? ((currentValue - entryValue) / entryValue) * 100 : 0;

    const { error: updateError } = await supabase
      .from("kol_trades")
      .update({
        unrealized_pnl_usd: unrealizedPnl,
        pnl_percentage: pnlPercentage,
      })
      .eq("id", tradeId);

    if (updateError) {
      console.error("Error updating trade PnL:", updateError);
    }
  }
}

/**
 * Check if user is in the leaderboard (has Twitter linked)
 */
export async function isUserInLeaderboard(
  walletAddress: string,
): Promise<boolean> {
  // First find the user via their wallet
  const { data: wallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("user_id")
    .eq("wallet_address", walletAddress)
    .single();

  if (walletError || !wallet) {
    return false;
  }

  // Check if user has Twitter linked
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("twitter_id")
    .eq("id", wallet.user_id)
    .single();

  if (userError || !user) {
    return false;
  }

  return !!user.twitter_id;
}

/**
 * Get user ID from wallet address
 * Handles case-insensitive matching for EVM addresses
 */
export async function getUserIdFromWallet(
  walletAddress: string,
): Promise<string | null> {
  // First try exact match
  let { data, error } = await supabase
    .from("user_wallets")
    .select("user_id")
    .eq("wallet_address", walletAddress)
    .single();

  // If not found and it's an EVM address, try case-insensitive
  if (error?.code === "PGRST116" && walletAddress.startsWith("0x")) {
    const { data: iData } = await supabase
      .from("user_wallets")
      .select("user_id")
      .ilike("wallet_address", walletAddress)
      .single();
    data = iData;
    error = null;
  }

  if (error || !data) {
    return null;
  }

  return data.user_id;
}

/**
 * Get trade statistics for a user
 */
export async function getUserTradeStats(userId: string) {
  const { data, error } = await supabase
    .from("kol_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching user stats:", error);
    return null;
  }

  return data;
}
