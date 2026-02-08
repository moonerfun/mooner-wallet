/**
 * Swap Error Parser
 * Centralized error parsing for swap operations
 * Extracted from useSwapExecution.ts
 */

/**
 * Known Solana program error codes and their user-friendly messages
 */
export const SOLANA_ERROR_MESSAGES: Record<number, string> = {
  // DEX slippage errors
  15001:
    "Price moved too much. Try increasing slippage tolerance or swap a smaller amount.",
  15002: "Insufficient liquidity for this swap. Try a smaller amount.",
  15003: "Route expired. Please try again.",
  // Common Solana errors
  6000: "Slippage tolerance exceeded. Increase slippage and try again.",
  6001: "Insufficient funds for this transaction.",
  6002: "Invalid account data.",
  6003: "Account already initialized.",
  // Token program errors
  1: "Insufficient funds in your wallet.",
  3: "Invalid account for this operation.",
  4: "Account not found.",
};

/**
 * Slippage-related error codes that should trigger auto-retry
 */
export const SLIPPAGE_ERROR_CODES = [15001, 6000];

// =============================================================================
// OneBalance Fail Reasons (from API error-codes docs)
// =============================================================================

/**
 * OneBalance fail reasons that are safe to auto-retry with a fresh quote.
 * These indicate transient market/execution conditions, not user errors.
 * See: https://docs.onebalance.io/guides/quotes/refund-reasons
 */
export const RETRYABLE_FAIL_REASONS = [
  "SLIPPAGE",
  "ORDER_EXPIRED",
  "SOLVER_CAPACITY_EXCEEDED",
  "SWAP_USES_TOO_MUCH_GAS",
  "EXECUTION_REVERTED",
  "TRANSACTION_REVERTED",
  "GENERATE_SWAP_FAILED",
  "REVERSE_SWAP_FAILED",
  "TOO_LITTLE_RECEIVED",
  "INVALID_GAS_PRICE",
  "FLUID_DEX_ERROR",
] as const;

/**
 * Fail reasons that specifically benefit from higher slippage on retry.
 * Other retryable reasons should retry with the same slippage.
 */
export const SLIPPAGE_RELATED_FAIL_REASONS = [
  "SLIPPAGE",
  "TOO_LITTLE_RECEIVED",
  "EXECUTION_REVERTED",
  "TRANSACTION_REVERTED",
] as const;

/**
 * User-friendly messages for OneBalance fail reasons.
 * Shown to the user when a swap is REFUNDED.
 */
export const FAIL_REASON_MESSAGES: Record<string, string> = {
  // Price & Market
  SLIPPAGE: "Price changed during execution. Retrying with updated quote...",
  TOO_LITTLE_RECEIVED:
    "Output amount was too low. Retrying with higher tolerance...",
  ORDER_EXPIRED: "Quote expired. Getting a fresh quote...",
  NO_QUOTES: "No liquidity available for this token pair.",
  NO_INTERNAL_SWAP_ROUTES_FOUND: "No swap route found for this token pair.",
  SWAP_USES_TOO_MUCH_GAS:
    "Gas cost too high for this swap. Try a smaller amount.",
  // Execution
  EXECUTION_REVERTED: "Transaction reverted on-chain. Retrying...",
  TRANSACTION_REVERTED: "Transaction reverted on-chain. Retrying...",
  GENERATE_SWAP_FAILED: "Swap generation failed. Retrying...",
  REVERSE_SWAP_FAILED: "Reverse swap failed. Retrying...",
  SOLVER_CAPACITY_EXCEEDED: "Solver at capacity. Retrying in a moment...",
  // Balance & Allowance
  TRANSFER_AMOUNT_EXCEEDS_BALANCE: "Insufficient token balance for this swap.",
  TRANSFER_AMOUNT_EXCEEDS_ALLOWANCE: "Token approval needed.",
  INSUFFICIENT_NATIVE_TOKENS_SUPPLIED:
    "Insufficient native token for gas fees.",
  TRANSFER_FROM_FAILED: "Token transfer failed. Please try again.",
  TRANSFER_FAILED: "Token transfer failed. Please try again.",
  // Signature
  INVALID_SIGNATURE: "Invalid signature. Please try again.",
  SIGNATURE_EXPIRED: "Signature expired. Please try again.",
  INVALID_SENDER: "Invalid sender. Please reconnect your wallet.",
  // Solana-specific
  INSUFFICIENT_FUNDS_FOR_RENT:
    "Insufficient SOL for account rent. Add at least 0.002 SOL.",
  JUPITER_INVALID_TOKEN_ACCOUNT:
    "Solana token account issue. Please try again.",
  // Other
  INVALID_GAS_PRICE: "Invalid gas price. Retrying...",
  FLUID_DEX_ERROR: "DEX protocol error. Retrying...",
  DOUBLE_SPEND: "Duplicate transaction detected.",
  UNKNOWN: "Unknown error occurred.",
};

/**
 * Check if a OneBalance failReason is retryable
 */
export function isRetryableFailReason(failReason: string | undefined): boolean {
  if (!failReason) return false;
  return (RETRYABLE_FAIL_REASONS as readonly string[]).includes(failReason);
}

/**
 * Check if a OneBalance failReason benefits from increased slippage on retry
 */
export function isSlippageRelatedFailReason(
  failReason: string | undefined,
): boolean {
  if (!failReason) return false;
  return (SLIPPAGE_RELATED_FAIL_REASONS as readonly string[]).includes(
    failReason,
  );
}

/**
 * Get user-friendly message for a OneBalance fail reason
 */
export function getFailReasonMessage(failReason: string | undefined): string {
  if (!failReason) return "Swap failed. Please try again.";
  return FAIL_REASON_MESSAGES[failReason] || `Swap failed: ${failReason}`;
}

/**
 * Extract OneBalance failReason from an error message.
 * Our polling code throws errors like "Transaction REFUNDED: SLIPPAGE"
 */
export function extractFailReason(error: unknown): string | undefined {
  const message = extractDeepErrorMessage(error);
  if (!message) return undefined;

  // Match pattern: "Transaction REFUNDED: <REASON>" or "Transaction FAILED: <REASON>"
  const refundMatch = message.match(
    /Transaction (?:REFUNDED|FAILED):\s*(\S+)/i,
  );
  if (refundMatch) {
    return refundMatch[1];
  }

  // Check if the message itself is a known fail reason
  const upperMessage = message.toUpperCase().trim();
  if (FAIL_REASON_MESSAGES[upperMessage]) {
    return upperMessage;
  }

  return undefined;
}

/**
 * Extract the deepest error message from a nested error structure
 * Handles Turnkey errors which nest the actual error in .cause
 */
export function extractDeepErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    if (typeof error === "string") return error;
    return "";
  }

  // Check for nested cause (Turnkey errors nest the real error)
  const errorWithCause = error as Error & { cause?: unknown; code?: string };
  if (errorWithCause.cause) {
    const causeMessage = extractDeepErrorMessage(errorWithCause.cause);
    if (causeMessage) {
      return causeMessage;
    }
  }

  return error.message || "";
}

/**
 * Check if error is retryable (slippage, execution reverted, or other transient failure).
 * This is the primary check used by the execution hook to decide whether to retry.
 * Covers both on-chain Solana error codes AND OneBalance REFUNDED fail reasons.
 */
export function isSlippageError(error: unknown): boolean {
  const message = extractDeepErrorMessage(error);
  if (!message) return false;

  // Check if this is a OneBalance fail reason we can retry
  const failReason = extractFailReason(message);
  if (failReason && isRetryableFailReason(failReason)) {
    console.log(
      `[SwapErrorParser] Retryable OneBalance fail reason: ${failReason}`,
    );
    return true;
  }

  // Check for known Solana slippage error codes in various formats
  const customErrorMatch = message.match(/Custom["\s:]+(\d+)/i);
  if (customErrorMatch) {
    const errorCode = parseInt(customErrorMatch[1], 10);
    console.log(
      `[SwapErrorParser] Detected error code: ${errorCode}, isSlippage: ${SLIPPAGE_ERROR_CODES.includes(errorCode)}`,
    );
    return SLIPPAGE_ERROR_CODES.includes(errorCode);
  }

  // Check for slippage-related keywords
  const hasSlippageKeyword =
    message.toLowerCase().includes("slippage") ||
    message.toLowerCase().includes("price impact") ||
    message.toLowerCase().includes("too little received");

  if (hasSlippageKeyword) {
    console.log("[SwapErrorParser] Detected slippage keyword in error");
  }

  return hasSlippageKeyword;
}

/**
 * Parse EVM/Turnkey specific error messages
 */
export function parseEvmError(message: string): string | null {
  // Strip common RPC error prefixes
  const cleanedMessage = message
    .replace(/^Ethereum RPC Error:\s*/i, "")
    .replace(/^RPC Error:\s*/i, "")
    .trim();

  console.log(
    "[SwapErrorParser] parseEvmError input:",
    cleanedMessage.substring(0, 100),
  );

  // Insufficient funds for gas
  const insufficientFundsMatch = cleanedMessage.match(
    /insufficient funds for gas.*(?:balance\s*(\d+)|have\s*(\d+)).*(?:tx cost\s*(\d+)|want\s*(\d+))/i,
  );
  if (insufficientFundsMatch) {
    console.log("[SwapErrorParser] Matched insufficient funds pattern");
    const balanceWei = BigInt(
      insufficientFundsMatch[1] || insufficientFundsMatch[2] || "0",
    );
    const costWei = BigInt(
      insufficientFundsMatch[3] || insufficientFundsMatch[4] || "0",
    );
    const shortfallWei = costWei - balanceWei;

    const formatWei = (wei: bigint) => {
      const eth = Number(wei) / 1e18;
      if (eth < 0.0001) return `${(Number(wei) / 1e9).toFixed(4)} Gwei`;
      return `${eth.toFixed(6)}`;
    };

    const shortfall = formatWei(shortfallWei > 0n ? shortfallWei : 0n);
    return `Insufficient funds for gas. You need approximately ${shortfall} more native token to complete this transaction.`;
  }

  // Simple insufficient funds pattern
  if (
    message.toLowerCase().includes("insufficient funds") &&
    message.toLowerCase().includes("gas")
  ) {
    return "Insufficient funds for gas fees. Please add more native token to your wallet.";
  }

  // Nonce too low
  if (message.toLowerCase().includes("nonce too low")) {
    return "Transaction nonce conflict. Please try again.";
  }

  // Replacement transaction underpriced
  if (message.toLowerCase().includes("replacement transaction underpriced")) {
    return "Transaction underpriced. Please try again with higher gas.";
  }

  // Already known
  if (message.toLowerCase().includes("already known")) {
    return "Transaction already submitted. Please wait for confirmation.";
  }

  // Execution reverted
  if (message.toLowerCase().includes("execution reverted")) {
    const revertMatch = message.match(
      /execution reverted:\s*(.+?)(?:\s*\(|$)/i,
    );
    if (revertMatch && revertMatch[1]) {
      return `Transaction reverted: ${revertMatch[1].trim()}`;
    }
    return "Transaction reverted. The swap conditions may no longer be valid.";
  }

  // Gas estimation failed
  if (message.toLowerCase().includes("gas required exceeds allowance")) {
    return "Gas estimation failed. You may not have enough funds to complete this swap.";
  }

  return null;
}

/**
 * Parse Solana custom error codes
 */
export function parseSolanaCustomError(message: string): string | null {
  const customErrorMatch = message.match(/Custom:\s*(\d+)/);
  if (customErrorMatch) {
    const errorCode = parseInt(customErrorMatch[1], 10);
    const friendlyMessage = SOLANA_ERROR_MESSAGES[errorCode];
    if (friendlyMessage) {
      return friendlyMessage;
    }
    return `Swap failed (error ${errorCode}). Try increasing slippage or reducing amount.`;
  }
  return null;
}

/**
 * Parse common error patterns
 */
export function parseCommonError(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  // Insufficient balance (generic)
  if (lowerMessage.includes("insufficient")) {
    if (lowerMessage.includes("gas") || lowerMessage.includes("native")) {
      return "Insufficient native token balance to pay for gas fees.";
    }
    return "Insufficient balance for this swap.";
  }

  // Slippage
  if (lowerMessage.includes("slippage")) {
    return "Price moved too much. Try increasing slippage tolerance.";
  }

  // Timeout
  if (lowerMessage.includes("timeout")) {
    return "Transaction timed out. The network may be congested.";
  }

  // Blockhash expired
  if (lowerMessage.includes("blockhash")) {
    return "Transaction expired. Please try again.";
  }

  // Network/RPC errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("rpc error") ||
    lowerMessage.includes("failed to fetch")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Rejected transactions
  if (lowerMessage.includes("rejected") || lowerMessage.includes("denied")) {
    return "Transaction was rejected. Please try again.";
  }

  return null;
}

/**
 * Parse error message and return user-friendly version
 */
export function parseSwapError(error: unknown): string {
  // Extract the deepest error message
  const deepMessage = extractDeepErrorMessage(error);
  const message =
    error instanceof Error ? error.message : String(error || "Unknown error");

  // Use the deepest message for parsing
  const parseableMessage = deepMessage || message;

  console.log("[SwapErrorParser] Parsing error:", {
    originalMessage: message?.substring(0, 100),
    deepMessage: deepMessage?.substring(0, 100),
  });

  // Check for OneBalance fail reason first (most specific)
  const failReason = extractFailReason(parseableMessage);
  if (failReason) {
    const failReasonMsg = getFailReasonMessage(failReason);
    console.log(
      `[SwapErrorParser] OneBalance fail reason: ${failReason} -> ${failReasonMsg}`,
    );
    return failReasonMsg;
  }

  // Try Solana custom error first
  const solanaError = parseSolanaCustomError(parseableMessage);
  if (solanaError) return solanaError;

  // Try EVM error parsing
  const evmError = parseEvmError(parseableMessage);
  if (evmError) {
    console.log("[SwapErrorParser] parseEvmError returned:", evmError);
    return evmError;
  }

  // Try common error patterns
  const commonError = parseCommonError(parseableMessage);
  if (commonError) return commonError;

  // If we have a deep message that's different and reasonable length
  if (deepMessage && deepMessage.length > 0 && deepMessage.length <= 150) {
    const cleanMessage = deepMessage
      .replace(/^Ethereum RPC Error:\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .trim();
    if (cleanMessage.length > 0) {
      return cleanMessage;
    }
  }

  // Generic fallback
  if (message.length > 100) {
    return "Swap failed. Please try again.";
  }

  return message || "Swap failed. Please try again.";
}
