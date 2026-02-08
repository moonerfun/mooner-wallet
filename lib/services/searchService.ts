/**
 * Search Service
 * Uses Mobula's fast-search API for universal token search
 * Supports blockchain filtering, sorting, and pagination
 *
 * API: https://docs.mobula.io/rest-api-reference/endpoint/fast-search
 */

import { getChainName as getChainNameFromChains } from "@/constants/chains";
import { PULSE_CHAINS } from "@/constants/pulseFilters";

// API base URL - uses pulse-v2-api for fast-search
const SEARCH_API_BASE = "https://pulse-v2-api.mobula.io/api/2";

// Types for search results
export interface SearchToken {
  address: string;
  chainId: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  priceUSD: number;
  priceChange24hPercentage: number;
  priceChange1hPercentage?: number;
  volume24hUSD: number;
  marketCapUSD: number;
  liquidityUSD?: number;
  holdersCount?: number;
  createdAt?: string;
  blockchain?: string;
  poolAddress?: string;
  // Additional fields from API
  trades24h?: number;
  buys24h?: number;
  sells24h?: number;
  // Security info
  security?: {
    buyTax?: string;
    sellTax?: string;
    isBlacklisted?: boolean;
    lowLiquidity?: string;
  };
}

export interface SearchFilters {
  blockchains?: string[]; // e.g., ["solana", "8453", "1"]
  sortBy?: SortOption;
  limit?: number;
  exact?: boolean; // Use exact match for ticker
  excludeBonded?: boolean;
}

export type SortOption =
  | "volume_24h"
  | "market_cap"
  | "created_at"
  | "volume_1h"
  | "volume_5min"
  | "fees_paid_5min"
  | "fees_paid_1h"
  | "fees_paid_24h"
  | "holders_count"
  | "organic_volume_1h"
  | "search_score";

export interface SearchResponse {
  data: SearchToken[];
}

/**
 * Convert chain IDs to API-compatible format
 * The API accepts both numeric chain IDs (1, 8453) and string identifiers (solana, evm:1)
 */
function normalizeChainIds(chainIds: string[]): string {
  return chainIds
    .map((id) => {
      // If it's already in correct format, return as-is
      if (
        id === "solana" ||
        id.startsWith("evm:") ||
        id.startsWith("solana:")
      ) {
        // Convert "solana:solana" to just "solana" for the API
        if (id === "solana:solana") return "solana";
        return id;
      }
      // If it's a numeric ID, return as-is (API handles it)
      if (/^\d+$/.test(id)) {
        return id;
      }
      return id;
    })
    .join(",");
}

/**
 * Get blockchain display name from chain ID in result
 */
export function getBlockchainName(chainId: string): string {
  // Try to find in PULSE_CHAINS first
  const chain = PULSE_CHAINS.find(
    (c) =>
      c.id === chainId ||
      c.id === `evm:${chainId}` ||
      (chainId.includes("solana") && c.id.includes("solana")),
  );
  if (chain) return chain.name;

  // Fallback to centralized chain name lookup
  return getChainNameFromChains(chainId);
}

/**
 * Convert chainId to blockchain slug for routing
 */
export { getBlockchainSlug } from "@/constants/chains";

/**
 * Search tokens using Mobula's fast-search API
 *
 * @param query - Search query (token name, symbol, or address)
 * @param filters - Optional filters for blockchains, sorting, etc.
 * @returns Array of matching tokens
 */
export async function searchTokens(
  query: string,
  filters: SearchFilters = {},
): Promise<SearchToken[]> {
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams();

  // Apply exact match syntax for short queries or when explicitly requested
  const searchInput = filters.exact ? `"${query}"` : query;
  params.set("input", searchInput);

  // Set type to tokens for token search
  params.set("type", "tokens");

  // Set limit (1-20, default 10)
  const limit = Math.min(Math.max(filters.limit || 10, 1), 20);
  params.set("limit", limit.toString());

  // Set sort option (default to search_score for best results)
  params.set("sortBy", filters.sortBy || "search_score");

  // Set mode to trendings for better results
  params.set("mode", "trendings");

  // Apply blockchain filters if specified
  if (filters.blockchains && filters.blockchains.length > 0) {
    const blockchainsFilter = JSON.stringify({
      blockchains: normalizeChainIds(filters.blockchains),
    });
    params.set("filters", blockchainsFilter);
  }

  // Exclude bonded tokens if specified
  if (filters.excludeBonded !== undefined) {
    params.set("excludeBonded", filters.excludeBonded.toString());
  }

  try {
    const url = `${SEARCH_API_BASE}/fast-search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXPO_PUBLIC_MOBULA_API_KEY && {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_MOBULA_API_KEY}`,
        }),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Search failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: SearchResponse = await response.json();

    // Normalize the response data
    return (data.data || []).map((token) => ({
      ...token,
      // Ensure required fields have defaults
      symbol: token.symbol || "???",
      name: token.name || "Unknown",
      priceUSD: token.priceUSD || 0,
      priceChange24hPercentage: token.priceChange24hPercentage || 0,
      volume24hUSD: token.volume24hUSD || 0,
      marketCapUSD: token.marketCapUSD || 0,
      blockchain: token.blockchain || getBlockchainName(token.chainId),
    }));
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

/**
 * Get trending/hot tokens from the API
 */
export async function getTrendingTokens(
  filters: SearchFilters = {},
): Promise<SearchToken[]> {
  const params = new URLSearchParams();

  // Set empty input for trending mode - API requires input parameter
  params.set("input", "");
  params.set("mode", "trendings");
  params.set("type", "tokens");

  // Set limit
  const limit = Math.min(Math.max(filters.limit || 20, 1), 20);
  params.set("limit", limit.toString());

  // Sort by volume for trending
  params.set("sortBy", filters.sortBy || "volume_24h");

  // Apply blockchain filters if specified
  if (filters.blockchains && filters.blockchains.length > 0) {
    const blockchainsFilter = JSON.stringify({
      blockchains: normalizeChainIds(filters.blockchains),
    });
    params.set("filters", blockchainsFilter);
  }

  try {
    const url = `${SEARCH_API_BASE}/fast-search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXPO_PUBLIC_MOBULA_API_KEY && {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_MOBULA_API_KEY}`,
        }),
      },
    });

    if (!response.ok) {
      throw new Error(`Trending fetch failed: ${response.status}`);
    }

    const data: SearchResponse = await response.json();

    return (data.data || []).map((token) => ({
      ...token,
      symbol: token.symbol || "???",
      name: token.name || "Unknown",
      priceUSD: token.priceUSD || 0,
      priceChange24hPercentage: token.priceChange24hPercentage || 0,
      volume24hUSD: token.volume24hUSD || 0,
      marketCapUSD: token.marketCapUSD || 0,
      blockchain: token.blockchain || getBlockchainName(token.chainId),
    }));
  } catch (error) {
    console.error("Trending fetch error:", error);
    throw error;
  }
}

/**
 * Default supported chains for search filters
 */
export const SEARCH_CHAINS = PULSE_CHAINS;

/**
 * Sort options for search
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "search_score", label: "Relevance" },
  { value: "volume_24h", label: "Volume 24h" },
  { value: "market_cap", label: "Market Cap" },
  { value: "holders_count", label: "Holders" },
  { value: "created_at", label: "Newest" },
  { value: "fees_paid_24h", label: "Fees 24h" },
];
