import {
  getMobulaClient,
  parseMarketData,
  parseMultiMarketData,
  type MarketHistoryPoint,
  type TokenMarketData,
} from "@/lib";
import { create } from "zustand";

// Re-export types for backward compatibility
export type { MarketHistoryPoint, TokenMarketData };

export interface MarketState {
  // Multi-asset market data
  tokens: TokenMarketData[];
  isLoadingTokens: boolean;
  tokensError: string | null;

  // Single asset detail
  selectedToken: TokenMarketData | null;
  isLoadingDetail: boolean;
  detailError: string | null;

  // Price history
  priceHistory: MarketHistoryPoint[];
  isLoadingHistory: boolean;
  historyError: string | null;

  // Search results
  searchResults: TokenMarketData[];
  isSearching: boolean;
  searchError: string | null;

  // Trending/hot tokens
  trendingTokens: TokenMarketData[];
  isLoadingTrending: boolean;

  // Actions
  fetchMultiMarketData: (assets: string[]) => Promise<void>;
  fetchMarketData: (asset: string) => Promise<void>;
  fetchMarketHistory: (
    asset: string,
    interval?: string,
    days?: number,
  ) => Promise<void>;
  searchTokens: (query: string) => Promise<void>;
  fetchTrendingTokens: () => Promise<void>;
  clearSearch: () => void;
  reset: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  // Initial state
  tokens: [],
  isLoadingTokens: false,
  tokensError: null,

  selectedToken: null,
  isLoadingDetail: false,
  detailError: null,

  priceHistory: [],
  isLoadingHistory: false,
  historyError: null,

  searchResults: [],
  isSearching: false,
  searchError: null,

  trendingTokens: [],
  isLoadingTrending: false,

  // Fetch market data for multiple assets
  fetchMultiMarketData: async (assets: string[]) => {
    set({ isLoadingTokens: true, tokensError: null });
    try {
      const client = getMobulaClient();
      // Join assets as comma-separated string for the API
      const assetsParam = assets.join(",");
      const response = await client.fetchMarketMultiData({
        assets: assetsParam,
      });

      if (response.data) {
        const tokens = parseMultiMarketData(
          response.data as Record<string, unknown>,
        );
        set({ tokens, isLoadingTokens: false });
      }
    } catch (error) {
      console.error("Failed to fetch multi market data:", error);
      set({
        tokensError:
          error instanceof Error
            ? error.message
            : "Failed to fetch market data",
        isLoadingTokens: false,
      });
    }
  },

  // Fetch market data for a single asset
  fetchMarketData: async (asset: string) => {
    set({ isLoadingDetail: true, detailError: null });
    try {
      const client = getMobulaClient();
      const response = await client.fetchMarketData({ asset });

      if (response.data) {
        const token = parseMarketData(response.data);
        if (token) {
          set({ selectedToken: token, isLoadingDetail: false });
        } else {
          set({
            detailError: "Invalid token data received",
            isLoadingDetail: false,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch market data:", error);
      set({
        detailError:
          error instanceof Error ? error.message : "Failed to fetch token data",
        isLoadingDetail: false,
      });
    }
  },

  // Fetch price history for charts
  fetchMarketHistory: async (asset: string, _interval = "1d", days = 30) => {
    set({ isLoadingHistory: true, historyError: null });
    try {
      const client = getMobulaClient();
      const now = Math.floor(Date.now() / 1000);
      const from = now - days * 24 * 60 * 60;

      const response = await client.fetchMarketHistory({
        asset,
        from,
        to: now,
      });

      if (response.data?.price_history) {
        const history: MarketHistoryPoint[] = response.data.price_history
          .filter(
            (point): point is [number, number] =>
              Array.isArray(point) &&
              point.length >= 2 &&
              point[0] != null &&
              point[1] != null,
          )
          .map((point) => ({
            timestamp: point[0] as number,
            price: point[1] as number,
          }));
        set({ priceHistory: history, isLoadingHistory: false });
      }
    } catch (error) {
      console.error("Failed to fetch market history:", error);
      set({
        historyError:
          error instanceof Error
            ? error.message
            : "Failed to fetch price history",
        isLoadingHistory: false,
      });
    }
  },

  // Search for tokens using the API
  searchTokens: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true, searchError: null });
    try {
      const client = getMobulaClient();
      // Use fetch with name parameter for search
      const response = await client.fetchMarketData({ asset: query });

      if (response.data) {
        const token = parseMarketData(response.data);
        if (token) {
          set({ searchResults: [token], isSearching: false });
        } else {
          set({ searchResults: [], isSearching: false });
        }
      } else {
        set({ searchResults: [], isSearching: false });
      }
    } catch (error) {
      console.error("Failed to search tokens:", error);
      // If single search fails, try multi search with the query
      try {
        const client = getMobulaClient();
        const response = await client.fetchMarketMultiData({ assets: query });

        if (response.data) {
          const results = parseMultiMarketData(
            response.data as Record<string, unknown>,
          );
          set({ searchResults: results, isSearching: false });
        } else {
          set({ searchResults: [], isSearching: false });
        }
      } catch {
        set({
          searchError: "No tokens found",
          searchResults: [],
          isSearching: false,
        });
      }
    }
  },

  // Fetch trending/popular tokens
  fetchTrendingTokens: async () => {
    set({ isLoadingTrending: true });
    try {
      const client = getMobulaClient();
      // Fetch top tokens by market cap - use Mobula-compatible asset names
      const topAssets = [
        "Bitcoin",
        "Ethereum",
        "Tether",
        "BNB",
        "Solana",
        "USD Coin",
        "XRP",
        "Dogecoin",
        "Cardano",
        "TRON",
        "Avalanche",
        "Shiba Inu",
        "Chainlink",
        "Polkadot",
        "Bitcoin Cash",
        "Polygon",
        "Litecoin",
        "Uniswap",
        "Dai",
        "Cosmos",
        "Stellar",
        "Monero",
        "Ethereum Classic",
        "Aave",
        "Arbitrum",
      ].join(",");

      const response = await client.fetchMarketMultiData({ assets: topAssets });

      if (response.data) {
        const tokens = parseMultiMarketData(
          response.data as Record<string, unknown>,
        ).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

        set({ trendingTokens: tokens, isLoadingTrending: false });
      }
    } catch (error) {
      console.error("Failed to fetch trending tokens:", error);
      set({ isLoadingTrending: false });
    }
  },

  // Clear search results
  clearSearch: () => {
    set({ searchResults: [], isSearching: false, searchError: null });
  },

  // Reset all state
  reset: () => {
    set({
      tokens: [],
      isLoadingTokens: false,
      tokensError: null,
      selectedToken: null,
      isLoadingDetail: false,
      detailError: null,
      priceHistory: [],
      isLoadingHistory: false,
      historyError: null,
      searchResults: [],
      isSearching: false,
      searchError: null,
      trendingTokens: [],
      isLoadingTrending: false,
    });
  },
}));
