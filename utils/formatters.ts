/**
 * Unified Formatting Utilities
 *
 * Centralized formatting for numbers, prices, tokens, and percentages.
 * Handles both EVM and Solana token decimals properly.
 *
 * @module utils/formatters
 */

// Re-export SDK formatters for convenience
export {
  formatCryptoPrice,
  formatPercentage,
  formatPureNumber,
  formatTokenPrice,
  truncate,
} from "@mobula_labs/sdk";

// Re-export our fixed formatUSD that properly rounds to 2 decimal places
export { formatUSD } from "@/lib/api/mobula/mobulaClient";

// Import precision constants for internal use
import {
  CHAIN_NATIVE_DECIMALS,
  EVM_DEFAULT_DECIMALS,
  SOLANA_SPL_DECIMALS,
} from "@/constants/precision";

// Re-export precision constants with aliases for backward compatibility
export {
  CHAIN_NATIVE_DECIMALS as CHAIN_DECIMALS,
  EVM_DEFAULT_DECIMALS,
  SOLANA_NATIVE_DECIMALS,
  SOLANA_SPL_DECIMALS,
} from "@/constants/precision";

// ============================================================================
// Price Formatting
// ============================================================================

/**
 * Format a price value with appropriate decimal places based on magnitude.
 * Handles very small prices (micro-caps) with scientific notation.
 *
 * @param price - The price to format
 * @param options - Formatting options
 * @returns Formatted price string with $ prefix
 *
 * @example
 * formatPrice(1234.56) // "$1,234.56"
 * formatPrice(0.00000123) // "$1.23e-6"
 * formatPrice(1500000) // "$1.50M"
 */
export function formatPrice(
  price: number | undefined | null,
  options: {
    /** Show compact notation (K, M, B) for large values */
    compact?: boolean;
    /** Minimum fraction digits */
    minDecimals?: number;
    /** Maximum fraction digits */
    maxDecimals?: number;
  } = {},
): string {
  const { compact = true, minDecimals = 2, maxDecimals } = options;

  if (price === undefined || price === null || isNaN(price)) return "$0.00";
  if (price === 0) return "$0.00";

  // Very small prices - use scientific notation
  if (price > 0 && price < 0.00001) {
    return `$${price.toExponential(2)}`;
  }

  // Small prices - show more decimals
  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  }

  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }

  // Medium prices
  if (price < 1000) {
    return `$${price.toFixed(maxDecimals ?? minDecimals)}`;
  }

  // Large prices with optional compact notation
  if (compact) {
    if (price >= 1e12) return `$${(price / 1e12).toFixed(2)}T`;
    if (price >= 1e9) return `$${(price / 1e9).toFixed(2)}B`;
    if (price >= 1e6) return `$${(price / 1e6).toFixed(2)}M`;
    if (price >= 1e3) return `$${(price / 1e3).toFixed(2)}K`;
  }

  // Standard formatting for large prices
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals ?? minDecimals,
  }).format(price);
}

/**
 * Format USD value with standard currency formatting.
 *
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string
 */
export function formatUsd(
  value: number | undefined | null,
  decimals: number = 2,
): string {
  if (value === undefined || value === null || isNaN(value)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a large number with compact notation (K, M, B, T).
 *
 * @param num - The number to format
 * @param options - Formatting options
 * @returns Formatted number string
 *
 * @example
 * formatCompactNumber(1234567) // "1.23M"
 * formatCompactNumber(1234567, { prefix: '$' }) // "$1.23M"
 */
export function formatCompactNumber(
  num: number | undefined | null,
  options: {
    /** Prefix to add (e.g., '$') */
    prefix?: string;
    /** Number of decimal places */
    decimals?: number;
    /** Show '-' for undefined/null values */
    showDash?: boolean;
  } = {},
): string {
  const { prefix = "", decimals = 1, showDash = false } = options;

  if (num === undefined || num === null || isNaN(num)) {
    return showDash ? "-" : `${prefix}0`;
  }

  if (num === 0) return `${prefix}0`;

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1e12)
    return `${sign}${prefix}${(absNum / 1e12).toFixed(decimals)}T`;
  if (absNum >= 1e9)
    return `${sign}${prefix}${(absNum / 1e9).toFixed(decimals)}B`;
  if (absNum >= 1e6)
    return `${sign}${prefix}${(absNum / 1e6).toFixed(decimals)}M`;
  if (absNum >= 1e3)
    return `${sign}${prefix}${(absNum / 1e3).toFixed(decimals)}K`;

  return `${sign}${prefix}${num.toFixed(decimals === 1 ? 0 : decimals)}`;
}

/**
 * Format a number for display (generic).
 * Alias for formatCompactNumber with $ prefix.
 */
export function formatNumber(
  num: number | undefined | null,
  options: { decimals?: number; showDash?: boolean } = {},
): string {
  return formatCompactNumber(num, { prefix: "$", ...options });
}

/**
 * Format a count (no currency prefix, whole numbers).
 *
 * @param num - The count to format
 * @returns Formatted count string
 */
export function formatCount(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return "-";

  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;

  return num.toString();
}

// ============================================================================
// Percentage Formatting
// ============================================================================

/**
 * Format a percentage value.
 *
 * @param value - The percentage value (not multiplied by 100)
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | undefined | null,
  options: {
    /** Number of decimal places */
    decimals?: number;
    /** Show + sign for positive values */
    showSign?: boolean;
    /** Show '-' for undefined/null values */
    showDash?: boolean;
  } = {},
): string {
  const { decimals = 1, showSign = false, showDash = false } = options;

  if (value === undefined || value === null || isNaN(value)) {
    return showDash ? "-" : "0%";
  }

  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format price change percentage with sign.
 */
export function formatPriceChange(value: number | undefined | null): string {
  return formatPercent(value, { decimals: 2, showSign: true });
}

// ============================================================================
// Token Amount Formatting
// ============================================================================

/**
 * Format a token amount with smart decimal handling based on magnitude.
 * Preserves precision for small amounts, uses compact notation for large.
 *
 * @param value - The token amount
 * @param options - Formatting options
 * @returns Formatted token amount string
 */
export function formatTokenAmount(
  value: string | number | undefined | null,
  options: {
    /** Token decimals (for raw amount conversion) */
    decimals?: number;
    /** Whether the value is in raw units (needs conversion) */
    isRawAmount?: boolean;
    /** Maximum display decimals */
    maxDisplayDecimals?: number;
  } = {},
): string {
  const { decimals = 0, isRawAmount = false, maxDisplayDecimals = 6 } = options;

  if (value === undefined || value === null) return "0";

  // If value is already a formatted string with K/M/B suffix, return it
  if (typeof value === "string" && /[KMBTkmbt]$/i.test(value.trim())) {
    return value;
  }

  let num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num) || num === 0) return "0";

  // Convert from raw amount if needed
  if (isRawAmount && decimals > 0) {
    num = num / Math.pow(10, decimals);
  }

  // Handle negative amounts
  const sign = num < 0 ? "-" : "";
  num = Math.abs(num);

  // Very small amounts
  if (num < 0.0001) return `${sign}<0.0001`;

  // Small amounts - show more precision
  if (num < 0.01)
    return `${sign}${num.toFixed(Math.min(maxDisplayDecimals, 6))}`;
  if (num < 1) return `${sign}${num.toFixed(Math.min(maxDisplayDecimals, 4))}`;
  if (num < 100)
    return `${sign}${num.toFixed(Math.min(maxDisplayDecimals, 3))}`;
  if (num < 1000) return `${sign}${num.toFixed(2)}`;

  // Large amounts - use compact notation
  if (num >= 1e9) return `${sign}${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${sign}${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${sign}${(num / 1e3).toFixed(2)}K`;

  return `${sign}${num.toFixed(2)}`;
}

/**
 * Format a token balance for display.
 * Shows appropriate precision based on balance size.
 *
 * @param balance - The balance as a string or number
 * @param decimals - Token decimals (for context, not conversion)
 * @returns Formatted balance string
 */
export function formatBalance(
  balance: string | number | undefined | null,
  decimals?: number,
): string {
  if (balance === undefined || balance === null) return "0";

  const num = typeof balance === "string" ? parseFloat(balance) : balance;

  if (isNaN(num) || num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);

  return formatTokenAmount(num);
}

// ============================================================================
// Raw Amount Conversion (for Blockchain Transactions)
// ============================================================================

/**
 * Convert human-readable amount to smallest unit (wei, lamports, etc.).
 * Uses string-based arithmetic to avoid floating-point precision issues.
 *
 * @param amount - Human-readable amount string
 * @param decimals - Token decimals
 * @returns Amount in smallest unit as string
 *
 * @example
 * toSmallestUnit("1.5", 18) // "1500000000000000000"
 * toSmallestUnit("1.5", 9) // "1500000000"
 * toSmallestUnit("1.5", 6) // "1500000"
 */
export function toSmallestUnit(amount: string, decimals: number): string {
  if (!amount || amount === "" || amount === ".") return "0";

  const trimmed = amount.trim();
  if (trimmed === "") return "0";

  // Split into integer and decimal parts
  const parts = trimmed.split(".");
  const integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "";

  // Pad or truncate decimal part to match token decimals
  if (decimalPart.length < decimals) {
    decimalPart = decimalPart.padEnd(decimals, "0");
  } else if (decimalPart.length > decimals) {
    // Truncate (don't round - we want exact conversion)
    decimalPart = decimalPart.slice(0, decimals);
  }

  // Combine integer and decimal parts
  const combined = integerPart + decimalPart;

  // Remove leading zeros (but keep at least one digit)
  return combined.replace(/^0+/, "") || "0";
}

/**
 * Convert smallest unit to human-readable amount.
 * Uses string manipulation to avoid floating point precision issues.
 *
 * @param amount - Amount in smallest unit (as string or number)
 * @param decimals - Token decimals
 * @returns Human-readable amount string with full precision
 */
export function fromSmallestUnit(
  amount: string | number,
  decimals: number,
): string {
  // Handle edge cases
  if (amount === undefined || amount === null) return "0";
  if (decimals === 0) return amount.toString();

  // Convert to string and handle negative numbers
  let str = amount.toString();
  const isNegative = str.startsWith("-");
  if (isNegative) str = str.slice(1);

  // Remove any non-numeric characters (except for scientific notation handling)
  if (str.includes("e") || str.includes("E")) {
    // Handle scientific notation by converting to regular number first
    const num = Number(amount);
    if (isNaN(num)) return "0";
    str = BigInt(Math.round(num)).toString();
    if (str.startsWith("-")) {
      str = str.slice(1);
    }
  }

  // Pad with leading zeros if necessary
  while (str.length <= decimals) {
    str = "0" + str;
  }

  // Insert decimal point
  const integerPart = str.slice(0, str.length - decimals);
  const fractionalPart = str.slice(str.length - decimals);

  // Remove trailing zeros from fractional part but keep at least one decimal if there's a fraction
  const trimmedFractional = fractionalPart.replace(/0+$/, "");

  // Build result
  let result = integerPart;
  if (trimmedFractional.length > 0) {
    result += "." + trimmedFractional;
  }

  // Handle leading zeros in integer part
  result = result.replace(/^0+/, "") || "0";
  if (result.startsWith(".")) {
    result = "0" + result;
  }

  return isNegative ? "-" + result : result;
}

/**
 * Convert amount from one decimal precision to another.
 * Useful when APIs return amounts in different formats.
 *
 * @param amount - The amount to convert
 * @param fromDecimals - Source decimals
 * @param toDecimals - Target decimals
 * @returns Converted amount string
 */
export function convertDecimals(
  amount: string | number,
  fromDecimals: number,
  toDecimals: number,
): string {
  if (fromDecimals === toDecimals) {
    return typeof amount === "string" ? amount : amount.toString();
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";

  const multiplier = Math.pow(10, toDecimals - fromDecimals);
  return (num * multiplier).toString();
}

// ============================================================================
// Token Decimals Helpers
// ============================================================================

/**
 * Get default decimals for a blockchain/chain.
 *
 * @param blockchain - The blockchain name (e.g., "solana", "ethereum")
 * @param isNativeToken - Whether this is the native token
 * @returns Default decimals for the chain
 */
export function getDefaultDecimals(
  blockchain: string | undefined,
  isNativeToken: boolean = false,
): number {
  if (!blockchain) return EVM_DEFAULT_DECIMALS;

  const chain = blockchain.toLowerCase().split(":")[0];

  // Native tokens have specific decimals
  if (isNativeToken) {
    return CHAIN_NATIVE_DECIMALS[chain] ?? EVM_DEFAULT_DECIMALS;
  }

  // SPL tokens on Solana typically use 6 decimals (pump.fun, etc.)
  if (chain === "solana") {
    return SOLANA_SPL_DECIMALS;
  }

  // EVM tokens typically use 18 decimals
  return EVM_DEFAULT_DECIMALS;
}

/**
 * Get decimals from token or fall back to chain default.
 *
 * @param token - Token object with optional decimals
 * @param blockchain - Blockchain name for fallback
 * @returns Token decimals
 */
export function getTokenDecimals(
  token: { decimals?: number; address?: string } | null | undefined,
  blockchain?: string,
): number {
  if (token?.decimals !== undefined && token.decimals !== null) {
    return token.decimals;
  }

  return getDefaultDecimals(blockchain, false);
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format a date as relative time ago.
 *
 * @param dateStr - ISO date string or Date object
 * @returns Relative time string (e.g., "5m", "2h", "3d")
 */
export function formatTimeAgo(
  dateStr: string | Date | undefined | null,
): string {
  if (!dateStr) return "";

  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;

  return `${Math.floor(diffDays / 365)}y`;
}

// ============================================================================
// Address/Hash Formatting
// ============================================================================

/**
 * Truncate an address for display.
 *
 * @param address - The full address
 * @param startChars - Number of starting characters to show
 * @param endChars - Number of ending characters to show
 * @returns Truncated address string
 */
export function truncateAddress(
  address: string | undefined | null,
  startChars: number = 6,
  endChars: number = 4,
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Truncate a transaction hash for display.
 */
export function truncateTxHash(
  hash: string | undefined | null,
  chars: number = 8,
): string {
  if (!hash) return "";
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Parse and validate amount input.
 * Normalizes decimal separators and removes invalid characters.
 *
 * @param text - Raw input text
 * @returns Validated amount string
 */
export function parseAmountInput(text: string): string {
  // Replace commas with periods (locale handling)
  const normalized = text.replace(/,/g, ".");
  // Remove non-numeric characters except decimal point
  const filtered = normalized.replace(/[^0-9.]/g, "");
  // Ensure only one decimal point
  const parts = filtered.split(".");
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return filtered;
}

/**
 * Check if an amount string is valid for a swap.
 */
export function isValidAmount(amount: string): boolean {
  if (!amount || amount === "" || amount === ".") return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

// ============================================================================
// Volume/Market Formatting (specialized)
// ============================================================================

/**
 * Format volume with $ prefix and compact notation.
 */
export function formatVolume(volume: number | undefined | null): string {
  return formatCompactNumber(volume, { prefix: "$", decimals: 2 });
}

/**
 * Format market cap with $ prefix and compact notation.
 */
export function formatMarketCap(marketCap: number | undefined | null): string {
  return formatCompactNumber(marketCap, { prefix: "$", decimals: 2 });
}

/**
 * Format liquidity with $ prefix and compact notation.
 */
export function formatLiquidity(liquidity: number | undefined | null): string {
  return formatCompactNumber(liquidity, { prefix: "$", decimals: 2 });
}
