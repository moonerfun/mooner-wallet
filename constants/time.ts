/**
 * Time Constants
 * Centralized time-related constants and utilities
 *
 * Use these constants for:
 * - Cache durations
 * - Expiration calculations
 * - Time-based filtering
 * - Date comparisons
 */

// =============================================================================
// Milliseconds
// =============================================================================

/** One second in milliseconds */
export const MS_SECOND = 1000;

/** One minute in milliseconds */
export const MS_MINUTE = 60 * MS_SECOND;

/** One hour in milliseconds */
export const MS_HOUR = 60 * MS_MINUTE;

/** One day in milliseconds */
export const MS_DAY = 24 * MS_HOUR;

/** One week in milliseconds */
export const MS_WEEK = 7 * MS_DAY;

/** 30 days in milliseconds */
export const MS_MONTH = 30 * MS_DAY;

/** 365 days in milliseconds */
export const MS_YEAR = 365 * MS_DAY;

// =============================================================================
// Seconds
// =============================================================================

/** One minute in seconds */
export const SECONDS_MINUTE = 60;

/** One hour in seconds */
export const SECONDS_HOUR = 3600;

/** One day in seconds */
export const SECONDS_DAY = 86400;

/** One week in seconds */
export const SECONDS_WEEK = 604800;

/** 30 days in seconds */
export const SECONDS_MONTH = 2592000;

/** 365 days in seconds */
export const SECONDS_YEAR = 31536000;

// =============================================================================
// Cache Durations
// =============================================================================

/** Short cache duration (5 minutes) */
export const CACHE_SHORT = 5 * MS_MINUTE;

/** Medium cache duration (30 minutes) */
export const CACHE_MEDIUM = 30 * MS_MINUTE;

/** Long cache duration (1 hour) */
export const CACHE_LONG = MS_HOUR;

/** Extended cache duration (24 hours) */
export const CACHE_EXTENDED = MS_DAY;

/** Token cache duration (5 minutes) */
export const TOKEN_CACHE_TTL = 5 * MS_MINUTE;

/** Portfolio cache duration (1 hour) */
export const PORTFOLIO_CACHE_TTL = MS_HOUR;

/** KOL stats cache duration (15 minutes - backend cron syncs more frequently) */
export const KOL_CACHE_TTL = 15 * MS_MINUTE;

/** Trending cache duration (5 minutes) */
export const TRENDING_CACHE_TTL = 5 * MS_MINUTE;

// =============================================================================
// Data Freshness Thresholds
// =============================================================================

/** Maximum age for data to be considered "fresh" */
export const DATA_FRESHNESS_THRESHOLD = 2 * MS_MINUTE;

/** Stale data threshold (when to show loading indicator) */
export const STALE_DATA_THRESHOLD = 5 * MS_MINUTE;

// =============================================================================
// Time Period Options (for charts/history)
// =============================================================================

/**
 * Time period options for price history charts
 * Values are in seconds for API compatibility
 */
export const TIME_PERIODS = {
  "1H": SECONDS_HOUR,
  "4H": 4 * SECONDS_HOUR,
  "24H": SECONDS_DAY,
  "7D": SECONDS_WEEK,
  "30D": SECONDS_MONTH,
  "1Y": SECONDS_YEAR,
  ALL: 0, // Special case: fetch all available data
} as const;

export type TimePeriod = keyof typeof TIME_PERIODS;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate time ago from a timestamp
 * @param timestamp - Unix timestamp or Date
 * @returns Time difference in milliseconds
 */
export function getTimeAgo(timestamp: number | Date): number {
  const time = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  return Date.now() - time;
}

/**
 * Check if data is stale based on timestamp
 * @param timestamp - Last update timestamp
 * @param threshold - Staleness threshold (default: DATA_FRESHNESS_THRESHOLD)
 * @returns True if data is stale
 */
export function isDataStale(
  timestamp: number | Date | undefined,
  threshold: number = DATA_FRESHNESS_THRESHOLD,
): boolean {
  if (!timestamp) return true;
  return getTimeAgo(timestamp) > threshold;
}
