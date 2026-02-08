/**
 * Search Store
 * Manages token search state using Mobula's fast-search API
 */

import {
  getTrendingTokens,
  SEARCH_CHAINS,
  SearchFilters,
  SearchToken,
  searchTokens,
  SortOption,
} from "@/lib/services/searchService";
import { create } from "zustand";

import {
  MAX_SEARCH_HISTORY,
  RELAY_DEFAULT_LIMIT,
  SEARCH_DEFAULT_LIMIT,
} from "@/constants/pagination";

export interface SearchState {
  // Search input
  query: string;

  // Results
  searchResults: SearchToken[];
  trendingTokens: SearchToken[];

  // Loading states
  isSearching: boolean;
  isLoadingTrending: boolean;

  // Error states
  searchError: string | null;
  trendingError: string | null;

  // Filters
  selectedChains: string[];
  sortBy: SortOption;

  // Search history
  searchHistory: string[];

  // Actions
  setQuery: (query: string) => void;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  fetchTrending: (filters?: SearchFilters) => Promise<void>;
  setSelectedChains: (chains: string[]) => void;
  setSortBy: (sortBy: SortOption) => void;
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  clearSearch: () => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
  query: "",
  searchResults: [],
  trendingTokens: [],
  isSearching: false,
  isLoadingTrending: false,
  searchError: null,
  trendingError: null,
  selectedChains: [], // Empty = all chains
  sortBy: "search_score",
  searchHistory: [],

  // Set query without searching
  setQuery: (query: string) => {
    set({ query });
  },

  // Search tokens
  search: async (query: string, filters?: SearchFilters) => {
    const state = get();

    // Clear results if query is empty
    if (!query.trim()) {
      set({
        query: "",
        searchResults: [],
        isSearching: false,
        searchError: null,
      });
      return;
    }

    set({
      query,
      isSearching: true,
      searchError: null,
    });

    try {
      const results = await searchTokens(query, {
        blockchains: filters?.blockchains ?? state.selectedChains,
        sortBy: filters?.sortBy ?? state.sortBy,
        limit: filters?.limit ?? SEARCH_DEFAULT_LIMIT,
        exact: filters?.exact,
        ...filters,
      });

      set({
        searchResults: results,
        isSearching: false,
      });
    } catch (error) {
      console.error("Search error:", error);
      set({
        searchError: error instanceof Error ? error.message : "Search failed",
        isSearching: false,
        searchResults: [],
      });
    }
  },

  // Fetch trending tokens
  fetchTrending: async (filters?: SearchFilters) => {
    const state = get();

    set({ isLoadingTrending: true, trendingError: null });

    try {
      const results = await getTrendingTokens({
        blockchains: filters?.blockchains ?? state.selectedChains,
        sortBy: filters?.sortBy ?? "volume_24h",
        limit: filters?.limit ?? RELAY_DEFAULT_LIMIT,
        ...filters,
      });

      set({
        trendingTokens: results,
        isLoadingTrending: false,
      });
    } catch (error) {
      console.error("Trending error:", error);
      set({
        trendingError:
          error instanceof Error ? error.message : "Failed to load trending",
        isLoadingTrending: false,
      });
    }
  },

  // Set selected blockchain filters
  setSelectedChains: (chains: string[]) => {
    set({ selectedChains: chains });
  },

  // Set sort option
  setSortBy: (sortBy: SortOption) => {
    set({ sortBy });
  },

  // Add to search history
  addToHistory: (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    set((state) => {
      const filtered = state.searchHistory.filter(
        (h) => h.toLowerCase() !== trimmed.toLowerCase(),
      );
      return {
        searchHistory: [trimmed, ...filtered].slice(0, MAX_SEARCH_HISTORY),
      };
    });
  },

  // Remove from search history
  removeFromHistory: (query: string) => {
    set((state) => ({
      searchHistory: state.searchHistory.filter((h) => h !== query),
    }));
  },

  // Clear search history
  clearHistory: () => {
    set({ searchHistory: [] });
  },

  // Clear current search
  clearSearch: () => {
    set({
      query: "",
      searchResults: [],
      isSearching: false,
      searchError: null,
    });
  },

  // Reset all state
  reset: () => {
    set({
      query: "",
      searchResults: [],
      trendingTokens: [],
      isSearching: false,
      isLoadingTrending: false,
      searchError: null,
      trendingError: null,
      selectedChains: [],
      sortBy: "search_score",
    });
  },
}));

// Selectors for common use cases
export const selectIsLoading = (state: SearchState) =>
  state.isSearching || state.isLoadingTrending;

export const selectHasFilters = (state: SearchState) =>
  state.selectedChains.length > 0;

export const selectDisplayTokens = (state: SearchState) =>
  state.query.length > 0 ? state.searchResults : state.trendingTokens;

export { SEARCH_CHAINS };
