/**
 * useLiveTokenBalance Hook
 * Retrieves token balances with real-time updates from position stream
 * Combines portfolio data with live WebSocket updates
 */

import { useCallback } from "react";

import {
  CHAIN_ID_TO_NAME,
  findCrossChainBalanceKey,
  getChainByRelayId,
  NATIVE_TOKEN_ADDRESS,
  RELAY_CHAIN_IDS,
  SOLANA_NATIVE_ADDRESS,
  SOLANA_WRAPPED_SOL_ADDRESS,
  type ChainKey,
} from "@/constants/chains";
import { PortfolioAsset, usePortfolioStore } from "@/store/portfolioStore";
import { NATIVE_TOKEN_ADDRESS as MOBULA_NATIVE_ADDRESS } from "@/types/positionStream";
import { fromSmallestUnit } from "@/utils/formatters";
import { SwapToken } from "../types";

/**
 * Balance data for a token with live updates
 */
export interface LiveTokenBalance {
  balance: string; // Full precision balance as string
  balanceRaw?: string; // Raw balance in smallest units
  decimals?: number; // Token decimals for conversion
  balanceUsd: number;
  isLive: boolean; // True if this data is from WebSocket stream
  lastUpdated?: number;
}

/**
 * Hook return type
 */
export interface UseLiveTokenBalanceReturn {
  getTokenBalance: (token: SwapToken) => LiveTokenBalance | null;
  refreshBalances: (addresses: string[]) => Promise<void>;
  isStreamConnected: boolean;
}

/**
 * Format balance with full precision, avoiding floating point issues
 * Uses the raw balance when available for maximum precision
 */
function formatFullPrecisionBalance(
  balance: number,
  balanceRaw?: string,
  decimals?: number,
): string {
  // If we have raw balance and decimals, compute from that to avoid floating point issues
  if (balanceRaw && decimals !== undefined) {
    return fromSmallestUnit(balanceRaw, decimals);
  }
  // Fallback: use the balance number with enough precision
  // For very large or very small numbers, we need more decimal places
  if (balance === 0) return "0";
  if (balance >= 1000000) return balance.toFixed(4);
  if (balance >= 1000) return balance.toFixed(6);
  if (balance >= 1) return balance.toFixed(9);
  if (balance >= 0.000001) return balance.toFixed(12);
  return balance.toPrecision(12);
}

/**
 * useLiveTokenBalance Hook
 * Looks up token balances from portfolio store with live stream updates
 */
export function useLiveTokenBalance(): UseLiveTokenBalanceReturn {
  const {
    portfolio,
    multiPortfolio,
    fetchMultiPortfolio,
    livePositions,
    isPositionsStreamConnected,
    lastPositionsUpdate,
  } = usePortfolioStore();

  /**
   * Get balance for a specific token, preferring live data when available
   */
  const getTokenBalance = useCallback(
    (token: SwapToken): LiveTokenBalance | null => {
      // First, try to get live position data
      // SwapToken chainId is a number, we need to convert to Mobula format
      const chainIdNum = token.chainId;
      const chainId =
        chainIdNum === RELAY_CHAIN_IDS.SOLANA
          ? "solana:solana"
          : `evm:${chainIdNum}`;

      // Convert native token address for lookup
      // Handle both EVM (0x000...0) and Solana (111...1) native addresses
      const isSolanaNative =
        token.address === SOLANA_NATIVE_ADDRESS ||
        token.address === SOLANA_WRAPPED_SOL_ADDRESS ||
        token.address === "11111111111111111111111111111111";
      const tokenAddress =
        token.address === NATIVE_TOKEN_ADDRESS || isSolanaNative
          ? MOBULA_NATIVE_ADDRESS
          : token.address;

      const liveKey = `${chainId}-${tokenAddress.toLowerCase()}`;
      const livePosition = livePositions.get(liveKey);

      if (livePosition) {
        // Use rawBalance if available for full precision
        const formattedBalance = livePosition.rawBalance
          ? fromSmallestUnit(livePosition.rawBalance, token.decimals)
          : livePosition.balance.toString();
        return {
          balance: formattedBalance,
          balanceRaw: livePosition.rawBalance,
          decimals: token.decimals,
          balanceUsd: livePosition.amountUSD,
          isLive: true,
          lastUpdated: lastPositionsUpdate,
        };
      }

      // Fallback to portfolio data
      const allAssets: PortfolioAsset[] = [
        ...(portfolio?.assets || []),
        ...multiPortfolio.flatMap((p) => p.assets || []),
      ];

      // Get chain config and key from chain ID for alias-based matching
      const chainConfig = getChainByRelayId(token.chainId);
      const chainKey = chainConfig?.key as ChainKey | undefined;
      const chainName = CHAIN_ID_TO_NAME[token.chainId];

      // Check if this is a native token (EVM zero address, Solana system program, or Mobula's native address)
      const isNativeToken =
        token.address === NATIVE_TOKEN_ADDRESS ||
        token.address.toLowerCase() === MOBULA_NATIVE_ADDRESS.toLowerCase() ||
        isSolanaNative;

      // Match token by symbol and/or address
      for (const asset of allAssets) {
        const symbolMatch =
          asset.symbol.toLowerCase() === token.symbol.toLowerCase();

        // For native tokens, match by symbol and chain
        if (isNativeToken && symbolMatch) {
          if (chainKey && asset.crossChainBalances) {
            // Use alias matching to find the correct key in crossChainBalances
            const crossChainKey = findCrossChainBalanceKey(
              asset.crossChainBalances,
              chainKey,
            );
            const chainBalance = crossChainKey
              ? asset.crossChainBalances[crossChainKey]
              : undefined;
            if (chainBalance) {
              const decimals = asset.decimals ?? token.decimals;
              return {
                balance: formatFullPrecisionBalance(
                  chainBalance.balance,
                  chainBalance.balanceRaw,
                  decimals,
                ),
                balanceRaw: chainBalance.balanceRaw,
                decimals,
                balanceUsd: chainBalance.balance * asset.price,
                isLive: false,
              };
            }
          }
          return {
            balance: formatFullPrecisionBalance(
              asset.balance,
              asset.balanceRaw,
              asset.decimals,
            ),
            balanceRaw: asset.balanceRaw,
            decimals: asset.decimals,
            balanceUsd: asset.valueUsd,
            isLive: false,
          };
        }

        // For contract tokens, match by address
        if (
          asset.address &&
          !isNativeToken &&
          asset.address.toLowerCase() === token.address.toLowerCase()
        ) {
          return {
            balance: formatFullPrecisionBalance(
              asset.balance,
              asset.balanceRaw,
              asset.decimals,
            ),
            balanceRaw: asset.balanceRaw,
            decimals: asset.decimals,
            balanceUsd: asset.valueUsd,
            isLive: false,
          };
        }

        // Fallback symbol match for tokens like USDC, USDT
        if (symbolMatch && !isNativeToken) {
          if (chainName && asset.blockchains?.includes(chainName)) {
            // Use alias matching for cross-chain balance lookup
            const crossChainKey = chainKey
              ? findCrossChainBalanceKey(asset.crossChainBalances, chainKey)
              : undefined;
            const chainBalance = crossChainKey
              ? asset.crossChainBalances?.[crossChainKey]
              : undefined;
            if (chainBalance) {
              const decimals = asset.decimals ?? token.decimals;
              return {
                balance: formatFullPrecisionBalance(
                  chainBalance.balance,
                  chainBalance.balanceRaw,
                  decimals,
                ),
                balanceRaw: chainBalance.balanceRaw,
                decimals,
                balanceUsd: chainBalance.balance * asset.price,
                isLive: false,
              };
            }
          }
        }
      }

      return null;
    },
    [portfolio, multiPortfolio, livePositions, lastPositionsUpdate],
  );

  /**
   * Refresh balances for addresses
   */
  const refreshBalances = useCallback(
    async (addresses: string[]) => {
      const uniqueAddresses = [...new Set(addresses)];
      if (uniqueAddresses.length > 0) {
        await fetchMultiPortfolio(uniqueAddresses);
      }
    },
    [fetchMultiPortfolio],
  );

  return {
    getTokenBalance,
    refreshBalances,
    isStreamConnected: isPositionsStreamConnected,
  };
}
