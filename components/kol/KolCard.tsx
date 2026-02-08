/**
 * KolCard - Leaderboard card showing KOL ranking and stats
 */

import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotificationContext } from "@/contexts";
import type { KolLeaderboardEntry, KolTier } from "@/lib/api/supabase/supabaseTypes";
import { useKolStore } from "@/store/kolStore";
import {
  formatCompactNumber,
  formatPercent,
  truncateAddress,
} from "@/utils/formatters";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface KolCardProps {
  kol: KolLeaderboardEntry;
  rank: number;
  onPress?: (kol: KolLeaderboardEntry) => void;
}

// Get tier color
const getTierColor = (tier: KolTier | null | undefined): string => {
  switch (tier) {
    case "diamond":
      return "#b9f2ff";
    case "platinum":
      return "#e5e4e2";
    case "gold":
      return "#ffd700";
    case "silver":
      return "#c0c0c0";
    case "bronze":
      return "#cd7f32";
    default:
      return "#888888";
  }
};

// Get tier icon
const getTierIcon = (tier: KolTier | null | undefined): string => {
  switch (tier) {
    case "diamond":
      return "diamond";
    case "platinum":
    case "gold":
    case "silver":
    case "bronze":
      return "medal";
    default:
      return "person";
  }
};

// Format number with K, M, B suffix (uses unified formatter)
const formatNumber = (num: number | null | undefined): string =>
  formatCompactNumber(num, { prefix: "$", decimals: 1 });

// Format wallet address (uses unified formatter)
const formatAddress = (address: string | null | undefined): string => {
  if (!address) return "Unknown";
  return truncateAddress(address, 6, 4);
};

// Get primary wallet from KOL entry
const getPrimaryWallet = (kol: KolLeaderboardEntry): string | null => {
  return kol.primary_evm_wallet || kol.primary_solana_wallet || null;
};

export const KolCard = memo(({ kol, rank, onPress }: KolCardProps) => {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const { followingIds, toggleFollow, timeframe, currentUser } = useKolStore();
  const { followKolForNotifications, unfollowKolForNotifications } =
    useNotificationContext();

  const isFollowing = followingIds.includes(kol.id);
  const tierColor = getTierColor(kol.kol_tier);
  const kolWalletAddress = getPrimaryWallet(kol);

  // Check if this KOL is the current user (prevent self-follow)
  const isCurrentUser = currentUser?.id === kol.id;

  // Get stats based on timeframe
  const getPnl = () => {
    switch (timeframe) {
      case "7d":
        return kol.pnl_7d_usd ?? 0;
      case "30d":
        return kol.pnl_30d_usd ?? 0;
      default:
        return kol.total_realized_pnl_usd ?? 0;
    }
  };

  const getVolume = () => {
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
    switch (timeframe) {
      case "7d":
        return kol.trades_7d ?? 0;
      case "30d":
        return kol.trades_30d ?? 0;
      default:
        return kol.total_trades ?? 0;
    }
  };

  const pnl = getPnl();
  const isPnlPositive = pnl >= 0;

  const handlePress = useCallback(() => {
    onPress?.(kol);
  }, [kol, onPress]);

  const handleFollowPress = useCallback(async () => {
    // Warn if no wallet address is available for the KOL
    if (!kolWalletAddress) {
      logger.warn(
        "KolCard",
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
        const success = await unfollowKolForNotifications(kolWalletAddress);
        if (success) {
          logger.info("KolCard", `Unfollowed KOL: ${kol.twitter_username}`);
        } else {
          logger.warn(
            "KolCard",
            `Failed to unfollow KOL: ${kol.twitter_username} - database sync failed`,
          );
        }
      } else {
        // Following
        const success = await followKolForNotifications(kolWalletAddress, {
          notify_on_trade: true,
          notify_on_new_position: true,
        });
        if (success) {
          logger.info("KolCard", `Followed KOL: ${kol.twitter_username}`);
        } else {
          logger.warn(
            "KolCard",
            `Failed to follow KOL: ${kol.twitter_username} - database sync failed`,
          );
        }
      }
    } catch (error) {
      logger.error("KolCard", "Error syncing follow status", error);
    }
  }, [
    kol.id,
    kol.twitter_username,
    kol.primary_evm_wallet,
    kol.primary_solana_wallet,
    kolWalletAddress,
    isFollowing,
    toggleFollow,
    followKolForNotifications,
    unfollowKolForNotifications,
  ]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      {...AnimatedPressablePresets.card}
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderRadius: br.lg,
          borderWidth: 1,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Rank Badge */}
      <View
        style={[
          styles.rankBadge,
          {
            backgroundColor:
              rank <= 3
                ? rank === 1
                  ? "#ffd700"
                  : rank === 2
                    ? "#c0c0c0"
                    : "#cd7f32"
                : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.rankText,
            { color: rank <= 3 ? "#000" : theme.text.primary },
          ]}
        >
          #{rank}
        </Text>
      </View>

      {/* Profile Section */}
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
              <Ionicons name="person" size={24} color={theme.text.muted} />
            </View>
          )}
          {kol.is_verified && (
            <View
              style={[
                styles.verifiedBadge,
                { backgroundColor: theme.primary.DEFAULT },
              ]}
            >
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>

        {/* Name & Handle */}
        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.displayName, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {kol.twitter_display_name || formatAddress(getPrimaryWallet(kol))}
            </Text>
            {kol.kol_tier && (
              <Ionicons
                name={getTierIcon(kol.kol_tier) as any}
                size={14}
                color={tierColor}
                style={styles.tierIcon}
              />
            )}
          </View>
          {kol.twitter_username && (
            <Text
              style={[styles.handle, { color: theme.text.muted }]}
              numberOfLines={1}
            >
              @{kol.twitter_username}
            </Text>
          )}
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        {/* PnL */}
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.text.muted }]}>
            PnL
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

        {/* Win Rate */}
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.text.muted }]}>
            Win Rate
          </Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>
            {formatPercent(kol.win_rate)}
          </Text>
        </View>

        {/* Volume */}
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.text.muted }]}>
            Volume
          </Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>
            {formatNumber(getVolume())}
          </Text>
        </View>

        {/* Trades */}
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.text.muted }]}>
            Trades
          </Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>
            {getTrades()}
          </Text>
        </View>
      </View>

      {/* Actions - Hide follow button for current user's own card */}
      <View style={styles.actionsSection}>
        {isCurrentUser ? (
          <View
            style={[
              styles.followButton,
              {
                backgroundColor: theme.border,
                borderRadius: br.md,
              },
            ]}
          >
            <Ionicons name="person" size={16} color={theme.text.muted} />
            <Text style={[styles.followText, { color: theme.text.muted }]}>
              You
            </Text>
          </View>
        ) : (
          <AnimatedPressable
            onPress={handleFollowPress}
            {...AnimatedPressablePresets.button}
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing
                  ? theme.border
                  : theme.primary.DEFAULT,
                borderRadius: br.md,
              },
            ]}
          >
            <Ionicons
              name={isFollowing ? "checkmark" : "add"}
              size={16}
              color={isFollowing ? theme.text.primary : theme.secondary.dark}
            />
            <Text
              style={[
                styles.followText,
                {
                  color: isFollowing
                    ? theme.text.primary
                    : theme.secondary.dark,
                },
              ]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </AnimatedPressable>
        )}
      </View>
    </AnimatedPressable>
  );
});
KolCard.displayName = "KolCard";

const styles = StyleSheet.create({
  container: {
    padding: 10, // Aligned with PulseTokenCard
    marginBottom: 6, // Aligned with PulseTokenCard
  },
  rankBadge: {
    position: "absolute",
    top: 8, // Adjusted for smaller padding
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankText: {
    fontSize: 11,
    fontWeight: "700",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8, // Reduced from 12
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 40, // Smaller avatar
    height: 40,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nameContainer: {
    marginLeft: 10, // Reduced from 12
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontSize: 14, // Smaller font
    fontWeight: "600",
  },
  tierIcon: {
    marginLeft: 4, // Reduced from 6
  },
  handle: {
    fontSize: 12, // Smaller font
    marginTop: 1,
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8, // Reduced from 12
    borderTopWidth: 0.5, // Lighter border
    borderBottomWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 8, // Reduced from 12
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10, // Smaller
    marginBottom: 2, // Reduced
  },
  statValue: {
    fontSize: 12, // Smaller
    fontWeight: "600",
  },
  actionsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 6, // Reduced from 8
    gap: 3, // Reduced from 4
  },
  followText: {
    fontSize: 12, // Smaller
    fontWeight: "600",
  },
});
