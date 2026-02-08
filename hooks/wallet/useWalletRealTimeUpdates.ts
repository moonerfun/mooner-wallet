/**
 * useWalletRealTimeUpdates - Hook for real-time wallet updates
 * Combines position and transaction streams for the wallet screen
 *
 * Features:
 * - Auto-subscribes to all wallet addresses
 * - Multi-chain support (EVM + Solana)
 * - Live balance updates
 * - Transaction notifications
 */

import { useCallback, useEffect, useMemo } from "react";

import { SUPPORTED_CHAINS } from "@/constants/chains";
import { usePositionsStream } from "@/hooks/streaming/usePositionsStream";
import { useTransactionStream } from "@/hooks/streaming/useTransactionStream";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ChainId } from "@/types/positionStream";
import type { TransactionEventData } from "@/types/transactionStream";

// Derive supported chain IDs from centralized config
const EVM_CHAIN_IDS: ChainId[] = Object.values(SUPPORTED_CHAINS)
  .filter((c) => c.isEvm)
  .map((c) => c.mobulaChainId as ChainId);

const SOLANA_CHAIN_IDS: ChainId[] = ["solana:solana"];

export interface UseWalletRealTimeUpdatesOptions {
  /** Whether updates are enabled */
  enabled?: boolean;
  /** Callback when a new transaction is received */
  onTransaction?: (tx: TransactionEventData) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseWalletRealTimeUpdatesReturn {
  /** Whether position stream is connected */
  isPositionsConnected: boolean;
  /** Whether transaction stream is connected */
  isTransactionsConnected: boolean;
  /** Position stream error */
  positionsError: string | null;
  /** Transaction stream error */
  transactionsError: string | null;
  /** Recent transactions from stream */
  recentTransactions: TransactionEventData[];
  /** Reconnect all streams */
  reconnect: () => void;
  /** Disconnect all streams */
  disconnect: () => void;
}

/**
 * Hook for real-time wallet updates across multiple addresses and chains
 */
export function useWalletRealTimeUpdates(
  walletAddresses: string[],
  options: UseWalletRealTimeUpdatesOptions = {},
): UseWalletRealTimeUpdatesReturn {
  const { enabled = true, onTransaction, debug = false } = options;

  // Separate EVM and Solana addresses
  const { evmAddresses, solanaAddresses } = useMemo(() => {
    const evm: string[] = [];
    const solana: string[] = [];

    walletAddresses.forEach((addr) => {
      // Solana addresses are base58 encoded, typically 32-44 chars
      // EVM addresses start with 0x and are 42 chars
      if (addr.startsWith("0x") && addr.length === 42) {
        evm.push(addr);
      } else if (addr.length >= 32 && addr.length <= 44) {
        solana.push(addr);
      }
    });

    return { evmAddresses: evm, solanaAddresses: solana };
  }, [walletAddresses]);

  // EVM position stream - use first EVM address (they share the same address for all EVM chains)
  // Note: For EVM wallets, all chains share the same address, so subscribing once covers all chains
  const evmPositionsStream = usePositionsStream(evmAddresses[0], {
    enabled: enabled && evmAddresses.length > 0,
    chainIds: EVM_CHAIN_IDS,
    debug,
  });

  // Solana position stream - subscribe to all Solana addresses
  // Note: Users may have multiple Solana wallets with different addresses
  const solanaPositionsStream = usePositionsStream(solanaAddresses[0], {
    enabled: enabled && solanaAddresses.length > 0,
    chainIds: SOLANA_CHAIN_IDS,
    debug,
  });

  // Additional Solana streams for extra wallets (if any)
  const extraSolanaStream1 = usePositionsStream(solanaAddresses[1], {
    enabled: enabled && solanaAddresses.length > 1,
    chainIds: SOLANA_CHAIN_IDS,
    debug,
  });

  const extraSolanaStream2 = usePositionsStream(solanaAddresses[2], {
    enabled: enabled && solanaAddresses.length > 2,
    chainIds: SOLANA_CHAIN_IDS,
    debug,
  });

  // Transaction stream for all addresses
  const allAddresses = useMemo(
    () => [...evmAddresses, ...solanaAddresses],
    [evmAddresses, solanaAddresses],
  );

  const chainIds: ChainId[] = useMemo(() => {
    const chains: ChainId[] = [];
    if (evmAddresses.length > 0) {
      chains.push(...EVM_CHAIN_IDS);
    }
    if (solanaAddresses.length > 0) {
      chains.push(...SOLANA_CHAIN_IDS);
    }
    return chains;
  }, [evmAddresses, solanaAddresses]);

  const transactionStream = useTransactionStream(allAddresses, {
    enabled: enabled && allAddresses.length > 0,
    chainIds,
    events: ["swap", "transfer", "swap-enriched"],
    onTransaction,
    debug,
  });

  // Get cleanup action from store
  const cleanupStalePositions = usePortfolioStore(
    (state) => state.cleanupStalePositions,
  );

  // Periodic cleanup of stale positions (every 2 minutes)
  useEffect(() => {
    if (!enabled) return;

    const cleanupInterval = setInterval(
      () => {
        cleanupStalePositions();
      },
      2 * 60 * 1000,
    ); // 2 minutes

    return () => clearInterval(cleanupInterval);
  }, [enabled, cleanupStalePositions]);

  // Combined connection states
  const isPositionsConnected =
    evmPositionsStream.isConnected ||
    solanaPositionsStream.isConnected ||
    extraSolanaStream1.isConnected ||
    extraSolanaStream2.isConnected;

  const positionsError =
    evmPositionsStream.error ||
    solanaPositionsStream.error ||
    extraSolanaStream1.error ||
    extraSolanaStream2.error;

  // Reconnect function
  const reconnect = useCallback(() => {
    evmPositionsStream.reconnect();
    solanaPositionsStream.reconnect();
    extraSolanaStream1.reconnect();
    extraSolanaStream2.reconnect();
    transactionStream.reconnect();
  }, [
    evmPositionsStream,
    solanaPositionsStream,
    extraSolanaStream1,
    extraSolanaStream2,
    transactionStream,
  ]);

  // Disconnect function
  const disconnect = useCallback(() => {
    evmPositionsStream.disconnect();
    solanaPositionsStream.disconnect();
    extraSolanaStream1.disconnect();
    extraSolanaStream2.disconnect();
    transactionStream.disconnect();
  }, [
    evmPositionsStream,
    solanaPositionsStream,
    extraSolanaStream1,
    extraSolanaStream2,
    transactionStream,
  ]);

  return {
    isPositionsConnected,
    isTransactionsConnected: transactionStream.isConnected,
    positionsError,
    transactionsError: transactionStream.error,
    recentTransactions: transactionStream.recentTransactions,
    reconnect,
    disconnect,
  };
}
