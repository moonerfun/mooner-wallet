/**
 * TransactionHistoryModal - Modal for viewing transaction history
 *
 * Features:
 * - Historical transactions from Mobula API
 * - Real-time transactions from WebSocket stream
 * - Swaps, transfers, and enriched swap data
 * - Chain icons and token logos
 * - Transaction hash links to explorers
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { getExplorerTxUrl, MOBULA_CHAIN_ID_TO_KEY } from "@/constants/chains";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { useWalletRealTimeUpdates } from "@/hooks";
import { formatUSD, getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import type {
  SwapEnrichedEventData,
  SwapEventData,
  TransactionEventData,
  TransferEventData,
} from "@/types/transactionStream";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TransactionHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

// Helper to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Helper to format address
function formatAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to format amount
function formatAmount(amount: string, decimals: number = 18): string {
  const value = parseFloat(amount) / Math.pow(10, decimals);
  if (value < 0.0001) return "<0.0001";
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Transaction card component
function TransactionCard({
  transaction,
  theme,
  br,
  fs,
  sp,
}: {
  transaction: TransactionEventData;
  theme: any;
  br: any;
  fs: any;
  sp: any;
}) {
  const { chainKey, chainName } = useMemo(() => {
    const chainId = transaction.chainId;
    let key = "ethereum";
    if (typeof chainId === "string" && chainId.includes(":")) {
      const [, id] = chainId.split(":");
      if (id === "solana") key = "solana";
      else key = MOBULA_CHAIN_ID_TO_KEY[parseInt(id)] || "ethereum";
    } else if (typeof chainId === "number") {
      key = MOBULA_CHAIN_ID_TO_KEY[chainId] || "ethereum";
    }
    // Map chain key to display name
    const nameMap: Record<string, string> = {
      ethereum: "Ethereum",
      solana: "Solana",
      base: "Base",
      arbitrum: "Arbitrum",
      polygon: "Polygon",
      optimism: "Optimism",
      bnb: "BNB Chain",
      avalanche: "Avalanche",
    };
    return { chainKey: key, chainName: nameMap[key] || "Ethereum" };
  }, [transaction.chainId]);

  const handleOpenExplorer = useCallback(() => {
    const url = getExplorerTxUrl(chainKey, transaction.transactionHash);
    if (url) {
      Linking.openURL(url);
    }
  }, [chainKey, transaction.transactionHash]);

  // Render based on transaction type
  if (transaction.type === "transfer") {
    const tx = transaction as TransferEventData;
    return (
      <TouchableOpacity
        onPress={handleOpenExplorer}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: br.lg,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: `${theme.primary.DEFAULT}20` },
              ]}
            >
              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.primary.DEFAULT}
              />
            </View>
            <View style={styles.chainBadge}>
              <ChainIcon chainName={chainName} size={14} />
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
              Transfer
            </Text>
            <Text
              style={[styles.cardSubtitle, { color: theme.text.secondary }]}
            >
              {formatAddress(tx.from)} → {formatAddress(tx.to)}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.amount, { color: theme.text.primary }]}>
              {formatUSD(tx.amountUSD)}
            </Text>
            <Text style={[styles.time, { color: theme.text.muted }]}>
              {formatDate(tx.date)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (transaction.type === "swap" || transaction.type === "swap-enriched") {
    const tx = transaction as SwapEventData | SwapEnrichedEventData;
    const isEnriched = transaction.type === "swap-enriched";
    const enrichedTx = isEnriched
      ? (transaction as SwapEnrichedEventData)
      : null;

    return (
      <TouchableOpacity
        onPress={handleOpenExplorer}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: br.lg,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.typeIcon,
                {
                  backgroundColor:
                    enrichedTx?.side === "buy"
                      ? `${theme.success}20`
                      : `${theme.error}20`,
                },
              ]}
            >
              <Ionicons
                name="swap-horizontal"
                size={20}
                color={enrichedTx?.side === "buy" ? theme.success : theme.error}
              />
            </View>
            <View style={styles.chainBadge}>
              <ChainIcon chainName={chainName} size={14} />
            </View>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.swapTokens}>
              {isEnriched && enrichedTx?.baseToken?.logo && (
                <Image
                  source={{ uri: enrichedTx.baseToken.logo }}
                  style={styles.tokenLogo}
                />
              )}
              <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
                {isEnriched
                  ? `${enrichedTx?.side === "buy" ? "Buy" : "Sell"} ${enrichedTx?.baseToken?.symbol || "Token"}`
                  : "Swap"}
              </Text>
            </View>
            <Text
              style={[styles.cardSubtitle, { color: theme.text.secondary }]}
            >
              {isEnriched
                ? `${enrichedTx?.quoteToken?.symbol || "?"} → ${enrichedTx?.baseToken?.symbol || "?"}`
                : `${formatAddress(tx.tokenIn)} → ${formatAddress(tx.tokenOut)}`}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text
              style={[
                styles.amount,
                {
                  color:
                    enrichedTx?.side === "buy" ? theme.success : theme.error,
                },
              ]}
            >
              {formatUSD(tx.amountOutUSD || tx.amountInUSD)}
            </Text>
            <Text style={[styles.time, { color: theme.text.muted }]}>
              {formatDate(tx.date)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return null;
}

// Unified transaction item for display (combines API + stream data)
interface UnifiedTransaction {
  id: string;
  hash: string;
  type: "swap" | "transfer" | "buy" | "sell" | "unknown";
  timestamp: number;
  blockchain: string;
  chainName: string;
  amountUsd: number;
  fromAddress?: string;
  toAddress?: string;
  tokenIn?: {
    name: string;
    symbol: string;
    logo?: string;
    amount: number;
  };
  tokenOut?: {
    name: string;
    symbol: string;
    logo?: string;
    amount: number;
  };
  source: "api" | "stream";
}

// Card component for unified transactions
function UnifiedTransactionCard({
  transaction,
  theme,
  br,
}: {
  transaction: UnifiedTransaction;
  theme: any;
  br: any;
}) {
  const handleOpenExplorer = useCallback(() => {
    const chainKeyMap: Record<string, string> = {
      Ethereum: "ethereum",
      Solana: "solana",
      Base: "base",
      Arbitrum: "arbitrum",
      Polygon: "polygon",
      Optimism: "optimism",
      "BNB Chain": "bnb",
      "BNB Smart Chain (BEP20)": "bnb",
      Avalanche: "avalanche",
    };
    const chainKey =
      chainKeyMap[transaction.chainName] ||
      transaction.blockchain.toLowerCase();
    const url = getExplorerTxUrl(chainKey, transaction.hash);
    if (url) {
      Linking.openURL(url);
    }
  }, [transaction]);

  const isSwap =
    transaction.type === "swap" ||
    transaction.type === "buy" ||
    transaction.type === "sell";
  const isBuy = transaction.type === "buy";
  const isSell = transaction.type === "sell";

  const iconName = isSwap ? "swap-horizontal" : "arrow-forward";
  const iconColor = isBuy
    ? theme.success
    : isSell
      ? theme.error
      : theme.primary.DEFAULT;

  return (
    <TouchableOpacity
      onPress={handleOpenExplorer}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: br.lg,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <View
            style={[styles.typeIcon, { backgroundColor: `${iconColor}20` }]}
          >
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
          <View style={styles.chainBadge}>
            <ChainIcon chainName={transaction.chainName} size={14} />
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.swapTokens}>
            {transaction.tokenOut?.logo && (
              <Image
                source={{ uri: transaction.tokenOut.logo }}
                style={styles.tokenLogo}
              />
            )}
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
              {isSwap
                ? `${isBuy ? "Buy" : isSell ? "Sell" : "Swap"} ${transaction.tokenOut?.symbol || "Token"}`
                : "Transfer"}
            </Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.text.secondary }]}>
            {isSwap && transaction.tokenIn && transaction.tokenOut
              ? `${transaction.tokenIn.symbol} → ${transaction.tokenOut.symbol}`
              : transaction.fromAddress && transaction.toAddress
                ? `${formatAddress(transaction.fromAddress)} → ${formatAddress(transaction.toAddress)}`
                : transaction.chainName}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text
            style={[
              styles.amount,
              {
                color: isBuy
                  ? theme.success
                  : isSell
                    ? theme.error
                    : theme.text.primary,
              },
            ]}
          >
            {formatUSD(transaction.amountUsd)}
          </Text>
          <Text style={[styles.time, { color: theme.text.muted }]}>
            {formatTimestamp(transaction.timestamp)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Helper to format timestamp
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function TransactionHistoryModal({
  visible,
  onClose,
}: TransactionHistoryModalProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const { consolidatedWallets } = useWallet();

  // API transaction state
  const [apiTransactions, setApiTransactions] = useState<UnifiedTransaction[]>(
    [],
  );
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get all wallet addresses
  const allWalletAddresses = useMemo(() => {
    return consolidatedWallets.map((wallet) => wallet.address).filter(Boolean);
  }, [consolidatedWallets]);

  // Get real-time transactions from stream
  const { recentTransactions, isTransactionsConnected } =
    useWalletRealTimeUpdates(allWalletAddresses, {
      enabled: visible && allWalletAddresses.length > 0,
    });

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    if (allWalletAddresses.length === 0) return;

    setIsLoadingApi(true);
    try {
      const client = getMobulaClient();
      const response = await client.fetchWalletTransactions({
        wallets: allWalletAddresses.join(","),
        limit: "50",
        order: "desc",
      });

      if (response.data?.transactions) {
        const transactions: UnifiedTransaction[] =
          response.data.transactions.map((tx: any, index: number) => {
            // Map blockchain name to display name
            const chainNameMap: Record<string, string> = {
              ethereum: "Ethereum",
              solana: "Solana",
              base: "Base",
              arbitrum: "Arbitrum",
              polygon: "Polygon",
              optimism: "Optimism",
              bnb: "BNB Chain",
              "bnb smart chain (bep20)": "BNB Chain",
              avalanche: "Avalanche",
            };

            const blockchain = (tx.blockchain || "ethereum").toLowerCase();
            const chainName =
              chainNameMap[blockchain] || tx.blockchain || "Ethereum";

            // Calculate USD value - try amount_usd first, then calculate from amount * price
            let amountUsd = tx.amount_usd || 0;
            if (!amountUsd && tx.amount && tx.asset?.price) {
              // amount might already be in decimal format or need decimals adjustment
              const decimals = tx.asset.decimals || 18;
              const rawAmount =
                typeof tx.amount === "string"
                  ? parseFloat(tx.amount)
                  : tx.amount;
              // Check if amount is already normalized (small number) or raw (large number)
              const normalizedAmount =
                rawAmount > 1e10
                  ? rawAmount / Math.pow(10, decimals)
                  : rawAmount;
              amountUsd = normalizedAmount * tx.asset.price;
            }

            return {
              id: `api-${tx.hash || tx.timestamp}-${index}`,
              hash: tx.hash || "",
              type: tx.type || "unknown",
              timestamp: tx.timestamp || Date.now(),
              blockchain,
              chainName,
              amountUsd,
              fromAddress: tx.from,
              toAddress: tx.to,
              tokenIn: tx.asset
                ? {
                    name: tx.asset.name || "Unknown",
                    symbol: tx.asset.symbol || "???",
                    logo: tx.asset.logo,
                    amount: tx.amount || 0,
                  }
                : undefined,
              tokenOut: tx.asset
                ? {
                    name: tx.asset.name || "Unknown",
                    symbol: tx.asset.symbol || "???",
                    logo: tx.asset.logo,
                    amount: tx.amount || 0,
                  }
                : undefined,
              source: "api" as const,
            };
          });

        // Debug: Log transactions with $0 values to diagnose
        const zeroValueTxs = transactions.filter((tx) => tx.amountUsd === 0);
        if (zeroValueTxs.length > 0) {
          console.log(
            "[TransactionHistoryModal] Transactions with $0 value:",
            zeroValueTxs.length,
          );
          console.log(
            "[TransactionHistoryModal] Sample raw tx:",
            JSON.stringify(response.data.transactions[0], null, 2),
          );
        }

        setApiTransactions(transactions);
      }
    } catch (error) {
      console.error(
        "[TransactionHistoryModal] Failed to fetch transactions:",
        error,
      );
    } finally {
      setIsLoadingApi(false);
    }
  }, [allWalletAddresses]);

  // Fetch on modal open
  useEffect(() => {
    if (visible && allWalletAddresses.length > 0) {
      fetchTransactions();
    }
  }, [visible, allWalletAddresses.length, fetchTransactions]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [fetchTransactions]);

  // Convert stream transactions to unified format
  const streamTransactionsUnified = useMemo((): UnifiedTransaction[] => {
    return recentTransactions.map((tx, index) => {
      const chainId = tx.chainId;
      let chainKey = "ethereum";
      if (typeof chainId === "string" && chainId.includes(":")) {
        const [, id] = chainId.split(":");
        if (id === "solana") chainKey = "solana";
        else chainKey = MOBULA_CHAIN_ID_TO_KEY[parseInt(id)] || "ethereum";
      } else if (typeof chainId === "number") {
        chainKey = MOBULA_CHAIN_ID_TO_KEY[chainId] || "ethereum";
      }

      const chainNameMap: Record<string, string> = {
        ethereum: "Ethereum",
        solana: "Solana",
        base: "Base",
        arbitrum: "Arbitrum",
        polygon: "Polygon",
        optimism: "Optimism",
        bnb: "BNB Chain",
        avalanche: "Avalanche",
      };

      const chainName = chainNameMap[chainKey] || "Ethereum";

      if (tx.type === "transfer") {
        const transferTx = tx as TransferEventData;
        return {
          id: `stream-${tx.transactionHash}-${index}`,
          hash: tx.transactionHash,
          type: "transfer" as const,
          timestamp: new Date(tx.date).getTime(),
          blockchain: chainKey,
          chainName,
          amountUsd: transferTx.amountUSD || 0,
          fromAddress: transferTx.from,
          toAddress: transferTx.to,
          source: "stream" as const,
        };
      }

      const swapTx = tx as SwapEventData | SwapEnrichedEventData;
      const isEnriched = tx.type === "swap-enriched";
      const enrichedTx = isEnriched ? (tx as SwapEnrichedEventData) : null;

      return {
        id: `stream-${tx.transactionHash}-swap-${index}`,
        hash: tx.transactionHash,
        type:
          enrichedTx?.side === "buy"
            ? "buy"
            : enrichedTx?.side === "sell"
              ? "sell"
              : "swap",
        timestamp: new Date(tx.date).getTime(),
        blockchain: chainKey,
        chainName,
        amountUsd: swapTx.amountOutUSD || swapTx.amountInUSD || 0,
        tokenIn: enrichedTx?.quoteToken
          ? {
              name: enrichedTx.quoteToken.name || "Unknown",
              symbol: enrichedTx.quoteToken.symbol || "???",
              logo: enrichedTx.quoteToken.logo,
              amount: parseFloat(swapTx.amountIn) || 0,
            }
          : undefined,
        tokenOut: enrichedTx?.baseToken
          ? {
              name: enrichedTx.baseToken.name || "Unknown",
              symbol: enrichedTx.baseToken.symbol || "???",
              logo: enrichedTx.baseToken.logo,
              amount: parseFloat(swapTx.amountOut) || 0,
            }
          : undefined,
        source: "stream" as const,
      };
    });
  }, [recentTransactions]);

  // Merge and dedupe transactions (stream takes priority for recent ones)
  const allTransactions = useMemo((): UnifiedTransaction[] => {
    const streamHashes = new Set(streamTransactionsUnified.map((t) => t.hash));
    const dedupedApi = apiTransactions.filter((t) => !streamHashes.has(t.hash));

    // Combine: stream first (newest), then API
    const combined = [...streamTransactionsUnified, ...dedupedApi];

    // Sort by timestamp descending
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [streamTransactionsUnified, apiTransactions]);

  const renderTransaction = useCallback(
    ({ item }: { item: UnifiedTransaction }) => (
      <UnifiedTransactionCard transaction={item} theme={theme} br={br} />
    ),
    [theme, br],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        {isLoadingApi ? (
          <>
            <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              Loading Transactions...
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name="receipt-outline"
              size={64}
              color={theme.text.muted}
            />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              No Transactions Yet
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: theme.text.secondary }]}
            >
              Your transaction history will appear here as you make swaps and
              transfers.
            </Text>
          </>
        )}
        {isTransactionsConnected && (
          <View style={styles.connectionStatus}>
            <View
              style={[styles.liveDot, { backgroundColor: theme.success }]}
            />
            <Text
              style={[styles.connectionText, { color: theme.text.secondary }]}
            >
              Live updates active
            </Text>
          </View>
        )}
      </View>
    ),
    [theme, isTransactionsConnected, isLoadingApi],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Transaction History
          </Text>
          <View style={styles.placeholder}>
            {isTransactionsConnected && (
              <View
                style={[
                  styles.liveIndicator,
                  { backgroundColor: theme.success },
                ]}
              />
            )}
          </View>
        </View>

        {/* Transaction List */}
        <FlatList
          data={allTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            allTransactions.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary.DEFAULT}
            />
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    position: "relative",
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  chainBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 13,
  },
  swapTokens: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  connectionText: {
    fontSize: 13,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
