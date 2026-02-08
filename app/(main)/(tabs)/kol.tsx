/**
 * KOL Leaderboard Screen - Shows top traders and their trades
 * Uses Mobula API for real-time wallet analytics
 */

import { UnifiedHeader } from "@/components";
import {
  KolCard,
  KolFilterModal,
  KolLeaderboardHeader,
  KolProfileModal,
  KolTradeCard,
} from "@/components/kol";
import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  useKolLeaderboardMobula,
  useKolTradesMobula,
  useTwitterAuth,
} from "@/hooks";
import type { KolLeaderboardEntry } from "@/lib/api/supabase/supabaseTypes";
import { useKolStore } from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type TabName = "leaderboard" | "trades";

export default function KolScreen() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate bottom padding to ensure content scrolls above tab bar
  const tabBarHeight =
    56 +
    Platform.select({
      android: Math.max(insets.bottom, 16),
      ios: insets.bottom,
      default: insets.bottom,
    });
  const contentPaddingBottom = tabBarHeight + 16;

  const { consolidatedWallets } = useWallet();
  const [activeTab, setActiveTab] = useState<TabName>("leaderboard");
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Get first wallet address for the current user
  const walletAddress = consolidatedWallets[0]?.address;

  // Initialize Twitter auth - this ensures user is loaded
  useTwitterAuth();

  // Hooks for data fetching - using Mobula-powered hooks
  // Note: Backend cron job handles syncing - client only reads from cache
  const {
    refetch: refetchLeaderboard,
    isLoading: leaderboardLoading,
    isSyncing,
  } = useKolLeaderboardMobula();

  const { refetch: refetchTrades, isLoading: tradesLoading } =
    useKolTradesMobula();

  // Store state
  const {
    leaderboard,
    recentTrades,
    selectedKol,
    selectedKolTrades,
    setSelectedKol,
    setSelectedKolTrades,
    timeframe,
    sortBy,
    showFollowingOnly,
    followingIds,
  } = useKolStore();

  // Compute filtered leaderboard - using useMemo to ensure it updates when deps change
  const filteredLeaderboard = React.useMemo(() => {
    let filtered = [...leaderboard];

    // Filter by following
    if (showFollowingOnly) {
      filtered = filtered.filter((kol) => followingIds.includes(kol.id));
    }

    // Sort based on criteria and timeframe
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "pnl":
          if (timeframe === "7d") {
            return (b.pnl_7d_usd ?? 0) - (a.pnl_7d_usd ?? 0);
          } else if (timeframe === "30d") {
            return (b.pnl_30d_usd ?? 0) - (a.pnl_30d_usd ?? 0);
          }
          return (
            (b.total_realized_pnl_usd ?? 0) - (a.total_realized_pnl_usd ?? 0)
          );
        case "volume":
          if (timeframe === "7d") {
            return (b.volume_7d_usd ?? 0) - (a.volume_7d_usd ?? 0);
          } else if (timeframe === "30d") {
            return (b.volume_30d_usd ?? 0) - (a.volume_30d_usd ?? 0);
          }
          return (b.total_volume_usd ?? 0) - (a.total_volume_usd ?? 0);
        case "trades":
          if (timeframe === "7d") {
            return (b.trades_7d ?? 0) - (a.trades_7d ?? 0);
          } else if (timeframe === "30d") {
            return (b.trades_30d ?? 0) - (a.trades_30d ?? 0);
          }
          return (b.total_trades ?? 0) - (a.total_trades ?? 0);
        case "winRate":
          return (b.win_rate ?? 0) - (a.win_rate ?? 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [leaderboard, showFollowingOnly, followingIds, sortBy, timeframe]);

  // Count active filters for badge
  const activeFilterCount = [
    timeframe !== "7d",
    sortBy !== "pnl",
    showFollowingOnly,
  ].filter(Boolean).length;

  // Initial fetch on mount if data is empty
  React.useEffect(() => {
    if (leaderboard.length === 0 && !leaderboardLoading) {
      console.log("[KOL] Initial mount - no data, fetching...");
      refetchLeaderboard(true);
    }
    if (recentTrades.length === 0 && !tradesLoading) {
      console.log("[KOL] Initial mount - no trades, fetching...");
      refetchTrades(true);
    }
  }, []); // Only on mount

  // Fetch from cache when screen comes into focus
  // Note: Backend cron job handles syncing KOL stats - client just reads from cache
  useFocusEffect(
    useCallback(() => {
      console.log(
        "[KOL] Screen focused - leaderboard has",
        leaderboard.length,
        "entries",
      );
      const timer = setTimeout(async () => {
        // Always fetch from backend cache - cron job keeps it fresh
        await Promise.all([refetchLeaderboard(), refetchTrades()]);
      }, 100);
      return () => clearTimeout(timer);
    }, [refetchLeaderboard, refetchTrades, leaderboard.length]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh from cache - bypasses dedup guard
    await Promise.all([refetchLeaderboard(true), refetchTrades(true)]);
    setRefreshing(false);
  }, [refetchLeaderboard, refetchTrades]);

  const handleLinkTwitter = useCallback(() => {
    router.push("/(main)/(tabs)/settings");
  }, [router]);

  const handleKolPress = useCallback(
    (kol: KolLeaderboardEntry) => {
      setSelectedKol(kol);
      // Filter trades for this KOL
      const kolTrades = recentTrades.filter((t) => t.user_id === kol.id);
      setSelectedKolTrades(kolTrades);
      setProfileModalVisible(true);
    },
    [recentTrades, setSelectedKol, setSelectedKolTrades],
  );

  const handleCloseProfile = useCallback(() => {
    setProfileModalVisible(false);
    setSelectedKol(null);
    setSelectedKolTrades([]);
  }, [setSelectedKol, setSelectedKolTrades]);

  const renderLeaderboardItem = useCallback(
    ({ item, index }: { item: KolLeaderboardEntry; index: number }) => (
      <KolCard kol={item} rank={index + 1} onPress={handleKolPress} />
    ),
    [handleKolPress],
  );

  const renderTradeItem = useCallback(
    ({ item }: { item: any }) => (
      <KolTradeCard
        trade={item}
        showTrader={true}
        onTraderPress={(userId) => {
          const kol = filteredLeaderboard.find((k) => k.id === userId);
          if (kol) handleKolPress(kol);
        }}
      />
    ),
    [filteredLeaderboard, handleKolPress],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons
          name={
            activeTab === "leaderboard"
              ? "trophy-outline"
              : "swap-horizontal-outline"
          }
          size={48}
          color={theme.text.muted}
        />
        <Text style={[styles.emptyStateTitle, { color: theme.text.primary }]}>
          {activeTab === "leaderboard" ? "No traders yet" : "No trades yet"}
        </Text>
        <Text style={[styles.emptyStateText, { color: theme.text.muted }]}>
          {activeTab === "leaderboard"
            ? "Be the first to link your X account and start trading!"
            : "Trades from linked KOLs will appear here"}
        </Text>
      </View>
    ),
    [activeTab, theme],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {/* Header */}
      <UnifiedHeader
        onProfilePress={() => router.push("/(main)/(tabs)/settings")}
      />

      {/* Tab Switcher with Filter Button */}
      <View style={styles.tabRow}>
        <View
          style={[
            styles.tabContainer,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <AnimatedPressable
            onPress={() => setActiveTab("leaderboard")}
            {...AnimatedPressablePresets.tab}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "leaderboard"
                    ? theme.primary.DEFAULT
                    : "transparent",
                borderRadius: br.md,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "leaderboard"
                      ? theme.secondary.dark
                      : theme.text.secondary,
                },
              ]}
            >
              Leaderboard
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => setActiveTab("trades")}
            {...AnimatedPressablePresets.tab}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "trades"
                    ? theme.primary.DEFAULT
                    : "transparent",
                borderRadius: br.md,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "trades"
                      ? theme.secondary.dark
                      : theme.text.secondary,
                },
              ]}
            >
              Live Trades
            </Text>
          </AnimatedPressable>
        </View>

        {/* Filter button */}
        {activeTab === "leaderboard" ? (
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterButton, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={theme.text.primary}
            />
            {activeFilterCount > 0 && (
              <View
                style={[
                  styles.filterBadge,
                  { backgroundColor: theme.primary.DEFAULT },
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    { color: theme.secondary.dark },
                  ]}
                >
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View
            style={{ width: 38, height: 38, marginTop: 12, marginBottom: 6 }}
          />
        )}
      </View>

      {/* Content */}
      {((activeTab === "leaderboard" &&
        leaderboardLoading &&
        leaderboard.length === 0) ||
        (activeTab === "trades" &&
          tradesLoading &&
          recentTrades.length === 0)) &&
      !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
        </View>
      ) : activeTab === "leaderboard" ? (
        <FlashList
          data={filteredLeaderboard}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaderboardItem}
          drawDistance={300}
          ListHeaderComponent={
            <KolLeaderboardHeader onLinkTwitter={handleLinkTwitter} />
          }
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{
            padding: sp[3], // Aligned with Pulse page (12px)
            paddingBottom: contentPaddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary.DEFAULT}
            />
          }
        />
      ) : (
        <FlashList
          data={recentTrades}
          keyExtractor={(item) => item.id}
          renderItem={renderTradeItem}
          drawDistance={300}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{
            padding: sp[3], // Aligned with Pulse page (12px)
            paddingBottom: contentPaddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary.DEFAULT}
            />
          }
        />
      )}

      {/* Profile Modal */}
      <KolProfileModal
        visible={profileModalVisible}
        kol={selectedKol}
        trades={selectedKolTrades}
        onClose={handleCloseProfile}
      />

      {/* Filter Modal */}
      <KolFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  syncText: {
    fontSize: 11,
    fontWeight: "500",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginTop: 12,
    marginBottom: 6,
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    gap: 8,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    marginLeft: 12,
    marginTop: 12,
    marginBottom: 6,
    padding: 3,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
