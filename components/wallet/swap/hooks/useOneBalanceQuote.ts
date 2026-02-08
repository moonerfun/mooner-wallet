/**
 * useOneBalanceQuote Hook
 * Fetches and manages swap quotes from OneBalance API
 * Unified cross-chain abstraction for all swaps
 */

import {
  SLIPPAGE_BPS_MAJOR,
  SLIPPAGE_BPS_MAX,
  SLIPPAGE_BPS_MEME,
  SLIPPAGE_BPS_STABLECOIN,
  SLIPPAGE_BPS_VOLATILE,
  SLIPPAGE_CROSS_CHAIN_MULTIPLIER,
  SLIPPAGE_RETRY_MULTIPLIER,
} from "@/constants/defaults";
import {
  getOneBalanceClient,
  toAggregatedAssetId,
  toEvmAssetId,
  toSolanaAssetId,
} from "@/lib/api/oneBalance/oneBalanceClient";
import { OneBalanceSwapQuote } from "@/lib/api/oneBalance/oneBalanceTypes";
import { toSmallestUnit } from "@/utils/formatters";
import { useCallback, useEffect, useRef, useState } from "react";
import { SwapToken } from "../types";

// Solana chain ID constant (used by the app)
const SOLANA_CHAIN_ID = 792703809;

// Minimum SOL swap amount - must cover wSOL rent (~0.00204 SOL) + OneBalance fees
const MIN_SOL_SWAP_AMOUNT = 0.005;

// =============================================================================
// Smart Slippage Classification
// Per OneBalance docs: https://docs.onebalance.io/guides/slippage/examples
// =============================================================================

/** Well-known stablecoin symbols */
const STABLECOIN_SYMBOLS = [
  "usdc",
  "usdt",
  "dai",
  "busd",
  "tusd",
  "frax",
  "lusd",
  "gusd",
  "pyusd",
];

/** Well-known major token symbols */
const MAJOR_TOKEN_SYMBOLS = [
  "eth",
  "weth",
  "btc",
  "wbtc",
  "sol",
  "wsol",
  "bnb",
  "matic",
  "avax",
  "link",
];

/**
 * Classify an asset as stablecoin, major, or volatile based on its symbol.
 */
function classifyAsset(symbol: string): "stablecoin" | "major" | "volatile" {
  const lower = symbol.toLowerCase();
  if (STABLECOIN_SYMBOLS.some((s) => lower === s || lower === `w${s}`)) {
    return "stablecoin";
  }
  if (MAJOR_TOKEN_SYMBOLS.some((s) => lower === s)) {
    return "major";
  }
  return "volatile";
}

/**
 * Check if a token is likely a meme/new token based on its asset ID.
 * Tokens with CAIP-19 addresses on Solana that aren't well-known are treated as meme tokens.
 * Pump.fun tokens, low-cap altcoins, etc.
 */
function isMemeToken(token: SwapToken): boolean {
  const cls = classifyAsset(token.symbol);
  if (cls !== "volatile") return false;

  // Solana tokens that aren't SOL/USDC are very likely meme/new tokens
  if (token.chainId === SOLANA_CHAIN_ID) {
    return true;
  }

  return false;
}

/**
 * Check if the swap is cross-chain (different blockchain ecosystems).
 */
function isCrossChain(fromToken: SwapToken, toToken: SwapToken): boolean {
  const fromIsSolana = fromToken.chainId === SOLANA_CHAIN_ID;
  const toIsSolana = toToken.chainId === SOLANA_CHAIN_ID;
  // Cross-chain if one is Solana and the other isn't
  return fromIsSolana !== toIsSolana;
}

/**
 * Compute the recommended minimum slippage in basis points based on asset types.
 * The user's configured slippage is used as a floor — we never go below it,
 * but we increase it if the asset volatility class warrants it.
 *
 * OneBalance recommended values:
 * - Stablecoins: 10-25 bps (0.1-0.25%)
 * - Major tokens: 50-100 bps (0.5-1%)
 * - Volatile/altcoins: 100-500 bps (1-5%)
 * - New/meme tokens: 500 bps (5%)
 * - Cross-chain: +50% of single-chain value
 */
export function getSmartSlippageBps(
  fromToken: SwapToken,
  toToken: SwapToken,
  userSlippageBps: number,
): number {
  const fromClass = classifyAsset(fromToken.symbol);
  const toClass = classifyAsset(toToken.symbol);

  // Determine base slippage from the more volatile side
  let recommendedBps: number;

  if (isMemeToken(fromToken) || isMemeToken(toToken)) {
    // Meme/new tokens need the highest slippage
    recommendedBps = SLIPPAGE_BPS_MEME;
  } else if (fromClass === "stablecoin" && toClass === "stablecoin") {
    recommendedBps = SLIPPAGE_BPS_STABLECOIN;
  } else if (fromClass === "volatile" || toClass === "volatile") {
    recommendedBps = SLIPPAGE_BPS_VOLATILE;
  } else {
    // major↔major or major↔stablecoin
    recommendedBps = SLIPPAGE_BPS_MAJOR;
  }

  // Apply cross-chain multiplier
  if (isCrossChain(fromToken, toToken)) {
    recommendedBps = Math.round(
      recommendedBps * SLIPPAGE_CROSS_CHAIN_MULTIPLIER,
    );
  }

  // Use whichever is higher: user preference or smart recommendation
  const finalBps = Math.max(userSlippageBps, recommendedBps);

  // Cap at maximum
  return Math.min(finalBps, SLIPPAGE_BPS_MAX);
}

/**
 * Quote parameters
 */
export interface OneBalanceQuoteParams {
  fromToken: SwapToken | null;
  toToken: SwapToken | null;
  fromAmount: string;
  slippage: string;
  evmAddress?: string; // EVM EOA address (used as signer)
  evmSmartAccountAddress?: string; // EVM account address (for EIP-7702, same as EOA)
  solanaAddress?: string;
  recipientAddress?: string;
}

/**
 * Quote state
 */
export interface OneBalanceQuoteState {
  quote: OneBalanceSwapQuote | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseOneBalanceQuoteReturn extends OneBalanceQuoteState {
  fetchQuote: () => Promise<void>;
  getQuoteForRetry: (
    retryAttempt?: number,
    amountOverride?: string,
  ) => Promise<OneBalanceSwapQuote | null>;
  clearQuote: () => void;
}

/**
 * Convert a SwapToken to a OneBalance asset ID
 * Prefers aggregated assets for common tokens (USDC, ETH, etc.)
 */
function tokenToAssetId(token: SwapToken): string {
  // Check if this is a common token that can use aggregated assets
  const aggregatedId = toAggregatedAssetId(token.symbol);
  if (aggregatedId) {
    return aggregatedId;
  }

  // Check if this is a Solana token
  if (token.chainId === SOLANA_CHAIN_ID) {
    return toSolanaAssetId(token.address);
  }

  // Default to EVM chain-specific asset
  return toEvmAssetId(token.chainId, token.address);
}

/**
 * useOneBalanceQuote Hook
 * Fetches swap quotes with debouncing and error handling
 */
export function useOneBalanceQuote(
  params: OneBalanceQuoteParams,
  debounceMs: number = 500,
): UseOneBalanceQuoteReturn {
  const [state, setState] = useState<OneBalanceQuoteState>({
    quote: null,
    isLoading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    fromToken,
    toToken,
    fromAmount,
    slippage,
    evmAddress,
    evmSmartAccountAddress,
    solanaAddress,
    recipientAddress,
  } = params;

  /**
   * Clear the current quote
   */
  const clearQuote = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setState({ quote: null, isLoading: false, error: null });
  }, []);

  /**
   * Fetch quote from OneBalance API
   */
  const fetchOneBalanceQuote = useCallback(
    async (
      overrideSlippageBps?: number,
    ): Promise<OneBalanceSwapQuote | null> => {
      if (!fromToken || !toToken || !fromAmount) return null;
      if (!evmAddress && !solanaAddress) return null;

      const client = getOneBalanceClient();
      const amountInSmallestUnit = toSmallestUnit(
        fromAmount,
        fromToken.decimals,
      );

      // Convert tokens to OneBalance asset IDs
      const fromAssetId = tokenToAssetId(fromToken);
      const toAssetId = tokenToAssetId(toToken);

      // Calculate user's configured slippage in basis points
      const userSlippageBps = Math.round(parseFloat(slippage) * 100);

      // Use override (for retries) or compute smart slippage
      const slippageBps =
        overrideSlippageBps ??
        getSmartSlippageBps(fromToken, toToken, userSlippageBps);

      console.log("[OneBalanceQuote] Request:", {
        fromAssetId,
        toAssetId,
        amount: amountInSmallestUnit,
        userSlippageBps,
        smartSlippageBps: slippageBps,
        overrideSlippageBps,
        evmAddress,
        evmSmartAccountAddress,
        solanaAddress,
      });

      const swapQuote = await client.getSwapQuote({
        // For EIP-7702, evmSmartAccountAddress = evmAddress (both are EOA)
        evmAddress: evmSmartAccountAddress || evmAddress,
        solanaAddress,
        // EVM signer address (EOA) - same as evmAddress for EIP-7702
        evmSignerAddress: evmAddress,
        fromAssetId,
        toAssetId,
        amount: amountInSmallestUnit,
        slippageTolerance: slippageBps,
        recipient: recipientAddress,
      });

      console.log("[OneBalanceQuote] Response:", swapQuote);
      return swapQuote;
    },
    [
      fromToken,
      toToken,
      fromAmount,
      slippage,
      evmAddress,
      evmSmartAccountAddress,
      solanaAddress,
      recipientAddress,
    ],
  );

  /**
   * Fetch quote
   */
  const fetchQuote = useCallback(async () => {
    // Validate inputs
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setState((prev) => ({ ...prev, quote: null, error: null }));
      return;
    }

    // Validate minimum SOL swap amount
    // SOL swaps require extra SOL for wSOL account rent (~0.00204 SOL)
    // Amounts below minimum will always fail on-chain
    if (
      fromToken.chainId === SOLANA_CHAIN_ID &&
      fromToken.symbol === "SOL" &&
      parseFloat(fromAmount) < MIN_SOL_SWAP_AMOUNT
    ) {
      setState({
        quote: null,
        isLoading: false,
        error: `Minimum SOL swap is ${MIN_SOL_SWAP_AMOUNT} SOL`,
      });
      return;
    }

    if (!evmAddress && !solanaAddress) {
      setState((prev) => ({
        ...prev,
        quote: null,
        error: "No wallet address",
      }));
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const swapQuote = await fetchOneBalanceQuote();
      if (!swapQuote) {
        throw new Error("Failed to get OneBalance quote");
      }

      setState({ quote: swapQuote, isLoading: false, error: null });
    } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("[OneBalanceQuote] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get quote";
      setState({ quote: null, isLoading: false, error: errorMessage });
    }
  }, [
    fromToken,
    toToken,
    fromAmount,
    evmAddress,
    solanaAddress,
    fetchOneBalanceQuote,
  ]);

  /**
   * Auto-fetch quote with debouncing when params change
   */
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if missing required params
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setState((prev) => ({ ...prev, quote: null, isLoading: false }));
      return;
    }

    // Set loading state immediately for better UX
    setState((prev) => ({ ...prev, isLoading: true }));

    // Debounce the actual fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchQuote();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fromToken?.address,
    fromToken?.chainId,
    fromToken?.decimals,
    toToken?.address,
    toToken?.chainId,
    toToken?.decimals,
    fromAmount,
    slippage,
    evmAddress,
    solanaAddress,
    recipientAddress,
    debounceMs,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Get a fresh quote immediately (for retry on slippage errors)
   * Supports progressive slippage: pass retryAttempt to multiply slippage on each retry.
   * @param retryAttempt - Retry attempt number (0 for first retry)
   * @param amountOverride - Optional amount to use instead of original fromAmount (useful after SOL provision)
   */
  const getQuoteForRetry = useCallback(
    async (
      retryAttempt: number = 0,
      amountOverride?: string,
    ): Promise<OneBalanceSwapQuote | null> => {
      const effectiveAmount = amountOverride || fromAmount;

      if (
        !fromToken ||
        !toToken ||
        !effectiveAmount ||
        parseFloat(effectiveAmount) <= 0 ||
        (!evmAddress && !solanaAddress)
      ) {
        return null;
      }

      try {
        // Compute smart slippage, then progressively increase for each retry
        const userSlippageBps = Math.round(parseFloat(slippage) * 100);
        const baseSmartBps = getSmartSlippageBps(
          fromToken,
          toToken,
          userSlippageBps,
        );
        const progressiveBps = Math.min(
          Math.round(
            baseSmartBps * Math.pow(SLIPPAGE_RETRY_MULTIPLIER, retryAttempt),
          ),
          SLIPPAGE_BPS_MAX,
        );

        console.log(
          `[OneBalanceQuote] Retry request (attempt ${retryAttempt}):`,
          {
            baseSmartBps,
            progressiveBps,
            multiplier: SLIPPAGE_RETRY_MULTIPLIER,
            originalAmount: fromAmount,
            effectiveAmount,
          },
        );

        // If we have an amount override, we need to fetch a completely new quote
        // instead of using fetchOneBalanceQuote which uses the original amount
        if (amountOverride && fromToken && toToken) {
          const client = getOneBalanceClient();
          const amountInSmallestUnit = toSmallestUnit(
            effectiveAmount,
            fromToken.decimals,
          );

          const fromAssetId = tokenToAssetId(fromToken);
          const toAssetId = tokenToAssetId(toToken);

          const swapQuote = await client.getSwapQuote({
            evmAddress: evmSmartAccountAddress || evmAddress,
            solanaAddress,
            evmSignerAddress: evmAddress,
            fromAssetId,
            toAssetId,
            amount: amountInSmallestUnit,
            slippageTolerance: progressiveBps,
            recipient: recipientAddress,
          });

          if (!swapQuote) {
            throw new Error("Failed to get quote with adjusted amount");
          }

          setState({ quote: swapQuote, isLoading: false, error: null });
          return swapQuote;
        }

        const swapQuote = await fetchOneBalanceQuote(progressiveBps);
        if (!swapQuote) {
          throw new Error("Failed to get OneBalance quote for retry");
        }

        console.log("[OneBalanceQuote] Retry response received");

        // Also update state
        setState({ quote: swapQuote, isLoading: false, error: null });

        return swapQuote;
      } catch (error) {
        console.error("[OneBalanceQuote] Retry error:", error);
        return null;
      }
    },
    [
      fromToken,
      toToken,
      fromAmount,
      slippage,
      evmAddress,
      evmSmartAccountAddress,
      solanaAddress,
      recipientAddress,
      fetchOneBalanceQuote,
    ],
  );

  return {
    ...state,
    fetchQuote,
    getQuoteForRetry,
    clearQuote,
  };
}
