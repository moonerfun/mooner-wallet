/**
 * Transaction Stream Service
 * WebSocket service for real-time swap and transfer event tracking
 * Uses Mobula's Multi-Events Stream API
 *
 * Based on:
 * - https://docs.mobula.io/indexing-stream/stream/websocket/multi-events-stream
 *
 * EVM Endpoint: wss://stream-evm-prod.mobula.io/
 * Solana Endpoint: wss://stream-sol-prod.mobula.io/
 */

import { TRANSACTION_STREAM_WS_URLS } from "@/constants/endpoints";
import {
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_PING_INTERVAL,
  WS_RECONNECT_DELAY,
} from "@/constants/network";
import type { ChainId } from "@/types/positionStream";
import type {
  TransactionEventData,
  TransactionEventType,
  TransactionStreamConnectionState,
  TransactionStreamError,
  TransactionStreamMessage,
  TransactionStreamOptions,
  TransactionSubscription,
} from "@/types/transactionStream";

// WebSocket endpoints by chain type (using centralized config)
const WS_ENDPOINTS = TRANSACTION_STREAM_WS_URLS;

type TimeoutRef = ReturnType<typeof setTimeout> | null;
type IntervalRef = ReturnType<typeof setInterval> | null;

/**
 * Transaction Stream Service
 * Manages WebSocket connections for real-time transaction events
 * Handles both EVM and Solana chains with separate connections
 */
export class TransactionStreamService {
  private evmWs: WebSocket | null = null;
  private solanaWs: WebSocket | null = null;
  private apiKey: string;
  private debug: boolean;
  private pingInterval: number;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;

  private evmConnectionState: TransactionStreamConnectionState = "disconnected";
  private solanaConnectionState: TransactionStreamConnectionState =
    "disconnected";
  private evmReconnectAttempts = 0;
  private solanaReconnectAttempts = 0;
  private evmReconnectTimeoutRef: TimeoutRef = null;
  private solanaReconnectTimeoutRef: TimeoutRef = null;
  private evmPingIntervalRef: IntervalRef = null;
  private solanaPingIntervalRef: IntervalRef = null;

  private subscriptions: Map<string, TransactionSubscription> = new Map();
  private pendingSubscriptions: Array<{
    name: string;
    chainIds: ChainId[];
    events: TransactionEventType[];
    wallets: string[];
  }> = [];

  // Callbacks
  private onConnectionChange?: (
    state: TransactionStreamConnectionState,
  ) => void;
  private onTransaction?: (transaction: TransactionEventData) => void;
  private onError?: (error: TransactionStreamError) => void;

  constructor(options: TransactionStreamOptions) {
    this.apiKey = options.apiKey;
    this.debug = options.debug ?? false;
    this.pingInterval = options.pingInterval ?? WS_PING_INTERVAL;
    this.reconnectDelay = options.reconnectDelay ?? WS_RECONNECT_DELAY;
    this.maxReconnectAttempts =
      options.maxReconnectAttempts ?? WS_MAX_RECONNECT_ATTEMPTS;

    this.onConnectionChange = options.onConnectionChange;
    this.onTransaction = options.onTransaction;
    this.onError = options.onError;
  }

  /**
   * Connect to EVM transaction stream
   */
  connectEvm(): void {
    if (this.evmWs?.readyState === WebSocket.OPEN) {
      this.log("EVM already connected");
      return;
    }

    if (this.evmWs?.readyState === WebSocket.CONNECTING) {
      this.log("EVM connection in progress");
      return;
    }

    this.setEvmConnectionState("connecting");
    this.log("Connecting to EVM stream:", WS_ENDPOINTS.evm);

    try {
      this.evmWs = new WebSocket(WS_ENDPOINTS.evm);
      this.setupEvmEventHandlers();
    } catch (error) {
      this.log("Failed to create EVM WebSocket:", error);
      this.setEvmConnectionState("error");
      this.scheduleEvmReconnect();
    }
  }

  /**
   * Connect to Solana transaction stream
   */
  connectSolana(): void {
    if (this.solanaWs?.readyState === WebSocket.OPEN) {
      this.log("Solana already connected");
      return;
    }

    if (this.solanaWs?.readyState === WebSocket.CONNECTING) {
      this.log("Solana connection in progress");
      return;
    }

    this.setSolanaConnectionState("connecting");
    this.log("Connecting to Solana stream:", WS_ENDPOINTS.solana);

    try {
      this.solanaWs = new WebSocket(WS_ENDPOINTS.solana);
      this.setupSolanaEventHandlers();
    } catch (error) {
      this.log("Failed to create Solana WebSocket:", error);
      this.setSolanaConnectionState("error");
      this.scheduleSolanaReconnect();
    }
  }

  /**
   * Disconnect all connections
   */
  disconnect(): void {
    this.log("Disconnecting all...");
    this.disconnectEvm();
    this.disconnectSolana();
    this.subscriptions.clear();
    this.pendingSubscriptions = [];
  }

  /**
   * Disconnect EVM connection
   */
  disconnectEvm(): void {
    this.clearEvmTimers();
    if (this.evmWs) {
      this.evmWs.onclose = null;
      this.evmWs.close(1000, "Client disconnect");
      this.evmWs = null;
    }
    this.setEvmConnectionState("disconnected");
  }

  /**
   * Disconnect Solana connection
   */
  disconnectSolana(): void {
    this.clearSolanaTimers();
    if (this.solanaWs) {
      this.solanaWs.onclose = null;
      this.solanaWs.close(1000, "Client disconnect");
      this.solanaWs = null;
    }
    this.setSolanaConnectionState("disconnected");
  }

  /**
   * Subscribe to wallet transactions
   * Tracks swaps and transfers for the given wallets
   */
  subscribeToWalletTransactions(
    wallets: string[],
    options: {
      chainIds?: ChainId[];
      events?: TransactionEventType[];
      name?: string;
    } = {},
  ): string {
    const {
      chainIds = ["evm:1", "solana:solana"],
      events = ["swap", "transfer", "swap-enriched"],
      name = `wallet-txs-${Date.now()}`,
    } = options;

    const subscriptionId = this.generateSubscriptionId(name, wallets);

    if (this.subscriptions.has(subscriptionId)) {
      this.log("Already subscribed:", subscriptionId);
      return subscriptionId;
    }

    // Separate EVM and Solana chains
    const evmChains = chainIds.filter((c) => c.startsWith("evm:"));
    const solanaChains = chainIds.filter(
      (c) => c.startsWith("solana:") || c === "solana",
    );

    // Subscribe to EVM chains
    if (evmChains.length > 0) {
      if (this.evmWs?.readyState === WebSocket.OPEN) {
        this.sendEvmSubscription(name, evmChains, events, wallets);
      } else {
        this.pendingSubscriptions.push({
          name,
          chainIds: evmChains,
          events,
          wallets,
        });
        this.connectEvm();
      }
    }

    // Subscribe to Solana chains
    if (solanaChains.length > 0) {
      if (this.solanaWs?.readyState === WebSocket.OPEN) {
        this.sendSolanaSubscription(name, solanaChains, events, wallets);
      } else {
        this.pendingSubscriptions.push({
          name,
          chainIds: solanaChains,
          events,
          wallets,
        });
        this.connectSolana();
      }
    }

    // Track subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      name,
      chainIds,
      events,
      wallets,
      subscribedAt: Date.now(),
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   * Note: Server may return "Subscription ID not found" if the subscription
   * was already cleaned up (e.g., after reconnection). This is handled gracefully.
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      // Already unsubscribed or never existed locally - this is fine
      this.log("Subscription already removed locally:", subscriptionId);
      return;
    }

    // Remove from local tracking first to prevent double-unsubscribe attempts
    this.subscriptions.delete(subscriptionId);

    const unsubMessage = {
      type: "unsubscribe",
      authorization: this.apiKey,
      payload: {
        subscriptionId,
      },
    };

    // Send to both connections - server may return "not found" which is handled in handleMessage
    if (this.evmWs?.readyState === WebSocket.OPEN) {
      this.evmWs.send(JSON.stringify(unsubMessage));
    }
    if (this.solanaWs?.readyState === WebSocket.OPEN) {
      this.solanaWs.send(JSON.stringify(unsubMessage));
    }

    this.log("Unsubscribed from:", subscriptionId);
  }

  /**
   * Unsubscribe from all
   */
  unsubscribeAll(): void {
    const unsubMessage = {
      type: "unsubscribe",
      authorization: this.apiKey,
      payload: {},
    };

    if (this.evmWs?.readyState === WebSocket.OPEN) {
      this.evmWs.send(JSON.stringify(unsubMessage));
    }
    if (this.solanaWs?.readyState === WebSocket.OPEN) {
      this.solanaWs.send(JSON.stringify(unsubMessage));
    }

    this.subscriptions.clear();
    this.log("Unsubscribed from all");
  }

  /**
   * Get connection states
   */
  getConnectionState(): {
    evm: TransactionStreamConnectionState;
    solana: TransactionStreamConnectionState;
  } {
    return {
      evm: this.evmConnectionState,
      solana: this.solanaConnectionState,
    };
  }

  /**
   * Check if any connection is active
   */
  isConnected(): boolean {
    return (
      this.evmConnectionState === "connected" ||
      this.solanaConnectionState === "connected"
    );
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: {
    onConnectionChange?: (state: TransactionStreamConnectionState) => void;
    onTransaction?: (transaction: TransactionEventData) => void;
    onError?: (error: TransactionStreamError) => void;
  }): void {
    if (callbacks.onConnectionChange)
      this.onConnectionChange = callbacks.onConnectionChange;
    if (callbacks.onTransaction) this.onTransaction = callbacks.onTransaction;
    if (callbacks.onError) this.onError = callbacks.onError;
  }

  // Private methods

  private setupEvmEventHandlers(): void {
    if (!this.evmWs) return;

    this.evmWs.onopen = () => {
      this.log("EVM connected");
      this.setEvmConnectionState("connected");
      this.evmReconnectAttempts = 0;
      this.startEvmPingInterval();
      this.processPendingEvmSubscriptions();
    };

    this.evmWs.onmessage = (event) => {
      this.handleMessage(event.data, "evm");
    };

    this.evmWs.onerror = (error) => {
      this.log("EVM WebSocket error:", error);
      this.setEvmConnectionState("error");
    };

    this.evmWs.onclose = (event) => {
      this.log("EVM connection closed:", event.code, event.reason);
      this.clearEvmTimers();
      if (event.code !== 1000) {
        this.scheduleEvmReconnect();
      } else {
        this.setEvmConnectionState("disconnected");
      }
    };
  }

  private setupSolanaEventHandlers(): void {
    if (!this.solanaWs) return;

    this.solanaWs.onopen = () => {
      this.log("Solana connected");
      this.setSolanaConnectionState("connected");
      this.solanaReconnectAttempts = 0;
      this.startSolanaPingInterval();
      this.processPendingSolanaSubscriptions();
    };

    this.solanaWs.onmessage = (event) => {
      this.handleMessage(event.data, "solana");
    };

    this.solanaWs.onerror = (error) => {
      this.log("Solana WebSocket error:", error);
      this.setSolanaConnectionState("error");
    };

    this.solanaWs.onclose = (event) => {
      this.log("Solana connection closed:", event.code, event.reason);
      this.clearSolanaTimers();
      if (event.code !== 1000) {
        this.scheduleSolanaReconnect();
      } else {
        this.setSolanaConnectionState("disconnected");
      }
    };
  }

  private handleMessage(data: string, source: "evm" | "solana"): void {
    try {
      const message = JSON.parse(data);

      // Handle pong
      if (message.event === "pong") {
        this.log(`${source} pong received`);
        return;
      }

      // Handle subscription confirmation
      if (message.event === "subscribed") {
        this.log(`${source} subscription confirmed:`, message.subscriptionId);
        return;
      }

      // Handle error
      if (message.error) {
        // Ignore "Subscription ID not found" errors - these are benign
        // and occur when unsubscribing from already-cleaned-up subscriptions
        // (e.g., after reconnection or server-side timeout)
        if (
          typeof message.error === "string" &&
          message.error.includes("Subscription ID") &&
          message.error.includes("not found")
        ) {
          this.log(`${source} subscription already cleaned up:`, message.error);
          return;
        }

        this.log(`${source} error:`, message.error);
        this.onError?.({ error: message.error, details: message.details });
        return;
      }

      // Handle reorg (blockchain reorganization)
      if (message.reorg) {
        this.log(`${source} reorg detected`);
        return;
      }

      // Handle transaction data
      if (message.data) {
        const txMessage = message as TransactionStreamMessage;
        this.log(`${source} transaction:`, txMessage.data.type);
        this.onTransaction?.(txMessage.data);
      }
    } catch (error) {
      this.log("Failed to parse message:", error);
    }
  }

  private sendEvmSubscription(
    name: string,
    chainIds: ChainId[],
    events: TransactionEventType[],
    wallets: string[],
  ): void {
    if (!this.evmWs || this.evmWs.readyState !== WebSocket.OPEN) return;

    // Build filter for wallet addresses (case-insensitive for EVM)
    // Each wallet needs both transactionFrom and transactionTo checks
    const walletConditions = wallets.flatMap((w) => [
      { eq: ["transactionFrom", w.toLowerCase()] as [string, string] },
      { eq: ["transactionTo", w.toLowerCase()] as [string, string] },
    ]);

    const message = {
      type: "stream",
      authorization: this.apiKey,
      payload: {
        name,
        chainIds,
        events,
        filters: { or: walletConditions },
        subscriptionTracking: "true",
      },
    };

    this.evmWs.send(JSON.stringify(message));
    this.log("EVM subscription sent:", name, chainIds, message.payload);
  }

  private sendSolanaSubscription(
    name: string,
    chainIds: ChainId[],
    events: TransactionEventType[],
    wallets: string[],
  ): void {
    if (!this.solanaWs || this.solanaWs.readyState !== WebSocket.OPEN) return;

    // Build filter for wallet addresses
    // Each wallet needs both transactionFrom and transactionTo checks
    const walletConditions = wallets.flatMap((w) => [
      { eq: ["transactionFrom", w] as [string, string] },
      { eq: ["transactionTo", w] as [string, string] },
    ]);

    const message = {
      type: "stream",
      authorization: this.apiKey,
      payload: {
        name,
        chainIds,
        events,
        filters: { or: walletConditions },
        subscriptionTracking: "true",
      },
    };

    this.solanaWs.send(JSON.stringify(message));
    this.log("Solana subscription sent:", name, chainIds, message.payload);
  }

  private processPendingEvmSubscriptions(): void {
    const evmPending = this.pendingSubscriptions.filter((sub) =>
      sub.chainIds.some((c) => c.startsWith("evm:")),
    );

    evmPending.forEach((sub) => {
      const evmChains = sub.chainIds.filter((c) => c.startsWith("evm:"));
      this.sendEvmSubscription(sub.name, evmChains, sub.events, sub.wallets);
    });

    // Remove processed EVM subscriptions
    this.pendingSubscriptions = this.pendingSubscriptions.filter(
      (sub) => !sub.chainIds.some((c) => c.startsWith("evm:")),
    );
  }

  private processPendingSolanaSubscriptions(): void {
    const solanaPending = this.pendingSubscriptions.filter((sub) =>
      sub.chainIds.some((c) => c.startsWith("solana:") || c === "solana"),
    );

    solanaPending.forEach((sub) => {
      const solanaChains = sub.chainIds.filter(
        (c) => c.startsWith("solana:") || c === "solana",
      );
      this.sendSolanaSubscription(
        sub.name,
        solanaChains,
        sub.events,
        sub.wallets,
      );
    });

    // Remove processed Solana subscriptions
    this.pendingSubscriptions = this.pendingSubscriptions.filter(
      (sub) =>
        !sub.chainIds.some((c) => c.startsWith("solana:") || c === "solana"),
    );
  }

  private startEvmPingInterval(): void {
    this.clearEvmPingInterval();
    this.evmPingIntervalRef = setInterval(() => {
      if (this.evmWs?.readyState === WebSocket.OPEN) {
        this.evmWs.send(JSON.stringify({ event: "ping" }));
      }
    }, this.pingInterval);
  }

  private startSolanaPingInterval(): void {
    this.clearSolanaPingInterval();
    this.solanaPingIntervalRef = setInterval(() => {
      if (this.solanaWs?.readyState === WebSocket.OPEN) {
        this.solanaWs.send(JSON.stringify({ event: "ping" }));
      }
    }, this.pingInterval);
  }

  private clearEvmPingInterval(): void {
    if (this.evmPingIntervalRef) {
      clearInterval(this.evmPingIntervalRef);
      this.evmPingIntervalRef = null;
    }
  }

  private clearSolanaPingInterval(): void {
    if (this.solanaPingIntervalRef) {
      clearInterval(this.solanaPingIntervalRef);
      this.solanaPingIntervalRef = null;
    }
  }

  private clearEvmTimers(): void {
    this.clearEvmPingInterval();
    if (this.evmReconnectTimeoutRef) {
      clearTimeout(this.evmReconnectTimeoutRef);
      this.evmReconnectTimeoutRef = null;
    }
  }

  private clearSolanaTimers(): void {
    this.clearSolanaPingInterval();
    if (this.solanaReconnectTimeoutRef) {
      clearTimeout(this.solanaReconnectTimeoutRef);
      this.solanaReconnectTimeoutRef = null;
    }
  }

  private scheduleEvmReconnect(): void {
    if (this.evmReconnectAttempts >= this.maxReconnectAttempts) {
      this.log("EVM max reconnect attempts reached");
      this.setEvmConnectionState("error");
      return;
    }

    this.setEvmConnectionState("reconnecting");
    this.evmReconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.evmReconnectAttempts - 1),
      30000,
    );

    this.log(`EVM reconnecting in ${delay}ms`);

    this.evmReconnectTimeoutRef = setTimeout(() => {
      this.connectEvm();
    }, delay);
  }

  private scheduleSolanaReconnect(): void {
    if (this.solanaReconnectAttempts >= this.maxReconnectAttempts) {
      this.log("Solana max reconnect attempts reached");
      this.setSolanaConnectionState("error");
      return;
    }

    this.setSolanaConnectionState("reconnecting");
    this.solanaReconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.solanaReconnectAttempts - 1),
      30000,
    );

    this.log(`Solana reconnecting in ${delay}ms`);

    this.solanaReconnectTimeoutRef = setTimeout(() => {
      this.connectSolana();
    }, delay);
  }

  private setEvmConnectionState(state: TransactionStreamConnectionState): void {
    if (this.evmConnectionState !== state) {
      this.evmConnectionState = state;
      this.onConnectionChange?.(state);
    }
  }

  private setSolanaConnectionState(
    state: TransactionStreamConnectionState,
  ): void {
    if (this.solanaConnectionState !== state) {
      this.solanaConnectionState = state;
      this.onConnectionChange?.(state);
    }
  }

  private generateSubscriptionId(name: string, wallets: string[]): string {
    return `${name}-${wallets.join("-").slice(0, 20)}-${Date.now()}`;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[TransactionStream]", ...args);
    }
  }
}

// Singleton instance
let transactionStreamInstance: TransactionStreamService | null = null;

/**
 * Get or create the transaction stream service singleton
 */
export function getTransactionStreamService(
  options?: Partial<TransactionStreamOptions>,
): TransactionStreamService {
  if (!transactionStreamInstance) {
    const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";
    transactionStreamInstance = new TransactionStreamService({
      apiKey,
      debug: __DEV__,
      ...options,
    });
  } else if (options) {
    transactionStreamInstance.setCallbacks({
      onConnectionChange: options.onConnectionChange,
      onTransaction: options.onTransaction,
      onError: options.onError,
    });
  }

  return transactionStreamInstance;
}

/**
 * Reset the transaction stream service
 */
export function resetTransactionStreamService(): void {
  if (transactionStreamInstance) {
    transactionStreamInstance.disconnect();
    transactionStreamInstance = null;
  }
}
