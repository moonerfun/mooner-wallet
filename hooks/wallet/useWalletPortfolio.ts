import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import {
  usePortfolioStore,
  type PortfolioAsset,
  type WalletPortfolio,
} from "@/store/portfolioStore";
import { useEffect, useMemo, useRef } from "react";

/**
 * Hook to fetch portfolio for multiple wallets
 * Merges REST-fetched data with real-time WebSocket position updates
 *
 * NOTE: For most use cases, prefer using portfolio from WalletContext instead.
 * This hook is only needed when you specifically need to trigger a new fetch
 * or access live position merging (e.g., SendModal).
 */
export function useMultiWalletPortfolio(wallets: string[]) {
  const {
    multiPortfolio,
    isLoadingMulti,
    fetchMultiPortfolio,
    livePositions,
    lastPositionsUpdate,
  } = usePortfolioStore();

  const walletsKey = wallets.join(",");

  useEffect(() => {
    // Skip if empty
    if (!wallets || wallets.length === 0) {
      return;
    }

    // Deduplication is now handled in the store's fetchMultiPortfolio
    fetchMultiPortfolio(wallets);
  }, [walletsKey]); // Only re-run when wallets change

  // Merge live position data with REST portfolio data
  const portfoliosWithLiveData = useMemo((): WalletPortfolio[] => {
    if (livePositions.size === 0) {
      return multiPortfolio;
    }

    return multiPortfolio.map((portfolio) => {
      // Update assets with live position data
      const updatedAssets = portfolio.assets.map((asset): PortfolioAsset => {
        // Try to find a matching live position
        // Live positions are keyed by "chainId-tokenAddress"
        for (const [key, livePos] of livePositions) {
          // Check if this live position matches this asset
          // livePos.token is the token address string, tokenDetails has metadata
          const matchesByAddress =
            livePos.token?.toLowerCase() === asset.address?.toLowerCase();
          const matchesByTokenDetails =
            livePos.tokenDetails?.address?.toLowerCase() ===
            asset.address?.toLowerCase();
          const matchesBySymbol =
            livePos.tokenDetails?.symbol?.toLowerCase() ===
            asset.symbol?.toLowerCase();

          if (matchesByAddress || matchesByTokenDetails || matchesBySymbol) {
            // Merge live data into the asset
            return {
              ...asset,
              balance: livePos.balance ?? asset.balance,
              valueUsd: livePos.amountUSD ?? asset.valueUsd,
              price: livePos.tokenDetails?.price ?? asset.price,
              priceChange24h:
                livePos.tokenDetails?.priceChange24h ?? asset.priceChange24h,
            };
          }
        }
        return asset;
      });

      // Recalculate total balance from updated assets
      const totalBalanceUsd = updatedAssets.reduce(
        (sum, a) => sum + (a.valueUsd || 0),
        0,
      );

      return {
        ...portfolio,
        assets: updatedAssets,
        totalBalanceUsd,
        lastUpdated: lastPositionsUpdate || portfolio.lastUpdated,
      };
    });
  }, [multiPortfolio, livePositions, lastPositionsUpdate]);

  // Calculate combined totals from the merged data
  const totalBalance = portfoliosWithLiveData.reduce(
    (sum, p) => sum + p.totalBalanceUsd,
    0,
  );
  const totalChange = portfoliosWithLiveData.reduce(
    (sum, p) => sum + p.totalChange24h,
    0,
  );

  return {
    portfolios: portfoliosWithLiveData,
    totalBalance,
    totalChange,
    totalChangePercentage:
      totalBalance > 0 ? (totalChange / totalBalance) * 100 : 0,
    isLoading: isLoadingMulti,
    refetch: () => {
      if (wallets.length > 0) {
        // Force fetch to bypass deduplication (for pull-to-refresh)
        fetchMultiPortfolio(wallets, true);
      }
    },
  };
}

/**
 * Hook to fetch wallet transaction history
 */
export function useWalletTransactions(
  wallet: string | undefined,
  blockchain?: string,
) {
  const {
    transactions,
    isLoadingTransactions,
    transactionsError,
    fetchWalletTransactions,
  } = usePortfolioStore();

  useEffect(() => {
    if (wallet) {
      fetchWalletTransactions(wallet, blockchain);
    }
  }, [wallet, blockchain]);

  return {
    transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
    refetch: () => wallet && fetchWalletTransactions(wallet, blockchain),
  };
}

/**
 * Hook for active wallet positions
 */
export function useWalletPositions(
  wallet: string | undefined,
  blockchain?: string,
) {
  const { positions, isLoadingPositions, fetchWalletPositions } =
    usePortfolioStore();

  useEffect(() => {
    if (wallet) {
      fetchWalletPositions(wallet, blockchain);
    }
  }, [wallet, blockchain]);

  return {
    positions,
    isLoading: isLoadingPositions,
    refetch: () => wallet && fetchWalletPositions(wallet, blockchain),
  };
}

/**
 * Hook for real-time position updates via WebSocket
 */
export function useWalletPositionStream(
  wallet: string | undefined,
  token: string | undefined,
  blockchain: string | undefined,
) {
  const { positions } = usePortfolioStore();
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!wallet || !token || !blockchain) return;

    const client = getMobulaClient();

    try {
      const subscriptionId = `${wallet}-${token}-${blockchain}`;

      const actualId = client.streams.subscribe(
        "position",
        {
          wallet,
          token,
          blockchain: blockchain as never,
          subscriptionId,
          subscriptionTracking: true,
        },
        (data: unknown) => {
          const positionData = data as any;
          if (positionData?.data) {
            // Update position in store
            usePortfolioStore.setState((state) => ({
              positions: state.positions.map((pos) =>
                pos.address === token
                  ? {
                      ...pos,
                      balance: positionData.data.balance,
                      valueUsd: positionData.data.amountUSD,
                    }
                  : pos,
              ),
            }));
          }
        },
      );

      subscriptionIdRef.current = actualId;
    } catch (error) {
      console.error("Failed to subscribe to position stream:", error);
    }

    return () => {
      if (subscriptionIdRef.current) {
        try {
          const client = getMobulaClient();
          client.streams.unsubscribe("position", subscriptionIdRef.current);
        } catch (error) {
          console.error("Failed to unsubscribe from position stream:", error);
        }
        subscriptionIdRef.current = null;
      }
    };
  }, [wallet, token, blockchain]);

  return { positions };
}
