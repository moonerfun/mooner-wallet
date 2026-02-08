/**
 * API Endpoints & URLs
 * Centralized configuration for all API and WebSocket endpoints
 *
 * All external service URLs should be defined here for:
 * - Easy environment-based configuration
 * - Single source of truth for URL changes
 * - Better testability with mock endpoints
 */

// =============================================================================
// REST API Base URLs
// =============================================================================

/** Mobula API base URL */
export const MOBULA_API_URL =
  process.env.EXPO_PUBLIC_MOBULA_API_URL || "https://api.mobula.io";

/** Mobula Pulse V2 API base URL */
export const MOBULA_PULSE_API_URL =
  process.env.EXPO_PUBLIC_MOBULA_PULSE_API_URL ||
  "https://pulse-v2-api.mobula.io/api/2";

/** OneBalance API base URL (unified cross-chain abstraction) */
export const ONEBALANCE_API_URL =
  process.env.EXPO_PUBLIC_ONEBALANCE_API_URL || "https://be.onebalance.io/api";

/** Solana RPC endpoint */
export const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

// =============================================================================
// WebSocket URLs
// =============================================================================

/** Mobula main WebSocket endpoint */
export const MOBULA_WS_URL = "wss://api.mobula.io";

/** Mobula Pulse V2 WebSocket endpoint */
export const MOBULA_PULSE_WS_URL = "wss://pulse-v2-api.mobula.io";

/** Relay WebSocket endpoint */
export const RELAY_WS_URL = "wss://ws.relay.link";

/** Transaction stream endpoints by chain type */
export const TRANSACTION_STREAM_WS_URLS = {
  evm: "wss://stream-evm-prod.mobula.io/",
  solana: "wss://stream-sol-prod.mobula.io/",
} as const;

// =============================================================================
// API Endpoint Paths
// =============================================================================

/**
 * Mobula API endpoint paths
 * Append to MOBULA_API_URL for full URL
 */
export const MOBULA_ENDPOINTS = {
  search: "/api/1/search",
  fastSearch: "/api/1/fast-search",
  tokenDetails: "/api/1/market/data",
  tokenHistory: "/api/1/market/history",
  walletPortfolio: "/api/1/wallet/portfolio",
  walletPositions: "/api/1/wallet/positions",
  walletHistory: "/api/1/wallet/history",
  traderPositions: "/api/1/trader-positions",
  trending: "/api/1/market/trending",
  newTokens: "/api/1/market/new",
} as const;

// =============================================================================
// Asset URLs
// =============================================================================

/** CoinGecko asset base URL */
export const COINGECKO_ASSETS_URL = "https://assets.coingecko.com/coins/images";

/** Default token logo fallback */
export const DEFAULT_TOKEN_LOGO =
  "https://assets.coingecko.com/coins/images/1/large/bitcoin.png";

/** Default chain logo fallback */
export const DEFAULT_CHAIN_LOGO =
  "https://assets.coingecko.com/coins/images/279/large/ethereum.png";
