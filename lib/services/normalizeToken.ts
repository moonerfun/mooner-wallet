/**
 * Token Normalization Utilities
 *
 * Converts raw API responses (snake_case, nested) to normalized format (camelCase, flat).
 * Based on MTT patterns with improved type safety and performance.
 */

import {
  getField,
  isNonEmptyString,
  type PulseToken,
  type RawPulseToken,
} from "@/lib/api/mobula/mobulaTypes";
import { wsLogger } from "@/utils/logger";

// Cache for normalized tokens to avoid redundant processing
const normalizationCache = new WeakMap<object, PulseToken | null>();

/**
 * Field mapping configuration
 * Maps normalized field names to possible API field names
 */
const FIELD_MAPPINGS = {
  // Identifiers
  address: ["address", "contract_address", "tokenAddress", "token_address"],
  chainId: ["chainId", "chain_id", "blockchain"],

  // Metadata
  name: ["name"],
  symbol: ["symbol"],
  logo: ["logo", "image", "icon"],

  // Pricing
  price: ["latest_price", "price", "priceUSD"],
  priceChange24h: ["price_change_24h", "priceChange24h"],
  priceChange1h: ["price_change_1h", "priceChange1h"],

  // Market data
  marketCap: ["market_cap", "marketCap", "latest_market_cap"],
  liquidity: ["liquidity", "liquidityUSD"],
  volume24h: ["volume_24h", "volume24h"],
  volume1h: ["volume_1h", "volume1h"],

  // Holders
  holdersCount: ["holdersCount", "holders_count"],
  top10Holdings: [
    "top10HoldingsPercentage",
    "top10Holdings",
    "top_10_holdings",
  ],
  top50Holdings: ["top50HoldingsPercentage", "top50Holdings"],
  top100Holdings: ["top100HoldingsPercentage", "top100Holdings"],
  devHoldingsPercentage: ["devHoldingsPercentage", "dev_holdings_percentage"],
  snipersHoldings: [
    "snipersHoldingsPercentage",
    "snipersHoldings",
    "snipers_holdings",
  ],
  insidersHoldings: [
    "insidersHoldingsPercentage",
    "insidersHoldings",
    "insiders_holdings",
  ],
  bundlersHoldings: [
    "bundlersHoldingsPercentage",
    "bundlersHoldings",
    "bundlers_holdings",
  ],
  proTradersHoldings: ["proTradersHoldingsPercentage", "proTradersHoldings"],

  // Trader counts
  insidersCount: ["insidersCount"],
  bundlersCount: ["bundlersCount"],
  snipersCount: ["snipersCount"],
  proTradersCount: ["proTradersCount"],
  freshTradersCount: ["freshTradersCount"],
  smartTradersCount: ["smartTradersCount"],

  // Bonding
  bondingPercentage: ["bondingPercentage", "bonding_percentage"],
  bonded: ["bonded"],
  createdAt: ["created_at", "createdAt"],
  bondedAt: ["bonded_at", "bondedAt"],
  poolAddress: ["poolAddress", "pool_address"],

  // Trading activity
  buys24h: ["buys_24h", "buys24h"],
  sells24h: ["sells_24h", "sells24h"],
  buys1h: ["buys_1h", "buys1h"],
  sells1h: ["sells_1h", "sells1h"],
  trades24h: ["trades_24h", "trades24h"],
  trades1h: ["trades_1h", "trades1h"],

  // Fees
  feesPaid24h: ["fees_paid_24h", "feesPaid24h"],
  feesPaid1h: ["fees_paid_1h", "feesPaid1h"],
  totalFeesPaidUSD: ["totalFeesPaidUSD"],

  // Metadata
  twitterReuses: ["twitterReusesCount", "twitterReuses", "twitter_reuses"],
  devMigration: ["deployerMigrationsCount", "devMigration", "dev_migration"],
  dexPaid: ["dexscreenerAdPaid", "dexPaid", "dex_paid"],
  protocol: ["preBondingFactory", "source", "factory"],
} as const;

/**
 * Extract a field from raw token data, checking nested token object first
 */
function extractField<T>(
  raw: RawPulseToken,
  fieldNames: readonly string[],
  tokenObj: Record<string, unknown> | null,
): T | undefined {
  // Try nested token object first (contains token metadata)
  if (tokenObj) {
    const nestedValue = getField<T>(tokenObj, ...fieldNames);
    if (nestedValue !== undefined) {
      return nestedValue;
    }
  }

  // Fallback to root level (contains statistics)
  return getField<T>(raw as Record<string, unknown>, ...fieldNames);
}

/**
 * Normalize a raw API token to our internal format
 *
 * Handles:
 * - snake_case -> camelCase conversion
 * - Nested token objects (API format: { token: {...}, stats at root })
 * - Missing/null field handling
 * - Performance via caching
 *
 * @param raw - Raw token from Mobula API
 * @returns Normalized PulseToken or null if invalid
 */
export function normalizeToken(raw: RawPulseToken): PulseToken | null {
  // Validate input
  if (!raw || typeof raw !== "object") {
    return null;
  }

  // Check cache first
  const cached = normalizationCache.get(raw);
  if (cached !== undefined) {
    return cached;
  }

  // Extract nested token object (contains token metadata in API format)
  const tokenObj =
    raw.token && typeof raw.token === "object"
      ? (raw.token as Record<string, unknown>)
      : null;

  // Extract required fields
  const address = extractField<string>(raw, FIELD_MAPPINGS.address, tokenObj);
  const chainId = extractField<string>(raw, FIELD_MAPPINGS.chainId, tokenObj);

  // Validate required fields
  if (!isNonEmptyString(address) || !isNonEmptyString(chainId)) {
    // Log occasionally to avoid spam
    wsLogger.sample(0.05, "Missing address or chainId in token:", {
      hasAddress: !!address,
      hasChainId: !!chainId,
      keys: Object.keys(raw).slice(0, 10),
    });
    normalizationCache.set(raw, null);
    return null;
  }

  // Extract exchange info
  const exchange =
    (tokenObj?.exchange as { name?: string; logo?: string } | undefined) ??
    ((raw as Record<string, unknown>).exchange as
      | { name?: string; logo?: string }
      | undefined);

  // Extract socials
  const socials = (raw as Record<string, unknown>).socials as
    | {
        twitter?: string;
        website?: string;
        telegram?: string;
      }
    | undefined;

  // Determine protocol from various sources
  const protocol =
    extractField<string>(raw, FIELD_MAPPINGS.protocol, tokenObj) ??
    exchange?.name;

  // Check if pump live
  const liveStatus = getField<string>(
    raw as Record<string, unknown>,
    "live_status",
  );
  const isPumpLive = liveStatus === "pump_live";

  // Build normalized token
  const normalized: PulseToken = {
    // Required
    address,
    chainId,

    // Metadata
    name: extractField<string>(raw, FIELD_MAPPINGS.name, tokenObj),
    symbol: extractField<string>(raw, FIELD_MAPPINGS.symbol, tokenObj),
    logo: extractField<string>(raw, FIELD_MAPPINGS.logo, tokenObj),

    // Pricing
    price: extractField<number>(raw, FIELD_MAPPINGS.price, tokenObj),
    priceChange24h: extractField<number>(
      raw,
      FIELD_MAPPINGS.priceChange24h,
      tokenObj,
    ),
    priceChange1h: extractField<number>(
      raw,
      FIELD_MAPPINGS.priceChange1h,
      tokenObj,
    ),

    // Market data
    marketCap: extractField<number>(raw, FIELD_MAPPINGS.marketCap, tokenObj),
    volume24h: extractField<number>(raw, FIELD_MAPPINGS.volume24h, tokenObj),
    volume1h: extractField<number>(raw, FIELD_MAPPINGS.volume1h, tokenObj),
    liquidity: extractField<number>(raw, FIELD_MAPPINGS.liquidity, tokenObj),

    // Holders
    holdersCount: extractField<number>(
      raw,
      FIELD_MAPPINGS.holdersCount,
      tokenObj,
    ),
    top10Holdings: extractField<number>(
      raw,
      FIELD_MAPPINGS.top10Holdings,
      tokenObj,
    ),
    top50Holdings: extractField<number>(
      raw,
      FIELD_MAPPINGS.top50Holdings,
      tokenObj,
    ),
    top100Holdings: extractField<number>(
      raw,
      FIELD_MAPPINGS.top100Holdings,
      tokenObj,
    ),
    devHoldingsPercentage: extractField<number>(
      raw,
      FIELD_MAPPINGS.devHoldingsPercentage,
      tokenObj,
    ),
    snipersHoldings: extractField<number>(
      raw,
      FIELD_MAPPINGS.snipersHoldings,
      tokenObj,
    ),
    insidersHoldings: extractField<number>(
      raw,
      FIELD_MAPPINGS.insidersHoldings,
      tokenObj,
    ),
    bundlersHoldings: extractField<number>(
      raw,
      FIELD_MAPPINGS.bundlersHoldings,
      tokenObj,
    ),
    proTradersHoldings: extractField<number>(
      raw,
      FIELD_MAPPINGS.proTradersHoldings,
      tokenObj,
    ),

    // Trader counts
    insidersCount: extractField<number>(raw, ["insidersCount"], tokenObj),
    bundlersCount: extractField<number>(raw, ["bundlersCount"], tokenObj),
    snipersCount: extractField<number>(raw, ["snipersCount"], tokenObj),
    proTradersCount: extractField<number>(raw, ["proTradersCount"], tokenObj),
    freshTradersCount: extractField<number>(
      raw,
      ["freshTradersCount"],
      tokenObj,
    ),
    smartTradersCount: extractField<number>(
      raw,
      ["smartTradersCount"],
      tokenObj,
    ),

    // Bonding
    bondingPercentage: extractField<number>(
      raw,
      FIELD_MAPPINGS.bondingPercentage,
      tokenObj,
    ),
    bonded: extractField<boolean>(raw, FIELD_MAPPINGS.bonded, tokenObj),
    createdAt: extractField<string>(raw, FIELD_MAPPINGS.createdAt, tokenObj),
    bondedAt: extractField<string>(raw, FIELD_MAPPINGS.bondedAt, tokenObj),
    poolAddress: extractField<string>(
      raw,
      FIELD_MAPPINGS.poolAddress,
      tokenObj,
    ),

    // Exchange & Socials
    exchange,
    socials,

    // Trading activity
    buys24h: extractField<number>(raw, FIELD_MAPPINGS.buys24h, tokenObj),
    sells24h: extractField<number>(raw, FIELD_MAPPINGS.sells24h, tokenObj),
    buys1h: extractField<number>(raw, FIELD_MAPPINGS.buys1h, tokenObj),
    sells1h: extractField<number>(raw, FIELD_MAPPINGS.sells1h, tokenObj),
    trades24h: extractField<number>(raw, FIELD_MAPPINGS.trades24h, tokenObj),
    trades1h: extractField<number>(raw, FIELD_MAPPINGS.trades1h, tokenObj),

    // Fees
    feesPaid24h: extractField<number>(
      raw,
      FIELD_MAPPINGS.feesPaid24h,
      tokenObj,
    ),
    feesPaid1h: extractField<number>(raw, FIELD_MAPPINGS.feesPaid1h, tokenObj),
    totalFeesPaidUSD: extractField<number>(
      raw,
      FIELD_MAPPINGS.totalFeesPaidUSD,
      tokenObj,
    ),

    // Metadata
    dexPaid: extractField<boolean>(raw, FIELD_MAPPINGS.dexPaid, tokenObj),
    twitterReuses: extractField<number>(
      raw,
      FIELD_MAPPINGS.twitterReuses,
      tokenObj,
    ),
    protocol,
    isPumpLive,
  };

  // Cache and return
  normalizationCache.set(raw, normalized);
  return normalized;
}

/**
 * Normalize an array of tokens efficiently
 */
export function normalizeTokens(rawTokens: RawPulseToken[]): PulseToken[] {
  if (!Array.isArray(rawTokens)) {
    return [];
  }

  const normalized: PulseToken[] = [];

  for (const raw of rawTokens) {
    const token = normalizeToken(raw);
    if (token) {
      normalized.push(token);
    }
  }

  return normalized;
}

/**
 * Clear normalization cache (useful for memory management)
 */
export function clearNormalizationCache(): void {
  // WeakMap cleans up automatically, but we can't clear it manually
  // This is a no-op but provides a consistent API if we switch to Map
}
