import {
  Button,
  Card,
  PortfolioAssetCard,
  QuickActions,
  ReceiveModal,
  SendModal,
  TransactionHistoryModal,
  UnifiedHeader,
  WalletCard,
  WalletTabsSection,
} from "@/components";
import { getChainKey } from "@/constants/chains";
import { DEFAULT_WALLET_CONFIG, NetworkKey } from "@/constants/turnkey";
import { useTheme } from "@/contexts/ThemeContext";
import { ConsolidatedWallet, useWallet } from "@/contexts/WalletContext";
import { useWalletRealTimeUpdates } from "@/hooks";
import { formatPercentage, formatUSD } from "@/lib/api/mobula/mobulaClient";
import { usePortfolioStore, useSettingsStore } from "@/store";
import { Ionicons } from "@expo/vector-icons";
import { AuthState, useTurnkey } from "@turnkey/react-native-wallet-kit";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function WalletScreen() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate bottom padding to ensure content scrolls above tab bar
  // Tab bar height is 56 + bottom safe area, plus some extra padding
  const tabBarHeight =
    56 +
    Platform.select({
      android: Math.max(insets.bottom, 16),
      ios: insets.bottom,
      default: insets.bottom,
    });
  const contentPaddingBottom = tabBarHeight + 16;

  const {
    wallets,
    accounts,
    consolidatedWallets,
    setWallets,
    setAccounts,
    setUser,
    setSelectedWallet,
    formatAddress,
    // Portfolio from shared context (no duplicate API calls!)
    portfolio,
    portfolioBalance: totalBalanceUsd,
    portfolioChange24h: totalChange24h,
    portfolioChangePercentage24h: totalChangePercentage24h,
    isLoadingPortfolio,
    refetchPortfolio,
  } = useWallet();

  // Get portfolio assets from the shared portfolio
  const portfolios = portfolio ? [portfolio] : [];

  // All wallet addresses for real-time updates hook
  const allWalletAddresses = useMemo(() => {
    return consolidatedWallets.map((wallet) => wallet.address).filter(Boolean);
  }, [consolidatedWallets]);

  // Get persisted wallet selection
  const selectedWalletId = useSettingsStore((s) => s.selectedWalletId);
  const setSelectedWalletId = useSettingsStore((s) => s.setSelectedWalletId);
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);

  const {
    fetchWallets,
    fetchWalletAccounts,
    createWallet,
    user: turnkeyUser,
    authState,
  } = useTurnkey();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Listen for transaction completion triggers from swap/trade modals
  const lastTransactionTimestamp = usePortfolioStore(
    (state) => state.lastTransactionTimestamp,
  );
  const clearPendingRefresh = usePortfolioStore(
    (state) => state.clearPendingRefresh,
  );

  // Track the last processed transaction timestamp
  const lastProcessedTimestampRef = useRef(0);

  // When a transaction completes, force refresh the portfolio and reconnect streams
  useEffect(() => {
    if (
      lastTransactionTimestamp > 0 &&
      lastTransactionTimestamp > lastProcessedTimestampRef.current
    ) {
      console.log(
        "[WalletScreen] Transaction completed, refreshing portfolio...",
      );
      lastProcessedTimestampRef.current = lastTransactionTimestamp;

      // Delay slightly to allow blockchain state to update
      const refreshTimeout = setTimeout(() => {
        refetchPortfolio();
        clearPendingRefresh();
      }, 1000);

      // Additional refresh after 3 seconds to catch any delayed updates
      const delayedRefreshTimeout = setTimeout(() => {
        refetchPortfolio();
      }, 3000);

      return () => {
        clearTimeout(refreshTimeout);
        clearTimeout(delayedRefreshTimeout);
      };
    }
  }, [lastTransactionTimestamp, refetchPortfolio, clearPendingRefresh]);

  // Real-time WebSocket updates for positions and transactions
  const {
    isPositionsConnected,
    isTransactionsConnected,
    recentTransactions,
    reconnect: reconnectStreams,
  } = useWalletRealTimeUpdates(allWalletAddresses, {
    enabled: allWalletAddresses.length > 0,
    // Note: Transaction toasts removed - swap/trade modals already show success toasts
    // Duplicate toasts were being triggered for each transaction event
  });

  // Calculate per-chain balances from portfolio data
  // Maps chain key to total USD balance for that chain
  const chainBalances = useMemo(() => {
    const balances: Record<string, number> = {};

    // Iterate through all portfolios and their assets
    portfolios.forEach((portfolio) => {
      portfolio.assets.forEach((asset) => {
        // cross_chain_balances contains per-chain balance info
        if (asset.crossChainBalances) {
          Object.entries(asset.crossChainBalances).forEach(
            ([chainName, chainData]) => {
              // Calculate USD value for this chain's balance of this asset
              const chainBalance = chainData.balance || 0;
              const usdValue = chainBalance * (asset.price || 0);

              // Normalize Mobula chain name to our chain key using alias matching
              // e.g., "BNB Smart Chain (BEP20)" -> "bnb"
              const chainKey = getChainKey(chainName);
              const normalizedChain = chainKey || chainName.toLowerCase();
              balances[normalizedChain] =
                (balances[normalizedChain] || 0) + usdValue;
            },
          );
        }
      });
    });

    return balances;
  }, [portfolios]);

  // Deduplicate assets from portfolio to avoid duplicate key errors
  // The Mobula API can return the same asset multiple times (e.g., same token on same chain)
  // Also filter out tokens with value less than $0.1 to hide dust
  const deduplicatedAssets = useMemo(() => {
    if (!portfolios.length || !portfolios[0]?.assets?.length) {
      return [];
    }

    const seen = new Set<string>();
    return portfolios[0].assets.filter((asset) => {
      // Filter out tokens with value less than $0.1
      if ((asset.valueUsd || 0) < 0.1) {
        return false;
      }
      // Create a unique key based on blockchain and address
      const key = `${asset.blockchain || "unknown"}-${asset.address || asset.symbol}`;
      if (seen.has(key)) {
        return false; // Skip duplicate
      }
      seen.add(key);
      return true;
    });
  }, [portfolios]);

  // Helper to get total balance for a consolidated wallet
  const getWalletBalance = useCallback(
    (wallet: ConsolidatedWallet): number => {
      let total = 0;
      wallet.availableNetworks.forEach((networkKey) => {
        // Look up by chain key (normalized from Mobula chain names)
        total += chainBalances[networkKey] || 0;
      });
      return total;
    },
    [chainBalances],
  );

  // Helper to get per-network balances for a consolidated wallet
  const getNetworkBalances = useCallback(
    (
      wallet: ConsolidatedWallet,
    ): { network: NetworkKey; balanceUsd: number }[] => {
      return wallet.availableNetworks.map((networkKey) => {
        // Look up by chain key (normalized from Mobula chain names)
        const balanceUsd = chainBalances[networkKey] || 0;
        return { network: networkKey, balanceUsd };
      });
    },
    [chainBalances],
  );

  // Calculate display values
  const isPositiveChange = totalChange24h >= 0;

  // Modal states
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Handle send modal close - reconnect streams after transfer
  const handleSendModalClose = useCallback(() => {
    setShowSendModal(false);
    // Reconnect streams in case they disconnected during send
    setTimeout(() => {
      reconnectStreams();
      refetchPortfolio();
    }, 500);
  }, [reconnectStreams, refetchPortfolio]);

  // Load wallets and accounts
  const loadWalletData = useCallback(async () => {
    try {
      setLoading(true);

      // Set user from Turnkey
      if (turnkeyUser) {
        setUser(turnkeyUser);
      }

      // Fetch wallets
      const walletList = await fetchWallets?.();
      if (walletList && walletList.length > 0) {
        setWallets(walletList);

        // Find the wallet to use - either persisted selection or first wallet
        let targetWallet = walletList[0];

        if (selectedWalletId) {
          const persistedWallet = walletList.find(
            (w: any) => w.walletId === selectedWalletId,
          );
          if (persistedWallet) {
            targetWallet = persistedWallet;
          } else {
            // Persisted wallet not found, use first wallet and update storage
            setSelectedWalletId(targetWallet.walletId);
          }
        } else {
          // No persisted selection, save first wallet as default
          setSelectedWalletId(targetWallet.walletId);
        }

        // Set the selected wallet in context
        setSelectedWallet(targetWallet);

        // Fetch accounts for the selected wallet
        const walletAccounts = await fetchWalletAccounts?.({
          wallet: targetWallet,
        });
        if (walletAccounts) {
          // Map to our format with address field
          const mappedAccounts = walletAccounts.map((acc: any) => ({
            addressFormat: acc.addressFormat,
            address: acc.address,
            path: acc.path,
            curve: acc.curve,
            pathFormat: acc.pathFormat,
          }));
          setAccounts(mappedAccounts);
        }
      } else {
        // No wallets, create one
        await handleCreateWallet();
      }
    } catch (err) {
      console.error("Error loading wallet data:", err);
    } finally {
      setLoading(false);
    }
  }, [
    fetchWallets,
    fetchWalletAccounts,
    turnkeyUser,
    selectedWalletId,
    setSelectedWalletId,
    setSelectedWallet,
  ]);

  // Create new wallet
  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      const result = await createWallet?.({
        walletName: DEFAULT_WALLET_CONFIG.walletName,
        accounts: DEFAULT_WALLET_CONFIG.walletAccounts,
      });

      if (result) {
        // Reload wallet data
        await loadWalletData();
      }
    } catch (err: any) {
      console.error("Error creating wallet:", err);
      Alert.alert("Error", "Failed to create wallet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadWalletData(), refetchPortfolio()]);
    setRefreshing(false);
  }, [loadWalletData, refetchPortfolio]);

  // Copy address to clipboard
  const handleCopyAddress = async (address: string, chainName: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied!", `${chainName} address copied to clipboard`);
  };

  // Quick actions
  const quickActions = [
    {
      id: "receive",
      title: "Receive",
      icon: "arrow-down" as const,
      onPress: () => {
        setShowReceiveModal(true);
      },
    },
    {
      id: "send",
      title: "Send",
      icon: "arrow-up" as const,
      onPress: () => {
        setShowSendModal(true);
      },
    },
    {
      id: "history",
      title: "History",
      icon: "time-outline" as const,
      onPress: () => {
        setShowHistoryModal(true);
      },
    },
    {
      id: "buy",
      title: "Buy",
      icon: "card" as const,
      onPress: () => {
        Alert.alert("Coming Soon", "Buy feature will be available soon!");
      },
    },
  ];

  // Load data on mount - wait for settings to hydrate first
  useEffect(() => {
    if (authState === AuthState.Authenticated && hasHydrated) {
      loadWalletData();
    }
  }, [authState, hasHydrated]);

  const isInitialLoading = loading && accounts.length === 0;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {/* Header - always visible */}
      <UnifiedHeader
        onProfilePress={() => router.push("/(main)/(tabs)/settings" as any)}
      />

      {isInitialLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: contentPaddingBottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary.DEFAULT}
            />
          }
        >
          {/* Total Balance Card */}
          <View
            style={{
              paddingHorizontal: sp[3],
              marginTop: sp[3],
              marginBottom: sp[2],
            }}
          >
            <View style={{ alignItems: "flex-start" }}>
              <Text
                style={{
                  fontSize: fs["4xl"],
                  fontWeight: "700",
                  color: theme.text.primary,
                }}
              >
                {isLoadingPortfolio && allWalletAddresses.length === 0
                  ? "Loading..."
                  : formatUSD(totalBalanceUsd)}
              </Text>
              <Text
                style={{
                  fontSize: fs.sm,
                  color: isPositiveChange ? theme.success : theme.error,
                  marginTop: sp[1],
                }}
              >
                {isPositiveChange ? "+" : ""}
                {formatUSD(totalChange24h)} (
                {formatPercentage(totalChangePercentage24h / 100)})
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <QuickActions actions={quickActions} />

          {/* Wallets Section - Consolidated View */}
          <View style={{ paddingHorizontal: sp[3], marginTop: sp[3] }}>
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "600",
                color: theme.text.primary,
                marginBottom: sp[3],
              }}
            >
              Your Wallets
            </Text>

            <View style={{ gap: sp[3] }}>
              {consolidatedWallets.map((wallet) => (
                <WalletCard
                  key={`${wallet.walletType}-${wallet.address}`}
                  wallet={wallet}
                  totalBalanceUsd={getWalletBalance(wallet)}
                  networkBalances={getNetworkBalances(wallet)}
                  isLoadingBalance={isLoadingPortfolio}
                  onCopy={() =>
                    handleCopyAddress(wallet.address, wallet.walletTypeName)
                  }
                  onNetworkPress={() => {
                    // Network press toggles the card expansion - handled internally by WalletCard
                    // No additional action needed here
                  }}
                />
              ))}
            </View>

            {consolidatedWallets.length === 0 && (
              <Card>
                <View style={{ alignItems: "center", padding: sp[6] }}>
                  <Ionicons
                    name="wallet-outline"
                    size={48}
                    color={theme.text.muted}
                  />
                  <Text
                    style={{
                      fontSize: fs.base,
                      color: theme.text.secondary,
                      marginTop: sp[3],
                      textAlign: "center",
                    }}
                  >
                    No wallets found
                  </Text>
                  <Button
                    title="Create Wallet"
                    onPress={handleCreateWallet}
                    size="sm"
                    style={{ marginTop: sp[4] }}
                  />
                </View>
              </Card>
            )}
          </View>

          {/* Holdings Section - User's Portfolio Assets */}
          {deduplicatedAssets.length > 0 && (
            <View style={{ paddingHorizontal: sp[3], marginTop: sp[3] }}>
              <Text
                style={{
                  fontSize: fs.lg,
                  fontWeight: "600",
                  color: theme.text.primary,
                  marginBottom: sp[3],
                }}
              >
                Your Holdings
              </Text>
              {deduplicatedAssets.map((asset, index) => (
                <PortfolioAssetCard
                  key={`${asset.blockchain || "unknown"}-${asset.address || asset.symbol}-${index}`}
                  asset={asset}
                  onPress={(a) => {
                    // Navigate to token details if we have an address
                    // Native tokens (SOL, ETH, BNB) now have proper addresses assigned in portfolioStore
                    if (a.address) {
                      // Map blockchain name to the format expected by Mobula API
                      const blockchain = (
                        a.blockchain || "solana"
                      ).toLowerCase();
                      router.push({
                        pathname: "/(main)/token/[blockchain]/[address]",
                        params: { blockchain, address: a.address },
                      } as any);
                    }
                  }}
                />
              ))}
            </View>
          )}

          {/* Loading state for holdings */}
          {isLoadingPortfolio && allWalletAddresses.length > 0 && (
            <View style={{ paddingHorizontal: sp[3], marginTop: sp[3] }}>
              <Text
                style={{
                  fontSize: fs.lg,
                  fontWeight: "600",
                  color: theme.text.primary,
                  marginBottom: sp[3],
                }}
              >
                Your Holdings
              </Text>
              <View style={{ alignItems: "center", padding: sp[6] }}>
                <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
                <Text
                  style={{
                    fontSize: fs.sm,
                    color: theme.text.secondary,
                    marginTop: sp[2],
                  }}
                >
                  Loading your tokens...
                </Text>
              </View>
            </View>
          )}

          {/* Discover Section - Wallet Tabs with Live Data */}
          <WalletTabsSection />
        </ScrollView>
      )}

      {/* Modals */}
      <ReceiveModal
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
      />

      <SendModal visible={showSendModal} onClose={handleSendModalClose} />

      <TransactionHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </SafeAreaView>
  );
}
