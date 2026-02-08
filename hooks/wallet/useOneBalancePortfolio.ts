/**
 * useOneBalancePortfolio Hook
 * Fetches and manages unified balance data from OneBalance API
 *
 * OneBalance provides:
 * - Aggregated balances across all chains (e.g., total USDC across Ethereum, Arbitrum, Base, etc.)
 * - Individual chain breakdowns
 * - Multi-account support (EVM + Solana)
 *
 * Key aggregated assets:
 * - ob:usdc - USDC across all chains
 * - ob:eth - ETH/WETH across all chains
 * - ob:sol - SOL across supported chains
 * - ob:usdt - USDT across all chains
 */

import {
  OneBalanceAggregatedAssetBalance,
  oneBalanceClient,
} from "@/lib/api/oneBalance/oneBalanceClient";
import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface ChainBalance {
  chainId: string; // CAIP-2 format (e.g., "eip155:1", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
  chainName: string;
  balance: string; // Raw balance in smallest unit
  formattedBalance: string; // Human-readable balance
  fiatValue: number; // USD value
}

export interface AggregatedAsset {
  assetId: string; // e.g., "ob:usdc"
  symbol: string;
  name: string;
  balance: string; // Total raw balance
  formattedBalance: string; // Human-readable total
  fiatValue: number; // Total USD value
  decimals: number;
  chainBalances: ChainBalance[]; // Per-chain breakdown
}

export interface OneBalancePortfolio {
  // Primary aggregated assets
  usdc: AggregatedAsset | null;
  eth: AggregatedAsset | null;
  sol: AggregatedAsset | null;
  usdt: AggregatedAsset | null;

  // All aggregated assets
  aggregatedAssets: AggregatedAsset[];

  // Totals
  totalFiatValue: number;

  // Status
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getChainName(caipChainId: string): string {
  const chainMap: Record<string, string> = {
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
  return chainMap[caipChainId] || caipChainId;
}

function getAssetDecimals(assetId: string): number {
  if (assetId.includes("usdc") || assetId.includes("usdt")) return 6;
  if (assetId.includes("eth") || assetId.includes("weth")) return 18;
  if (assetId.includes("sol")) return 9;
  if (assetId.includes("wbtc")) return 8;
  return 18;
}

function formatBalance(balance: string, decimals: number): string {
  const num = parseFloat(balance) / Math.pow(10, decimals);
  if (isNaN(num)) return "0";
  if (num === 0) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  return num.toFixed(6);
}

function getAssetName(assetId: string): string {
  const names: Record<string, string> = {
    "ob:usdc": "USD Coin",
    "ob:usdt": "Tether USD",
    "ob:eth": "Ethereum",
    "ob:sol": "Solana",
    "ob:wbtc": "Wrapped Bitcoin",
    "ob:arb": "Arbitrum",
    "ob:op": "Optimism",
    "ob:matic": "Polygon",
  };
  return names[assetId] || assetId.replace("ob:", "").toUpperCase();
}

function getAssetSymbol(assetId: string): string {
  return assetId.replace("ob:", "").toUpperCase();
}

function transformAggregatedAsset(
  raw: OneBalanceAggregatedAssetBalance,
): AggregatedAsset {
  const decimals = getAssetDecimals(raw.aggregatedAssetId);

  const chainBalances: ChainBalance[] = raw.individualAssetBalances.map((b) => {
    // Extract chain ID from assetType (e.g., "eip155:1/erc20:0x..." -> "eip155:1")
    const parts = b.assetType.split("/");
    const chainId = parts[0] || b.assetType;

    return {
      chainId,
      chainName: getChainName(chainId),
      balance: b.balance,
      formattedBalance: formatBalance(b.balance, decimals),
      fiatValue: b.fiatValue,
    };
  });

  // Sort chains by fiat value (highest first)
  chainBalances.sort((a, b) => b.fiatValue - a.fiatValue);

  return {
    assetId: raw.aggregatedAssetId,
    symbol: getAssetSymbol(raw.aggregatedAssetId),
    name: getAssetName(raw.aggregatedAssetId),
    balance: raw.balance,
    formattedBalance: formatBalance(raw.balance, decimals),
    fiatValue: raw.fiatValue,
    decimals,
    chainBalances,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useOneBalancePortfolio(
  evmAddress?: string,
  solanaAddress?: string,
  options?: {
    /** Auto-refresh interval in ms (default: 30000) */
    refreshInterval?: number;
    /** Enable auto-refresh (default: true) */
    autoRefresh?: boolean;
    /** Specific asset IDs to fetch (default: all) */
    assetIds?: string[];
  },
) {
  const {
    refreshInterval = 30000,
    autoRefresh = true,
    assetIds,
  } = options || {};

  const [portfolio, setPortfolio] = useState<OneBalancePortfolio>({
    usdc: null,
    eth: null,
    sol: null,
    usdt: null,
    aggregatedAssets: [],
    totalFiatValue: 0,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const fetchBalance = useCallback(async () => {
    if (!evmAddress && !solanaAddress) {
      return;
    }

    setPortfolio((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Build CAIP-10 account identifiers
      const accounts: string[] = [];

      if (evmAddress) {
        // For EIP-7702, we use the EOA directly with any chain (1 = Ethereum mainnet)
        accounts.push(`eip155:1:${evmAddress}`);
      }

      if (solanaAddress) {
        accounts.push(
          `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${solanaAddress}`,
        );
      }

      // Fetch aggregated balances using V3 endpoint
      const response = await oneBalanceClient.getAggregatedBalanceV3(
        accounts,
        assetIds,
      );

      // Transform response to our format
      const aggregatedAssets = response.balanceByAggregatedAsset.map(
        transformAggregatedAsset,
      );

      // Sort by fiat value (highest first)
      aggregatedAssets.sort((a, b) => b.fiatValue - a.fiatValue);

      // Find primary assets
      const usdc =
        aggregatedAssets.find((a) => a.assetId === "ob:usdc") || null;
      const eth = aggregatedAssets.find((a) => a.assetId === "ob:eth") || null;
      const sol = aggregatedAssets.find((a) => a.assetId === "ob:sol") || null;
      const usdt =
        aggregatedAssets.find((a) => a.assetId === "ob:usdt") || null;

      // Calculate total fiat value
      const totalFiatValue = aggregatedAssets.reduce(
        (sum, asset) => sum + asset.fiatValue,
        0,
      );

      setPortfolio({
        usdc,
        eth,
        sol,
        usdt,
        aggregatedAssets,
        totalFiatValue,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("[useOneBalancePortfolio] Error fetching balance:", error);
      setPortfolio((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch balance",
      }));
    }
  }, [evmAddress, solanaAddress, assetIds]);

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(fetchBalance, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchBalance]);

  return {
    ...portfolio,
    refetch: fetchBalance,
  };
}

/**
 * Convenience hook for just USDC balance
 * Perfect for swap screens where USDC is the primary input
 */
export function useOneBalanceUsdc(evmAddress?: string, solanaAddress?: string) {
  const { usdc, isLoading, error, refetch, lastUpdated } =
    useOneBalancePortfolio(evmAddress, solanaAddress, {
      assetIds: ["ob:usdc"],
    });

  return {
    balance: usdc?.balance || "0",
    formattedBalance: usdc?.formattedBalance || "0",
    fiatValue: usdc?.fiatValue || 0,
    chainBalances: usdc?.chainBalances || [],
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}
