/**
 * Position Stream Types
 * TypeScript types for Mobula WebSocket position streaming
 * Based on https://docs.mobula.io/indexing-stream/stream/websocket/wss-positions-stream
 */

// Chain identifiers - keep flexible for Mobula API compatibility
export type ChainId =
  | "evm:1" // Ethereum
  | "evm:56" // BSC
  | "evm:8453" // Base
  | "solana:solana" // Solana
  | string; // Other chains (API may return additional formats)

// Native token address (used for ETH, SOL, etc.) - Mobula uses this format
export const NATIVE_TOKEN_ADDRESS =
  "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE";

/**
 * Token metadata included in position updates
 */
export interface PositionTokenDetails {
  address: string;
  chainId: ChainId;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
  price: number;
  priceChange24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

/**
 * Single wallet position data
 * Received from position/positions WebSocket streams
 */
export interface WalletPositionData {
  wallet: string;
  token: string;
  chainId: ChainId;
  balance: number;
  rawBalance: string;
  amountUSD: number;
  buys: number;
  sells: number;
  volumeBuyToken: number;
  volumeSellToken: number;
  volumeBuy: number;
  volumeSell: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
  realizedPnlUSD: number;
  unrealizedPnlUSD: number;
  totalPnlUSD: number;
  firstDate: string | null;
  lastDate: string | null;
  tokenDetails?: PositionTokenDetails;
}

/**
 * Response from positions (plural) stream
 * Contains all positions for a wallet
 */
export interface PositionsStreamResponse {
  data: {
    wallet: string;
    chainId: ChainId;
    positions: WalletPositionData[];
  };
  subscriptionId?: string;
}

/**
 * Response from position (singular) stream
 * Contains a single token position update
 */
export interface PositionStreamResponse {
  data: WalletPositionData;
  subscriptionId?: string;
}

/**
 * Subscription confirmation event
 */
export interface SubscriptionConfirmation {
  event: "subscribed";
  subscriptionId: string;
  type: "position" | "positions";
}

/**
 * Error response from WebSocket
 */
export interface StreamError {
  error: string;
  subscriptionId?: string;
  details?: unknown;
}

/**
 * Ping/pong messages for keepalive
 */
export interface PingMessage {
  event: "ping";
}

export interface PongMessage {
  event: "pong";
}

/**
 * Subscription payload for positions stream (all tokens)
 */
export interface PositionsSubscriptionPayload {
  type: "positions";
  authorization: string;
  payload: {
    wallet: string;
    blockchain?: ChainId;
    subscriptionId?: string;
    subscriptionTracking?: boolean;
  };
}

/**
 * Subscription payload for position stream (single token)
 */
export interface PositionSubscriptionPayload {
  type: "position";
  authorization: string;
  payload: {
    wallet: string;
    token: string;
    blockchain?: ChainId;
    subscriptionId?: string;
    subscriptionTracking?: boolean;
  };
}

/**
 * Unsubscribe payload
 */
export interface UnsubscribePayload {
  type: "unsubscribe";
  authorization: string;
  payload: {
    type?: "position" | "positions";
    subscriptionId?: string;
    wallet?: string;
    token?: string;
    blockchain?: ChainId;
  };
}

/**
 * All possible message types from position WebSocket
 */
export type PositionStreamMessage =
  | PositionsStreamResponse
  | PositionStreamResponse
  | SubscriptionConfirmation
  | StreamError
  | PongMessage;

/**
 * Connection state for the stream
 */
export type StreamConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Subscription tracking for managing multiple subscriptions
 */
export interface PositionSubscription {
  id: string;
  wallet: string;
  token?: string; // Only for single position subscriptions
  blockchain: ChainId;
  type: "position" | "positions";
  subscribedAt: number;
}

/**
 * Options for position stream connection
 */
export interface PositionStreamOptions {
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;
  /** Reconnect delay in milliseconds (default: 3000) */
  reconnectDelay?: number;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Callback when connection state changes */
  onConnectionChange?: (state: StreamConnectionState) => void;
  /** Callback when positions update */
  onPositionsUpdate?: (positions: WalletPositionData[]) => void;
  /** Callback when single position updates */
  onPositionUpdate?: (position: WalletPositionData) => void;
  /** Callback on error */
  onError?: (error: StreamError) => void;
}
