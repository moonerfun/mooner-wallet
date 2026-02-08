/**
 * Transaction Stream Types
 * TypeScript types for Mobula Multi-Events WebSocket streaming
 * Based on https://docs.mobula.io/indexing-stream/stream/websocket/multi-events-stream
 */

import type { ChainId } from "./positionStream";

/**
 * Event types supported by the multi-events stream
 */
export type TransactionEventType = "swap" | "transfer" | "swap-enriched";

/**
 * Filter operators for transaction stream
 */
export interface StreamFilter {
  eq?: [string, string];
  or?: StreamFilter[];
  and?: StreamFilter[];
  in?: [string, string[]];
}

/**
 * Base transaction data common to all event types
 */
export interface BaseTransactionData {
  blockNumber: number;
  chainId: ChainId;
  transactionHash: string;
  transactionIndex: number;
  transactionFrom: string;
  transactionTo: string;
  transactionFees: string;
  date: string;
  type: TransactionEventType;
}

/**
 * Transfer event data
 */
export interface TransferEventData extends BaseTransactionData {
  type: "transfer";
  contract: string;
  from: string;
  to: string;
  amount: string;
  amountUSD: number;
  assetId?: number;
}

/**
 * Token info in swap events
 */
export interface SwapTokenInfo {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
  price?: number;
  priceChange24h?: number;
}

/**
 * Swap event data
 */
export interface SwapEventData extends BaseTransactionData {
  type: "swap" | "swap-enriched";
  poolAddress: string;
  poolType: string;
  swapSenderAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountInUSD: number;
  amountOutUSD: number;
}

/**
 * Enriched swap event data (includes token details)
 */
export interface SwapEnrichedEventData extends Omit<SwapEventData, "type"> {
  type: "swap-enriched";
  baseToken: SwapTokenInfo;
  quoteToken: SwapTokenInfo;
  side: "buy" | "sell";
  priceUSD: number;
  volumeUSD: number;
}

/**
 * Union of all transaction event data types
 */
export type TransactionEventData =
  | TransferEventData
  | SwapEventData
  | SwapEnrichedEventData;

/**
 * Message received from transaction stream
 */
export interface TransactionStreamMessage {
  data: TransactionEventData;
  chainId: ChainId;
  reorg?: boolean;
}

/**
 * Subscription payload for transaction stream
 */
export interface TransactionStreamSubscriptionPayload {
  type: "stream";
  authorization: string;
  payload: {
    name: string;
    chainIds: ChainId[];
    events: TransactionEventType[];
    filters?: StreamFilter;
    subscriptionTracking?: boolean;
  };
}

/**
 * Unsubscribe payload for transaction stream
 */
export interface TransactionStreamUnsubscribePayload {
  type: "unsubscribe";
  authorization: string;
  payload: {
    subscriptionId?: string;
  };
}

/**
 * Transaction stream subscription tracking
 */
export interface TransactionSubscription {
  id: string;
  name: string;
  chainIds: ChainId[];
  events: TransactionEventType[];
  wallets: string[];
  subscribedAt: number;
}

/**
 * Options for transaction stream connection
 */
export interface TransactionStreamOptions {
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
  onConnectionChange?: (state: TransactionStreamConnectionState) => void;
  /** Callback when transaction event received */
  onTransaction?: (transaction: TransactionEventData) => void;
  /** Callback on error */
  onError?: (error: TransactionStreamError) => void;
}

/**
 * Connection state for transaction stream
 */
export type TransactionStreamConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Error from transaction stream
 */
export interface TransactionStreamError {
  error: string;
  details?: unknown;
}
