/**
 * Mobula Wallet Service
 * Centralized service for fetching wallet data from Mobula API
 * Replaces manual trade tracking with Mobula's pre-calculated analytics
 */

// Types for Mobula wallet API responses
export interface MobulaWalletAnalysis {
  winRateDistribution: {
    ">500%": number;
    "200%-500%": number;
    "50%-200%": number;
    "0%-50%": number;
    "-50%-0%": number;
    "<-50%": number;
  };
  marketCapDistribution: {
    ">1000M": number;
    ">100M": number;
    "10M-100M": number;
    "1M-10M": number;
    "100k-1M": number;
    "<100k": number;
  };
  periodTimeframes: Array<{
    date: string;
    realized: number;
  }>;
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
    periodBuyTokens: number;
    periodSellTokens: number;
    periodTradingTokens: number;
    holdingTokensCount: number;
    holdingDuration: number;
    tradingTimeFrames: number;
    winRealizedPnl: number;
    winRealizedPnlRate: number;
    nativeBalance?: {
      rawBalance: string;
      formattedBalance: number;
      assetId: number;
      chainId: string;
      address: string;
      decimals: number;
      name: string;
      symbol: string;
      logo: string;
      price: number;
      balanceUSD: number;
    };
    winToken?: {
      address: string;
      chainId: string;
      name: string;
      symbol: string;
      logo: string;
      decimals: number;
    };
    fundingInfo?: {
      from: string;
      date: string;
      chainId: string;
      txHash: string;
      amount: string;
      fromWalletLogo: string;
      fromWalletTag: string;
    };
  };
  labels: string[];
}

export interface MobulaWalletPosition {
  token: {
    address: string;
    chainId: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUSD: number;
    logo: string | null;
    liquidityUSD: number;
    marketCapUSD: number;
    priceChange24hPercentage: number;
    volume24hUSD: number;
  };
  balance: number;
  rawBalance: string;
  amountUSD: number;
  buys: number;
  sells: number;
  volumeBuyToken: number;
  volumeSellToken: number;
  volumeBuy: number;
  volumeSell: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
  realizedPnlUSD: number;
  unrealizedPnlUSD: number;
  totalPnlUSD: number;
  firstDate: string;
  lastDate: string;
}

export interface MobulaWalletTrade {
  chain_id: string;
  swap_type: string;
  date: string;
  amount_usd: number;
  pool_address: string;
  token0_address: string;
  token1_address: string;
  transaction_sender_address: string;
  transaction_hash: string;
  base: string;
  quote: string;
  side: "buy" | "sell";
  amount_quote: number;
  amount_base: number;
  amount_quote_raw: string;
  amount_base_raw: string;
  price_usd_token0: number;
  price_usd_token1: number;
  base_token: {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    chainId: string;
    priceUSD: number;
    liquidityUSD: number;
    volume24hUSD: number;
    marketCapUSD: number;
    priceChange24hPercentage: number;
    logo: string | null;
  };
  labels: string[];
  platform: string | null;
}

export interface MobulaWalletActivity {
  chainId: string;
  txDateMs: number;
  txDateIso: string;
  txHash: string;
  txRawFeesNative: string;
  txFeesNativeUsd: number;
  txBlockNumber: number;
  txIndex: number;
  actions: Array<
    | {
        model: "swap";
        swapType: string;
        swapAmountOut: number;
        swapAmountIn: number;
        swapPriceUsdTokenOut: number;
        swapPriceUsdTokenIn: number;
        swapAmountUsd: number;
        swapTransactionSenderAddress: string;
        swapBaseAddress: string;
        swapQuoteAddress: string;
        swapAssetIn: {
          id: number | null;
          name: string;
          symbol: string;
          decimals: number;
          price: number;
          liquidity: number;
          logo: string | null;
          contract: string;
        };
        swapAssetOut: {
          id: number | null;
          name: string;
          symbol: string;
          decimals: number;
          price: number;
          liquidity: number;
          logo: string | null;
          contract: string;
        };
      }
    | {
        model: "transfer";
        transferAmount: number;
        transferAmountUsd: number;
        transferType: string;
        transferFromAddress: string;
        transferToAddress: string;
        transferAsset: {
          id: number | null;
          name: string;
          symbol: string;
          decimals: number;
          price: number;
          logo: string | null;
          contract: string;
        };
      }
  >;
}

export interface MobulaPortfolioAsset {
  contracts_balances: Array<{
    address: string;
    balance: number;
    balanceRaw: string;
    chainId: string;
    decimals: number;
  }>;
  cross_chain_balances: Record<string, number>;
  price_change_24h: number;
  estimated_balance: number;
  price: number;
  token_balance: number;
  allocation: number;
  asset: {
    id: number;
    name: string;
    symbol: string;
    decimals: string[];
    contracts: string[];
    blockchains: string[];
    logo: string;
  };
  wallets: string[];
  realized_pnl: number;
  unrealized_pnl: number;
  price_bought: number;
  total_invested: number;
  min_buy_price: number;
  max_buy_price: number;
}

export interface MobulaPortfolio {
  total_wallet_balance: number;
  wallets: string[];
  assets: MobulaPortfolioAsset[];
  balances_length: number;
  win_rate: number;
  tokens_distribution: {
    "10x+": number;
    "4x - 10x": number;
    "2x - 4x": number;
    "10% - 2x": number;
    "-10% - 10%": number;
    "-50% - -10%": number;
    "-100% - -50%": number;
  };
  pnl_history: {
    "1y": number[][];
    "7d": number[][];
    "24h": number[][];
    "30d": number[][];
  };
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  total_pnl_history: {
    "24h": { realized: number; unrealized: number };
    "7d": { realized: number; unrealized: number };
    "30d": { realized: number; unrealized: number };
    "1y": { realized: number; unrealized: number };
  };
}

export type AnalysisPeriod = "1d" | "7d" | "30d" | "90d";

// API base URL
const MOBULA_API_BASE =
  process.env.EXPO_PUBLIC_MOBULA_API_URL || "https://api.mobula.io";
const MOBULA_API_KEY = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";

/**
 * Generic fetch wrapper for Mobula API
 */
async function mobulaFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  // Filter out undefined params
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const url = `${MOBULA_API_BASE}/api${endpoint}?${searchParams.toString()}`;

  console.log(`[MobulaWallet] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: MOBULA_API_KEY ? `Bearer ${MOBULA_API_KEY}` : "",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Mobula API error (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Get comprehensive wallet trading analysis
 * This is the key endpoint for KOL stats - provides:
 * - Win rate distribution
 * - PnL stats (realized/unrealized)
 * - Trading volume
 * - Holding patterns
 * - Labels (smart money, etc.)
 */
export async function getWalletAnalysis(
  wallet: string,
  options: {
    blockchain?: string;
    period?: AnalysisPeriod;
  } = {},
): Promise<MobulaWalletAnalysis> {
  const { blockchain, period = "7d" } = options;

  const response = await mobulaFetch<{ data: MobulaWalletAnalysis }>(
    "/2/wallet/analysis",
    {
      wallet,
      blockchain,
      period,
    },
  );

  return response.data;
}

/**
 * Get wallet positions with PnL
 * Returns all token positions with:
 * - Current balance and value
 * - Average buy/sell prices
 * - Realized and unrealized PnL per token
 */
export async function getWalletPositions(
  wallet: string,
  options: {
    blockchain: string; // Required per Mobula docs
    backfill?: boolean;
  },
): Promise<MobulaWalletPosition[]> {
  const { blockchain, backfill = false } = options;

  if (!blockchain) {
    console.warn("[getWalletPositions] blockchain is required by Mobula API");
  }

  const response = await mobulaFetch<{ data: MobulaWalletPosition[] }>(
    "/2/wallet/positions",
    {
      wallet,
      blockchain,
      backfill,
    },
  );

  return response.data || [];
}

/**
 * Get wallet trades history
 * Returns detailed swap trades with:
 * - Token info
 * - USD values
 * - Side (buy/sell)
 * - Labels
 */
export async function getWalletTrades(
  wallet: string,
  options: {
    blockchain?: string;
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    from?: number;
    to?: number;
  } = {},
): Promise<MobulaWalletTrade[]> {
  const {
    blockchain,
    limit = 100,
    offset = 0,
    order = "desc",
    from,
    to,
  } = options;

  const response = await mobulaFetch<{ data: MobulaWalletTrade[] }>(
    "/1/wallet/trades",
    {
      wallet,
      blockchain,
      limit,
      offset,
      order,
      from: from?.toString(),
      to: to?.toString(),
    },
  );

  return response.data;
}

/**
 * Get wallet activity (transfers, swaps, vault ops)
 * More comprehensive than trades - includes all tx types
 */
export async function getWalletActivity(
  wallet: string,
  options: {
    blockchains?: string;
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    filterSpam?: boolean;
    unlistedAssets?: boolean;
    backfillTransfers?: boolean;
    cursorHash?: string;
    cursorDirection?: "before" | "after";
  } = {},
): Promise<{
  data: MobulaWalletActivity[];
  pagination: {
    page: number;
    offset: number;
    limit: number;
    pageEntries: number;
  };
  backfillStatus?: "processed" | "processing" | "pending";
}> {
  const {
    blockchains,
    limit = 100,
    offset = 0,
    order = "desc",
    filterSpam = true,
    unlistedAssets = true,
    backfillTransfers = false,
    cursorHash,
    cursorDirection,
  } = options;

  const response = await mobulaFetch<{
    data: MobulaWalletActivity[];
    pagination: {
      page: number;
      offset: number;
      limit: number;
      pageEntries: number;
    };
    backfillStatus?: "processed" | "processing" | "pending";
  }>("/2/wallet/activity", {
    wallet,
    blockchains,
    limit,
    offset,
    order,
    filterSpam,
    unlistedAssets,
    backfillTransfers,
    cursor_hash: cursorHash,
    cursor_direction: cursorDirection,
  });

  return response;
}

/**
 * Get wallet portfolio (current holdings)
 * Returns:
 * - Total balance
 * - All assets with allocations
 * - PnL per asset
 * - Win rate
 * - Token distribution
 */
export async function getWalletPortfolio(
  wallet: string | string[],
  options: {
    blockchains?: string;
    cache?: boolean;
    stale?: number;
    minliq?: number;
    filterSpam?: boolean;
    shouldFetchPriceChange?: "24h" | false;
  } = {},
): Promise<MobulaPortfolio> {
  const {
    blockchains,
    cache = true,
    stale = 300,
    minliq = 1000,
    filterSpam = true,
    shouldFetchPriceChange = "24h",
  } = options;

  const walletParam = Array.isArray(wallet) ? wallet.join(",") : wallet;

  const response = await mobulaFetch<{ data: MobulaPortfolio }>(
    "/1/wallet/portfolio",
    {
      wallet: walletParam,
      blockchains,
      cache,
      stale,
      minliq,
      filterSpam,
      shouldFetchPriceChange: shouldFetchPriceChange || undefined,
    },
  );

  return response.data;
}

/**
 * Get historical net worth
 */
export async function getWalletHistory(
  wallet: string | string[],
  options: {
    blockchains?: string;
    from?: number;
    to?: number;
    period?: "5min" | "15min" | "1h" | "6h" | "1d" | "7d";
    minliq?: number;
    filterSpam?: boolean;
  } = {},
): Promise<{
  wallets: string[];
  balance_usd: number;
  balance_history: number[][];
}> {
  const {
    blockchains,
    from,
    to,
    period = "1d",
    minliq = 1000,
    filterSpam = false,
  } = options;

  const walletParam = Array.isArray(wallet) ? wallet.join(",") : wallet;

  const response = await mobulaFetch<{
    data: {
      wallets: string[];
      balance_usd: number;
      balance_history: number[][];
    };
  }>("/1/wallet/history", {
    wallet: walletParam,
    blockchains,
    from: from?.toString(),
    to: to?.toString(),
    period,
    minliq,
    filterSpam,
  });

  return response.data;
}

// ============================================
// Aggregated KOL Stats from Mobula Data
// ============================================

/**
 * Complete KOL stats derived from Mobula APIs
 * This replaces the need for manual aggregations in Supabase
 */
export interface MobulaKolStats {
  // From wallet/analysis
  totalValue: number;
  pnl7dUsd: number;
  pnl30dUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  winRate: number;
  winCount: number;
  totalTrades: number;
  volumeBuy: number;
  volumeSell: number;
  totalVolume: number;
  holdingTokensCount: number;
  avgHoldingDuration: number;

  // Win rate distribution
  winRateDistribution: MobulaWalletAnalysis["winRateDistribution"];

  // Market cap preferences
  marketCapDistribution: MobulaWalletAnalysis["marketCapDistribution"];

  // Best token info
  winToken: MobulaWalletAnalysis["stat"]["winToken"] | null;

  // Labels (smart money, early adopter, etc.)
  labels: string[];

  // Period timeframes for charts
  periodPnl: Array<{ date: string; realized: number }>;
}

/**
 * Fetch comprehensive KOL stats using Mobula APIs
 * This is the main function to get all stats for a KOL
 */
export async function getKolStats(
  wallet: string,
  options: {
    blockchain?: string;
    period?: AnalysisPeriod;
  } = {},
): Promise<MobulaKolStats> {
  const { blockchain, period = "7d" } = options;

  // Fetch analysis data - this is the main source
  const analysis = await getWalletAnalysis(wallet, { blockchain, period });
  const {
    stat,
    winRateDistribution,
    marketCapDistribution,
    labels,
    periodTimeframes,
  } = analysis;

  // Calculate win rate from distribution
  const totalWins =
    winRateDistribution[">500%"] +
    winRateDistribution["200%-500%"] +
    winRateDistribution["50%-200%"] +
    winRateDistribution["0%-50%"];

  const totalLosses =
    winRateDistribution["-50%-0%"] + winRateDistribution["<-50%"];

  const totalTrades = totalWins + totalLosses;
  const calculatedWinRate =
    totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  return {
    totalValue: stat.totalValue,
    pnl7dUsd: period === "7d" ? stat.periodRealizedPnlUSD : 0,
    pnl30dUsd: period === "30d" ? stat.periodRealizedPnlUSD : 0,
    realizedPnlUsd: stat.periodRealizedPnlUSD,
    unrealizedPnlUsd: stat.periodTotalPnlUSD - stat.periodRealizedPnlUSD,
    winRate: stat.winRealizedPnlRate || calculatedWinRate,
    winCount: stat.periodWinCount,
    totalTrades: stat.periodBuys + stat.periodSells,
    volumeBuy: stat.periodVolumeBuy,
    volumeSell: stat.periodVolumeSell,
    totalVolume: stat.periodVolumeBuy + stat.periodVolumeSell,
    holdingTokensCount: stat.holdingTokensCount,
    avgHoldingDuration: stat.holdingDuration,
    winRateDistribution,
    marketCapDistribution,
    winToken: stat.winToken || null,
    labels,
    periodPnl: periodTimeframes,
  };
}

/**
 * Fetch KOL stats for multiple periods at once
 * Useful for displaying 7d, 30d, and all-time stats
 */
export async function getKolStatsMultiPeriod(
  wallet: string,
  options: {
    blockchain?: string;
  } = {},
): Promise<{
  stats7d: MobulaKolStats;
  stats30d: MobulaKolStats;
  stats90d: MobulaKolStats;
}> {
  const { blockchain } = options;

  // Fetch all periods in parallel
  const [stats7d, stats30d, stats90d] = await Promise.all([
    getKolStats(wallet, { blockchain, period: "7d" }),
    getKolStats(wallet, { blockchain, period: "30d" }),
    getKolStats(wallet, { blockchain, period: "90d" }),
  ]);

  return { stats7d, stats30d, stats90d };
}
