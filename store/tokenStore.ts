/**
 * Token Detail Store - State management for token detail page
 */

import { create } from "zustand";

export interface TokenDetails {
  // Basic info
  address: string;
  blockchain: string;
  name: string;
  symbol: string;
  logo?: string;
  description?: string;
  deployer?: string;

  // Pricing
  price: number;
  priceChange1m?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange4h?: number;
  priceChange6h?: number;
  priceChange12h?: number;
  priceChange24h?: number;

  // All-time high/low
  athUSD?: number;
  atlUSD?: number;
  athDate?: string;
  atlDate?: string;

  // Market data
  marketCap?: number;
  fullyDilutedValuation?: number;
  liquidity?: number;
  liquidityMaxUSD?: number;
  approximateReserveUSD?: number;

  // Volume by timeframe
  volume1m?: number;
  volume5m?: number;
  volume15m?: number;
  volume1h?: number;
  volume4h?: number;
  volume6h?: number;
  volume12h?: number;
  volume24h?: number;
  volumeBuy24h?: number;
  volumeSell24h?: number;

  // Token info
  totalSupply?: number;
  circulatingSupply?: number;
  decimals?: number;

  // Holder data
  holdersCount?: number;
  top10HoldingsPercentage?: number;
  top50HoldingsPercentage?: number;
  top100HoldingsPercentage?: number;
  top200HoldingsPercentage?: number;
  devHoldingsPercentage?: number;
  insidersHoldingsPercentage?: number;
  bundlersHoldingsPercentage?: number;
  snipersHoldingsPercentage?: number;
  proTradersHoldingsPercentage?: number;

  // Transactions by timeframe
  trades1m?: number;
  trades5m?: number;
  trades15m?: number;
  trades1h?: number;
  trades4h?: number;
  trades6h?: number;
  trades12h?: number;
  trades24h?: number;
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  buyers24h?: number;
  sellers24h?: number;
  traders24h?: number;
  makers24h?: number;

  // Organic trading metrics (excludes bots/snipers)
  organicTrades24h?: number;
  organicTraders24h?: number;
  organicVolume24h?: number;

  // Fees paid
  feesPaid1h?: number;
  feesPaid24h?: number;
  totalFeesPaid?: number;

  // Socials
  twitter?: string;
  telegram?: string;
  website?: string;
  discord?: string;
  socials?: {
    twitter?: string;
    website?: string;
    telegram?: string;
    others?: Record<string, string>;
    uri?: string;
  };

  // Pool/Pair info
  poolAddress?: string;
  quoteToken?: {
    address: string;
    symbol: string;
    name: string;
  };
  exchange?: {
    name: string;
    logo?: string;
  };

  // Timestamps
  createdAt?: string;
  bondedAt?: string;

  // Bonding curve
  bondingPercentage?: number;
  isBonded?: boolean;

  // Security flags
  security?: {
    honeypot?: boolean;
    rugPull?: boolean;
    scam?: boolean;
    verified?: boolean;
  };

  // Dexscreener info
  dexscreenerListed?: boolean;
  dexscreenerAdPaid?: boolean;

  // Deployer/Twitter metrics
  deployerMigrationsCount?: number;
  twitterReusesCount?: number;
  twitterRenameCount?: number;
}

export interface Trade {
  id: string;
  type: "buy" | "sell";
  amount: number;
  amountUsd: number;
  price: number;
  maker: string;
  timestamp: string;
  txHash: string;
}

export interface Holder {
  address: string;
  balance: number;
  percentage: number;
  isContract?: boolean;
  label?: string;
}

export interface TokenState {
  // Token data
  token: TokenDetails | null;
  trades: Trade[];
  holders: Holder[];

  // Loading states
  isLoading: boolean;
  isLoadingTrades: boolean;
  isLoadingHolders: boolean;

  // Errors
  error: string | null;

  // Chart settings
  chartInterval: string;
  chartType: "candles" | "line";

  // Actions
  setToken: (token: TokenDetails) => void;
  updateToken: (updates: Partial<TokenDetails>) => void;
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  addTradesBatch: (trades: Trade[]) => void;
  setHolders: (holders: Holder[]) => void;
  setIsLoadingHolders: (loading: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setChartInterval: (interval: string) => void;
  setChartType: (type: "candles" | "line") => void;
  clearToken: () => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  token: null,
  trades: [],
  holders: [],
  isLoading: true,
  isLoadingTrades: false,
  isLoadingHolders: false,
  error: null,
  chartInterval: "15",
  chartType: "candles",

  setToken: (token) => set({ token, isLoading: false, error: null }),

  updateToken: (updates) =>
    set((state) => ({
      token: state.token ? { ...state.token, ...updates } : null,
    })),

  setTrades: (trades) => set({ trades, isLoadingTrades: false }),

  addTrade: (trade) =>
    set((state) => {
      // Check for duplicate trades by ID
      const exists = state.trades.some((t) => t.id === trade.id);
      if (exists) return state;
      return {
        trades: [trade, ...state.trades].slice(0, 100),
      };
    }),

  addTradesBatch: (newTrades) =>
    set((state) => {
      if (newTrades.length === 0) return state;

      // First, deduplicate within the incoming batch (keep first occurrence)
      const seenInBatch = new Set<string>();
      const dedupedNewTrades = newTrades.filter((t) => {
        if (seenInBatch.has(t.id)) return false;
        seenInBatch.add(t.id);
        return true;
      });

      // Then filter out trades that already exist in state
      const existingIds = new Set(state.trades.map((t) => t.id));
      const uniqueNewTrades = dedupedNewTrades.filter(
        (t) => !existingIds.has(t.id),
      );

      if (uniqueNewTrades.length === 0) return state;

      // Add new trades at the beginning and limit to 100
      return {
        trades: [...uniqueNewTrades, ...state.trades].slice(0, 100),
      };
    }),

  setHolders: (holders) => set({ holders, isLoadingHolders: false }),

  setIsLoadingHolders: (loading) => set({ isLoadingHolders: loading }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setChartInterval: (interval) => set({ chartInterval: interval }),

  setChartType: (type) => set({ chartType: type }),

  clearToken: () =>
    set({
      token: null,
      trades: [],
      holders: [],
      isLoading: true,
      error: null,
    }),
}));
