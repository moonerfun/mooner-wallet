/**
 * usePositionsStream - React hook for real-time wallet position updates
 * Connects to Mobula's positions WebSocket stream
 *
 * Features:
 * - Auto-connect/disconnect on wallet changes
 * - Multi-chain support (EVM + Solana)
 * - Batched updates to prevent UI freezing
 * - Automatic reconnection with exponential backoff
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getPositionStreamService,
  PositionStreamService,
} from "@/lib/streaming/positionStreamService";
import { usePortfolioStore } from "@/store/portfolioStore";
import type {
  ChainId,
  StreamConnectionState,
  StreamError,
  WalletPositionData,
} from "@/types/positionStream";
import { UpdateBatcher } from "@/utils/UpdateBatcher";

export interface UsePositionsStreamOptions {
  /** Whether the stream is enabled */
  enabled?: boolean;
  /** Chain IDs to subscribe to */
  chainIds?: ChainId[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface UsePositionsStreamReturn {
  /** Current connection state */
  connectionState: StreamConnectionState;
  /** Whether connected to the stream */
  isConnected: boolean;
  /** Current error if any */
  error: string | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect from stream */
  disconnect: () => void;
}

/**
 * Hook to subscribe to real-time position updates for a wallet
 */
export function usePositionsStream(
  walletAddress: string | undefined,
  options: UsePositionsStreamOptions = {},
): UsePositionsStreamReturn {
  const {
    enabled = true,
    chainIds = ["evm:1", "solana:solana"],
    debug = false,
  } = options;

  const [connectionState, setConnectionState] =
    useState<StreamConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<PositionStreamService | null>(null);
  const subscriptionIdsRef = useRef<string[]>([]);

  // Get portfolio store actions
  const updatePositionsFromStream = usePortfolioStore(
    (state) => state.updatePositionsFromStream,
  );
  const setPositionsStreamConnected = usePortfolioStore(
    (state) => state.setPositionsStreamConnected,
  );

  // Position update batcher to prevent UI freezing
  const batcherRef = useRef<UpdateBatcher<WalletPositionData>>(
    new UpdateBatcher<WalletPositionData>(
      (positions) => {
        // Deduplicate by keeping latest update per token
        const latestByToken = new Map<string, WalletPositionData>();
        positions.forEach((pos) => {
          const key = `${pos.chainId}-${pos.token.toLowerCase()}`;
          latestByToken.set(key, pos);
        });

        // Update store with latest positions
        const deduped = Array.from(latestByToken.values());
        updatePositionsFromStream(deduped);
      },
      50, // 50ms debounce
      200, // 200ms max delay
    ),
  );

  // Handle positions update from stream
  const handlePositionsUpdate = useCallback(
    (positions: WalletPositionData[]) => {
      if (debug) {
        console.log(
          "[usePositionsStream] Received",
          positions.length,
          "positions",
        );
      }

      // Queue all positions for batched update
      positions.forEach((pos) => {
        batcherRef.current.add(pos);
      });
    },
    [debug],
  );

  // Handle single position update
  const handlePositionUpdate = useCallback(
    (position: WalletPositionData) => {
      if (debug) {
        console.log("[usePositionsStream] Position update:", position.token);
      }

      batcherRef.current.add(position);
    },
    [debug],
  );

  // Handle connection state change
  const handleConnectionChange = useCallback(
    (state: StreamConnectionState) => {
      setConnectionState(state);
      setPositionsStreamConnected(state === "connected");

      if (state === "connected") {
        setError(null);
      }
    },
    [setPositionsStreamConnected],
  );

  // Handle errors
  const handleError = useCallback((err: StreamError) => {
    console.error("[usePositionsStream] Error:", err.error);
    setError(err.error);
  }, []);

  // Initialize service
  useEffect(() => {
    if (!enabled) return;

    serviceRef.current = getPositionStreamService({
      debug,
      onConnectionChange: handleConnectionChange,
      onPositionsUpdate: handlePositionsUpdate,
      onPositionUpdate: handlePositionUpdate,
      onError: handleError,
    });

    return () => {
      // Cleanup batcher on unmount
      batcherRef.current.flushSync();
    };
  }, [
    enabled,
    debug,
    handleConnectionChange,
    handlePositionsUpdate,
    handlePositionUpdate,
    handleError,
  ]);

  // Subscribe to wallet positions when wallet changes
  useEffect(() => {
    if (!enabled || !walletAddress || !serviceRef.current) {
      return;
    }

    const service = serviceRef.current;

    // Unsubscribe from previous subscriptions
    subscriptionIdsRef.current.forEach((id) => {
      service.unsubscribe(id);
    });
    subscriptionIdsRef.current = [];

    // Subscribe to each chain
    chainIds.forEach((chainId) => {
      const subscriptionId = service.subscribeToPositions(
        walletAddress,
        chainId,
      );
      subscriptionIdsRef.current.push(subscriptionId);

      if (debug) {
        console.log(
          "[usePositionsStream] Subscribed to",
          walletAddress,
          "on",
          chainId,
        );
      }
    });

    // Cleanup on wallet change or unmount
    return () => {
      subscriptionIdsRef.current.forEach((id) => {
        service.unsubscribe(id);
      });
      subscriptionIdsRef.current = [];
    };
  }, [enabled, walletAddress, chainIds.join(","), debug]);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current.connect();
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    error,
    reconnect,
    disconnect,
  };
}

/**
 * Hook to subscribe to a single token position for a wallet
 * Useful for tracking a specific token during swaps
 */
export function usePositionStream(
  walletAddress: string | undefined,
  tokenAddress: string | undefined,
  blockchain: ChainId = "evm:1",
  options: { enabled?: boolean; debug?: boolean } = {},
): UsePositionsStreamReturn {
  const { enabled = true, debug = false } = options;

  const [connectionState, setConnectionState] =
    useState<StreamConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<PositionStreamService | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);

  const updatePositionFromStream = usePortfolioStore(
    (state) => state.updatePositionFromStream,
  );
  const setPositionsStreamConnected = usePortfolioStore(
    (state) => state.setPositionsStreamConnected,
  );

  // Handle position update
  const handlePositionUpdate = useCallback(
    (position: WalletPositionData) => {
      if (debug) {
        console.log("[usePositionStream] Position update:", position.token);
      }
      updatePositionFromStream(position);
    },
    [debug, updatePositionFromStream],
  );

  // Handle connection state change
  const handleConnectionChange = useCallback(
    (state: StreamConnectionState) => {
      setConnectionState(state);
      setPositionsStreamConnected(state === "connected");
      if (state === "connected") {
        setError(null);
      }
    },
    [setPositionsStreamConnected],
  );

  // Handle errors
  const handleError = useCallback((err: StreamError) => {
    console.error("[usePositionStream] Error:", err.error);
    setError(err.error);
  }, []);

  // Initialize service
  useEffect(() => {
    if (!enabled) return;

    serviceRef.current = getPositionStreamService({
      debug,
      onConnectionChange: handleConnectionChange,
      onPositionUpdate: handlePositionUpdate,
      onError: handleError,
    });
  }, [
    enabled,
    debug,
    handleConnectionChange,
    handlePositionUpdate,
    handleError,
  ]);

  // Subscribe to token position
  useEffect(() => {
    if (!enabled || !walletAddress || !tokenAddress || !serviceRef.current) {
      return;
    }

    const service = serviceRef.current;

    // Unsubscribe from previous
    if (subscriptionIdRef.current) {
      service.unsubscribe(subscriptionIdRef.current);
    }

    // Subscribe to new position
    subscriptionIdRef.current = service.subscribeToPosition(
      walletAddress,
      tokenAddress,
      blockchain,
    );

    if (debug) {
      console.log(
        "[usePositionStream] Subscribed to",
        walletAddress,
        tokenAddress,
        blockchain,
      );
    }

    return () => {
      if (subscriptionIdRef.current) {
        service.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [enabled, walletAddress, tokenAddress, blockchain, debug]);

  const reconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    error,
    reconnect,
    disconnect,
  };
}
