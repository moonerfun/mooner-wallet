/**
 * Blockchain utilities for fetching blockchain data from Mobula API
 * Provides blockchain logos and metadata for all supported chains
 */

// Import from centralized chain configuration
import {
  CHAIN_LOGOS as CENTRALIZED_CHAIN_LOGOS,
  CHAIN_NAME_ALIASES as CENTRALIZED_CHAIN_NAME_ALIASES,
  getChainLogo as getCentralizedChainLogo,
} from "@/constants/chains";

// API configuration
const MOBULA_API_URL =
  process.env.EXPO_PUBLIC_MOBULA_API_URL || "https://api.mobula.io";
const MOBULA_API_KEY = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";

// Blockchain data from Mobula API
export interface BlockchainData {
  name: string;
  logo: string;
  chainId: string;
  evmChainId?: number;
  color?: string;
  shortName?: string;
  explorer?: string;
  rpcs?: string[];
  testnet?: boolean;
  eth?: {
    name: string;
    symbol: string;
    logo?: string;
    decimals: number;
  };
}

// Normalized blockchain info for easy lookup
export interface BlockchainInfo {
  name: string;
  logo: string;
  symbol: string;
  color: string;
  chainId: number | string;
  explorer?: string;
}

// Cache for blockchain data
let cachedBlockchains: Map<string, BlockchainInfo> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Re-export from centralized chains for backward compatibility
export const CHAIN_LOGOS = CENTRALIZED_CHAIN_LOGOS;
const CHAIN_NAME_ALIASES = CENTRALIZED_CHAIN_NAME_ALIASES;

/**
 * Get blockchain logo by chain name (synchronous, uses cache/fallback)
 */
export function getChainLogo(chainName: string): string {
  const normalizedName = chainName.toLowerCase().trim();

  // Check cache first
  if (cachedBlockchains) {
    const cached = cachedBlockchains.get(normalizedName);
    if (cached?.logo) return cached.logo;

    // Try aliases
    for (const [key, aliases] of Object.entries(CHAIN_NAME_ALIASES)) {
      if (aliases.includes(normalizedName)) {
        const aliasedChain = cachedBlockchains.get(key);
        if (aliasedChain?.logo) return aliasedChain.logo;
      }
    }
  }

  // Fallback to centralized chain logos
  return getCentralizedChainLogo(normalizedName);
}

/**
 * Get blockchain info by chain name (synchronous, uses cache/fallback)
 */
export function getChainInfo(chainName: string): BlockchainInfo | null {
  const normalizedName = chainName.toLowerCase().trim();

  if (cachedBlockchains) {
    const cached = cachedBlockchains.get(normalizedName);
    if (cached) return cached;

    // Try aliases
    for (const [key, aliases] of Object.entries(CHAIN_NAME_ALIASES)) {
      if (aliases.includes(normalizedName)) {
        const aliasedChain = cachedBlockchains.get(key);
        if (aliasedChain) return aliasedChain;
      }
    }
  }

  return null;
}

/**
 * Prefetch blockchains on app startup
 */
export async function prefetchBlockchains(): Promise<void> {
  if (cachedBlockchains && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (MOBULA_API_KEY) {
      headers["Authorization"] = `Bearer ${MOBULA_API_KEY}`;
    }

    const response = await fetch(`${MOBULA_API_URL}/api/1/blockchains`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data?.data) {
      const chainMap = new Map<string, BlockchainInfo>();

      for (const chain of data.data) {
        if (!chain.name) continue;

        const normalizedName = chain.name.toLowerCase().trim();
        const info: BlockchainInfo = {
          name: chain.name,
          logo: chain.logo || "",
          symbol: chain.eth?.symbol || chain.shortName || "",
          color: chain.color || "#627EEA",
          chainId: chain.evmChainId || chain.chainId || "",
          explorer: chain.explorer,
        };

        chainMap.set(normalizedName, info);

        if (chain.shortName) {
          chainMap.set(chain.shortName.toLowerCase(), info);
        }
      }

      cachedBlockchains = chainMap;
      cacheTimestamp = Date.now();
    }
  } catch (err) {
    console.error("[prefetchBlockchains] Error:", err);
  }
}
