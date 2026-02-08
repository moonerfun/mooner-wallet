/**
 * Position Stream Service
 * WebSocket service for real-time wallet position updates
 * Uses native WebSocket to avoid React Native compatibility issues with Mobula SDK
 *
 * Based on:
 * - https://docs.mobula.io/indexing-stream/stream/websocket/wss-positions-stream
 * - https://docs.mobula.io/indexing-stream/stream/websocket/wss-position-stream
 */

import { MOBULA_WS_URL } from "@/constants/endpoints";
import {
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_PING_INTERVAL,
  WS_RECONNECT_DELAY,
} from "@/constants/network";
import type {
  ChainId,
  PositionsStreamResponse,
  PositionStreamMessage,
  PositionStreamOptions,
  PositionStreamResponse,
  PositionSubscription,
  StreamConnectionState,
  StreamError,
  WalletPositionData,
} from "@/types/positionStream";

type TimeoutRef = ReturnType<typeof setTimeout> | null;
type IntervalRef = ReturnType<typeof setInterval> | null;

/**
 * Position Stream Service
 * Manages WebSocket connection for real-time wallet position updates
 */
export class PositionStreamService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private debug: boolean;
  private pingInterval: number;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;

  private connectionState: StreamConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimeoutRef: TimeoutRef = null;
  private pingIntervalRef: IntervalRef = null;

  private subscriptions: Map<string, PositionSubscription> = new Map();
  private pendingSubscriptions: Array<{
    wallet: string;
    token?: string;
    blockchain: ChainId;
  }> = [];

  // Callbacks
  private onConnectionChange?: (state: StreamConnectionState) => void;
  private onPositionsUpdate?: (positions: WalletPositionData[]) => void;
  private onPositionUpdate?: (position: WalletPositionData) => void;
  private onError?: (error: StreamError) => void;

  constructor(options: PositionStreamOptions) {
    this.apiKey = options.apiKey;
    this.debug = options.debug ?? false;
    this.pingInterval = options.pingInterval ?? WS_PING_INTERVAL;
    this.reconnectDelay = options.reconnectDelay ?? WS_RECONNECT_DELAY;
    this.maxReconnectAttempts =
      options.maxReconnectAttempts ?? WS_MAX_RECONNECT_ATTEMPTS;

    this.onConnectionChange = options.onConnectionChange;
    this.onPositionsUpdate = options.onPositionsUpdate;
    this.onPositionUpdate = options.onPositionUpdate;
    this.onError = options.onError;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log("Already connected");
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.log("Connection in progress");
      return;
    }

    this.setConnectionState("connecting");
    this.log("Connecting to", MOBULA_WS_URL);

    try {
      this.ws = new WebSocket(MOBULA_WS_URL);
      this.setupEventHandlers();
    } catch (error) {
      this.log("Failed to create WebSocket:", error);
      this.setConnectionState("error");
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.log("Disconnecting...");
    this.clearTimers();
    this.subscriptions.clear();
    this.pendingSubscriptions = [];

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.setConnectionState("disconnected");
  }

  /**
   * Subscribe to all positions for a wallet
   */
  subscribeToPositions(wallet: string, blockchain: ChainId = "evm:1"): string {
    const subscriptionId = this.generateSubscriptionId(
      "positions",
      wallet,
      blockchain,
    );

    if (this.subscriptions.has(subscriptionId)) {
      this.log("Already subscribed to positions for", wallet);
      return subscriptionId;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPositionsSubscription(wallet, blockchain, subscriptionId);
    } else {
      this.pendingSubscriptions.push({ wallet, blockchain });
      this.connect();
    }

    return subscriptionId;
  }

  /**
   * Subscribe to a single token position
   */
  subscribeToPosition(
    wallet: string,
    token: string,
    blockchain: ChainId = "evm:1",
  ): string {
    const subscriptionId = this.generateSubscriptionId(
      "position",
      wallet,
      blockchain,
      token,
    );

    if (this.subscriptions.has(subscriptionId)) {
      this.log("Already subscribed to position for", wallet, token);
      return subscriptionId;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPositionSubscription(wallet, token, blockchain, subscriptionId);
    } else {
      this.pendingSubscriptions.push({ wallet, token, blockchain });
      this.connect();
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.log("Subscription not found:", subscriptionId);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: "unsubscribe",
        authorization: this.apiKey,
        payload: {
          subscriptionId,
        },
      };
      this.ws.send(JSON.stringify(message));
      this.log("Unsubscribed from:", subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Unsubscribe from all subscriptions for a wallet
   */
  unsubscribeFromWallet(wallet: string): void {
    const toRemove: string[] = [];

    this.subscriptions.forEach((sub, id) => {
      if (sub.wallet.toLowerCase() === wallet.toLowerCase()) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.unsubscribe(id));
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: "unsubscribe",
        authorization: this.apiKey,
        payload: {},
      };
      this.ws.send(JSON.stringify(message));
      this.log("Unsubscribed from all");
    }

    this.subscriptions.clear();
  }

  /**
   * Get current connection state
   */
  getConnectionState(): StreamConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): PositionSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: {
    onConnectionChange?: (state: StreamConnectionState) => void;
    onPositionsUpdate?: (positions: WalletPositionData[]) => void;
    onPositionUpdate?: (position: WalletPositionData) => void;
    onError?: (error: StreamError) => void;
  }): void {
    if (callbacks.onConnectionChange)
      this.onConnectionChange = callbacks.onConnectionChange;
    if (callbacks.onPositionsUpdate)
      this.onPositionsUpdate = callbacks.onPositionsUpdate;
    if (callbacks.onPositionUpdate)
      this.onPositionUpdate = callbacks.onPositionUpdate;
    if (callbacks.onError) this.onError = callbacks.onError;
  }

  // Private methods

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log("Connected");
      this.setConnectionState("connected");
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.processPendingSubscriptions();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as PositionStreamMessage;
        this.handleMessage(message);
      } catch (error) {
        this.log("Failed to parse message:", error);
      }
    };

    this.ws.onerror = (error) => {
      this.log("WebSocket error:", error);
      this.setConnectionState("error");
    };

    this.ws.onclose = (event) => {
      this.log("Connection closed:", event.code, event.reason);
      this.clearTimers();

      if (event.code !== 1000) {
        // Abnormal closure
        this.scheduleReconnect();
      } else {
        this.setConnectionState("disconnected");
      }
    };
  }

  private handleMessage(message: PositionStreamMessage): void {
    // Handle pong response
    if ("event" in message) {
      if (message.event === "pong") {
        this.log("Received pong");
        return;
      }
      if (message.event === "subscribed") {
        this.log("Subscription confirmed:", message.subscriptionId);
        return;
      }
    }

    // Handle error
    if ("error" in message) {
      this.log("Error:", message.error);
      this.onError?.(message as StreamError);
      return;
    }

    // Handle positions update (all positions)
    if (this.isPositionsResponse(message)) {
      const positions = message.data.positions;
      this.log("Positions update:", positions.length, "positions");
      this.onPositionsUpdate?.(positions);
      return;
    }

    // Handle single position update
    if (this.isPositionResponse(message)) {
      const position = message.data;
      this.log("Position update:", position.token);
      this.onPositionUpdate?.(position);
      return;
    }
  }

  private isPositionsResponse(
    message: PositionStreamMessage,
  ): message is PositionsStreamResponse {
    return (
      "data" in message &&
      message.data !== null &&
      typeof message.data === "object" &&
      "positions" in message.data &&
      Array.isArray(message.data.positions)
    );
  }

  private isPositionResponse(
    message: PositionStreamMessage,
  ): message is PositionStreamResponse {
    return (
      "data" in message &&
      message.data !== null &&
      typeof message.data === "object" &&
      "wallet" in message.data &&
      "token" in message.data &&
      !("positions" in message.data)
    );
  }

  private sendPositionsSubscription(
    wallet: string,
    blockchain: ChainId,
    subscriptionId: string,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "positions",
      authorization: this.apiKey,
      payload: {
        wallet,
        blockchain,
        subscriptionId,
        subscriptionTracking: true,
      },
    };

    this.ws.send(JSON.stringify(message));
    this.log("Subscribed to positions for:", wallet, "on", blockchain);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      wallet,
      blockchain,
      type: "positions",
      subscribedAt: Date.now(),
    });
  }

  private sendPositionSubscription(
    wallet: string,
    token: string,
    blockchain: ChainId,
    subscriptionId: string,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "position",
      authorization: this.apiKey,
      payload: {
        wallet,
        token,
        blockchain,
        subscriptionId,
        subscriptionTracking: true,
      },
    };

    this.ws.send(JSON.stringify(message));
    this.log("Subscribed to position for:", wallet, token, "on", blockchain);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      wallet,
      token,
      blockchain,
      type: "position",
      subscribedAt: Date.now(),
    });
  }

  private processPendingSubscriptions(): void {
    const pending = [...this.pendingSubscriptions];
    this.pendingSubscriptions = [];

    pending.forEach(({ wallet, token, blockchain }) => {
      if (token) {
        this.subscribeToPosition(wallet, token, blockchain);
      } else {
        this.subscribeToPositions(wallet, blockchain);
      }
    });
  }

  private startPingInterval(): void {
    this.clearPingInterval();

    this.pingIntervalRef = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: "ping" }));
        this.log("Sent ping");
      }
    }, this.pingInterval);
  }

  private clearPingInterval(): void {
    if (this.pingIntervalRef) {
      clearInterval(this.pingIntervalRef);
      this.pingIntervalRef = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("Max reconnect attempts reached");
      this.setConnectionState("error");
      return;
    }

    this.setConnectionState("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000,
    );

    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeoutRef = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    this.clearPingInterval();

    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef);
      this.reconnectTimeoutRef = null;
    }
  }

  private setConnectionState(state: StreamConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.onConnectionChange?.(state);
    }
  }

  private generateSubscriptionId(
    type: "position" | "positions",
    wallet: string,
    blockchain: ChainId,
    token?: string,
  ): string {
    const base = `${type}-${wallet.toLowerCase()}-${blockchain}`;
    return token ? `${base}-${token.toLowerCase()}` : base;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[PositionStream]", ...args);
    }
  }
}

// Singleton instance
let positionStreamInstance: PositionStreamService | null = null;

/**
 * Get or create the position stream service singleton
 */
export function getPositionStreamService(
  options?: Partial<PositionStreamOptions>,
): PositionStreamService {
  if (!positionStreamInstance) {
    const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";
    positionStreamInstance = new PositionStreamService({
      apiKey,
      debug: __DEV__,
      ...options,
    });
  } else if (options) {
    // Update callbacks if provided
    positionStreamInstance.setCallbacks({
      onConnectionChange: options.onConnectionChange,
      onPositionsUpdate: options.onPositionsUpdate,
      onPositionUpdate: options.onPositionUpdate,
      onError: options.onError,
    });
  }

  return positionStreamInstance;
}

/**
 * Reset the position stream service (useful for testing)
 */
export function resetPositionStreamService(): void {
  if (positionStreamInstance) {
    positionStreamInstance.disconnect();
    positionStreamInstance = null;
  }
}
