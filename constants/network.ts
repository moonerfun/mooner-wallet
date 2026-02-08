/**
 * Network Configuration Constants
 * Centralized configuration for timeouts, retries, and intervals
 *
 * All network-related timing constants should be defined here for:
 * - Consistent behavior across the app
 * - Easy tuning of performance parameters
 * - Clear documentation of timing expectations
 */

// =============================================================================
// Request Timeouts
// =============================================================================

/** Default HTTP request timeout in milliseconds */
export const REQUEST_TIMEOUT = 30000; // 30 seconds

/** Timeout for quick requests (search, autocomplete) */
export const QUICK_REQUEST_TIMEOUT = 10000; // 10 seconds

/** Timeout for slow endpoints (large data fetches, analytics) */
export const SLOW_REQUEST_TIMEOUT = 60000; // 60 seconds

/** Timeout for swap/transaction operations */
export const TRANSACTION_TIMEOUT = 120000; // 2 minutes

// =============================================================================
// WebSocket Configuration
// =============================================================================

/** WebSocket ping interval to keep connection alive */
export const WS_PING_INTERVAL = 30000; // 30 seconds

/** Initial delay before attempting WebSocket reconnection */
export const WS_RECONNECT_DELAY = 3000; // 3 seconds

/** Maximum WebSocket reconnection attempts before giving up */
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

/** WebSocket close code for normal closure */
export const WS_CLOSE_NORMAL = 1000;

/** Maximum backoff delay for exponential reconnection */
export const WS_MAX_BACKOFF_DELAY = 30000; // 30 seconds

// =============================================================================
// Retry Configuration
// =============================================================================

/** Maximum number of retries for failed requests */
export const MAX_RETRIES = 3;

/** Delay between retries in milliseconds */
export const RETRY_DELAY = 1000; // 1 second

/** Multiplier for exponential backoff */
export const RETRY_BACKOFF_MULTIPLIER = 2;

// =============================================================================
// Polling Intervals
// =============================================================================

/** Interval for polling price updates */
export const PRICE_POLL_INTERVAL = 10000; // 10 seconds

/** Interval for polling portfolio updates */
export const PORTFOLIO_POLL_INTERVAL = 30000; // 30 seconds

/** Interval for polling transaction status */
export const TX_STATUS_POLL_INTERVAL = 2000; // 2 seconds

/** Delay before checking transaction status after submission */
export const TX_CONFIRMATION_DELAY = 3000; // 3 seconds

// =============================================================================
// Rate Limiting
// =============================================================================

/** Minimum delay between consecutive API requests */
export const MIN_REQUEST_DELAY = 100; // 100ms

/** Maximum requests per minute for rate limiting */
export const MAX_REQUESTS_PER_MINUTE = 60;

// =============================================================================
// Debounce & Throttle
// =============================================================================

/** Debounce delay for search input */
export const SEARCH_DEBOUNCE_DELAY = 300; // 300ms

/** Debounce delay for filter changes */
export const FILTER_DEBOUNCE_DELAY = 200; // 200ms

/** Throttle delay for scroll events */
export const SCROLL_THROTTLE_DELAY = 100; // 100ms

/** Debounce delay for store updates (batching) */
export const STORE_UPDATE_DEBOUNCE = 50; // 50ms

/** Maximum delay for batched updates */
export const STORE_UPDATE_MAX_DELAY = 200; // 200ms
