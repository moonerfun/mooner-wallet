/**
 * KolProfileModal - Modal showing detailed KOL profile and trades
 * Enhanced with Mobula analytics data
 */

import { useTheme } from "@/contexts/ThemeContext";
import { getExplorerAddressUrl } from "@/constants/chains";
import { useNotificationContext } from "@/contexts";
import { useKolDetailsMobula } from "@/hooks";
import type { KolLeaderboardEntry, KolRecentTrade } from "@/lib/api/supabase/supabaseTypes";
import { useKolStore } from "@/store/kolStore";
import {
  formatCompactNumber,
  formatPercent,
  truncateAddress,
} from "@/utils/formatters";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { KolTradeCard } from "./KolTradeCard";

const screenWidth = Dimensions.get("window").width;

interface KolProfileModalProps {
  visible: boolean;
  kol: KolLeaderboardEntry | null;
  trades: KolRecentTrade[];
  onClose: () => void;
}

// Format number (uses unified formatter)
const formatNumber = (num: number | null | undefined): string =>
  formatCompactNumber(num, { prefix: "$", decimals: 1 });

// Format wallet address (uses unified formatter)
const formatAddress = (address: string | null | undefined): string => {
  if (!address) return "Unknown";
  return truncateAddress(address, 6, 4);
};

// Get primary wallet from KOL entry
const getPrimaryWallet = (kol: KolLeaderboardEntry): string | null => {
  return kol.primary_solana_wallet || kol.primary_evm_wallet || null;
};

// Get chain type from KOL entry
const getChainType = (kol: KolLeaderboardEntry): "evm" | "solana" => {
  // Prefer Solana wallet, then EVM
  if (kol.primary_solana_wallet) return "solana";
  if (kol.primary_evm_wallet) return "evm";
  return "solana"; // Default to Solana
};

export const KolProfileModal = memo(
  ({ visible, kol, trades, onClose }: KolProfileModalProps) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
    const { followingIds, toggleFollow, timeframe, currentUser } =
      useKolStore();
    const { followKolForNotifications, unfollowKolForNotifications } =
      useNotificationContext();

    // Get primary wallet and chain type for Mobula data fetching
    const primaryWallet = kol ? getPrimaryWallet(kol) : null;
    const chainType = kol ? getChainType(kol) : "solana";

    // Fetch enriched data from Mobula when modal is visible
    const { stats: mobulaStats, isLoading: mobulaLoading } =
      useKolDetailsMobula(visible ? primaryWallet : null, chainType);

    const isFollowing = kol ? followingIds.includes(kol.id) : false;

    // Check if this KOL is the current user (prevent self-follow)
    const isCurrentUser = kol ? currentUser?.id === kol.id : false;

    const handleTwitterPress = useCallback(() => {
      if (kol?.twitter_username) {
        Linking.openURL(`https://twitter.com/${kol.twitter_username}`);
      }
    }, [kol?.twitter_username]);

    const handleFollowPress = useCallback(async () => {
      if (!kol) return;

      // Warn if no wallet address is available for the KOL
      if (!primaryWallet) {
        logger.warn(
          "KolProfileModal",
          `Cannot sync follow for KOL ${kol.twitter_username}: no wallet address available`,
          {
            kolId: kol.id,
            hasEvmWallet: !!kol.primary_evm_wallet,
            hasSolanaWallet: !!kol.primary_solana_wallet,
          },
        );
        // Still update local state for UI consistency, but this won't trigger notifications
        toggleFollow(kol.id);
        return;
      }

      // Update local state first for immediate UI feedback
      toggleFollow(kol.id);

      // Sync with Supabase for notifications
      try {
        if (isFollowing) {
          // Unfollowing
          const success = await unfollowKolForNotifications(primaryWallet);
          if (success) {
            logger.info(
              "KolProfileModal",
              `Unfollowed KOL: ${kol.twitter_username}`,
            );
          } else {
            logger.warn(
              "KolProfileModal",
              `Failed to unfollow KOL: ${kol.twitter_username} - database sync failed`,
            );
          }
        } else {
          // Following
          const success = await followKolForNotifications(primaryWallet, {
            notify_on_trade: true,
            notify_on_new_position: true,
          });
          if (success) {
            logger.info(
              "KolProfileModal",
              `Followed KOL: ${kol.twitter_username}`,
            );
          } else {
            logger.warn(
              "KolProfileModal",
              `Failed to follow KOL: ${kol.twitter_username} - database sync failed`,
            );
          }
        }
      } catch (error) {
        logger.error("KolProfileModal", "Error syncing follow status", error);
      }
    }, [
      kol,
      primaryWallet,
      isFollowing,
      toggleFollow,
      followKolForNotifications,
      unfollowKolForNotifications,
    ]);

    // Prepare chart data from periodPnl
    const chartData = useMemo(() => {
      const pnlData = mobulaStats?.periodPnl;
      if (!pnlData || pnlData.length === 0) return null;

      // Sort by date and get cumulative PnL
      const sortedData = [...pnlData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calculate cumulative PnL
      let cumulative = 0;
      const cumulativeData = sortedData.map((d) => {
        cumulative += d.realized;
        return cumulative;
      });

      // Format labels (show every few days)
      const labels = sortedData.map((d, i) => {
        if (
          sortedData.length <= 7 ||
          i % Math.ceil(sortedData.length / 5) === 0
        ) {
          const date = new Date(d.date);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }
        return "";
      });

      return {
        labels,
        datasets: [{ data: cumulativeData }],
      };
    }, [mobulaStats?.periodPnl]);

    // Early return after all hooks
    if (!kol) return null;

    // Get stats based on timeframe
    const getPnl = () => {
      switch (timeframe) {
        case "7d":
          return mobulaStats?.pnl7dUsd ?? kol.pnl_7d_usd ?? 0;
        case "30d":
          return mobulaStats?.pnl30dUsd ?? kol.pnl_30d_usd ?? 0;
        default:
          return mobulaStats?.realizedPnlUsd ?? kol.total_realized_pnl_usd ?? 0;
      }
    };

    const getVolume = () => {
      if (mobulaStats?.totalVolume != null) {
        return mobulaStats.totalVolume;
      }
      switch (timeframe) {
        case "7d":
          return kol.volume_7d_usd ?? 0;
        case "30d":
          return kol.volume_30d_usd ?? 0;
        default:
          return kol.total_volume_usd ?? 0;
      }
    };

    const getTrades = () => {
      if (mobulaStats?.totalTrades != null) {
        return mobulaStats.totalTrades;
      }
      switch (timeframe) {
        case "7d":
          return kol.trades_7d ?? 0;
        case "30d":
          return kol.trades_30d ?? 0;
        default:
          return kol.total_trades ?? 0;
      }
    };

    const winRate = mobulaStats?.winRate ?? kol.win_rate ?? 0;
    const pnl = getPnl();
    const isPnlPositive = (pnl ?? 0) >= 0;

    // Get labels from Mobula (smart money, early adopter, etc.)
    const labels = mobulaStats?.labels ?? [];

    // Get win rate distribution for display
    const winRateDistribution = mobulaStats?.winRateDistribution;

    // Get best performing token
    const bestToken = mobulaStats?.winToken;

    const renderHeader = () => (
      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {kol.twitter_avatar_url ? (
            <Image
              source={{ uri: kol.twitter_avatar_url }}
              style={[styles.avatar, { borderRadius: br.full }]}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.border, borderRadius: br.full },
              ]}
            >
              <Ionicons name="person" size={40} color={theme.text.muted} />
            </View>
          )}
          {kol.is_verified && (
            <View
              style={[
                styles.verifiedBadge,
                { backgroundColor: theme.primary.DEFAULT },
              ]}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          )}
        </View>

        {/* Name & Handle */}
        <Text style={[styles.displayName, { color: theme.text.primary }]}>
          {kol.twitter_display_name || formatAddress(getPrimaryWallet(kol))}
        </Text>
        {kol.twitter_username && (
          <TouchableOpacity onPress={handleTwitterPress}>
            <Text style={[styles.handle, { color: theme.primary.DEFAULT }]}>
              @{kol.twitter_username}
            </Text>
          </TouchableOpacity>
        )}

        {/* Wallet Addresses */}
        <View style={styles.walletsContainer}>
          {kol.primary_evm_wallet && (
            <TouchableOpacity
              style={styles.walletRow}
              onPress={() =>
                Linking.openURL(
                  getExplorerAddressUrl("ethereum", kol.primary_evm_wallet!),
                )
              }
            >
              <Text style={[styles.walletLabel, { color: theme.text.muted }]}>
                EVM:
              </Text>
              <Text style={[styles.walletAddress, { color: theme.text.muted }]}>
                {formatAddress(kol.primary_evm_wallet)}
              </Text>
              <Ionicons
                name="open-outline"
                size={14}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
          {kol.primary_solana_wallet && (
            <TouchableOpacity
              style={styles.walletRow}
              onPress={() =>
                Linking.openURL(
                  getExplorerAddressUrl("solana", kol.primary_solana_wallet!),
                )
              }
            >
              <Text style={[styles.walletLabel, { color: theme.text.muted }]}>
                SOL:
              </Text>
              <Text style={[styles.walletAddress, { color: theme.text.muted }]}>
                {formatAddress(kol.primary_solana_wallet)}
              </Text>
              <Ionicons
                name="open-outline"
                size={14}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Chain Trade Counts */}
        {(kol.evm_trades || kol.solana_trades) && (
          <View
            style={[
              styles.chainStats,
              { backgroundColor: theme.surface, borderRadius: br.md },
            ]}
          >
            {kol.evm_trades !== null && kol.evm_trades > 0 && (
              <View style={styles.chainStatItem}>
                <Text
                  style={[styles.chainStatLabel, { color: theme.text.muted }]}
                >
                  EVM
                </Text>
                <Text
                  style={[styles.chainStatValue, { color: theme.text.primary }]}
                >
                  {kol.evm_trades}
                </Text>
              </View>
            )}
            {kol.solana_trades !== null && kol.solana_trades > 0 && (
              <View style={styles.chainStatItem}>
                <Text
                  style={[styles.chainStatLabel, { color: theme.text.muted }]}
                >
                  Solana
                </Text>
                <Text
                  style={[styles.chainStatValue, { color: theme.text.primary }]}
                >
                  {kol.solana_trades}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Stats Grid */}
        <View
          style={[
            styles.statsGrid,
            {
              backgroundColor: theme.surface,
              borderRadius: br.lg,
              borderWidth: 0.5,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              PnL ({timeframe})
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: isPnlPositive ? theme.success : theme.error },
              ]}
            >
              {isPnlPositive ? "+" : ""}
              {formatNumber(pnl)}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              Win Rate
            </Text>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {formatPercent(winRate)}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              Volume ({timeframe})
            </Text>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {formatNumber(getVolume())}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              Trades ({timeframe})
            </Text>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {getTrades() ?? 0}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              Followers
            </Text>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {formatCompactNumber(kol.followers_count ?? 0)}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>
              Holding
            </Text>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {mobulaStats?.holdingTokensCount ?? 0} tokens
            </Text>
          </View>
        </View>

        {/* PnL Chart */}
        {chartData && chartData.datasets[0].data.length > 1 && (
          <View
            style={[
              styles.chartContainer,
              {
                backgroundColor: theme.surface,
                borderRadius: br.lg,
                borderWidth: 0.5,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.chartTitle, { color: theme.text.primary }]}>
              Cumulative PnL ({timeframe})
            </Text>
            <LineChart
              data={chartData}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                backgroundColor: theme.surface,
                backgroundGradientFrom: theme.surface,
                backgroundGradientTo: theme.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => {
                  const lastValue =
                    chartData.datasets[0].data[
                      chartData.datasets[0].data.length - 1
                    ];
                  return lastValue >= 0
                    ? `rgba(34, 197, 94, ${opacity})`
                    : `rgba(239, 68, 68, ${opacity})`;
                },
                labelColor: () => theme.text.muted,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "3",
                  strokeWidth: "1",
                },
                propsForLabels: {
                  fontSize: 10,
                },
                formatYLabel: (value) => {
                  const num = parseFloat(value);
                  if (Math.abs(num) >= 1000)
                    return `$${(num / 1000).toFixed(0)}K`;
                  return `$${num.toFixed(0)}`;
                },
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLabels={true}
              withVerticalLabels={true}
              fromZero={false}
            />
          </View>
        )}

        {/* Mobula Labels (Smart Money, etc.) */}
        {labels.length > 0 && (
          <View style={styles.labelsContainer}>
            {labels.map((label, index) => (
              <View
                key={index}
                style={[
                  styles.labelBadge,
                  {
                    backgroundColor: theme.primary.DEFAULT + "20",
                    borderRadius: br.sm,
                  },
                ]}
              >
                <Text
                  style={[styles.labelText, { color: theme.primary.DEFAULT }]}
                >
                  {label
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Win Rate Distribution */}
        {winRateDistribution && (
          <View
            style={[
              styles.distributionContainer,
              {
                backgroundColor: theme.surface,
                borderRadius: br.lg,
                borderWidth: 0.5,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[styles.distributionTitle, { color: theme.text.primary }]}
            >
              Win Rate Distribution
            </Text>
            <View style={styles.distributionGrid}>
              {Object.entries(winRateDistribution).map(([range, count]) => (
                <View key={range} style={styles.distributionItem}>
                  <Text
                    style={[
                      styles.distributionLabel,
                      { color: theme.text.muted },
                    ]}
                  >
                    {range}
                  </Text>
                  <Text
                    style={[
                      styles.distributionValue,
                      {
                        color:
                          range.startsWith("-") || range.startsWith("<-")
                            ? theme.error
                            : theme.success,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Best Performing Token */}
        {bestToken && (
          <View
            style={[
              styles.bestTokenContainer,
              {
                backgroundColor: theme.surface,
                borderRadius: br.lg,
                borderWidth: 0.5,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.bestTokenTitle, { color: theme.text.muted }]}>
              Best Trade
            </Text>
            <View style={styles.bestTokenRow}>
              {bestToken.logo && (
                <Image
                  source={{ uri: bestToken.logo }}
                  style={[styles.bestTokenLogo, { borderRadius: br.full }]}
                />
              )}
              <View>
                <Text
                  style={[
                    styles.bestTokenSymbol,
                    { color: theme.text.primary },
                  ]}
                >
                  {bestToken.symbol}
                </Text>
                <Text
                  style={[styles.bestTokenName, { color: theme.text.muted }]}
                >
                  {bestToken.name}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading indicator for Mobula data */}
        {mobulaLoading && (
          <View style={styles.mobulaLoadingContainer}>
            <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
            <Text
              style={[styles.mobulaLoadingText, { color: theme.text.muted }]}
            >
              Loading analytics...
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isCurrentUser ? (
            <View
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.border,
                  borderRadius: br.md,
                  flex: 1,
                },
              ]}
            >
              <Ionicons name="person" size={18} color={theme.text.muted} />
              <Text
                style={[styles.actionButtonText, { color: theme.text.muted }]}
              >
                Your Profile
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleFollowPress}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isFollowing
                    ? theme.border
                    : theme.primary.DEFAULT,
                  borderRadius: br.md,
                  flex: 1,
                },
              ]}
            >
              <Ionicons
                name={isFollowing ? "checkmark" : "add"}
                size={18}
                color={isFollowing ? theme.text.primary : theme.secondary.dark}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  {
                    color: isFollowing
                      ? theme.text.primary
                      : theme.secondary.dark,
                  },
                ]}
              >
                {isFollowing ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
          )}

          {kol.twitter_username && (
            <TouchableOpacity
              onPress={handleTwitterPress}
              style={[
                styles.actionButton,
                {
                  backgroundColor: "#1DA1F2",
                  borderRadius: br.md,
                },
              ]}
            >
              <Ionicons name="logo-twitter" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Trades Section Header */}
        <View style={styles.tradesHeader}>
          <Text style={[styles.tradesTitle, { color: theme.text.primary }]}>
            Recent Trades
          </Text>
          <Text style={[styles.tradesCount, { color: theme.text.muted }]}>
            {trades.length} trades
          </Text>
        </View>
      </View>
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView
          edges={["top"]}
          style={{ flex: 1, backgroundColor: theme.background }}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: theme.border, borderBottomWidth: 1 },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              Trader Profile
            </Text>
            <View style={styles.closeButton} />
          </View>

          {/* Content */}
          <FlashList
            data={trades}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <KolTradeCard trade={item} showTrader={false} />
            )}
            drawDistance={300}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{ padding: sp[3] }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="swap-horizontal"
                  size={48}
                  color={theme.text.muted}
                />
                <Text
                  style={[styles.emptyStateText, { color: theme.text.muted }]}
                >
                  No trades yet
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    );
  },
);
KolProfileModal.displayName = "KolProfileModal";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    alignItems: "center",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  handle: {
    fontSize: 15,
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
  },
  walletsContainer: {
    marginBottom: 12,
    alignItems: "center",
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  walletLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  chainStats: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  chainStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chainStatLabel: {
    fontSize: 12,
  },
  chainStatValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    width: "100%",
    marginBottom: 16,
  },
  statItem: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: 10,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Labels (Smart Money, etc.)
  labelsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
    marginBottom: 16,
  },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // PnL Chart
  chartContainer: {
    width: "100%",
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  // Win Rate Distribution
  distributionContainer: {
    width: "100%",
    padding: 12,
    marginBottom: 16,
  },
  distributionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  distributionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  distributionItem: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: 8,
  },
  distributionLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  distributionValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Best Token
  bestTokenContainer: {
    width: "100%",
    padding: 12,
    marginBottom: 16,
  },
  bestTokenTitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  bestTokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bestTokenLogo: {
    width: 32,
    height: 32,
  },
  bestTokenSymbol: {
    fontSize: 14,
    fontWeight: "600",
  },
  bestTokenName: {
    fontSize: 12,
  },
  // Mobula Loading
  mobulaLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  mobulaLoadingText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tradesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  tradesTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  tradesCount: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 12,
  },
});
