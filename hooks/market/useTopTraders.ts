/**
 * useTopTraders Hook
 * Fetches top traders for a token using Mobula API
 */

import { toMobulaBlockchainName } from "@/constants/chains";
import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import {
    TopTrader,
    TraderLabel,
    useTopTradersStore,
} from "@/store/topTradersStore";
import { useCallback, useEffect, useRef } from "react";

interface UseTopTradersOptions {
  address: string;
  blockchain: string;
  enabled?: boolean;
  limit?: number;
}

// Map API labels to our TraderLabel type
const mapLabel = (apiLabel?: string): TraderLabel | undefined => {
  if (!apiLabel) return undefined;
  const labelMap: Record<string, TraderLabel> = {
    whale: "whale",
    sniper: "sniper",
    fresh: "fresh",
    bot: "bot",
    dev: "dev",
    insider: "insider",
    pro: "pro",
    bundler: "bundler",
  };
  return labelMap[apiLabel.toLowerCase()];
};

export function useTopTraders({
  address,
  blockchain,
  enabled = true,
  limit = 50,
}: UseTopTradersOptions) {
  const {
    traders,
    isLoading,
    error,
    setTraders,
    setLoading,
    setError,
    clearTraders,
  } = useTopTradersStore();

  const isMounted = useRef(true);
  const isFetchingRef = useRef(false);
  const lastFetchKeyRef = useRef<string | null>(null);

  const fetchTopTraders = useCallback(async () => {
    if (!address || !blockchain) return;

    // Create a unique key for this request to prevent duplicates
    const fetchKey = `${address}-${blockchain}`;

    // Skip if already fetching the same data
    if (isFetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    setError(null);

    try {
      const client = getMobulaClient();

      // Convert blockchain to Mobula API format (e.g., "bnb" -> "BNB Smart Chain (BEP20)")
      const mobulaBlockchain = toMobulaBlockchainName(blockchain);

      // Fetch token trader positions from Mobula API
      const response = await client.fetchTokenTraderPositions({
        address,
        blockchain: mobulaBlockchain,
        limit,
      });

      if (!isMounted.current) return;

      if (response?.data) {
        // Map API response to our TopTrader interface
        // API fields: walletAddress, volumeBuyUSD, volumeSellUSD, tokenAmount, pnlUSD, labels, chainId
        const topTraders: TopTrader[] = response.data.map(
          (trader: any, index: number) => {
            const volumeBuy = Number(trader.volumeBuyUSD) || 0;
            const volumeSell = Number(trader.volumeSellUSD) || 0;
            const tokenAmount = Number(trader.tokenAmount) || 0;
            const pnl = Number(trader.pnlUSD) || 0;

            // Get primary label from labels array
            const labels = trader.labels as string[] | undefined;
            const primaryLabel = labels?.[0] ? mapLabel(labels[0]) : undefined;
            const mappedLabels = labels?.map(mapLabel).filter(Boolean) as
              | TraderLabel[]
              | undefined;

            return {
              address: trader.walletAddress || "",
              label: primaryLabel,
              labels: mappedLabels,
              bought: volumeBuy,
              sold: volumeSell,
              remaining: tokenAmount,
              remainingPercentage: trader.remainingPercentage || 0, // This may need to be calculated
              realizedPnl: pnl,
              unrealizedPnl: trader.unrealizedPnlUSD
                ? Number(trader.unrealizedPnlUSD)
                : 0,
              totalPnl: pnl,
              buyCount: Number(trader.buyCount) || 0,
              sellCount: Number(trader.sellCount) || 0,
              firstTradeAt: trader.firstTradeAt,
              lastTradeAt: trader.lastTradeAt,
              avgBuyPrice: trader.avgBuyPrice
                ? Number(trader.avgBuyPrice)
                : undefined,
              avgSellPrice: trader.avgSellPrice
                ? Number(trader.avgSellPrice)
                : undefined,
            };
          },
        );

        setTraders(topTraders);
      } else {
        setTraders([]);
      }
    } catch (err) {
      console.error("Error fetching top traders:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load top traders",
        );
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [address, blockchain, limit, setTraders, setLoading, setError]);

  // Track whether we've already fetched for this token
  const hasFetchedForTokenRef = useRef<string | null>(null);

  // Fetch on mount and when token changes (not on focus changes)
  useEffect(() => {
    isMounted.current = true;

    const tokenKey = `${address}-${blockchain}`;

    // Only fetch if enabled, we have valid params, and we haven't fetched this token yet
    // This prevents re-fetching when screen regains focus
    if (
      enabled &&
      address &&
      blockchain &&
      hasFetchedForTokenRef.current !== tokenKey
    ) {
      hasFetchedForTokenRef.current = tokenKey;
      fetchTopTraders();
    }

    return () => {
      isMounted.current = false;
    };
  }, [enabled, address, blockchain, fetchTopTraders]);

  // Reset fetch tracking when token changes
  useEffect(() => {
    return () => {
      hasFetchedForTokenRef.current = null;
    };
  }, [address, blockchain]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTraders();
    };
  }, [clearTraders]);

  return {
    traders,
    isLoading,
    error,
    refetch: fetchTopTraders,
  };
}

export default useTopTraders;
