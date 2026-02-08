/**
 * Wallet Tabs Store - State management for wallet page tabs
 * Uses Pulse Stream V2 for real-time token data
 * Tabs: Verified, Trending, Most Held, Graduated
 */

import { create } from "zustand";

import { normalizeToken, PulseToken } from "./pulseStore";

export type WalletTabName = "verified" | "trending" | "mostHeld" | "graduated";

export interface WalletTabState {
  tokens: PulseToken[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

export interface WalletTabsStore {
  // Connection state
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;

  // Tab states
  tabs: Record<WalletTabName, WalletTabState>;

  // Active tab
  activeTab: WalletTabName;

  // Actions
  setConnected: (connected: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setPaused: (paused: boolean) => void;
  setActiveTab: (tab: WalletTabName) => void;
  setTokens: (tab: WalletTabName, tokens: PulseToken[]) => void;
  setLoading: (tab: WalletTabName, loading: boolean) => void;
  setError: (tab: WalletTabName, error: string | null) => void;
  mergeToken: (tab: WalletTabName, token: PulseToken) => void;
  removeToken: (tab: WalletTabName, tokenKey: string) => void;
  clearTab: (tab: WalletTabName) => void;
  clearAll: () => void;
}

const DEFAULT_TAB_STATE: WalletTabState = {
  tokens: [],
  loading: true,
  error: null,
  lastUpdate: 0,
};

export const useWalletTabsStore = create<WalletTabsStore>((set, get) => ({
  // Connection state
  isConnected: false,
  isStreaming: false,
  isPaused: false,

  // Tab states
  tabs: {
    verified: { ...DEFAULT_TAB_STATE },
    trending: { ...DEFAULT_TAB_STATE },
    mostHeld: { ...DEFAULT_TAB_STATE },
    graduated: { ...DEFAULT_TAB_STATE },
  },

  // Active tab
  activeTab: "trending",

  // Actions
  setConnected: (connected) => set({ isConnected: connected }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setPaused: (paused) => set({ isPaused: paused }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTokens: (tab, tokens) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          tokens,
          loading: false,
          lastUpdate: Date.now(),
        },
      },
    })),

  setLoading: (tab, loading) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          loading,
        },
      },
    })),

  setError: (tab, error) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          error,
          loading: false,
        },
      },
    })),

  mergeToken: (tab, token) =>
    set((state) => {
      const existing = state.tabs[tab].tokens;
      const tokenKey = `${token.chainId}-${token.address}`;
      const existingIndex = existing.findIndex(
        (t) => `${t.chainId}-${t.address}` === tokenKey,
      );

      let newTokens: PulseToken[];
      if (existingIndex >= 0) {
        // Update existing token
        newTokens = [...existing];
        newTokens[existingIndex] = { ...newTokens[existingIndex], ...token };
      } else {
        // Add new token (prepend for recency)
        newTokens = [token, ...existing].slice(0, 50); // Keep max 50
      }

      return {
        tabs: {
          ...state.tabs,
          [tab]: {
            ...state.tabs[tab],
            tokens: newTokens,
            lastUpdate: Date.now(),
          },
        },
      };
    }),

  removeToken: (tab, tokenKey) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: {
          ...state.tabs[tab],
          tokens: state.tabs[tab].tokens.filter(
            (t) => `${t.chainId}-${t.address}` !== tokenKey,
          ),
          lastUpdate: Date.now(),
        },
      },
    })),

  clearTab: (tab) =>
    set((state) => ({
      tabs: {
        ...state.tabs,
        [tab]: { ...DEFAULT_TAB_STATE },
      },
    })),

  clearAll: () =>
    set({
      tabs: {
        verified: { ...DEFAULT_TAB_STATE },
        trending: { ...DEFAULT_TAB_STATE },
        mostHeld: { ...DEFAULT_TAB_STATE },
        graduated: { ...DEFAULT_TAB_STATE },
      },
    }),
}));

/**
 * Normalize a raw API token to our internal format
 * Re-uses the normalizeToken from pulseStore
 */
export { normalizeToken };

/**
 * Get tab configuration for Pulse V2 WebSocket (Asset Mode / Token-Based)
 *
 * Using assetMode: true with TokensStatsRealTime schema filters.
 *
 * TESTED WORKING FILTERS (via scripts/test-pulse-filters.ts):
 * ✅ volume_1h, market_cap, holders_count, trades_1h, buyers_1h, liquidity
 * ✅ top_10_holdings_percentage, dev_holdings_percentage
 * ✅ snipers_holdings_percentage, bundlers_holdings_percentage
 * ✅ bonded (both direct boolean and { equals: boolean })
 * ✅ bonding_percentage
 * ✅ excludeKeywords - filters out tokens by name/symbol
 * ✅ created_at_offset - filters by token age
 * ✅ organic_* metrics - cleaner data without bot activity
 * ❌ dexscreener_listed - NOT WORKING (causes PrismaClientValidationError)
 *
 * MEMECOIN FOCUS:
 * - Excludes stablecoins (USDC, USDT, DAI, BUSD, etc.)
 * - Excludes established tokens (BTC, ETH, SOL, BNB, etc.)
 * - Excludes wrapped tokens (WBTC, WETH, WSOL, WBNB)
 * - Uses created_at_offset to filter out super old tokens
 * - Focuses on recent, actively traded memecoins
 */
export function getWalletTabViews() {
  // Keywords to exclude - stablecoins, established tokens, wrapped tokens
  const excludedKeywords = [
    // Stablecoins
    "USDC",
    "USDT",
    "DAI",
    "BUSD",
    "TUSD",
    "FRAX",
    "LUSD",
    "GUSD",
    "USDP",
    "USDD",
    "PYUSD",
    "cUSD",
    "sUSD",
    // Major established tokens
    "BTC",
    "ETH",
    "SOL",
    "BNB",
    "XRP",
    "ADA",
    "DOGE",
    "DOT",
    "AVAX",
    "MATIC",
    "LINK",
    "UNI",
    "ATOM",
    "LTC",
    "BCH",
    "NEAR",
    "APT",
    "FIL",
    "TRX",
    "XLM",
    "ALGO",
    "ARB",
    "OP",
    // Wrapped tokens
    "WBTC",
    "WETH",
    "WSOL",
    "WBNB",
    "WMATIC",
    "WAVAX",
    // Liquid staking tokens
    "stETH",
    "rETH",
    "cbETH",
    "mSOL",
    "jitoSOL",
    "bSOL",
    // Other DeFi / Infrastructure tokens
    "AAVE",
    "MKR",
    "CRV",
    "COMP",
    "SNX",
    "SUSHI",
    "YFI",
    "RAY",
    "ORCA",
    "JUP",
  ];

  // Shared quality filters - all tested and working
  // Designed to filter out rug pulls and low-quality tokens
  const qualityFilters = {
    holders_count: { gte: 100 },
    top_10_holdings_percentage: { lte: 35 },
    dev_holdings_percentage: { lte: 10 },
    snipers_holdings_percentage: { lte: 15 },
    bundlers_holdings_percentage: { lte: 15 },
    // // Filter out tokens older than 90 days (7,776,000 seconds)
    // // This keeps focus on newer memecoins
    // created_at_offset: { lte: 7776000 },
  };

  // Base filters for memecoin discovery
  const memecoinBaseFilters = {
    ...qualityFilters,
    excludeKeywords: excludedKeywords,
  };

  return [
    {
      // Verified - High quality memecoins with at least 1 social link
      // Strong volume, market cap, and community engagement
      // Uses stricter quality filters since dexscreener_listed doesn't work
      name: "verified",
      chainId: ["solana:solana", "evm:1", "evm:8453", "evm:56"],
      limit: 50,
      sortBy: "organic_volume_1h",
      sortOrder: "desc",
      filters: {
        ...memecoinBaseFilters,
        // Require at least one social link for "verified" feel
        min_socials: 1,
        // Strong activity metrics
        organic_volume_1h: { gte: 25000 },
        market_cap: { gte: 50000, lte: 500000000 },
        liquidity: { gte: 15000 },
        organic_trades_1h: { gte: 50 },
        organic_buyers_1h: { gte: 25 },
        // Stricter holder distribution
        holders_count: { gte: 150 },
        top_10_holdings_percentage: { lte: 30 },
      },
    },
    {
      // Trending - Memecoins with high fees paid indicating real trading interest
      // Sorted by 24h fees paid, focus on organic trading activity
      name: "trending",
      chainId: ["solana:solana", "evm:1", "evm:8453", "evm:56"],
      limit: 50,
      sortBy: "fees_paid_24h",
      sortOrder: "desc",
      filters: {
        ...memecoinBaseFilters,
        // High fees paid indicates real trading interest
        fees_paid_24h: { gte: 5000 },
        // High trading activity (organic to filter bots)
        organic_volume_1h: { gte: 20000 },
        organic_trades_1h: { gte: 50 },
        organic_buyers_1h: { gte: 20 },
        // Reasonable market cap range for memecoins
        market_cap: { gte: 25000, lte: 1000000000 },
        liquidity: { gte: 10000 },
      },
    },
    {
      // Most Held - Memecoins with broad holder distribution
      // Sorted by holder count, indicates community adoption
      name: "mostHeld",
      chainId: ["solana:solana", "evm:1", "evm:8453", "evm:56"],
      limit: 50,
      sortBy: "holders_count",
      sortOrder: "desc",
      filters: {
        ...memecoinBaseFilters,
        // Focus on holder count (max 50k to filter out established tokens)
        holders_count: { gte: 500, lte: 50000 },
        // Healthy distribution
        top_10_holdings_percentage: { lte: 40 },
        top_50_holdings_percentage: { lte: 60 },
        dev_holdings_percentage: { lte: 8 },
        // Minimum activity to ensure it's not dead
        organic_volume_1h: { gte: 5000 },
        organic_trades_1h: { gte: 20 },
        // Market cap range for legitimate memecoins
        market_cap: { gte: 20000, lte: 2000000000 },
        liquidity: { gte: 8000 },
      },
    },
    {
      // Graduated - Bonded memecoins that made it off launchpads
      // Successfully migrated from pump.fun, moonshot, etc.
      name: "graduated",
      chainId: ["solana:solana", "evm:1", "evm:8453", "evm:56"],
      limit: 50,
      sortBy: "organic_volume_1h",
      sortOrder: "desc",
      filters: {
        ...memecoinBaseFilters,
        // Must be bonded (graduated from launchpad)
        bonded: true,
        // Active trading post-graduation
        organic_volume_1h: { gte: 20000 },
        organic_trades_1h: { gte: 40 },
        organic_buyers_1h: { gte: 20 },
        // Healthy post-graduation metrics
        market_cap: { gte: 30000, lte: 500000000 },
        liquidity: { gte: 12000 },
        holders_count: { gte: 100 },
      },
    },
  ];
}
