/**
 * Token Detail Page
 * Dynamic route: /token/[blockchain]/[address]
 * Displays full token information with TradingView chart
 * Real-time updates via token-details WebSocket stream
 */

import { AnimatedScreen } from "@/components";
import {
  DevTokens,
  Markets,
  QuickBuyBar,
  TokenHeader,
  TokenHolders,
  TokenStats,
  TokenTrades,
  TopTraders,
  TradeModal,
  TraderModal,
  TradingViewChart,
} from "@/components/token";
import { TokenDetailSkeleton } from "@/components/ui/Skeleton";
import { getBlockchainSlug, toMobulaChainId } from "@/constants/chains";
import { useTheme } from "@/contexts/ThemeContext";
import { useTokenDetailsStream, useTokenHolders, useTopTraders } from "@/hooks";
import { useSettingsStore } from "@/store/settingsStore";
import { TokenDetails, useTokenStore } from "@/store/tokenStore";
import { useTopTradersStore } from "@/store/topTradersStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabName =
  | "stats"
  | "trades"
  | "holders"
  | "topTraders"
  | "devTokens"
  | "markets";

type TradeMode = "buy" | "sell";

export default function TokenDetailScreen() {
  const router = useRouter();
  const { blockchain: rawBlockchain, address } = useLocalSearchParams<{
    blockchain: string;
    address: string;
  }>();

  // Normalize blockchain param to handle various formats:
  // "evm" -> needs chain ID, but we'll try to use it
  // "evm:1" -> "ethereum"
  // "solana:solana" -> "solana"
  // "Solana", "Ethereum" -> lowercase for API compatibility
  // "ethereum", "base", "bsc" -> pass through
  const blockchain = React.useMemo(() => {
    if (!rawBlockchain) return "solana";

    // If it's a Mobula format (contains ":"), convert to slug
    if (rawBlockchain.includes(":")) {
      return getBlockchainSlug(rawBlockchain);
    }

    // If it's just "evm" without chain ID, default to ethereum
    if (rawBlockchain.toLowerCase() === "evm") {
      console.warn(
        "[TokenDetail] Received 'evm' without chain ID, defaulting to ethereum",
      );
      return "ethereum";
    }

    // Normalize to lowercase for API compatibility
    // This handles cases like "Solana" from portfolio holdings
    return rawBlockchain.toLowerCase();
  }, [rawBlockchain]);

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate bottom padding for FAB and scroll content
  const bottomPadding = Platform.select({
    android: Math.max(insets.bottom, 16) + 80, // 80 for FAB height
    ios: insets.bottom + 80,
    default: insets.bottom + 80,
  });

  const [activeTab, setActiveTab] = useState<TabName>("stats");

  // Trade modal state
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeMode, setTradeMode] = useState<TradeMode>("buy");

  // Quick buy enabled setting
  const quickBuyEnabled = useSettingsStore((s) => s.quickBuyEnabled);

  // Use LOCAL state for token data to prevent issues when navigating between token screens
  const [localToken, setLocalToken] = useState<TokenDetails | null>(null);
  const [localIsLoading, setLocalIsLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Get store state for trades (holders now loaded via useTokenHolders hook)
  const trades = useTokenStore((s) => s.trades);
  const storeToken = useTokenStore((s) => s.token);
  const chartInterval = useTokenStore((s) => s.chartInterval);
  const setToken = useTokenStore((s) => s.setToken);
  const setChartInterval = useTokenStore((s) => s.setChartInterval);
  const clearToken = useTokenStore((s) => s.clearToken);

  // Sync store token updates to local state for real-time WebSocket updates
  // Only sync if it's the same token (matching address) to avoid cross-token issues
  // Use a ref to track the current localToken address to avoid stale closures
  const localTokenAddressRef = React.useRef<string | null>(null);

  useEffect(() => {
    localTokenAddressRef.current = localToken?.address?.toLowerCase() || null;
  }, [localToken?.address]);

  useEffect(() => {
    if (!storeToken) return;

    const storeAddress = storeToken.address?.toLowerCase();
    const localAddress = localTokenAddressRef.current;

    // Only sync if addresses match and there's actually an update
    if (storeAddress && localAddress && storeAddress === localAddress) {
      setLocalToken(storeToken);
    }
  }, [storeToken]);

  // Top traders - use hook for data fetching
  const topTraders = useTopTradersStore((s) => s.traders);
  const clearTopTraders = useTopTradersStore((s) => s.clearTraders);
  useTopTraders({
    address: address || "",
    blockchain: blockchain || "",
    enabled: !localIsLoading && !localError && !!localToken,
  });

  // Token holders - use hook for data fetching
  const { holders } = useTokenHolders({
    address: address || "",
    blockchain: blockchain || "",
    enabled: !localIsLoading && !localError && !!localToken,
  });

  // Connect to token-details WebSocket for real-time updates
  // Only enable when we have a token loaded and no loading/error state
  const {
    isConnected: wsConnected,
    pauseStream,
    resumeStream,
  } = useTokenDetailsStream({
    address: address || "",
    blockchain: blockchain || "",
    enabled: !localIsLoading && !localError && !!localToken,
  });

  // Pause stream when screen loses focus (e.g., opening modals, navigating away)
  // Resume when screen regains focus
  useFocusEffect(
    useCallback(() => {
      console.log("[TokenDetail] Screen focused - resuming stream");
      resumeStream();

      return () => {
        console.log("[TokenDetail] Screen unfocused - pausing stream");
        pauseStream();
      };
    }, [pauseStream, resumeStream]),
  );

  // Fetch token data on mount
  useEffect(() => {
    if (!blockchain || !address) return;

    // Clear previous token data immediately when switching tokens
    // This prevents showing stale trades/holders from previous token
    clearToken();

    const fetchTokenData = async () => {
      setLocalIsLoading(true);
      setLocalError(null);
      try {
        const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";
        const chainId = toMobulaChainId(blockchain);

        // Fetch token details from Mobula API v2 (includes all enriched data)
        const response = await fetch(
          `https://api.mobula.io/api/2/token/details?blockchain=${chainId}&address=${address}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch token data");
        }

        const result = await response.json();
        const data = result.data;

        if (!data) {
          throw new Error("Token not found");
        }

        // Map API v2 response to our TokenDetails format
        // The v2 API uses camelCase field names
        const tokenDetails: TokenDetails = {
          // Basic info
          address: data.address || address,
          blockchain: data.blockchain || blockchain,
          name: String(data.name || "Unknown"),
          symbol: String(data.symbol || "???"),
          logo: data.logo,
          description: data.description,
          deployer: data.deployer,

          // Pricing
          price: data.priceUSD || 0,
          priceChange1m: data.priceChange1minPercentage,
          priceChange5m: data.priceChange5minPercentage,
          priceChange1h: data.priceChange1hPercentage,
          priceChange4h: data.priceChange4hPercentage,
          priceChange6h: data.priceChange6hPercentage,
          priceChange12h: data.priceChange12hPercentage,
          priceChange24h: data.priceChange24hPercentage,

          // All-time high/low
          athUSD: data.athUSD,
          atlUSD: data.atlUSD,
          athDate: data.athDate,
          atlDate: data.atlDate,

          // Market data
          marketCap: data.marketCapUSD,
          fullyDilutedValuation: data.marketCapDilutedUSD,
          liquidity: data.liquidityUSD,
          liquidityMaxUSD: data.liquidityMaxUSD,
          approximateReserveUSD: data.approximateReserveUSD,

          // Volume by timeframe
          volume1m: data.volume1minUSD,
          volume5m: data.volume5minUSD,
          volume15m: data.volume15minUSD,
          volume1h: data.volume1hUSD,
          volume4h: data.volume4hUSD,
          volume6h: data.volume6hUSD,
          volume12h: data.volume12hUSD,
          volume24h: data.volume24hUSD,
          volumeBuy24h: data.volumeBuy24hUSD,
          volumeSell24h: data.volumeSell24hUSD,

          // Supply
          totalSupply: data.totalSupply,
          circulatingSupply: data.circulatingSupply,
          decimals: data.decimals,

          // Holder distribution
          holdersCount: data.holdersCount,
          top10HoldingsPercentage: data.top10HoldingsPercentage,
          top50HoldingsPercentage: data.top50HoldingsPercentage,
          top100HoldingsPercentage: data.top100HoldingsPercentage,
          top200HoldingsPercentage: data.top200HoldingsPercentage,
          devHoldingsPercentage: data.devHoldingsPercentage,
          insidersHoldingsPercentage: data.insidersHoldingsPercentage,
          bundlersHoldingsPercentage: data.bundlersHoldingsPercentage,
          snipersHoldingsPercentage: data.snipersHoldingsPercentage,
          proTradersHoldingsPercentage: data.proTradersHoldingsPercentage,

          // Transactions by timeframe
          trades1m: data.trades1min,
          trades5m: data.trades5min,
          trades15m: data.trades15min,
          trades1h: data.trades1h,
          trades4h: data.trades4h,
          trades6h: data.trades6h,
          trades12h: data.trades12h,
          trades24h: data.trades24h,
          txns24h: data.trades24h,
          buys24h: data.buys24h,
          sells24h: data.sells24h,
          buyers24h: data.buyers24h,
          sellers24h: data.sellers24h,
          traders24h: data.traders24h,
          makers24h: data.traders24h,

          // Organic trading metrics
          organicTrades24h: data.organicTrades24h,
          organicTraders24h: data.organicTraders24h,
          organicVolume24h: data.organicVolume24hUSD,

          // Fees paid
          feesPaid1h: data.feesPaid1hUSD,
          feesPaid24h: data.feesPaid24hUSD,
          totalFeesPaid: data.totalFeesPaidUSD,

          // Socials
          twitter: data.socials?.twitter,
          telegram: data.socials?.telegram,
          website: data.socials?.website,
          discord: data.socials?.discord,
          socials: data.socials,

          // Timestamps
          createdAt: data.createdAt,

          // Bonding
          bondingPercentage: data.bondingPercentage,
          isBonded: data.bonded,
          bondedAt: data.bondedAt,

          // Exchange
          exchange: data.exchange,

          // Pool
          poolAddress: data.poolAddress,

          // Security
          security: data.security,

          // Dexscreener
          dexscreenerListed: data.dexscreenerListed,
          dexscreenerAdPaid: data.dexscreenerAdPaid,

          // Deployer/Twitter metrics
          deployerMigrationsCount: data.deployerMigrationsCount,
          twitterReusesCount: data.twitterReusesCount,
          twitterRenameCount: data.twitterRenameCount,
        };

        // Also update the global store for WebSocket updates
        setToken(tokenDetails);
        // Set local state
        setLocalToken(tokenDetails);
        setLocalIsLoading(false);
      } catch (err) {
        console.error("Error fetching token:", err);
        setLocalError(
          err instanceof Error ? err.message : "Failed to load token",
        );
        setLocalIsLoading(false);
      }
    };

    fetchTokenData();

    return () => {
      // Clear top traders on unmount
      clearTopTraders();
    };
  }, [blockchain, address, clearToken, clearTopTraders]);

  const handleBack = useCallback(() => {
    // Check if we can go back, otherwise go to home
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)/(tabs)");
    }
  }, [router]);

  if (localIsLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top"]}
      >
        <AnimatedScreen entering="fadeUp" exiting="none" duration={300}>
          <TokenDetailSkeleton />
        </AnimatedScreen>
      </SafeAreaView>
    );
  }

  if (localError || !localToken) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top"]}
      >
        <View style={styles.errorContainer}>
          <TouchableOpacity style={styles.backButtonError} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Ionicons name="alert-circle" size={60} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.text.primary }]}>
            Token Not Found
          </Text>
          <Text style={[styles.errorText, { color: theme.text.secondary }]}>
            {localError || "Unable to load token data"}
          </Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: theme.primary.DEFAULT },
            ]}
            onPress={() => router.back()}
          >
            <Text
              style={[styles.retryButtonText, { color: theme.secondary.dark }]}
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <AnimatedScreen entering="fadeUp" exiting="none" duration={300}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          {/* Header */}
          <TokenHeader
            token={localToken}
            onBack={handleBack}
            isLive={wsConnected}
          />

          {/* Chart */}
          <View style={styles.chartSection}>
            <TradingViewChart
              address={address!}
              blockchain={blockchain!}
              symbol={localToken.symbol}
              interval={chartInterval}
              onIntervalChange={setChartInterval}
            />
          </View>

          {/* Quick Buy Bar - inline below chart */}
          {quickBuyEnabled && localToken && <QuickBuyBar token={localToken} />}

          {/* Tab Bar */}
          <View style={styles.tabBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarScrollContent}
            >
              <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
                {(
                  [
                    { key: "stats", label: "Stats" },
                    { key: "trades", label: "Trades" },
                    { key: "holders", label: "Holders" },
                    { key: "topTraders", label: "Top Traders" },
                    ...(localToken.deployer
                      ? [{ key: "devTokens", label: "Dev Tokens" }]
                      : []),
                    { key: "markets", label: "Markets" },
                  ] as { key: TabName; label: string }[]
                ).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tab,
                      activeTab === tab.key && {
                        borderBottomColor: theme.primary.DEFAULT,
                        borderBottomWidth: 2,
                      },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color:
                            activeTab === tab.key
                              ? theme.primary.DEFAULT
                              : theme.text.secondary,
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === "stats" && <TokenStats token={localToken} />}
            {activeTab === "trades" && (
              <TokenTrades
                trades={trades}
                blockchain={blockchain!}
                deployerAddress={localToken.deployer}
              />
            )}
            {activeTab === "holders" && (
              <TokenHolders holders={holders} blockchain={blockchain!} />
            )}
            {activeTab === "topTraders" && (
              <TopTraders traders={topTraders} blockchain={blockchain!} />
            )}
            {activeTab === "devTokens" && localToken.deployer && (
              <DevTokens
                deployerAddress={localToken.deployer}
                blockchain={blockchain!}
                currentTokenAddress={address}
              />
            )}
            {activeTab === "markets" && (
              <Markets tokenAddress={address!} blockchain={blockchain!} />
            )}
          </View>
        </ScrollView>

        {/* Trader Modal */}
        <TraderModal />

        {/* Trade Modal */}
        <TradeModal
          visible={showTradeModal}
          onClose={() => setShowTradeModal(false)}
          token={localToken}
          initialMode={tradeMode}
        />

        {/* Buy/Sell FAB */}
        <View
          style={[
            styles.fabContainer,
            {
              bottom: Platform.select({
                android: Math.max(insets.bottom, 16) + 8,
                ios: insets.bottom + 8,
                default: 24,
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.fab,
              styles.buyFab,
              { backgroundColor: theme.success },
            ]}
            onPress={() => {
              setTradeMode("buy");
              setShowTradeModal(true);
            }}
          >
            <Text style={styles.fabText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.fab,
              styles.sellFab,
              { backgroundColor: theme.error },
            ]}
            onPress={() => {
              setTradeMode("sell");
              setShowTradeModal(true);
            }}
          >
            <Text style={styles.fabText}>Sell</Text>
          </TouchableOpacity>
        </View>
      </AnimatedScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Base value, overridden dynamically
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  backButtonError: {
    position: "absolute",
    top: 16,
    left: 16,
    padding: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    fontWeight: "600",
  },
  chartSection: {
    height: 350,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  tabBarContainer: {
    marginTop: 12,
  },
  tabBarScrollContent: {
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabContent: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  fab: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buyFab: {},
  sellFab: {},
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
