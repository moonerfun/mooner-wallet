/**
 * Mobula Types & Utilities
 *
 * Re-exports SDK types and provides utilities for type-safe API responses.
 * Based on MTT patterns for consistent type handling.
 */

// Re-export SDK utilities
export {
  MobulaClient,
  MobulaError,
  buildExplorerUrl,
  buildNativeSymbol,
  formatCryptoPrice,
  formatPercentage,
  formatPureNumber,
  formatTokenPrice,
  truncate,
} from "@mobula_labs/sdk";

// Re-export our fixed formatUSD
export { formatUSD } from "./mobulaClient";

// ============================================================================
// Field Extraction Utilities
// ============================================================================

/**
 * Safely extract a field from an object, trying multiple key variations
 * Handles snake_case, camelCase, and nested objects
 *
 * @example
 * const price = getField<number>(data, 'price', 'priceUSD', 'price_usd');
 */
export function getField<T>(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return undefined;
}

/**
 * Safely extract a nested field from an object
 *
 * @example
 * const twitter = getNestedField<string>(data, 'socials', 'twitter');
 */
export function getNestedField<T>(
  obj: Record<string, unknown> | null | undefined,
  parentKey: string,
  ...childKeys: string[]
): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const parent = obj[parentKey];
  if (!parent || typeof parent !== "object") {
    return undefined;
  }

  return getField<T>(parent as Record<string, unknown>, ...childKeys);
}

/**
 * Extract a field trying both a nested object and root level
 * Common pattern for Mobula API responses
 *
 * @example
 * const address = getFieldWithFallback<string>(data, 'token', 'address', 'contract_address');
 */
export function getFieldWithFallback<T>(
  obj: Record<string, unknown> | null | undefined,
  nestedKey: string,
  ...fieldKeys: string[]
): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  // Try nested object first
  const nested = obj[nestedKey];
  if (nested && typeof nested === "object") {
    const nestedValue = getField<T>(
      nested as Record<string, unknown>,
      ...fieldKeys,
    );
    if (nestedValue !== undefined) {
      return nestedValue;
    }
  }

  // Fallback to root level
  return getField<T>(obj, ...fieldKeys);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid number (not NaN, not Infinity)
 */
export function isValidNumber(value: unknown): value is number {
  return (
    typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)
  );
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Check if an object has a required field
 */
export function hasField<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return obj !== null && typeof obj === "object" && key in obj;
}

// ============================================================================
// Market Data Types (for REST API responses)
// ============================================================================

/**
 * Token market data from REST API
 * Maps to fetchMarketData / fetchMarketMultiData responses
 */
export interface TokenMarketData {
  id: string;
  name: string;
  symbol: string;
  logo?: string;
  price: number;
  priceChange24h: number;
  priceChange1h?: number;
  priceChange7d?: number;
  marketCap: number;
  volume24h: number;
  liquidity?: number;
  rank?: number;
  blockchain?: string;
  address?: string;
}

/**
 * Market history point for charts
 */
export interface MarketHistoryPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

/**
 * Parse market data response from SDK
 */
export function parseMarketData(data: unknown): TokenMarketData | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;

  const name = getField<string>(obj, "name");
  const symbol = getField<string>(obj, "symbol");
  const price = getField<number>(obj, "price");

  if (!name || !symbol || price === undefined) {
    return null;
  }

  return {
    id: String(getField(obj, "id") ?? name),
    name,
    symbol,
    logo: getField<string>(obj, "logo"),
    price,
    priceChange24h:
      getField<number>(obj, "price_change_24h", "priceChange24h") ?? 0,
    priceChange1h: getField<number>(obj, "price_change_1h", "priceChange1h"),
    priceChange7d: getField<number>(obj, "price_change_7d", "priceChange7d"),
    marketCap: getField<number>(obj, "market_cap", "marketCap") ?? 0,
    volume24h: getField<number>(obj, "volume", "volume24h", "volume_24h") ?? 0,
    liquidity: getField<number>(obj, "liquidity"),
    rank: getField<number>(obj, "rank"),
    blockchain: getField<string>(obj, "blockchain"),
    address: getField<string>(obj, "address"),
  };
}

/**
 * Parse multi-market data response
 */
export function parseMultiMarketData(
  data: Record<string, unknown>,
): TokenMarketData[] {
  return Object.entries(data)
    .map(([key, value]) => {
      const parsed = parseMarketData(value);
      if (parsed) {
        // Use key as fallback for id
        return { ...parsed, id: parsed.id || key };
      }
      return null;
    })
    .filter((item): item is TokenMarketData => item !== null);
}

// ============================================================================
// Pulse Token Types (for WebSocket stream)
// ============================================================================

/**
 * Normalized Pulse token interface
 * Use this in components - not the raw API response
 */
export interface PulseToken {
  // Required identifiers
  address: string;
  chainId: string;

  // Token metadata
  name?: string;
  symbol?: string;
  logo?: string;

  // Pricing
  price?: number;
  priceChange24h?: number;
  priceChange1h?: number;

  // Market data
  marketCap?: number;
  volume24h?: number;
  volume1h?: number;
  liquidity?: number;

  // Holder data
  holdersCount?: number;
  top10Holdings?: number;
  top50Holdings?: number;
  top100Holdings?: number;
  devHoldingsPercentage?: number;
  snipersHoldings?: number;
  insidersHoldings?: number;
  bundlersHoldings?: number;
  proTradersHoldings?: number;

  // Trader counts
  insidersCount?: number;
  bundlersCount?: number;
  snipersCount?: number;
  proTradersCount?: number;
  freshTradersCount?: number;
  smartTradersCount?: number;

  // Bonding info
  bondingPercentage?: number;
  bonded?: boolean;
  createdAt?: string;
  bondedAt?: string;
  poolAddress?: string;

  // Exchange info
  exchange?: {
    name?: string;
    logo?: string;
  };

  // Socials
  socials?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };

  // Trading activity
  buys24h?: number;
  sells24h?: number;
  buys1h?: number;
  sells1h?: number;
  trades24h?: number;
  trades1h?: number;

  // Fees paid
  feesPaid24h?: number;
  feesPaid1h?: number;
  totalFeesPaidUSD?: number;

  // Metadata
  dexPaid?: boolean;
  twitterReuses?: number;
  protocol?: string;
  isPumpLive?: boolean;
}

/**
 * Raw Pulse token from API (snake_case, possibly nested)
 */
export interface RawPulseToken {
  token?: {
    address?: string;
    chainId?: string;
    name?: string;
    symbol?: string;
    logo?: string;
    [key: string]: unknown;
  };
  address?: string;
  chainId?: string;
  chain_id?: string;
  [key: string]: unknown;
}

// ============================================================================
// Token Details Types (for token detail page)
// ============================================================================

export interface TokenDetails {
  // Basic info
  address: string;
  blockchain: string;
  name: string;
  symbol: string;
  logo?: string;
  description?: string;
  deployer?: string;

  // Pricing
  price: number;
  priceChange1m?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange4h?: number;
  priceChange6h?: number;
  priceChange12h?: number;
  priceChange24h?: number;

  // ATH/ATL
  athUSD?: number;
  atlUSD?: number;
  athDate?: string;
  atlDate?: string;

  // Market data
  marketCap?: number;
  fullyDilutedValuation?: number;
  liquidity?: number;
  liquidityMaxUSD?: number;

  // Volume
  volume1m?: number;
  volume5m?: number;
  volume15m?: number;
  volume1h?: number;
  volume4h?: number;
  volume6h?: number;
  volume12h?: number;
  volume24h?: number;
  volumeBuy24h?: number;
  volumeSell24h?: number;

  // Supply
  totalSupply?: number;
  circulatingSupply?: number;
  decimals?: number;

  // Holder data
  holdersCount?: number;
  top10HoldingsPercentage?: number;
  top50HoldingsPercentage?: number;
  top100HoldingsPercentage?: number;
  top200HoldingsPercentage?: number;
  devHoldingsPercentage?: number;
  insidersHoldingsPercentage?: number;
  bundlersHoldingsPercentage?: number;
  snipersHoldingsPercentage?: number;
  proTradersHoldingsPercentage?: number;

  // Transaction data
  trades24h?: number;
  buys24h?: number;
  sells24h?: number;
  traders24h?: number;

  // Socials
  twitter?: string;
  telegram?: string;
  website?: string;
  socials?: {
    twitter?: string;
    website?: string;
    telegram?: string;
    others?: Record<string, string>;
  };

  // Security
  security?: {
    honeypot?: boolean;
    rugPull?: boolean;
    scam?: boolean;
    verified?: boolean;
  };

  // Exchange
  exchange?: {
    name: string;
    logo?: string;
  };

  // Timestamps
  createdAt?: string;
  bondedAt?: string;
}

// ============================================================================
// Trade Types
// ============================================================================

export interface Trade {
  id: string;
  type: "buy" | "sell";
  amount: number;
  amountUsd: number;
  price: number;
  maker: string;
  timestamp: string;
  txHash: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type ViewName = "new" | "bonding" | "bonded";

// ============================================================================
// Formatting Utilities - Re-export from unified formatters
// ============================================================================

// Re-export formatting utilities from central location for backward compatibility
// New code should import directly from @/utils/formatters
export {
  formatCompactNumber as formatNumber,
  formatPercent,
  formatPrice,
  formatTimeAgo,
} from "@/utils/formatters";

/**
 * Generate unique key for a token
 */
export function getTokenKey(token: {
  address?: string;
  chainId?: string;
}): string {
  return `${token.chainId || "unknown"}-${token.address || "unknown"}`;
}
