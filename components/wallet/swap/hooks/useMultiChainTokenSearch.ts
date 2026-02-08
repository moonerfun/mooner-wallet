/**
 * useMultiChainTokenSearch Hook
 * Searches for tokens across multiple chains simultaneously
 * Uses Mobula's fast-search API (same as the search page)
 * Designed for the UnifiedTokenSelector component
 *
 * Hybrid approach:
 * - Shows predefined popular tokens immediately (instant)
 * - Fetches trending tokens from API in background (with caching)
 * - Merges them together with held tokens on top
 */

import { SUPPORTED_CHAINS } from "@/constants/chains";
import {
  getTrendingTokens,
  searchTokens as mobulaSearchTokens,
} from "@/lib/services/searchService";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPopularTokensForChain } from "../constants/popularTokens";
import { SwapToken } from "../types";

// ============================================================================
// Trending Tokens Cache
// ============================================================================

interface CacheEntry {
  tokens: SwapToken[];
  timestamp: number;
}

// Module-level cache for trending tokens (persists across component remounts)
const trendingTokensCache = new Map<string, CacheEntry>();

// Cache TTL: 5 minutes (tokens stay fresh for 5 min before refetching)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get cache key from chain IDs
 */
function getCacheKey(chainIds: number[]): string {
  return chainIds.sort((a, b) => a - b).join(",");
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Get cached trending tokens if valid
 */
function getCachedTrending(chainIds: number[]): SwapToken[] | null {
  const key = getCacheKey(chainIds);
  const entry = trendingTokensCache.get(key);
  if (isCacheValid(entry)) {
    return entry.tokens;
  }
  return null;
}

/**
 * Store trending tokens in cache
 */
function setCachedTrending(chainIds: number[], tokens: SwapToken[]): void {
  const key = getCacheKey(chainIds);
  trendingTokensCache.set(key, {
    tokens,
    timestamp: Date.now(),
  });
}

// ============================================================================
// Types
// ============================================================================

/**
 * Multi-chain token search state
 */
export interface MultiChainTokenSearchState {
  results: SwapToken[];
  isSearching: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseMultiChainTokenSearchReturn extends MultiChainTokenSearchState {
  searchTokens: (query: string) => Promise<void>;
  clearSearch: () => void;
  /** Tokens user holds with balances (sorted by USD value) */
  portfolioTokens: SwapToken[];
  /** Popular tokens for the chain(s) - predefined + trending from API */
  popularTokens: SwapToken[];
  /** Whether trending tokens are being loaded from API */
  isLoadingTrending: boolean;
}

/**
 * useMultiChainTokenSearch Hook
 * Searches tokens across multiple chains with debouncing
 */
export function useMultiChainTokenSearch(
  chainIds: number[],
  getTokenBalance?: (
    token: SwapToken,
  ) => { balance: string; balanceUsd: number } | null,
  debounceMs: number = 300,
): UseMultiChainTokenSearchReturn {
  const [state, setState] = useState<MultiChainTokenSearchState>({
    results: [],
    isSearching: false,
    error: null,
  });

  // Trending tokens state (fetched from API)
  const [trendingTokens, setTrendingTokens] = useState<SwapToken[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");

  /**
   * Convert relay chain IDs to Mobula format for API calls
   */
  const getMobulaChainIds = useCallback((): string[] => {
    if (chainIds.length === 0) return []; // Empty = all chains

    return chainIds
      .map((relayChainId) => {
        // Find the chain config by relay chain ID
        const chainConfig = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.relayChainId === relayChainId,
        );
        if (!chainConfig) return null;

        // Mobula uses: "solana" for Solana, or EVM chain ID as string
        if (!chainConfig.isEvm) {
          return chainConfig.key; // "solana"
        }
        return chainConfig.evmChainId?.toString() || null;
      })
      .filter((id): id is string => id !== null);
  }, [chainIds]);

  /**
   * Fetch trending tokens from API when chains change (with caching)
   */
  useEffect(() => {
    const fetchTrending = async () => {
      if (chainIds.length === 0) {
        setTrendingTokens([]);
        return;
      }

      // Check cache first - instant load if cached
      const cached = getCachedTrending(chainIds);
      if (cached) {
        setTrendingTokens(cached);
        // Don't show loading since we have cached data
        return;
      }

      setIsLoadingTrending(true);
      try {
        const mobulaChainIds = getMobulaChainIds();
        const trending = await getTrendingTokens({
          blockchains: mobulaChainIds.length > 0 ? mobulaChainIds : undefined,
          limit: 20,
          sortBy: "volume_24h",
        });

        // Convert to SwapToken format
        const tokens: SwapToken[] = trending.map((token) => {
          // Convert chainId from Mobula format to relay chain ID
          let relayChainId = 1; // Default to Ethereum
          const chainIdStr = token.chainId;

          if (chainIdStr === "solana" || chainIdStr?.includes("solana")) {
            relayChainId = SUPPORTED_CHAINS.solana.relayChainId;
          } else if (chainIdStr) {
            // Try to find by EVM chain ID
            const evmId = parseInt(chainIdStr.replace("evm:", ""), 10);
            const chainConfig = Object.values(SUPPORTED_CHAINS).find(
              (c) => c.evmChainId === evmId,
            );
            if (chainConfig) {
              relayChainId = chainConfig.relayChainId;
            }
          }

          return {
            symbol: token.symbol || "???",
            name: token.name || "Unknown",
            logo: token.logo || undefined,
            address: token.address,
            chainId: relayChainId,
            decimals: token.decimals || 18,
          };
        });

        // Cache the results
        setCachedTrending(chainIds, tokens);
        setTrendingTokens(tokens);
      } catch (error) {
        console.error(
          "[MultiChainTokenSearch] Error fetching trending:",
          error,
        );
        setTrendingTokens([]);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    fetchTrending();
  }, [chainIds.join(","), getMobulaChainIds]);

  /**
   * Get predefined popular tokens for all chains
   */
  const predefinedTokens = useMemo((): SwapToken[] => {
    const allTokens: SwapToken[] = [];
    chainIds.forEach((chainId) => {
      const tokens = getPopularTokensForChain(chainId);
      allTokens.push(...tokens);
    });
    return allTokens;
  }, [chainIds]);

  /**
   * Get combined popular tokens (predefined + trending), enriched with balances
   * Priority: tokens with balance > trending tokens > predefined tokens
   */
  const popularTokens = useMemo((): SwapToken[] => {
    // Create a map to deduplicate by address+chainId
    const tokenMap = new Map<string, SwapToken>();
    // Also track by symbol+chainId to catch duplicates with different addresses
    const symbolChainMap = new Map<string, string>(); // symbol+chainId -> address key
    // Track which tokens came from trending API
    const trendingKeys = new Set<string>();

    /**
     * Normalize address for comparison
     * - Lowercase
     * - Treat common native token addresses as equivalent
     */
    const normalizeAddress = (address: string): string => {
      const lower = address.toLowerCase();
      // Common native token address patterns
      const nativePatterns = [
        "0x0000000000000000000000000000000000000000",
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "11111111111111111111111111111111", // Solana native
        "so11111111111111111111111111111111111111112", // Wrapped SOL
      ];
      if (nativePatterns.some((p) => lower === p || lower.includes(p))) {
        return "native";
      }
      return lower;
    };

    /**
     * Get unique key for a token
     */
    const getTokenKey = (token: SwapToken): string => {
      return `${normalizeAddress(token.address)}-${token.chainId}`;
    };

    // Add predefined tokens first (will be overwritten by trending if duplicate)
    predefinedTokens.forEach((token) => {
      const key = getTokenKey(token);
      const symbolKey = `${token.symbol.toUpperCase()}-${token.chainId}`;

      tokenMap.set(key, token);
      symbolChainMap.set(symbolKey, key);
    });

    // Add trending tokens (will overwrite predefined if duplicate)
    trendingTokens.forEach((token) => {
      const key = getTokenKey(token);
      const symbolKey = `${token.symbol.toUpperCase()}-${token.chainId}`;

      // Check if we already have this token by symbol+chain
      const existingKey = symbolChainMap.get(symbolKey);
      if (existingKey && existingKey !== key) {
        // Same symbol+chain but different address - likely same token, skip
        // Keep the predefined one (more reliable address)
        trendingKeys.add(existingKey); // Mark predefined as "trending" for sorting
        return;
      }

      const existing = tokenMap.get(key);
      trendingKeys.add(key); // Mark as trending
      tokenMap.set(key, {
        ...token,
        // Preserve any existing data from predefined (like more accurate decimals)
        ...(existing
          ? { decimals: existing.decimals, address: existing.address }
          : {}),
      });
      symbolChainMap.set(symbolKey, key);
    });

    // Convert to array and enrich with balance data
    let allTokens = Array.from(tokenMap.values());

    if (getTokenBalance) {
      allTokens = allTokens.map((token) => {
        const balanceData = getTokenBalance(token);
        if (balanceData) {
          return {
            ...token,
            balance: balanceData.balance,
            balanceUsd: balanceData.balanceUsd,
          };
        }
        return token;
      });
    }

    // Sort: tokens with balance first (by USD value), then trending, then predefined
    return allTokens.sort((a, b) => {
      const aHasBalance = parseFloat(a.balance || "0") > 0;
      const bHasBalance = parseFloat(b.balance || "0") > 0;

      // Tokens with balance come first
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;

      // If both have balance, sort by USD value
      if (aHasBalance && bHasBalance) {
        return (b.balanceUsd || 0) - (a.balanceUsd || 0);
      }

      // Among tokens without balance, trending comes before predefined
      const aKey = getTokenKey(a);
      const bKey = getTokenKey(b);
      const aIsTrending = trendingKeys.has(aKey);
      const bIsTrending = trendingKeys.has(bKey);
      if (aIsTrending && !bIsTrending) return -1;
      if (!aIsTrending && bIsTrending) return 1;

      return 0;
    });
  }, [predefinedTokens, trendingTokens, getTokenBalance]);

  /**
   * Get portfolio tokens across all chains with balances (only tokens user holds)
   */
  const portfolioTokens = useMemo((): SwapToken[] => {
    // Filter popular tokens to only those with balance
    return popularTokens
      .filter((token) => {
        const balance = parseFloat(token.balance || "0");
        return balance > 0;
      })
      .sort((a, b) => {
        const aUsd = a.balanceUsd || 0;
        const bUsd = b.balanceUsd || 0;
        return bUsd - aUsd;
      });
  }, [popularTokens]);

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    lastQueryRef.current = "";
    setState({ results: [], isSearching: false, error: null });
  }, []);

  /**
   * Search tokens across all chains using Mobula API
   */
  const searchTokens = useCallback(
    async (query: string) => {
      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Handle empty query
      if (!query.trim()) {
        setState({ results: [], isSearching: false, error: null });
        lastQueryRef.current = "";
        return;
      }

      lastQueryRef.current = query;
      setState((prev) => ({ ...prev, isSearching: true }));

      // Debounce the search
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const mobulaChainIds = getMobulaChainIds();

          // Use Mobula's search service (same as search page)
          const mobulaResults = await mobulaSearchTokens(query, {
            blockchains: mobulaChainIds.length > 0 ? mobulaChainIds : undefined,
            limit: 20,
            sortBy: "search_score",
          });

          // Only update if this is still the current query
          if (lastQueryRef.current !== query) return;

          // Convert Mobula results to SwapToken format
          const tokens: SwapToken[] = mobulaResults.map((token) => {
            // Convert chainId from Mobula format to relay chain ID
            let relayChainId = 1; // Default to Ethereum
            const chainIdStr = token.chainId;

            if (chainIdStr === "solana" || chainIdStr.includes("solana")) {
              relayChainId = SUPPORTED_CHAINS.solana.relayChainId;
            } else {
              // Try to find by EVM chain ID
              const evmId = parseInt(chainIdStr.replace("evm:", ""), 10);
              const chainConfig = Object.values(SUPPORTED_CHAINS).find(
                (c) => c.evmChainId === evmId,
              );
              if (chainConfig) {
                relayChainId = chainConfig.relayChainId;
              }
            }

            return {
              symbol: token.symbol || "???",
              name: token.name || "Unknown",
              logo: token.logo || undefined,
              address: token.address,
              chainId: relayChainId,
              decimals: token.decimals || 18,
            };
          });

          // Enrich with balance data
          const enrichedTokens = tokens.map((token) => {
            if (getTokenBalance) {
              const balanceData = getTokenBalance(token);
              if (balanceData) {
                return {
                  ...token,
                  balance: balanceData.balance,
                  balanceUsd: balanceData.balanceUsd,
                };
              }
            }
            return token;
          });

          // Sort by balance (tokens with balance first, then by USD value)
          const sortedTokens = enrichedTokens.sort((a, b) => {
            const aHasBalance = parseFloat(a.balance || "0") > 0;
            const bHasBalance = parseFloat(b.balance || "0") > 0;

            if (aHasBalance && !bHasBalance) return -1;
            if (!aHasBalance && bHasBalance) return 1;

            const aUsd = a.balanceUsd || 0;
            const bUsd = b.balanceUsd || 0;
            return bUsd - aUsd;
          });

          setState({
            results: sortedTokens,
            isSearching: false,
            error: null,
          });
        } catch (error) {
          console.error("[MultiChainTokenSearch] Error:", error);

          // Only update if this is still the current query
          if (lastQueryRef.current !== query) return;

          setState({
            results: [],
            isSearching: false,
            error: error instanceof Error ? error.message : "Search failed",
          });
        }
      }, debounceMs);
    },
    [chainIds, getTokenBalance, debounceMs, getMobulaChainIds],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Clear search when chains change
  useEffect(() => {
    clearSearch();
  }, [chainIds.join(","), clearSearch]);

  return {
    ...state,
    searchTokens,
    clearSearch,
    portfolioTokens,
    popularTokens,
    isLoadingTrending,
  };
}
