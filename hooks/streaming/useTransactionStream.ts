/**
 * useTransactionStream - React hook for real-time wallet transaction updates
 * Connects to Mobula's Multi-Events WebSocket stream
 *
 * Features:
 * - Track swaps and transfers for wallet addresses
 * - Separate EVM and Solana connections
 * - Real-time transaction notifications
 * - Automatic reconnection
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getTransactionStreamService,
  TransactionStreamService,
} from "@/lib/streaming/transactionStreamService";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ChainId } from "@/types/positionStream";
import type {
  TransactionEventData,
  TransactionEventType,
  TransactionStreamConnectionState,
  TransactionStreamError,
} from "@/types/transactionStream";

export interface UseTransactionStreamOptions {
  /** Whether the stream is enabled */
  enabled?: boolean;
  /** Chain IDs to subscribe to */
  chainIds?: ChainId[];
  /** Event types to subscribe to */
  events?: TransactionEventType[];
  /** Callback when a transaction is received */
  onTransaction?: (transaction: TransactionEventData) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseTransactionStreamReturn {
  /** Current connection states */
  connectionState: {
    evm: TransactionStreamConnectionState;
    solana: TransactionStreamConnectionState;
  };
  /** Whether any connection is active */
  isConnected: boolean;
  /** Current error if any */
  error: string | null;
  /** Recent transactions (last 50) */
  recentTransactions: TransactionEventData[];
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect from stream */
  disconnect: () => void;
}

/**
 * Hook to subscribe to real-time transaction updates for wallets
 */
export function useTransactionStream(
  walletAddresses: string[],
  options: UseTransactionStreamOptions = {},
): UseTransactionStreamReturn {
  const {
    enabled = true,
    chainIds = ["evm:1", "solana:solana"],
    events = ["swap", "transfer", "swap-enriched"],
    onTransaction,
    debug = false,
  } = options;

  const [connectionState, setConnectionState] = useState<{
    evm: TransactionStreamConnectionState;
    solana: TransactionStreamConnectionState;
  }>({
    evm: "disconnected",
    solana: "disconnected",
  });
  const [error, setError] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<
    TransactionEventData[]
  >([]);

  const serviceRef = useRef<TransactionStreamService | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const onTransactionRef = useRef(onTransaction);

  // Keep callback ref updated
  useEffect(() => {
    onTransactionRef.current = onTransaction;
  }, [onTransaction]);

  // Get portfolio store actions
  const addTransactionFromStream = usePortfolioStore(
    (state) => state.addTransactionFromStream,
  );

  // Handle transaction event
  const handleTransaction = useCallback(
    (transaction: TransactionEventData) => {
      if (debug) {
        console.log(
          "[useTransactionStream] Transaction:",
          transaction.type,
          transaction.transactionHash.slice(0, 10),
        );
      }

      // Add to recent transactions (keep last 50)
      setRecentTransactions((prev) => {
        const updated = [transaction, ...prev].slice(0, 50);
        return updated;
      });

      // Update portfolio store
      addTransactionFromStream(transaction);

      // Call user callback
      onTransactionRef.current?.(transaction);
    },
    [debug, addTransactionFromStream],
  );

  // Handle connection state change
  const handleConnectionChange = useCallback(
    (state: TransactionStreamConnectionState) => {
      // Get current connection states from service
      if (serviceRef.current) {
        const states = serviceRef.current.getConnectionState();
        setConnectionState(states);
      }

      if (state === "connected") {
        setError(null);
      }
    },
    [],
  );

  // Handle errors
  const handleError = useCallback((err: TransactionStreamError) => {
    console.error("[useTransactionStream] Error:", err.error);
    setError(err.error);
  }, []);

  // Initialize service
  useEffect(() => {
    if (!enabled) return;

    serviceRef.current = getTransactionStreamService({
      debug,
      onConnectionChange: handleConnectionChange,
      onTransaction: handleTransaction,
      onError: handleError,
    });
  }, [enabled, debug, handleConnectionChange, handleTransaction, handleError]);

  // Subscribe to wallet transactions when wallets change
  useEffect(() => {
    if (!enabled || walletAddresses.length === 0 || !serviceRef.current) {
      return;
    }

    const service = serviceRef.current;

    // Unsubscribe from previous
    if (subscriptionIdRef.current) {
      service.unsubscribe(subscriptionIdRef.current);
    }

    // Subscribe to new wallets
    subscriptionIdRef.current = service.subscribeToWalletTransactions(
      walletAddresses,
      {
        chainIds,
        events,
        name: `wallet-txs-${Date.now()}`,
      },
    );

    if (debug) {
      console.log(
        "[useTransactionStream] Subscribed to",
        walletAddresses.length,
        "wallets",
      );
    }

    // Cleanup on wallet change or unmount
    return () => {
      if (subscriptionIdRef.current) {
        service.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [
    enabled,
    walletAddresses.join(","),
    chainIds.join(","),
    events.join(","),
    debug,
  ]);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();

      // Reconnect based on chains
      const hasEvm = chainIds.some((c) => c.startsWith("evm:"));
      const hasSolana = chainIds.some(
        (c) => c.startsWith("solana:") || c === "solana",
      );

      if (hasEvm) serviceRef.current.connectEvm();
      if (hasSolana) serviceRef.current.connectSolana();
    }
  }, [chainIds]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);

  return {
    connectionState,
    isConnected:
      connectionState.evm === "connected" ||
      connectionState.solana === "connected",
    error,
    recentTransactions,
    reconnect,
    disconnect,
  };
}

/**
 * Hook to get real-time swap notifications for a wallet
 * Useful for swap confirmations and status updates
 */
export function useSwapStream(
  walletAddress: string | undefined,
  options: {
    enabled?: boolean;
    chainId?: ChainId;
    onSwap?: (swap: TransactionEventData) => void;
    debug?: boolean;
  } = {},
): {
  isConnected: boolean;
  lastSwap: TransactionEventData | null;
  error: string | null;
} {
  const { enabled = true, chainId = "evm:1", onSwap, debug = false } = options;

  const [lastSwap, setLastSwap] = useState<TransactionEventData | null>(null);

  const handleTransaction = useCallback(
    (tx: TransactionEventData) => {
      if (tx.type === "swap" || tx.type === "swap-enriched") {
        setLastSwap(tx);
        onSwap?.(tx);
      }
    },
    [onSwap],
  );

  const { isConnected, error } = useTransactionStream(
    walletAddress ? [walletAddress] : [],
    {
      enabled: enabled && !!walletAddress,
      chainIds: [chainId],
      events: ["swap", "swap-enriched"],
      onTransaction: handleTransaction,
      debug,
    },
  );

  return {
    isConnected,
    lastSwap,
    error,
  };
}
