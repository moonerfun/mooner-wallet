/**
 * Pagination Constants
 * Centralized configuration for page sizes and limits
 *
 * Use these constants for:
 * - API request limits
 * - List pagination
 * - Maximum item counts
 * - Search result limits
 */

// =============================================================================
// Default Page Sizes
// =============================================================================

/** Default number of items per page */
export const DEFAULT_PAGE_SIZE = 30;

/** Small page size (for modals, dropdowns) */
export const PAGE_SIZE_SMALL = 10;

/** Medium page size (for main lists) */
export const PAGE_SIZE_MEDIUM = 30;

/** Large page size (for data-heavy views) */
export const PAGE_SIZE_LARGE = 50;

/** Extra large page size (for exports, analytics) */
export const PAGE_SIZE_XL = 100;

// =============================================================================
// API-Specific Limits
// =============================================================================

/** Default limit for Relay API requests */
export const RELAY_DEFAULT_LIMIT = 20;

/** Default limit for Pulse stream requests */
export const PULSE_DEFAULT_LIMIT = 50;

/** Default limit for search requests */
export const SEARCH_DEFAULT_LIMIT = 15;

/** Default limit for KOL/trader requests */
export const KOL_DEFAULT_LIMIT = 50;

/** Default limit for transaction history */
export const TRANSACTION_HISTORY_LIMIT = 30;

/** Default limit for wallet analysis */
export const WALLET_ANALYSIS_LIMIT = 100;

// =============================================================================
// Maximum Limits
// =============================================================================

/** Maximum items in search history */
export const MAX_SEARCH_HISTORY = 10;

/** Maximum number of pulse tokens to display */
export const MAX_PULSE_TOKENS = 50;

/** Maximum number of recent transactions */
export const MAX_RECENT_TRANSACTIONS = 100;

/** Maximum number of tokens in portfolio view */
export const MAX_PORTFOLIO_TOKENS = 500;

/** Maximum number of KOL entries */
export const MAX_KOL_ENTRIES = 100;

/** Maximum number of trending tokens */
export const MAX_TRENDING_TOKENS = 50;

// =============================================================================
// Infinite Scroll Configuration
// =============================================================================

/** Number of items to load on initial render */
export const INITIAL_LOAD_COUNT = 20;

/** Number of items to load on each scroll */
export const LOAD_MORE_COUNT = 20;

/** Distance from bottom (in pixels) to trigger load more */
export const LOAD_MORE_THRESHOLD = 200;

// =============================================================================
// Batch Processing
// =============================================================================

/** Batch size for processing large datasets */
export const BATCH_PROCESS_SIZE = 50;

/** Maximum items to update in a single batch */
export const MAX_BATCH_UPDATE = 100;
