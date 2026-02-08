/**
 * Swap Store
 * Zustand store for managing swap state
 */

import { CHAIN_NAME_TO_ID } from "@/constants/chains";
import { create } from "zustand";
import {
  SwapToken,
  SwapWalletAccount,
  TokenSelectorMode,
  UnifiedSwapQuote,
} from "../types";

// Default chain ID (Ethereum mainnet)
const DEFAULT_CHAIN_ID = 1;

/**
 * Swap store state
 */
export interface SwapState {
  // Token selection
  fromToken: SwapToken | null;
  toToken: SwapToken | null;
  fromAmount: string;

  // Chain selection
  selectedFromChain: SwapWalletAccount | null;
  selectedToChain: SwapWalletAccount | null;

  // Quote
  quote: UnifiedSwapQuote | null;
  isLoadingQuote: boolean;

  // Settings
  slippage: string;
  isCrossChainMode: boolean;

  // UI state
  tokenSelectorMode: TokenSelectorMode;
  showConfirmation: boolean;

  // Execution
  isSwapping: boolean;
}

/**
 * Swap store actions
 */
export interface SwapActions {
  // Token actions
  setFromToken: (token: SwapToken | null) => void;
  setToToken: (token: SwapToken | null) => void;
  setFromAmount: (amount: string) => void;
  swapTokens: () => void;

  // Chain actions
  setSelectedFromChain: (chain: SwapWalletAccount | null) => void;
  setSelectedToChain: (chain: SwapWalletAccount | null) => void;

  // Unified token + chain selection (for UnifiedTokenSelector)
  selectFromTokenWithChain: (
    token: SwapToken,
    chain: SwapWalletAccount,
  ) => void;
  selectToTokenWithChain: (token: SwapToken, chain: SwapWalletAccount) => void;

  // Quote actions
  setQuote: (quote: UnifiedSwapQuote | null) => void;
  setIsLoadingQuote: (loading: boolean) => void;

  // Settings actions
  setSlippage: (slippage: string) => void;
  setIsCrossChainMode: (enabled: boolean) => void;

  // UI actions
  setTokenSelectorMode: (mode: TokenSelectorMode) => void;
  setShowConfirmation: (show: boolean) => void;

  // Execution actions
  setIsSwapping: (swapping: boolean) => void;

  // Utility actions
  reset: () => void;
  getChainId: (account: SwapWalletAccount | null) => number;
}

/**
 * Initial state
 */
const initialState: SwapState = {
  fromToken: null,
  toToken: null,
  fromAmount: "",
  selectedFromChain: null,
  selectedToChain: null,
  quote: null,
  isLoadingQuote: false,
  slippage: "0.5",
  isCrossChainMode: false,
  tokenSelectorMode: null,
  showConfirmation: false,
  isSwapping: false,
};

/**
 * Swap store
 */
export const useSwapStore = create<SwapState & SwapActions>((set, get) => ({
  ...initialState,

  // Token actions
  setFromToken: (token) => {
    const { toToken } = get();
    // If same token selected for both, swap them
    if (
      toToken &&
      token &&
      toToken.address === token.address &&
      toToken.chainId === token.chainId
    ) {
      set({ fromToken: token, toToken: get().fromToken, quote: null });
    } else {
      set({ fromToken: token, quote: null });
    }
  },

  setToToken: (token) => {
    const { fromToken } = get();
    // If same token selected for both, swap them
    if (
      fromToken &&
      token &&
      fromToken.address === token.address &&
      fromToken.chainId === token.chainId
    ) {
      set({ toToken: token, fromToken: get().toToken, quote: null });
    } else {
      set({ toToken: token, quote: null });
    }
  },

  setFromAmount: (amount) => {
    // Replace commas with periods for locale keyboards that use comma as decimal separator
    const normalized = amount.replace(/,/g, ".");
    // Parse and validate amount input
    const filtered = normalized.replace(/[^0-9.]/g, "");
    const parts = filtered.split(".");
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
    set({ fromAmount: formatted, quote: null });
  },

  swapTokens: () => {
    const { fromToken, toToken, selectedFromChain, selectedToChain } = get();
    set({
      fromToken: toToken,
      toToken: fromToken,
      selectedFromChain: selectedToChain,
      selectedToChain: selectedFromChain,
      quote: null,
    });
  },

  // Chain actions
  setSelectedFromChain: (chain) => {
    const { isCrossChainMode } = get();
    set({
      selectedFromChain: chain,
      selectedToChain: isCrossChainMode ? get().selectedToChain : chain,
      fromToken: null,
      toToken: isCrossChainMode ? get().toToken : null,
      quote: null,
    });
  },

  setSelectedToChain: (chain) => {
    set({
      selectedToChain: chain,
      toToken: null,
      quote: null,
    });
  },

  // Unified token + chain selection (for UnifiedTokenSelector)
  // These actions set both token and chain together, auto-detecting cross-chain mode
  selectFromTokenWithChain: (token, chain) => {
    const { toToken, selectedToChain } = get();

    // Auto-detect if this will be a cross-chain swap
    const willBeCrossChain = toToken && toToken.chainId !== token.chainId;

    // If same token selected for both, swap them
    if (
      toToken &&
      toToken.address === token.address &&
      toToken.chainId === token.chainId
    ) {
      set({
        fromToken: token,
        toToken: get().fromToken,
        selectedFromChain: chain,
        selectedToChain: get().selectedFromChain,
        isCrossChainMode: false, // Same token on same chain can't be cross-chain
        quote: null as UnifiedSwapQuote | null,
      });
    } else {
      set({
        fromToken: token,
        selectedFromChain: chain,
        isCrossChainMode: willBeCrossChain ?? false,
        quote: null as UnifiedSwapQuote | null,
      });
    }
  },

  selectToTokenWithChain: (token, chain) => {
    const { fromToken, selectedFromChain } = get();

    // Auto-detect if this will be a cross-chain swap
    const willBeCrossChain = fromToken && fromToken.chainId !== token.chainId;

    // If same token selected for both, swap them
    if (
      fromToken &&
      fromToken.address === token.address &&
      fromToken.chainId === token.chainId
    ) {
      set({
        toToken: token,
        fromToken: get().toToken,
        selectedToChain: chain,
        selectedFromChain: get().selectedToChain,
        isCrossChainMode: false,
        quote: null as UnifiedSwapQuote | null,
      });
    } else {
      set({
        toToken: token,
        selectedToChain: chain,
        isCrossChainMode: willBeCrossChain ?? false,
        quote: null as UnifiedSwapQuote | null,
      });
    }
  },

  // Quote actions
  setQuote: (quote) => set({ quote }),
  setIsLoadingQuote: (loading) => set({ isLoadingQuote: loading }),

  // Settings actions
  setSlippage: (slippage) => {
    // Replace commas with periods for locale keyboards that use comma as decimal separator
    const normalized = slippage.replace(/,/g, ".");
    // Parse and validate slippage input
    const filtered = normalized.replace(/[^0-9.]/g, "");
    const parts = filtered.split(".");
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
    set({ slippage: formatted });
  },
  setIsCrossChainMode: (enabled) => set({ isCrossChainMode: enabled }),

  // UI actions
  setTokenSelectorMode: (mode) => set({ tokenSelectorMode: mode }),
  setShowConfirmation: (show) => set({ showConfirmation: show }),

  // Execution actions
  setIsSwapping: (swapping) => set({ isSwapping: swapping }),

  // Utility actions
  reset: () => set(initialState),

  getChainId: (account) => {
    if (!account) return DEFAULT_CHAIN_ID;
    return CHAIN_NAME_TO_ID[account.chainName] || DEFAULT_CHAIN_ID;
  },
}));

/**
 * Selector for checking if swap is ready
 */
export const selectIsSwapReady = (state: SwapState): boolean => {
  if (
    !state.fromToken ||
    !state.toToken ||
    !state.fromAmount ||
    parseFloat(state.fromAmount) <= 0 ||
    !state.quote ||
    state.isLoadingQuote
  ) {
    return false;
  }

  // Block SOL swaps below minimum amount (covers wSOL rent + fees)
  const amount = parseFloat(state.fromAmount);
  if (
    state.fromToken.chainId === SOLANA_CHAIN_ID_STORE &&
    state.fromToken.symbol === "SOL" &&
    amount < MIN_SOL_SWAP
  ) {
    return false;
  }

  return true;
};

/**
 * Selector for swap button text
 */
// Minimum swap amounts by chain type (must match SwapModalV2 constants)
const SOLANA_CHAIN_ID_STORE = 792703809;
const MIN_SOL_SWAP = 0.005;

export const selectSwapButtonText = (state: SwapState): string => {
  if (!state.fromToken || !state.toToken) return "Select Tokens";
  if (!state.fromAmount || parseFloat(state.fromAmount) <= 0)
    return "Enter Amount";

  // Check minimum amount for SOL swaps
  const amount = parseFloat(state.fromAmount);
  if (
    state.fromToken.chainId === SOLANA_CHAIN_ID_STORE &&
    state.fromToken.symbol === "SOL" &&
    amount > 0 &&
    amount < MIN_SOL_SWAP
  ) {
    return `Min ${MIN_SOL_SWAP} SOL`;
  }

  if (state.isLoadingQuote) return "Getting Quote...";
  if (state.quote?.isCrossChain) return "Review Cross-Chain Swap";
  return "Review Swap";
};

/**
 * Selector for auto-detecting cross-chain mode based on selected tokens
 * This is the "smart" detection that Bitget uses
 */
export const selectIsCrossChainSwap = (state: SwapState): boolean => {
  if (!state.fromToken || !state.toToken) return false;
  return state.fromToken.chainId !== state.toToken.chainId;
};

/**
 * Selector for getting the route type description
 */
export const selectSwapRouteType = (
  state: SwapState,
): "same-chain" | "cross-chain" | "unknown" => {
  if (!state.fromToken || !state.toToken) return "unknown";
  return state.fromToken.chainId === state.toToken.chainId
    ? "same-chain"
    : "cross-chain";
};
