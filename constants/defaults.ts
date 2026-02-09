/**
 * Default Values
 * Centralized default configuration values
 *
 * Use these constants for:
 * - Initial state values
 * - Fallback values
 * - Default settings
 */

// =============================================================================
// Trading Defaults
// =============================================================================

/** Default slippage tolerance percentage */
export const DEFAULT_SLIPPAGE = 0.5;

/** Minimum slippage tolerance percentage */
export const MIN_SLIPPAGE = 0.1;

/** Maximum slippage tolerance percentage */
export const MAX_SLIPPAGE = 50;

/** High slippage warning threshold */
export const HIGH_SLIPPAGE_WARNING = 5;

// =============================================================================
// OneBalance Slippage (basis points) — per asset volatility class
// See: https://docs.onebalance.io/guides/slippage/overview
// =============================================================================

/** Slippage for stablecoin↔stablecoin swaps (USDC↔USDT) — 0.25% */
export const SLIPPAGE_BPS_STABLECOIN = 25;

/** Slippage for major token swaps (ETH↔USDC) — 1% */
export const SLIPPAGE_BPS_MAJOR = 100;

/** Slippage for volatile/altcoin swaps — 3% */
export const SLIPPAGE_BPS_VOLATILE = 300;

/** Slippage for new/meme tokens (Pump.fun, low-cap) — 5% */
export const SLIPPAGE_BPS_MEME = 500;

/** Extra slippage multiplier for cross-chain operations (+50%) */
export const SLIPPAGE_CROSS_CHAIN_MULTIPLIER = 1.5;

/** Maximum slippage cap in basis points (10%) */
export const SLIPPAGE_BPS_MAX = 1000;

/** Progressive slippage multiplier per retry attempt */
export const SLIPPAGE_RETRY_MULTIPLIER = 1.5;

// =============================================================================
// Notification Thresholds
// =============================================================================

/** Minimum trade value (USD) to trigger notification */
export const LARGE_TRADE_THRESHOLD = 5000;

/** Minimum price change (%) to trigger notification */
export const PRICE_CHANGE_NOTIFICATION_THRESHOLD = 10;

// =============================================================================
// Filter Defaults
// =============================================================================

/** Minimum liquidity filter (USD) */
export const MIN_LIQUIDITY_DEFAULT = 1000;

/** Minimum volume filter (USD) */
export const MIN_VOLUME_DEFAULT = 100000;

/** Minimum market cap filter (USD) */
export const MIN_MARKET_CAP_DEFAULT = 10000;

// =============================================================================
// Display Thresholds
// =============================================================================

/** Threshold to hide small balances (USD) */
export const SMALL_BALANCE_THRESHOLD = 1;

/** Minimum value to show in portfolio (USD) */
export const DUST_THRESHOLD = 0.01;

// =============================================================================
// Validation Limits
// =============================================================================

/** Minimum transaction amount (in base units) */
export const MIN_TRANSACTION_AMOUNT = 0.000001;

/** Maximum gas limit for EVM transactions */
export const MAX_GAS_LIMIT = 15000000;

// =============================================================================
// Priority Fees (Solana - in micro-lamports)
// =============================================================================

export const PRIORITY_FEES = {
  low: 1000,
  medium: 50000,
  high: 200000,
} as const;

export type PriorityFeeLevel = keyof typeof PRIORITY_FEES;

// =============================================================================
// Quick Buy Defaults
// =============================================================================

/** Default quick buy preset amounts (USD) */
export const DEFAULT_QUICK_BUY_AMOUNTS = [10, 50, 100, 500];

/** Default selected quick buy amount (USD) */
export const DEFAULT_QUICK_BUY_AMOUNT = 50;

// =============================================================================
// Retry Defaults
// =============================================================================

/** Default number of transaction retry attempts */
export const DEFAULT_TX_RETRIES = 3;

/** Default delay between transaction retries (ms) */
export const DEFAULT_TX_RETRY_DELAY = 1000;

// =============================================================================
// Scam Token Filtering
// =============================================================================

/** Minimum liquidity (USD) for a token to be shown - tokens with 0 liquidity are likely scams */
export const SCAM_MIN_LIQUIDITY = 100;

/** Maximum holder concentration - if top 10 holders own more than this %, likely a scam */
export const SCAM_MAX_TOP_HOLDERS = 0.99;

/** Patterns in token names/symbols that indicate scams */
export const SCAM_NAME_PATTERNS = [
  /claim/i,
  /airdrop/i,
  /\.(com|io|org|net|xyz|cfd|help|claim)\b/i,
  /t\.me\//i,
  /telegram/i,
  /www\./i,
  /https?:/i,
  /\*claim/i,
  /free.*token/i,
] as const;

/** Known scam token contract addresses (lowercase) */
export const SCAM_TOKEN_ADDRESSES: Set<string> = new Set([
  // Add known scam addresses here as they're discovered
]);
