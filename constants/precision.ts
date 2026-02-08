/**
 * Precision Constants
 * Centralized decimal precision configuration
 *
 * Use these constants for:
 * - Consistent number formatting
 * - Display precision
 * - Calculation precision
 */

// =============================================================================
// Display Precision (decimal places to show)
// =============================================================================

/** Decimal places for balance display */
export const PRECISION_BALANCE = 6;

/** Decimal places for USD value display */
export const PRECISION_USD = 2;

/** Decimal places for price display (standard) */
export const PRECISION_PRICE = 4;

/** Decimal places for small price display (micro-caps) */
export const PRECISION_PRICE_SMALL = 8;

/** Decimal places for percentage display */
export const PRECISION_PERCENTAGE = 2;

/** Decimal places for token amount input */
export const PRECISION_INPUT = 9;

// =============================================================================
// Calculation Precision
// =============================================================================

/** Precision for intermediate calculations */
export const PRECISION_CALCULATION = 18;

/** Precision for rate calculations */
export const PRECISION_RATE = 8;

// =============================================================================
// Token Decimals (blockchain-specific)
// =============================================================================

/** Default decimals for Solana SPL tokens */
export const SOLANA_SPL_DECIMALS = 6;

/** Decimals for native SOL */
export const SOLANA_NATIVE_DECIMALS = 9;

/** Default decimals for EVM tokens */
export const EVM_DEFAULT_DECIMALS = 18;

/** Lamports per SOL */
export const LAMPORTS_PER_SOL = 1e9;

/** Wei per ETH */
export const WEI_PER_ETH = 1e18;

// =============================================================================
// Chain-Specific Decimals
// =============================================================================

/**
 * Native token decimals by chain
 * Most EVM chains use 18, Solana uses 9
 */
export const CHAIN_NATIVE_DECIMALS: Record<string, number> = {
  // Solana
  solana: 9,
  // EVM chains (all use 18)
  ethereum: 18,
  eth: 18,
  base: 18,
  bsc: 18,
  bnb: 18,
  arbitrum: 18,
  polygon: 18,
  avalanche: 18,
  optimism: 18,
};

/**
 * Get native token decimals for a chain
 * @param chain - Chain name or ID
 * @returns Decimals (defaults to EVM_DEFAULT_DECIMALS)
 */
export function getChainDecimals(chain: string): number {
  const normalized = chain.toLowerCase();
  return CHAIN_NATIVE_DECIMALS[normalized] ?? EVM_DEFAULT_DECIMALS;
}

// =============================================================================
// Formatting Thresholds
// =============================================================================

/** Below this value, use compact notation (K, M, B) */
export const COMPACT_THRESHOLD = 1000;

/** Below this value, use scientific notation for prices */
export const SCIENTIFIC_NOTATION_THRESHOLD = 0.0001;

/** Above this value, use compact notation for large numbers */
export const LARGE_NUMBER_THRESHOLD = 1e9;

// =============================================================================
// Significant Figures
// =============================================================================

/** Significant figures for compact numbers */
export const SIGNIFICANT_FIGURES_COMPACT = 3;

/** Significant figures for scientific notation */
export const SIGNIFICANT_FIGURES_SCIENTIFIC = 4;
