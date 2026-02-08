/**
 * Regex Patterns & Validators
 * Centralized patterns for validation and parsing
 *
 * Use these patterns for:
 * - Address validation
 * - Input sanitization
 * - Data extraction
 */

// =============================================================================
// Address Patterns
// =============================================================================

/** EVM address pattern (0x followed by 40 hex characters) */
export const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/** Solana address pattern (Base58 encoded, 32-44 characters) */
export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Transaction hash pattern (0x followed by 64 hex characters) */
export const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

/** Solana signature pattern (Base58 encoded, 87-88 characters) */
export const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// =============================================================================
// Input Patterns
// =============================================================================

/** Numeric input pattern (allows decimals) */
export const NUMERIC_PATTERN = /^\d*\.?\d*$/;

/** Integer only pattern */
export const INTEGER_PATTERN = /^\d+$/;

/** Percentage pattern (0-100 with optional decimals) */
export const PERCENTAGE_PATTERN = /^(100(\.0+)?|\d{1,2}(\.\d+)?)$/;

// =============================================================================
// Parsing Patterns
// =============================================================================

/** Chain ID extraction pattern (e.g., "evm:1" -> captures "evm" and "1") */
export const CHAIN_ID_PATTERN = /^(\w+):(\d+|[\w-]+)$/;

/** Numeric chain ID check */
export const NUMERIC_CHAIN_ID_PATTERN = /^\d+$/;

/** Number suffix pattern (for formatting) */
export const NUMBER_SUFFIX_PATTERN = /[KMBT]$/;

// =============================================================================
// Error Patterns
// =============================================================================

/** PostgreSQL error code extraction */
export const PG_ERROR_CODE_PATTERN = /PGRST(\d+)/;

/** Solana error code extraction */
export const SOLANA_ERROR_CODE_PATTERN = /custom program error: 0x(\w+)/i;

// =============================================================================
// Validator Functions
// =============================================================================

/**
 * Check if a string is a valid EVM address
 */
export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_PATTERN.test(address);
}

/**
 * Check if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS_PATTERN.test(address);
}

/**
 * Check if a string is a valid blockchain address (EVM or Solana)
 */
export function isValidAddress(address: string): boolean {
  return isValidEvmAddress(address) || isValidSolanaAddress(address);
}

/**
 * Check if a string is a valid EVM transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return TX_HASH_PATTERN.test(hash);
}

/**
 * Check if a string is a valid Solana signature
 */
export function isValidSolanaSignature(signature: string): boolean {
  return SOLANA_SIGNATURE_PATTERN.test(signature);
}

/**
 * Determine address type from string
 */
export function getAddressType(address: string): "evm" | "solana" | "unknown" {
  if (isValidEvmAddress(address)) return "evm";
  if (isValidSolanaAddress(address)) return "solana";
  return "unknown";
}
