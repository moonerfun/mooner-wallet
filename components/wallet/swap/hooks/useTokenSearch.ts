/**
 * useTokenSearch Hook
 * Searches for tokens via Mobula API with debouncing
 */

import { searchTokens as mobulaSearchTokens } from "@/lib/services/searchService";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPopularTokensForChain } from "../constants/popularTokens";
import { SwapToken } from "../types";

/**
 * Token search state
 */
export interface TokenSearchState {
  results: SwapToken[];
  isSearching: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseTokenSearchReturn extends TokenSearchState {
  searchTokens: (query: string) => Promise<void>;
  clearSearch: () => void;
  getPopularTokens: () => SwapToken[];
}

/**
 * useTokenSearch Hook
 * Searches tokens with debouncing and enriches results with balance data
 */
export function useTokenSearch(
  chainId: number,
  getTokenBalance?: (
    token: SwapToken,
  ) => { balance: string; balanceUsd: number } | null,
  debounceMs: number = 300,
): UseTokenSearchReturn {
  const [state, setState] = useState<TokenSearchState>({
    results: [],
    isSearching: false,
    error: null,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");

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
   * Get popular tokens for the current chain
   */
  const getPopularTokens = useCallback((): SwapToken[] => {
    const tokens = getPopularTokensForChain(chainId);

    // Enrich with balance data if available
    if (getTokenBalance) {
      return tokens.map((token) => {
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

    return tokens;
  }, [chainId, getTokenBalance]);

  /**
   * Search tokens via Mobula API
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
          const searchResults = await mobulaSearchTokens(query, {
            blockchains: [chainId.toString()],
            limit: 15,
          });

          // Only update if this is still the current query
          if (lastQueryRef.current !== query) return;

          // Convert search results to SwapToken format and enrich with balance data
          const enrichedTokens = searchResults.map((t) => {
            const tokenWithChainId: SwapToken = {
              symbol: t.symbol,
              name: t.name,
              address: t.address || "",
              logo: t.logo ?? undefined,
              chainId: chainId,
              decimals: t.decimals || 18,
            };

            if (getTokenBalance) {
              const balanceData = getTokenBalance(tokenWithChainId);
              if (balanceData) {
                return {
                  ...tokenWithChainId,
                  balance: balanceData.balance,
                  balanceUsd: balanceData.balanceUsd,
                };
              }
            }

            return tokenWithChainId;
          });

          setState({
            results: enrichedTokens,
            isSearching: false,
            error: null,
          });
        } catch (error) {
          console.error("[TokenSearch] Error:", error);

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
    [chainId, getTokenBalance, debounceMs],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Clear search when chain changes
  useEffect(() => {
    clearSearch();
  }, [chainId, clearSearch]);

  return {
    ...state,
    searchTokens,
    clearSearch,
    getPopularTokens,
  };
}
