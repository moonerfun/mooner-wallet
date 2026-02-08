/**
 * Swap Module
 * Main export for the swap feature
 */

// Main components
export { SwapModalV2 } from "./SwapModalV2"; // Bitget-style unified token selector

// Types
export * from "./types";

// Store
export {
  selectIsCrossChainSwap,
  selectIsSwapReady,
  selectSwapButtonText,
  selectSwapRouteType,
  useSwapStore,
} from "./store";

// Hooks
export {
  useLiveTokenBalance,
  useMultiChainTokenSearch,
  // OneBalance hooks
  useOneBalanceAccount,
  useOneBalanceBalance,
  useOneBalanceExecution,
  useOneBalanceQuote,
  useTokenSearch,
  useUnifiedSwap,
} from "./hooks";

// Components
export {
  ChainSelector,
  QuoteDetails,
  SlippageSettings,
  SwapPreviewInline,
  TokenInput,
  TokenRow,
  TokenSelector,
  UnifiedTokenSelector,
} from "./components";

// Services
export {
  broadcastSignedTransaction,
  confirmSolanaTransaction,
  signAndBroadcastEvmTransaction,
  signAndBroadcastSolanaTransaction,
  signSwapMessage,
  submitSignature,
} from "./services";

// Constants
export {
  CHAIN_RPC_URLS,
  POPULAR_TOKENS,
  findToken,
  getPopularTokensForChain,
  getRpcUrl,
  hasRpcSupport,
} from "./constants";

// Utils
export { bytesToHex, hexToBytes, rlpEncode, toBeBytes } from "./utils";
