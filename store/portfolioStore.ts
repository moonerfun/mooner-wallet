import {
  MOBULA_CHAIN_ID_TO_KEY,
  toMobulaBlockchainName,
} from "@/constants/chains";
import { PAGE_SIZE_LARGE } from "@/constants/pagination";
import {
  calculateFinalChange24h,
  calculateTotalChange24h,
  extractApiPnl24h,
  getMobulaClient,
  transformMobulaAssets,
  type PortfolioAsset,
} from "@/lib";
import type { WalletPositionData } from "@/types/positionStream";
import type { TransactionEventData } from "@/types/transactionStream";
import { create } from "zustand";

// Re-export types from portfolioTransformers for backward compatibility
export type {
  CrossChainBalance,
  PortfolioAsset,
} from "@/lib/services/portfolioTransformers";

export interface PortfolioTransaction {
  hash: string;
  type: "buy" | "sell" | "transfer" | "swap" | "unknown";
  tokenIn?: {
    name: string;
    symbol: string;
    logo?: string;
    amount: number;
    valueUsd: number;
  };
  tokenOut?: {
    name: string;
    symbol: string;
    logo?: string;
    amount: number;
    valueUsd: number;
  };
  timestamp: number;
  blockchain: string;
  status: "success" | "pending" | "failed";
}

export interface WalletPortfolio {
  walletAddress: string;
  totalBalanceUsd: number;
  totalChange24h: number;
  totalChangePercentage24h: number;
  assets: PortfolioAsset[];
  lastUpdated: number;
}

interface PortfolioState {
  // Portfolio data
  portfolio: WalletPortfolio | null;
  isLoadingPortfolio: boolean;
  portfolioError: string | null;

  // Multi-wallet portfolio
  multiPortfolio: WalletPortfolio[];
  isLoadingMulti: boolean;
  _multiPortfolioRequestId: number; // Track current request to prevent race conditions
  _lastFetchedWalletsKey: string; // Track last fetched wallets to prevent duplicate calls
  _multiPortfolioFetchInProgress: boolean; // Prevent concurrent fetches
  _lastFetchedAt: number; // Timestamp of last successful fetch for cache TTL

  // Transaction history
  transactions: PortfolioTransaction[];
  isLoadingTransactions: boolean;
  transactionsError: string | null;

  // Active positions (for trading)
  positions: PortfolioAsset[];
  isLoadingPositions: boolean;

  // Real-time stream state
  isPositionsStreamConnected: boolean;
  lastPositionsUpdate: number;
  livePositions: Map<string, WalletPositionData>;
  recentStreamTransactions: TransactionEventData[];

  // Transaction completion trigger for forcing portfolio refresh
  lastTransactionTimestamp: number;
  pendingRefreshWallets: string[];

  // Actions
  fetchWalletPortfolio: (wallet: string, blockchains?: string) => Promise<void>;
  fetchMultiPortfolio: (wallets: string[], force?: boolean) => Promise<void>;
  fetchWalletTransactions: (
    wallet: string,
    blockchain?: string,
  ) => Promise<void>;
  fetchWalletPositions: (wallet: string, blockchain?: string) => Promise<void>;
  clearPortfolio: () => void;
  reset: () => void;

  // Real-time stream actions
  setPositionsStreamConnected: (connected: boolean) => void;
  updatePositionsFromStream: (positions: WalletPositionData[]) => void;
  updatePositionFromStream: (position: WalletPositionData) => void;
  addTransactionFromStream: (transaction: TransactionEventData) => void;
  getLivePosition: (
    chainId: string,
    token: string,
  ) => WalletPositionData | undefined;
  cleanupStalePositions: (maxAgeMs?: number) => void;

  // Transaction completion actions
  triggerPortfolioRefresh: (walletAddresses: string[]) => void;
  clearPendingRefresh: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  // Initial state
  portfolio: null,
  isLoadingPortfolio: false,
  portfolioError: null,

  multiPortfolio: [],
  isLoadingMulti: false,
  _multiPortfolioRequestId: 0,
  _lastFetchedWalletsKey: "",
  _multiPortfolioFetchInProgress: false,
  _lastFetchedAt: 0,

  transactions: [],
  isLoadingTransactions: false,
  transactionsError: null,

  positions: [],
  isLoadingPositions: false,

  // Real-time stream state
  isPositionsStreamConnected: false,
  lastPositionsUpdate: 0,
  livePositions: new Map<string, WalletPositionData>(),
  recentStreamTransactions: [],

  // Transaction completion trigger
  lastTransactionTimestamp: 0,
  pendingRefreshWallets: [],

  // Fetch portfolio for a single wallet
  fetchWalletPortfolio: async (wallet: string, blockchains?: string) => {
    set({ isLoadingPortfolio: true, portfolioError: null });
    try {
      const client = getMobulaClient();
      const response = await client.fetchWalletPortfolio({
        wallet,
        blockchains,
        shouldFetchPriceChange: "24h",
        // Fetch all chains if no specific blockchain is provided
        fetchAllChains: blockchains ? undefined : "true",
      });

      // Debug: log the raw response to understand the structure
      console.log(
        "[Portfolio] Raw response:",
        JSON.stringify(response, null, 2),
      );
      console.log("[Portfolio] response.data exists:", !!response.data);
      console.log("[Portfolio] response type:", typeof response);

      // The SDK may return data directly or nested in response.data
      const data = response.data ?? response;
      const totalBalance = data.total_wallet_balance || 0;

      console.log("[Portfolio] Parsed total_wallet_balance:", totalBalance);
      console.log("[Portfolio] Assets count:", data.assets?.length || 0);

      if (data) {
        // Use centralized transformer for assets
        const assets = transformMobulaAssets(data.assets || [], totalBalance);

        // Calculate 24h change using centralized utilities
        const totalChange24h = calculateTotalChange24h(assets);
        const apiChange24h = extractApiPnl24h(data);
        const {
          change24h: finalChange24h,
          changePercentage24h: finalChangePercentage24h,
        } = calculateFinalChange24h(totalChange24h, apiChange24h, totalBalance);

        const portfolio: WalletPortfolio = {
          walletAddress: wallet,
          totalBalanceUsd: totalBalance,
          totalChange24h: finalChange24h,
          totalChangePercentage24h: finalChangePercentage24h,
          assets: assets.sort((a, b) => b.valueUsd - a.valueUsd),
          lastUpdated: Date.now(),
        };

        set({ portfolio, isLoadingPortfolio: false });
      } else {
        // No data returned, set empty portfolio
        console.log("[Portfolio] No data in response");
        set({
          portfolio: {
            walletAddress: wallet,
            totalBalanceUsd: 0,
            totalChange24h: 0,
            totalChangePercentage24h: 0,
            assets: [],
            lastUpdated: Date.now(),
          },
          isLoadingPortfolio: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch wallet portfolio:", error);
      set({
        portfolioError:
          error instanceof Error ? error.message : "Failed to fetch portfolio",
        isLoadingPortfolio: false,
      });
    }
  },

  // Fetch portfolio for multiple wallets
  // force: bypass deduplication check (for pull-to-refresh)
  fetchMultiPortfolio: async (wallets: string[], force: boolean = false) => {
    const walletsKey = wallets.sort().join(",");
    const state = get();

    // Skip if fetch already in progress for same wallets
    if (
      !force &&
      state._multiPortfolioFetchInProgress &&
      state._lastFetchedWalletsKey === walletsKey
    ) {
      console.log(
        "[MultiPortfolio] Fetch already in progress for these wallets, skipping",
      );
      return;
    }

    // Increment request ID to track this specific request
    const currentRequestId = state._multiPortfolioRequestId + 1;
    set({
      isLoadingMulti: true,
      _multiPortfolioRequestId: currentRequestId,
      _lastFetchedWalletsKey: walletsKey,
      _multiPortfolioFetchInProgress: true,
    });

    try {
      const client = getMobulaClient();

      // Use the standard wallet portfolio endpoint with wallets parameter
      // This aggregates all wallets into a single response
      const response = await client.fetchWalletPortfolio({
        wallets: wallets.join(","),
        shouldFetchPriceChange: "24h",
        fetchAllChains: "true",
      });

      // Check if this request is still the current one (prevents race condition)
      if (get()._multiPortfolioRequestId !== currentRequestId) {
        console.log(
          "[MultiPortfolio] Ignoring stale response for request",
          currentRequestId,
        );
        return;
      }

      console.log(
        "[MultiPortfolio] Raw response:",
        JSON.stringify(response, null, 2),
      );

      // The response aggregates all wallets into a single portfolio
      const data = response.data ?? response;

      if (data && data.total_wallet_balance !== undefined) {
        // Single aggregated portfolio from multiple wallets
        const totalBalance = data.total_wallet_balance || 0;

        // Use centralized transformer for assets (same as single wallet)
        const assets = transformMobulaAssets(data.assets || [], totalBalance);

        // Calculate 24h change using centralized utilities
        const totalChange24h = calculateTotalChange24h(assets);
        const apiChange24h = extractApiPnl24h(data);
        const {
          change24h: finalChange24h,
          changePercentage24h: finalChangePercentage24h,
        } = calculateFinalChange24h(totalChange24h, apiChange24h, totalBalance);

        const portfolio: WalletPortfolio = {
          walletAddress: wallets.join(","),
          totalBalanceUsd: totalBalance,
          totalChange24h: finalChange24h,
          totalChangePercentage24h: finalChangePercentage24h,
          assets: assets.sort((a, b) => b.valueUsd - a.valueUsd),
          lastUpdated: Date.now(),
        };

        set({
          multiPortfolio: [portfolio],
          isLoadingMulti: false,
          _multiPortfolioFetchInProgress: false,
          _lastFetchedAt: Date.now(),
        });
      } else {
        set({
          multiPortfolio: [],
          isLoadingMulti: false,
          _multiPortfolioFetchInProgress: false,
          _lastFetchedAt: Date.now(),
        });
      }
    } catch (error) {
      // Only update error state if this is still the current request
      if (get()._multiPortfolioRequestId === currentRequestId) {
        console.error("Failed to fetch multi portfolio:", error);
        set({ isLoadingMulti: false, _multiPortfolioFetchInProgress: false });
      }
    }
  },

  // Fetch wallet transactions/activity
  fetchWalletTransactions: async (wallet: string, blockchain?: string) => {
    set({ isLoadingTransactions: true, transactionsError: null });
    try {
      const client = getMobulaClient();
      const response = await client.fetchWalletActivity({
        wallet,
        blockchains: blockchain,
        limit: PAGE_SIZE_LARGE,
      });

      if (response.data) {
        const transactions: PortfolioTransaction[] = response.data.map(
          (tx: any) => {
            const actions = tx.actions || [];
            const firstAction = actions[0] || {};

            let type: PortfolioTransaction["type"] = "unknown";
            if (firstAction.model?.toLowerCase() === "swap") type = "swap";
            else if (firstAction.model?.toLowerCase() === "transfer")
              type = "transfer";
            else if (firstAction.type?.toLowerCase() === "buy") type = "buy";
            else if (firstAction.type?.toLowerCase() === "sell") type = "sell";

            return {
              hash: tx.hash || "",
              type,
              tokenIn: firstAction.tokenIn
                ? {
                    name: firstAction.tokenIn.name || "Unknown",
                    symbol: firstAction.tokenIn.symbol || "???",
                    logo: firstAction.tokenIn.logo,
                    amount: firstAction.amountIn || 0,
                    valueUsd: firstAction.amountInUSD || 0,
                  }
                : undefined,
              tokenOut: firstAction.tokenOut
                ? {
                    name: firstAction.tokenOut.name || "Unknown",
                    symbol: firstAction.tokenOut.symbol || "???",
                    logo: firstAction.tokenOut.logo,
                    amount: firstAction.amountOut || 0,
                    valueUsd: firstAction.amountOutUSD || 0,
                  }
                : undefined,
              timestamp: tx.timestamp || Date.now(),
              blockchain: tx.blockchain || "ethereum",
              status:
                tx.status === "success"
                  ? "success"
                  : tx.status === "pending"
                    ? "pending"
                    : "failed",
            };
          },
        );

        set({ transactions, isLoadingTransactions: false });
      }
    } catch (error) {
      console.error("Failed to fetch wallet transactions:", error);
      set({
        transactionsError:
          error instanceof Error
            ? error.message
            : "Failed to fetch transactions",
        isLoadingTransactions: false,
      });
    }
  },

  // Fetch wallet positions (active holdings)
  fetchWalletPositions: async (wallet: string, blockchain?: string) => {
    set({ isLoadingPositions: true });
    try {
      const client = getMobulaClient();
      // Convert blockchain to Mobula API format if provided
      const mobulaBlockchain = blockchain
        ? toMobulaBlockchainName(blockchain)
        : undefined;
      const response = await client.fetchWalletPositions({
        wallet,
        blockchain: mobulaBlockchain,
      });

      if (response.data) {
        const positions: PortfolioAsset[] = response.data.map((pos: any) => ({
          name: pos.token?.name || "Unknown",
          symbol: pos.token?.symbol || "???",
          logo: pos.token?.logo,
          address: pos.token?.address || "",
          blockchain: pos.token?.blockchain || blockchain || "ethereum",
          blockchains: pos.token?.blockchains || [
            pos.token?.blockchain || blockchain || "ethereum",
          ],
          crossChainBalances: {},
          balance: pos.balance || 0,
          balanceRaw: pos.rawBalance || "0",
          price: pos.price || pos.token?.price || 0,
          priceChange24h: pos.token?.priceChange24h || 0,
          valueUsd: pos.amountUSD || 0,
          allocation: 0, // Will be calculated if needed
        }));

        set({ positions, isLoadingPositions: false });
      }
    } catch (error) {
      console.error("Failed to fetch wallet positions:", error);
      set({ isLoadingPositions: false });
    }
  },

  // Clear current portfolio (used when switching wallets)
  clearPortfolio: () => {
    // Increment request ID to invalidate any in-flight requests
    const newRequestId = get()._multiPortfolioRequestId + 1;
    set({
      portfolio: null,
      portfolioError: null,
      multiPortfolio: [],
      transactions: [],
      transactionsError: null,
      positions: [],
      livePositions: new Map(),
      lastPositionsUpdate: 0,
      _multiPortfolioRequestId: newRequestId,
    });
  },

  // Real-time stream actions
  setPositionsStreamConnected: (connected: boolean) => {
    set({ isPositionsStreamConnected: connected });
  },

  updatePositionsFromStream: (streamPositions: WalletPositionData[]) => {
    const { livePositions, positions, portfolio, multiPortfolio } = get();
    const newLivePositions = new Map(livePositions);
    let totalValueChange = 0;

    // Map chainId format (evm:1) to blockchain name (ethereum)
    // Using centralized MOBULA_CHAIN_ID_TO_KEY for consistency
    const chainIdToBlockchain = MOBULA_CHAIN_ID_TO_KEY;

    streamPositions.forEach((pos) => {
      const key = `${pos.chainId}-${pos.token.toLowerCase()}`;
      const oldPos = newLivePositions.get(key);
      if (oldPos) {
        totalValueChange += pos.amountUSD - oldPos.amountUSD;
      }
      newLivePositions.set(key, pos);
    });

    // Helper to check if position matches an asset
    const findMatchingPosition = (
      asset: PortfolioAsset,
    ): WalletPositionData | undefined => {
      for (const [key, livePos] of newLivePositions) {
        // Match by token address
        const matchesByAddress =
          livePos.token?.toLowerCase() === asset.address?.toLowerCase();
        const matchesByTokenDetails =
          livePos.tokenDetails?.address?.toLowerCase() ===
          asset.address?.toLowerCase();
        const matchesBySymbol =
          livePos.tokenDetails?.symbol?.toLowerCase() ===
          asset.symbol?.toLowerCase();

        if (matchesByAddress || matchesByTokenDetails || matchesBySymbol) {
          return livePos;
        }
      }
      return undefined;
    };

    // Update positions array with stream data
    const updatedPositions = positions.map((asset) => {
      const livePos = findMatchingPosition(asset);
      if (livePos) {
        return {
          ...asset,
          balance: livePos.balance,
          balanceRaw: livePos.rawBalance,
          valueUsd: livePos.amountUSD,
          price: livePos.tokenDetails?.price ?? asset.price,
          priceChange24h:
            livePos.tokenDetails?.priceChange24h ?? asset.priceChange24h,
        };
      }
      return asset;
    });

    // Update portfolio total if we have one
    const updatedPortfolio = portfolio
      ? {
          ...portfolio,
          totalBalanceUsd: portfolio.totalBalanceUsd + totalValueChange,
          lastUpdated: Date.now(),
        }
      : null;

    // Update multiPortfolio assets with live data
    const updatedMultiPortfolio = multiPortfolio.map((p) => {
      const updatedAssets = p.assets.map((asset) => {
        const livePos = findMatchingPosition(asset);
        if (livePos) {
          return {
            ...asset,
            balance: livePos.balance,
            balanceRaw: livePos.rawBalance,
            valueUsd: livePos.amountUSD,
            price: livePos.tokenDetails?.price ?? asset.price,
            priceChange24h:
              livePos.tokenDetails?.priceChange24h ?? asset.priceChange24h,
          };
        }
        return asset;
      });

      // Recalculate total balance from updated assets
      const newTotalBalance = updatedAssets.reduce(
        (sum, a) => sum + (a.valueUsd || 0),
        0,
      );

      return {
        ...p,
        assets: updatedAssets,
        totalBalanceUsd: newTotalBalance,
        lastUpdated: Date.now(),
      };
    });

    set({
      livePositions: newLivePositions,
      positions: updatedPositions,
      portfolio: updatedPortfolio,
      multiPortfolio: updatedMultiPortfolio,
      lastPositionsUpdate: Date.now(),
    });
  },

  updatePositionFromStream: (position: WalletPositionData) => {
    get().updatePositionsFromStream([position]);
  },

  addTransactionFromStream: (transaction: TransactionEventData) => {
    const { recentStreamTransactions, transactions } = get();

    // Add to recent stream transactions (keep last 100)
    const updatedStreamTxs = [transaction, ...recentStreamTransactions].slice(
      0,
      100,
    );

    // Convert to PortfolioTransaction format and add to transactions
    const portfolioTx: PortfolioTransaction = {
      hash: transaction.transactionHash,
      type:
        transaction.type === "swap" || transaction.type === "swap-enriched"
          ? "swap"
          : "transfer",
      tokenIn:
        transaction.type === "swap" || transaction.type === "swap-enriched"
          ? {
              name: (transaction as any).baseToken?.name || "Unknown",
              symbol: (transaction as any).baseToken?.symbol || "???",
              logo: (transaction as any).baseToken?.logo,
              amount: parseFloat((transaction as any).amountIn || "0"),
              valueUsd: (transaction as any).amountInUSD || 0,
            }
          : undefined,
      tokenOut:
        transaction.type === "swap" || transaction.type === "swap-enriched"
          ? {
              name: (transaction as any).quoteToken?.name || "Unknown",
              symbol: (transaction as any).quoteToken?.symbol || "???",
              logo: (transaction as any).quoteToken?.logo,
              amount: parseFloat((transaction as any).amountOut || "0"),
              valueUsd: (transaction as any).amountOutUSD || 0,
            }
          : undefined,
      timestamp: new Date(transaction.date).getTime(),
      blockchain: transaction.chainId
        .replace("evm:", "")
        .replace("solana:", ""),
      status: "success",
    };

    // Prepend to transactions list (most recent first)
    const updatedTransactions = [portfolioTx, ...transactions].slice(0, 100);

    set({
      recentStreamTransactions: updatedStreamTxs,
      transactions: updatedTransactions,
    });
  },

  getLivePosition: (chainId: string, token: string) => {
    const key = `${chainId}-${token.toLowerCase()}`;
    return get().livePositions.get(key);
  },

  /**
   * Clean up stale positions that haven't been updated recently
   * Removes positions with zero balance or positions older than maxAgeMs
   * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
   */
  cleanupStalePositions: (maxAgeMs = 5 * 60 * 1000) => {
    const { livePositions, lastPositionsUpdate } = get();
    const now = Date.now();
    const cutoffTime = now - maxAgeMs;

    // Only clean up if we have positions and they're old enough
    if (livePositions.size === 0 || lastPositionsUpdate > cutoffTime) {
      return;
    }

    const newLivePositions = new Map<string, WalletPositionData>();
    let removedCount = 0;

    for (const [key, position] of livePositions) {
      // Keep positions that:
      // 1. Have non-zero balance, OR
      // 2. Have significant USD value (> $0.01)
      const hasBalance = position.balance > 0;
      const hasValue = position.amountUSD > 0.01;

      if (hasBalance || hasValue) {
        newLivePositions.set(key, position);
      } else {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(
        `[PortfolioStore] Cleaned up ${removedCount} stale positions`,
      );
      set({ livePositions: newLivePositions });
    }
  },

  /**
   * Trigger a portfolio refresh after a transaction completes
   * This sets a timestamp that the wallet page can watch to know when to refresh
   * @param walletAddresses - Array of wallet addresses that need refreshing
   */
  triggerPortfolioRefresh: (walletAddresses: string[]) => {
    console.log(
      "[PortfolioStore] Triggering portfolio refresh for:",
      walletAddresses,
    );

    // Clear any stale live positions for these wallets to force fresh data
    const { livePositions } = get();
    const newLivePositions = new Map(livePositions);

    // Remove positions for the affected wallets to ensure fresh data is fetched
    // We don't have wallet-to-position mapping, so we clear all to be safe
    // The WebSocket will repopulate with fresh data

    set({
      lastTransactionTimestamp: Date.now(),
      pendingRefreshWallets: walletAddresses,
      // Clear live positions to force re-fetch and avoid stale data
      livePositions: new Map(),
      lastPositionsUpdate: 0,
    });

    // Immediately trigger a force fetch for the wallets
    if (walletAddresses.length > 0) {
      // Use setTimeout to avoid race conditions with the modal closing
      setTimeout(() => {
        get().fetchMultiPortfolio(walletAddresses, true);
      }, 500);
    }
  },

  /**
   * Clear the pending refresh flag after wallet page has processed it
   */
  clearPendingRefresh: () => {
    set({ pendingRefreshWallets: [] });
  },

  // Reset all state
  reset: () => {
    set({
      portfolio: null,
      isLoadingPortfolio: false,
      portfolioError: null,
      multiPortfolio: [],
      isLoadingMulti: false,
      _multiPortfolioRequestId: 0,
      transactions: [],
      isLoadingTransactions: false,
      transactionsError: null,
      positions: [],
      isLoadingPositions: false,
      isPositionsStreamConnected: false,
      lastPositionsUpdate: 0,
      livePositions: new Map(),
      recentStreamTransactions: [],
      lastTransactionTimestamp: 0,
      pendingRefreshWallets: [],
    });
  },
}));
