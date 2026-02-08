import { useCallback, useEffect, useRef } from "react";
import { useMarketStore } from "@/store/marketStore";

/**
 * Hook to fetch and manage market data for multiple assets
 */
export function useMarketData(assets?: string[]) {
  const {
    tokens,
    isLoadingTokens,
    tokensError,
    fetchMultiMarketData,
    fetchTrendingTokens,
    trendingTokens,
    isLoadingTrending,
  } = useMarketStore();

  useEffect(() => {
    if (assets && assets.length > 0) {
      fetchMultiMarketData(assets);
    } else {
      fetchTrendingTokens();
    }
  }, [assets?.join(",")]);

  return {
    tokens: assets ? tokens : trendingTokens,
    isLoading: assets ? isLoadingTokens : isLoadingTrending,
    error: tokensError,
    refetch: () =>
      assets ? fetchMultiMarketData(assets) : fetchTrendingTokens(),
  };
}

/**
 * Hook to fetch market data for a single token
 */
export function useTokenMarketData(asset: string | undefined) {
  const { selectedToken, isLoadingDetail, detailError, fetchMarketData } =
    useMarketStore();

  useEffect(() => {
    if (asset) {
      fetchMarketData(asset);
    }
  }, [asset]);

  return {
    token: selectedToken,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: () => asset && fetchMarketData(asset),
  };
}

/**
 * Hook to fetch price history for charts
 */
export function usePriceHistory(
  asset: string | undefined,
  interval = "1d",
  days = 30,
) {
  const { priceHistory, isLoadingHistory, historyError, fetchMarketHistory } =
    useMarketStore();

  useEffect(() => {
    if (asset) {
      fetchMarketHistory(asset, interval, days);
    }
  }, [asset, interval, days]);

  return {
    history: priceHistory,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: () => asset && fetchMarketHistory(asset, interval, days),
  };
}

/**
 * Hook for token search with debouncing
 */
export function useTokenSearch(debounceMs = 300) {
  const { searchResults, isSearching, searchError, searchTokens, clearSearch } =
    useMarketStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (!query.trim()) {
        clearSearch();
        return;
      }

      timeoutRef.current = setTimeout(() => {
        searchTokens(query);
      }, debounceMs);
    },
    [debounceMs, searchTokens, clearSearch],
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    clearSearch();
  }, [clearSearch]);

  return {
    results: searchResults,
    isSearching,
    error: searchError,
    search,
    clear,
  };
}

/**
 * Hook for real-time market data streaming for a single asset
 * Note: WebSocket streaming is currently disabled due to React Native compatibility issues
 */
export function useMarketStream(asset: string | undefined) {
  const { selectedToken } = useMarketStore();
  // WebSocket streaming is disabled - just return the selected token from store
  return { token: selectedToken };
}

/**
 * Hook for real-time streaming of multiple tokens (for markets page)
 * Note: WebSocket streaming is currently disabled due to React Native compatibility issues
 * The Mobula SDK uses browser WebSocket APIs that don't work well with RN's polyfill
 */
export function useMultiMarketStream(tokenNames: string[]) {
  // WebSocket streaming is disabled - return not connected
  // This allows the Markets page to fall back to polling
  return { isConnected: false };
}

/**
 * Hook for trending tokens with optional real-time streaming
 */
export function useTrendingTokens(enableStreaming = true) {
  const { trendingTokens, isLoadingTrending, fetchTrendingTokens } =
    useMarketStore();

  // Fetch initial data
  useEffect(() => {
    fetchTrendingTokens();
  }, []);

  // Get token names for streaming
  const tokenNames = trendingTokens.map((t) => t.name);

  // Subscribe to real-time updates if enabled and we have tokens
  const { isConnected } = useMultiMarketStream(
    enableStreaming && tokenNames.length > 0 ? tokenNames : [],
  );

  return {
    tokens: trendingTokens,
    isLoading: isLoadingTrending,
    isStreaming: isConnected,
    refetch: fetchTrendingTokens,
  };
}
