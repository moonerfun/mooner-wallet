/**
 * useOneBalanceBalance Hook
 * Fetches and manages aggregated token balances from OneBalance API
 *
 * OneBalance provides aggregated balances across all chains:
 * - USDC on Ethereum + Arbitrum + Base = Single USDC balance
 * - ETH across all EVM chains = Single ETH balance
 * - SOL balance for Solana
 *
 * This is the key feature that enables chain abstraction:
 * Users see ONE balance, not fragmented balances per chain.
 */

import {
  getOneBalanceClient,
  toAggregatedAssetId,
} from "@/lib/api/oneBalance/oneBalanceClient";
import { useCallback, useRef, useState } from "react";
import { SwapToken } from "../types";

/**
 * Aggregated balance for a token
 */
export interface OneBalanceAggregatedBalance {
  /** Total balance across all chains (human readable) */
  balance: string;
  /** Total balance in smallest unit */
  balanceRaw: string;
  /** Total USD value */
  balanceUsd: number;
  /** Number of chains this token is on */
  chainCount: number;
  /** Breakdown by chain */
  byChain: {
    chainId: string;
    chainName: string;
    balance: string;
    balanceUsd: number;
  }[];
  /** Whether this is an aggregated asset (vs chain-specific) */
  isAggregated: boolean;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Cache for aggregated balances
 */
interface BalanceCache {
  balances: Map<string, OneBalanceAggregatedBalance>;
  lastFetched: number;
}

/**
 * Hook return type
 */
export interface UseOneBalanceBalanceReturn {
  /** Get aggregated balance for a token (by symbol for aggregated, or address for specific) */
  getAggregatedBalance: (
    token: SwapToken,
  ) => OneBalanceAggregatedBalance | null;
  /** Get total aggregated balance for a symbol (e.g., "USDC" returns total across all chains) */
  getTotalBalance: (symbol: string) => OneBalanceAggregatedBalance | null;
  /** Refresh balances from OneBalance API */
  refreshBalances: (
    evmAddress?: string,
    solanaAddress?: string,
  ) => Promise<void>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Whether balances have been fetched */
  hasFetched: boolean;
}

// Cache TTL: 30 seconds
const CACHE_TTL_MS = 30 * 1000;

// Chain ID to name mapping (from CAIP-2 format)
const CHAIN_ID_TO_NAME: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:42161": "Arbitrum",
  "eip155:10": "Optimism",
  "eip155:8453": "Base",
  "eip155:137": "Polygon",
  "eip155:56": "BSC",
  "eip155:59144": "Linea",
  "eip155:43114": "Avalanche",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
};

// Decimals for common aggregated assets
const AGGREGATED_ASSET_DECIMALS: Record<string, number> = {
  "ob:usdc": 6,
  "ob:usdt": 6,
  "ob:eth": 18,
  "ob:sol": 9,
  "ob:wbtc": 8,
};

/**
 * Format balance from smallest unit to human readable
 */
function formatBalance(balanceRaw: string, decimals: number): string {
  if (!balanceRaw || balanceRaw === "0") return "0";

  const num = BigInt(balanceRaw);
  const divisor = BigInt(10 ** decimals);
  const integerPart = num / divisor;
  const fractionalPart = num % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Trim trailing zeros but keep at least 2 decimal places for display
  const trimmed = fractionalStr.replace(/0+$/, "");
  const displayDecimals = Math.max(trimmed.length, Math.min(2, decimals));
  const finalFraction = fractionalStr.substring(0, displayDecimals);

  return `${integerPart}.${finalFraction}`;
}

/**
 * useOneBalanceBalance Hook
 * Fetches aggregated balances from OneBalance API
 */
export function useOneBalanceBalance(): UseOneBalanceBalanceReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const cacheRef = useRef<BalanceCache>({
    balances: new Map(),
    lastFetched: 0,
  });

  // Store addresses for refetching
  const addressesRef = useRef<{
    evmAddress?: string;
    solanaAddress?: string;
  }>({});

  /**
   * Fetch aggregated balances from OneBalance API
   */
  const refreshBalances = useCallback(
    async (evmAddress?: string, solanaAddress?: string) => {
      // Store addresses for future refetches
      if (evmAddress) addressesRef.current.evmAddress = evmAddress;
      if (solanaAddress) addressesRef.current.solanaAddress = solanaAddress;

      const evm = evmAddress || addressesRef.current.evmAddress;
      const solana = solanaAddress || addressesRef.current.solanaAddress;

      if (!evm && !solana) {
        console.log("[OneBalanceBalance] No addresses provided, skipping");
        return;
      }

      // Check cache TTL
      const now = Date.now();
      if (
        hasFetched &&
        now - cacheRef.current.lastFetched < CACHE_TTL_MS &&
        cacheRef.current.balances.size > 0
      ) {
        console.log("[OneBalanceBalance] Using cached balances");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const client = getOneBalanceClient();

        // Build accounts array in CAIP-10 format
        const accounts: string[] = [];
        if (evm) {
          accounts.push(`eip155:1:${evm}`);
        }
        if (solana) {
          accounts.push(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${solana}`);
        }

        console.log("[OneBalanceBalance] Fetching balances for:", accounts);

        // Fetch aggregated balances using V3 API
        const response = await client.getAggregatedBalanceV3(accounts);

        console.log("[OneBalanceBalance] Response:", response);

        // Parse and cache balances
        const newBalances = new Map<string, OneBalanceAggregatedBalance>();

        for (const asset of response.balanceByAggregatedAsset || []) {
          const assetId = asset.aggregatedAssetId; // e.g., "ob:usdc"
          const decimals = AGGREGATED_ASSET_DECIMALS[assetId] || 18;

          const byChain = (asset.individualAssetBalances || []).map(
            (chainBalance) => {
              const chainPart = chainBalance.assetType.split("/")[0];
              return {
                chainId: chainPart,
                chainName: CHAIN_ID_TO_NAME[chainPart] || chainPart,
                balance: formatBalance(chainBalance.balance, decimals),
                balanceUsd: chainBalance.fiatValue,
              };
            },
          );

          newBalances.set(assetId, {
            balance: formatBalance(asset.balance, decimals),
            balanceRaw: asset.balance,
            balanceUsd: asset.fiatValue,
            chainCount: byChain.length,
            byChain,
            isAggregated: true,
            lastUpdated: now,
          });

          // Also store by symbol for easy lookup (e.g., "usdc" -> same balance)
          const symbol = assetId.replace("ob:", "").toLowerCase();
          newBalances.set(symbol, newBalances.get(assetId)!);
        }

        // Also store chain-specific balances
        for (const asset of response.balanceBySpecificAsset || []) {
          const decimals = 18; // Default, could be improved with asset metadata
          newBalances.set(asset.assetType, {
            balance: formatBalance(asset.balance, decimals),
            balanceRaw: asset.balance,
            balanceUsd: asset.fiatValue,
            chainCount: 1,
            byChain: [
              {
                chainId: asset.assetType.split("/")[0],
                chainName:
                  CHAIN_ID_TO_NAME[asset.assetType.split("/")[0]] || "Unknown",
                balance: formatBalance(asset.balance, decimals),
                balanceUsd: asset.fiatValue,
              },
            ],
            isAggregated: false,
            lastUpdated: now,
          });
        }

        cacheRef.current = {
          balances: newBalances,
          lastFetched: now,
        };

        setHasFetched(true);
        console.log("[OneBalanceBalance] Cached", newBalances.size, "balances");
      } catch (err) {
        console.error("[OneBalanceBalance] Error fetching balances:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setIsLoading(false);
      }
    },
    [hasFetched],
  );

  /**
   * Get aggregated balance for a token
   * Prefers aggregated assets for common tokens (USDC, ETH, SOL, etc.)
   */
  const getAggregatedBalance = useCallback(
    (token: SwapToken): OneBalanceAggregatedBalance | null => {
      const cache = cacheRef.current.balances;

      // First, try to get aggregated balance by symbol
      const aggregatedId = toAggregatedAssetId(token.symbol);
      if (aggregatedId) {
        const balance = cache.get(aggregatedId);
        if (balance) {
          console.log(
            `[OneBalanceBalance] Found aggregated balance for ${token.symbol}:`,
            balance.balance,
          );
          return balance;
        }
      }

      // Try by lowercase symbol
      const symbolLower = token.symbol.toLowerCase();
      const bySymbol = cache.get(symbolLower);
      if (bySymbol) {
        return bySymbol;
      }

      // Fallback to chain-specific lookup (not common for OneBalance)
      return null;
    },
    [],
  );

  /**
   * Get total aggregated balance for a symbol
   */
  const getTotalBalance = useCallback(
    (symbol: string): OneBalanceAggregatedBalance | null => {
      const cache = cacheRef.current.balances;

      // Try aggregated asset ID
      const aggregatedId = toAggregatedAssetId(symbol);
      if (aggregatedId) {
        return cache.get(aggregatedId) || null;
      }

      // Try by symbol
      return cache.get(symbol.toLowerCase()) || null;
    },
    [],
  );

  return {
    getAggregatedBalance,
    getTotalBalance,
    refreshBalances,
    isLoading,
    error,
    hasFetched,
  };
}

export default useOneBalanceBalance;
