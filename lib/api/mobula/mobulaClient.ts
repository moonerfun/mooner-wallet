import type { SubscriptionPayload } from "@mobula_labs/sdk";
import { MobulaClient } from "@mobula_labs/sdk";

import { MOBULA_API_URL, MOBULA_WS_URL } from "@/constants/endpoints";
import { REQUEST_TIMEOUT } from "@/constants/network";

// Singleton instance of the Mobula client
let mobulaClient: MobulaClient | null = null;

// WebSocket is disabled for React Native due to compatibility issues
// The Mobula SDK's WebSocket implementation uses browser-specific APIs
// that don't work well with React Native's WebSocket polyfill
// We use REST API polling instead for real-time updates
const WEBSOCKET_ENABLED = false;

// WebSocket URL map for different stream types
// Using centralized WebSocket endpoint
const WSS_URL_MAP: Partial<Record<keyof SubscriptionPayload, string>> =
  WEBSOCKET_ENABLED
    ? {
        market: MOBULA_WS_URL,
        ohlcv: MOBULA_WS_URL,
        trade: MOBULA_WS_URL,
        "fast-trade": MOBULA_WS_URL,
      }
    : {};

// Configuration for the Mobula client
const MOBULA_CONFIG = {
  // API key is optional for demo API, required for production
  apiKey: process.env.EXPO_PUBLIC_MOBULA_API_KEY || undefined,
  // Use demo API for testing, production API for production
  restUrl: process.env.EXPO_PUBLIC_MOBULA_API_URL || MOBULA_API_URL,
  // Enable debug logging in development
  debug: __DEV__,
  // Request timeout in milliseconds (increased for slow endpoints like trader-positions)
  timeout: REQUEST_TIMEOUT,
  // Only include WebSocket URL map if enabled
  ...(WEBSOCKET_ENABLED && Object.keys(WSS_URL_MAP).length > 0
    ? { wsUrlMap: WSS_URL_MAP }
    : {}),
};

/**
 * Get or create a singleton instance of the Mobula client
 * This ensures we reuse the same client instance across the app
 */
export function getMobulaClient(): MobulaClient {
  if (!mobulaClient) {
    mobulaClient = new MobulaClient(MOBULA_CONFIG);
  }
  return mobulaClient;
}

/**
 * Reset the Mobula client (useful for testing or reconnection)
 */
export function resetMobulaClient(): void {
  mobulaClient = null;
}

/**
 * Re-export commonly used utilities from the SDK
 */
export {
  buildExplorerUrl,
  buildNativeSymbol,
  formatCryptoPrice,
  formatPercentage,
  formatPureNumber,
  formatTokenPrice,
  truncate,
} from "@mobula_labs/sdk";

/**
 * Format USD value with proper rounding to 2 decimal places.
 * This is a corrected version of the SDK's formatUSD which doesn't round properly.
 *
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string (e.g., "$2.84")
 */
export function formatUSD(
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

export { MobulaClient, MobulaError } from "@mobula_labs/sdk";
