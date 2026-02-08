/**
 * useWalletAnalysis Hook
 * Fetches wallet analysis data from Mobula API
 * Uses fetchWalletAnalysis endpoint for accurate stats (matching MTT web)
 */

import { toMobulaBlockchainName } from "@/constants/chains";
import { WALLET_ANALYSIS_LIMIT } from "@/constants/pagination";
import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import {
    AnalysisTimeframe,
    useWalletAnalysisStore,
    WalletActivity,
    WalletAnalysis,
    WalletPosition,
} from "@/store/walletAnalysisStore";
import { useCallback, useEffect, useRef } from "react";

interface UseWalletAnalysisOptions {
  walletAddress: string | null;
  blockchain: string | null;
  enabled?: boolean;
}

// Map timeframe to API period format
const mapTimeframeToPeriod = (timeframe: AnalysisTimeframe): string => {
  const periodMap: Record<AnalysisTimeframe, string> = {
    "24h": "1d",
    "7d": "7d",
    "30d": "30d",
    "90d": "90d",
  };
  return periodMap[timeframe];
};

export function useWalletAnalysis({
  walletAddress,
  blockchain,
  enabled = true,
}: UseWalletAnalysisOptions) {
  const {
    analysis,
    isLoading,
    error,
    timeframe,
    setAnalysis,
    setLoading,
    setError,
    clearAnalysis,
  } = useWalletAnalysisStore();

  const isMounted = useRef(true);

  const fetchWalletData = useCallback(async () => {
    if (!walletAddress || !blockchain) return;

    setLoading(true);
    setError(null);

    try {
      const client = getMobulaClient();
      const period = mapTimeframeToPeriod(timeframe);
      // Convert blockchain to Mobula API format (e.g., "bnb" -> "BNB Smart Chain (BEP20)")
      const mobulaBlockchain = toMobulaBlockchainName(blockchain);

      // Fetch all wallet data in parallel (matching MTT's approach)
      const [analysisRes, positionsRes, activityRes] = await Promise.all([
        // Main wallet analysis with stats - this is the key API for stats
        client
          .fetchWalletAnalysis({
            wallet: walletAddress,
            blockchain: mobulaBlockchain,
            period: period as "1d" | "7d" | "30d" | "90d",
          })
          .catch((err) => {
            console.error("fetchWalletAnalysis error:", err);
            return null;
          }),

        // Wallet positions - provides proper PNL data per position
        client
          .fetchWalletPositions({
            wallet: walletAddress,
            blockchain: mobulaBlockchain,
          })
          .catch((err) => {
            console.error("fetchWalletPositions error:", err);
            return null;
          }),

        // Wallet activity - transactions history
        client
          .fetchWalletActivity({
            wallet: walletAddress,
            blockchains: mobulaBlockchain,
            limit: WALLET_ANALYSIS_LIMIT,
          })
          .catch((err) => {
            console.error("fetchWalletActivity error:", err);
            return null;
          }),
      ]);

      if (!isMounted.current) return;

      // Debug: Log API responses to understand data structure
      console.log(
        "fetchWalletAnalysis response:",
        JSON.stringify(analysisRes?.data, null, 2)?.slice(0, 500),
      );
      console.log(
        "fetchWalletPositions response:",
        JSON.stringify(positionsRes?.data, null, 2)?.slice(0, 500),
      );
      console.log(
        "fetchWalletActivity response:",
        JSON.stringify(activityRes?.data, null, 2)?.slice(0, 500),
      );

      // Parse stats from wallet analysis response (matching MTT's data structure)
      const stat = (analysisRes?.data as Record<string, unknown>)?.stat as
        | Record<string, unknown>
        | undefined;

      // Parse positions from fetchWalletPositions response (proper PNL data)
      const positions: WalletPosition[] = [];
      let totalBalanceUsd = 0;

      if (positionsRes?.data) {
        const positionsData = positionsRes.data as Array<
          Record<string, unknown>
        >;

        for (const pos of positionsData) {
          const token = pos.token as Record<string, unknown> | undefined;
          const amount = Number(pos.balance) || 0;
          const amountUsd = Number(pos.amountUSD) || 0;

          // Filter out positions with no holdings (amount <= 0 or value < $0.01)
          if (amount <= 0 && amountUsd < 0.01) {
            continue;
          }

          totalBalanceUsd += amountUsd;

          positions.push({
            tokenAddress: (token?.address as string) || "",
            tokenSymbol: (token?.symbol as string) || "???",
            tokenName: (token?.name as string) || "Unknown",
            tokenLogo: (token?.logo as string) || undefined,
            blockchain: (token?.chainId as string) || blockchain,
            amount,
            amountUsd,
            price: Number(token?.priceUSD) || 0,
            priceChange24h: token?.priceChange24h as number | undefined,
            realizedPnl: Number(pos.realizedPnlUSD) || 0,
            unrealizedPnl: Number(pos.unrealizedPnlUSD) || 0,
            // Additional data from positions API
            marketCap: Number(token?.marketCapUSD) || undefined,
            createdAt: token?.createdAt as string | undefined,
          });
        }
      }

      // Parse activity from fetchWalletActivity response
      // Structure: { data: [{ actions: [...], txHash, txDateIso, chainId }] }
      const activities: WalletActivity[] = [];

      if (activityRes?.data) {
        const activityData = activityRes.data as Array<Record<string, unknown>>;

        for (const tx of activityData) {
          const actions = tx.actions as
            | Array<Record<string, unknown>>
            | undefined;
          if (!actions?.length) continue;

          // Get the first action to determine type
          const firstAction = actions[0];
          const actionModel = (
            (firstAction?.model as string) || "transfer"
          ).toLowerCase();
          const txType = (
            ["swap", "transfer", "mint", "burn"].includes(actionModel)
              ? actionModel
              : "transfer"
          ) as "swap" | "transfer" | "mint" | "burn";

          const txHash =
            (tx.txHash as string) ||
            (tx.hash as string) ||
            Math.random().toString();

          // Parse swap action
          if (txType === "swap") {
            const swapAssetIn = firstAction.swapAssetIn as
              | Record<string, unknown>
              | undefined;
            const swapAssetOut = firstAction.swapAssetOut as
              | Record<string, unknown>
              | undefined;

            activities.push({
              id: txHash,
              type: "swap",
              timestamp:
                (tx.txDateIso as string) ||
                (tx.date as string) ||
                new Date().toISOString(),
              tokenIn: swapAssetIn
                ? {
                    symbol: (swapAssetIn.symbol as string) || "???",
                    amount: Number(firstAction.swapAmountIn) || 0,
                    amountUsd: Number(firstAction.swapAmountUsd) || 0,
                  }
                : undefined,
              tokenOut: swapAssetOut
                ? {
                    symbol: (swapAssetOut.symbol as string) || "???",
                    amount: Number(firstAction.swapAmountOut) || 0,
                    amountUsd: Number(firstAction.swapAmountOutUsd) || 0,
                  }
                : undefined,
              hash: txHash,
              blockchain: (tx.chainId as string) || blockchain,
            });
          } else {
            // Parse transfer action
            const transferAsset = firstAction.transferAsset as
              | Record<string, unknown>
              | undefined;

            activities.push({
              id: txHash,
              type: txType,
              timestamp:
                (tx.txDateIso as string) ||
                (tx.date as string) ||
                new Date().toISOString(),
              tokenIn: transferAsset
                ? {
                    symbol: (transferAsset.symbol as string) || "???",
                    amount: Number(firstAction.transferAmount) || 0,
                    amountUsd:
                      Number(firstAction.transferValueUsd) ||
                      Number(firstAction.transferAmountUsd) ||
                      0,
                  }
                : undefined,
              hash: txHash,
              blockchain: (tx.chainId as string) || blockchain,
            });
          }
        }
      }

      // Extract stats from the analysis response
      // These field names match what MTT uses: periodVolumeBuy, periodVolumeSell, etc.
      const totalBought = Number(stat?.periodVolumeBuy) || 0;
      const totalSold = Number(stat?.periodVolumeSell) || 0;
      const winCount = Number(stat?.periodWinCount) || 0;
      const lossCount = Number(stat?.periodLossCount) || 0;
      const totalPnl = Number(stat?.periodTotalPnlUSD) || 0;
      const realizedPnl = Number(stat?.periodRealizedPnlUSD) || totalPnl;
      const unrealizedPnl = Number(stat?.periodUnrealizedPnlUSD) || 0;
      const realizedRate = Number(stat?.periodRealizedRate) || 0;
      const winRate =
        winCount + lossCount > 0
          ? winCount / (winCount + lossCount)
          : realizedRate;
      const buyCount = Number(stat?.periodBuys) || 0;
      const sellCount = Number(stat?.periodSells) || 0;
      const activeTokenCount =
        Number(stat?.periodActiveTokensCount) || positions.length;

      // Build the complete analysis object
      const walletAnalysis: WalletAnalysis = {
        address: walletAddress,
        blockchain,
        totalBalanceUsd,
        realizedPnl,
        unrealizedPnl,
        totalPnl,
        totalBought,
        totalSold,
        winCount,
        lossCount,
        winRate,
        txnCount: buyCount + sellCount,
        buyCount,
        sellCount,
        activeTokenCount,
        positions,
        activities, // Use parsed activities from fetchWalletActivity
        pnlHistory: [], // Would need separate API call for chart data
      };

      setAnalysis(walletAnalysis);
    } catch (err) {
      console.error("Error fetching wallet analysis:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load wallet data",
        );
      }
    }
  }, [walletAddress, blockchain, timeframe, setAnalysis, setLoading, setError]);

  // Fetch when enabled and wallet address changes
  useEffect(() => {
    isMounted.current = true;

    if (enabled && walletAddress && blockchain) {
      fetchWalletData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [enabled, walletAddress, blockchain, timeframe, fetchWalletData]);

  return {
    analysis,
    isLoading,
    error,
    refetch: fetchWalletData,
  };
}

export default useWalletAnalysis;
