/**
 * useQuickBuy Hook
 * Handles instant token purchases without opening a modal
 * Uses OneBalance for cross-chain swaps with USDC
 */

import { toast } from "@/components/ui/Toast";
import { useOneBalanceBalance } from "@/components/wallet/swap";
import { useOneBalanceAccount } from "@/components/wallet/swap/hooks/useOneBalanceAccount";
import { useOneBalanceExecution } from "@/components/wallet/swap/hooks/useOneBalanceExecution";
import { SwapToken } from "@/components/wallet/swap/types";
import { isSolanaChain, RELAY_CHAIN_IDS } from "@/constants/chains";
import { useWallet } from "@/contexts/WalletContext";
import {
  getOneBalanceClient,
  toEvmAssetId,
  toSolanaAssetId,
} from "@/lib/api/oneBalance/oneBalanceClient";
import { triggerKolSyncDelayed } from "@/lib/kol/kolSyncService";
import { useKolStore } from "@/store/kolStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import { TokenDetails } from "@/store/tokenStore";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

// Map blockchain name to chain ID
const BLOCKCHAIN_TO_CHAIN_ID: Record<string, number> = {
  solana: RELAY_CHAIN_IDS.SOLANA,
  ethereum: RELAY_CHAIN_IDS.ETHEREUM,
  eth: RELAY_CHAIN_IDS.ETHEREUM,
  base: RELAY_CHAIN_IDS.BASE,
  bsc: RELAY_CHAIN_IDS.BSC,
  bnb: RELAY_CHAIN_IDS.BSC,
  "bnb chain": RELAY_CHAIN_IDS.BSC,
};

// Aggregated USDC token definition for OneBalance
const AGGREGATED_USDC: SwapToken = {
  symbol: "USDC",
  name: "USD Coin (Aggregated)",
  logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  address: "ob:usdc",
  chainId: 0,
  decimals: 6,
};

export interface QuickBuyState {
  isExecuting: boolean;
  executingAmount: number | null;
  status: "idle" | "fetching-quote" | "executing" | "success" | "error";
  error: string | null;
}

export interface UseQuickBuyReturn {
  /** Execute a quick buy with specified USD amount */
  executeBuy: (amountUsd: number) => Promise<boolean>;
  /** Current execution state */
  state: QuickBuyState;
  /** USDC balance available for buying */
  usdcBalance: number;
  /** Reset state after execution */
  reset: () => void;
}

export function useQuickBuy(token: TokenDetails | null): UseQuickBuyReturn {
  const { consolidatedWallets, selectedWallet } = useWallet();
  const { currentUser } = useKolStore();
  const triggerPortfolioRefresh = usePortfolioStore(
    (state) => state.triggerPortfolioRefresh,
  );

  // Execution state
  const [state, setState] = useState<QuickBuyState>({
    isExecuting: false,
    executingAmount: null,
    status: "idle",
    error: null,
  });

  // Track if currently executing to prevent double-taps
  const isExecutingRef = useRef(false);

  // Get EVM and Solana addresses
  const { evmAddress, solanaAddress } = useMemo(() => {
    let evm: string | undefined;
    let solana: string | undefined;
    for (const wallet of consolidatedWallets) {
      if (wallet.walletType === "solana") {
        solana = wallet.address;
      } else if (
        wallet.walletType === "evm" ||
        wallet.walletType === "consolidated"
      ) {
        evm = wallet.address;
      }
    }
    return { evmAddress: evm, solanaAddress: solana };
  }, [consolidatedWallets]);

  // OneBalance account
  const { evmAccountAddress, isReady: isAccountReady } = useOneBalanceAccount(
    evmAddress,
    solanaAddress,
  );

  // Balance hook for USDC
  const { getAggregatedBalance, refreshBalances, hasFetched } =
    useOneBalanceBalance();

  // Fetch balances on mount when wallet addresses are available
  useEffect(() => {
    if (evmAddress || solanaAddress) {
      refreshBalances(evmAddress, solanaAddress);
    }
  }, [evmAddress, solanaAddress, refreshBalances]);

  // Get USDC balance
  const usdcBalance = useMemo(() => {
    if (!hasFetched) return 0;
    const usdcData = getAggregatedBalance({
      symbol: "USDC",
      name: "USD Coin",
      address: "ob:usdc",
      chainId: 0,
      decimals: 6,
    });
    return usdcData?.balanceUsd || 0;
  }, [hasFetched, getAggregatedBalance]);

  // Determine chain ID from token
  const chainId = useMemo(() => {
    if (!token?.blockchain) return RELAY_CHAIN_IDS.SOLANA;
    const blockchain = token.blockchain.toLowerCase().split(":")[0];
    return BLOCKCHAIN_TO_CHAIN_ID[blockchain] || RELAY_CHAIN_IDS.SOLANA;
  }, [token?.blockchain]);

  // Build trade token from token details
  const tradeToken = useMemo((): SwapToken | null => {
    if (!token) return null;
    const isSolana = isSolanaChain(chainId);
    const defaultDecimals = isSolana ? 6 : 18;

    return {
      symbol: token.symbol,
      name: token.name,
      logo: token.logo,
      address: token.address,
      chainId,
      decimals: token.decimals || defaultDecimals,
    };
  }, [token, chainId]);

  // Get wallet account for the target chain
  const walletAccount = useMemo(() => {
    if (!consolidatedWallets.length) return null;
    const isSolana = isSolanaChain(chainId);
    const targetType = isSolana ? "solana" : "evm";
    const wallet = consolidatedWallets.find((w) => w.walletType === targetType);
    return wallet?.address || null;
  }, [consolidatedWallets, chainId]);

  // OneBalance execution hook
  const { executeSwap: executeOneBalanceSwap, resetExecution } =
    useOneBalanceExecution(selectedWallet);

  // Reset function
  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      executingAmount: null,
      status: "idle",
      error: null,
    });
    isExecutingRef.current = false;
    resetExecution();
  }, [resetExecution]);

  // Execute quick buy
  const executeBuy = useCallback(
    async (amountUsd: number): Promise<boolean> => {
      // Prevent double execution
      if (isExecutingRef.current) {
        console.log("[QuickBuy] Already executing, ignoring");
        return false;
      }

      if (!token || !tradeToken || !walletAccount || !evmAddress) {
        toast.error("Unable to Buy", "Wallet not ready");
        return false;
      }

      if (amountUsd > usdcBalance) {
        toast.error(
          "Insufficient Balance",
          `You have $${usdcBalance.toFixed(2)} USDC`,
        );
        return false;
      }

      // Haptic feedback
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      isExecutingRef.current = true;
      setState({
        isExecuting: true,
        executingAmount: amountUsd,
        status: "fetching-quote",
        error: null,
      });

      console.log("[QuickBuy] Starting quick buy:", {
        token: token.symbol,
        amount: amountUsd,
      });

      try {
        // Create a fresh quote hook call with the specific amount
        // We need to fetch a quote directly using the OneBalance API
        const quoteResponse = await fetchQuoteDirectly(
          amountUsd,
          tradeToken,
          evmAddress,
          evmAccountAddress || undefined,
          solanaAddress,
          walletAccount,
        );

        if (!quoteResponse) {
          throw new Error("Failed to get quote");
        }

        setState((prev) => ({ ...prev, status: "executing" }));

        // Execute the swap
        const result = await executeOneBalanceSwap({
          fromToken: AGGREGATED_USDC,
          toToken: tradeToken,
          fromAmount: amountUsd.toString(),
          quote: quoteResponse,
          evmWalletAddress: evmAddress,
          solanaWalletAddress: solanaAddress,
          maxRetries: 2,
        });

        if (result.success) {
          // Success haptic
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          // Trigger portfolio refresh
          triggerPortfolioRefresh([walletAccount]);

          // Trigger KOL stats sync
          triggerKolSyncDelayed(currentUser?.id, 10000);

          setState({
            isExecuting: false,
            executingAmount: null,
            status: "success",
            error: null,
          });

          toast.success(
            `Bought ${token.symbol}! 🎉`,
            `$${amountUsd} → ${quoteResponse.outputAmountFormatted || ""} ${token.symbol}`,
          );

          isExecutingRef.current = false;
          return true;
        } else {
          throw new Error(result.error || "Swap failed");
        }
      } catch (error) {
        console.error("[QuickBuy] Error:", error);

        // Error haptic
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        setState({
          isExecuting: false,
          executingAmount: null,
          status: "error",
          error: errorMessage,
        });

        toast.error("Quick Buy Failed", errorMessage);
        isExecutingRef.current = false;
        return false;
      }
    },
    [
      token,
      tradeToken,
      walletAccount,
      evmAddress,
      evmAccountAddress,
      solanaAddress,
      usdcBalance,
      executeOneBalanceSwap,
      triggerPortfolioRefresh,
      currentUser?.id,
    ],
  );

  return {
    executeBuy,
    state,
    usdcBalance,
    reset,
  };
}

// Solana chain ID constant
const SOLANA_CHAIN_ID = 792703809;

/**
 * Fetch quote using OneBalance client
 */
async function fetchQuoteDirectly(
  amountUsd: number,
  toToken: SwapToken,
  evmAddress: string,
  evmAccountAddress: string | undefined,
  solanaAddress: string | undefined,
  recipientAddress: string,
): Promise<any> {
  const client = getOneBalanceClient();

  // Build the destination asset ID based on chain
  const isSolana = toToken.chainId === SOLANA_CHAIN_ID;
  const toAssetId = isSolana
    ? toSolanaAssetId(toToken.address)
    : toEvmAssetId(toToken.chainId, toToken.address);

  // USDC has 6 decimals
  const amount = Math.floor(amountUsd * 1_000_000).toString();

  console.log("[QuickBuy] Fetching quote:", {
    fromAssetId: "ob:usdc",
    toAssetId,
    amount,
    evmAddress,
    solanaAddress,
    recipient: recipientAddress,
  });

  const quote = await client.getSwapQuote({
    evmAddress: evmAccountAddress || evmAddress,
    evmSignerAddress: evmAddress,
    solanaAddress,
    fromAssetId: "ob:usdc",
    toAssetId,
    amount,
    slippageTolerance: 100, // 1% in basis points
    recipient: recipientAddress,
  });

  console.log("[QuickBuy] Quote received:", {
    outputAmount: quote.outputAmountFormatted,
    provider: quote.provider,
  });

  return quote;
}
