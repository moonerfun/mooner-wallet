/**
 * KolTradeCard - Shows a single trade from a KOL
 */

import { useTheme } from "@/contexts/ThemeContext";
import { getExplorerTxUrl } from "@/constants/chains";
import type { KolRecentTrade } from "@/lib/api/supabase/supabaseTypes";
import {
  formatCompactNumber,
  formatTimeAgo,
  formatTokenAmount,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface KolTradeCardProps {
  trade: KolRecentTrade;
  showTrader?: boolean;
  onTraderPress?: (userId: string) => void;
}

// Format time ago with "ago" suffix
const formatTimeAgoWithSuffix = (dateStr: string): string => {
  const result = formatTimeAgo(dateStr);
  if (result === "now") return result;
  return result ? `${result} ago` : "";
};

// Format token amount (uses unified formatter)
const formatAmount = (num: number | null | undefined): string =>
  formatTokenAmount(num);

// Format USD value (uses unified formatter)
const formatUsd = (num: number | null | undefined): string =>
  formatCompactNumber(num, { prefix: "$", decimals: 1 });

// Get trade USD value with fallback calculation
const getTradeUsdValue = (trade: KolRecentTrade): number => {
  // First try the direct token_out_usd_value
  if (trade.token_out_usd_value && trade.token_out_usd_value > 0) {
    return trade.token_out_usd_value;
  }
  // Fall back to amount_usd (the total trade value)
  if (trade.amount_usd && trade.amount_usd > 0) {
    return trade.amount_usd;
  }
  // Try to calculate from token amount and price
  if (trade.token_out_amount && trade.price_usd) {
    return trade.token_out_amount * trade.price_usd;
  }
  return 0;
};

// Check if position PnL data is available
const hasPositionPnl = (trade: KolRecentTrade): boolean => {
  return (
    trade.realized_pnl_usd !== null ||
    trade.unrealized_pnl_usd !== null ||
    trade.total_pnl_usd !== null
  );
};

// Get the total position PnL (realized + unrealized)
const getPositionPnl = (trade: KolRecentTrade): number => {
  // Use total_pnl_usd if available
  if (trade.total_pnl_usd !== null && trade.total_pnl_usd !== undefined) {
    return trade.total_pnl_usd;
  }
  // Otherwise calculate from realized + unrealized
  const realized = trade.realized_pnl_usd || 0;
  const unrealized = trade.unrealized_pnl_usd || 0;
  return realized + unrealized;
};

// Format PnL with sign
const formatPnl = (pnl: number): string => {
  const prefix = pnl >= 0 ? "+" : "";
  if (Math.abs(pnl) >= 1e6) return `${prefix}$${(pnl / 1e6).toFixed(1)}M`;
  if (Math.abs(pnl) >= 1e3) return `${prefix}$${(pnl / 1e3).toFixed(1)}K`;
  return `${prefix}$${pnl.toFixed(2)}`;
};

// Format wallet address
const formatAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get trade type color and icon
const getTradeTypeInfo = (
  tradeType: string,
  theme: any,
): { color: string; icon: string; label: string } => {
  switch (tradeType) {
    case "buy":
      return { color: theme.success, icon: "arrow-down", label: "Buy" };
    case "sell":
      return { color: theme.error, icon: "arrow-up", label: "Sell" };
    case "swap":
      return {
        color: theme.primary.DEFAULT,
        icon: "swap-horizontal",
        label: "Swap",
      };
    default:
      return { color: theme.text.muted, icon: "help", label: "Trade" };
  }
};

export const KolTradeCard = memo(
  ({ trade, showTrader = true, onTraderPress }: KolTradeCardProps) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
    const tradeInfo = getTradeTypeInfo(trade.trade_type, theme);

    const handleExplorerPress = useCallback(() => {
      const url = getExplorerTxUrl(trade.chain, trade.tx_hash);
      if (url) {
        Linking.openURL(url);
      }
    }, [trade.chain, trade.tx_hash]);

    const handleTraderPress = useCallback(() => {
      onTraderPress?.(trade.user_id);
    }, [trade.user_id, onTraderPress]);

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.surface,
            borderRadius: br.lg,
            borderWidth: 0.5,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Header: Trader Info + Time */}
        {showTrader && (
          <TouchableOpacity
            onPress={handleTraderPress}
            style={styles.headerRow}
          >
            <View style={styles.traderInfo}>
              {trade.twitter_avatar_url ? (
                <Image
                  source={{ uri: trade.twitter_avatar_url }}
                  style={[styles.traderAvatar, { borderRadius: br.full }]}
                />
              ) : (
                <View
                  style={[
                    styles.traderAvatarPlaceholder,
                    {
                      backgroundColor: theme.border,
                      borderRadius: br.full,
                    },
                  ]}
                >
                  <Ionicons name="person" size={14} color={theme.text.muted} />
                </View>
              )}
              <View>
                <View style={styles.traderNameRow}>
                  <Text
                    style={[styles.traderName, { color: theme.text.primary }]}
                  >
                    {trade.twitter_display_name ||
                      formatAddress(trade.wallet_address)}
                  </Text>
                  {trade.is_verified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color={theme.primary.DEFAULT}
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                {trade.twitter_username && (
                  <Text
                    style={[styles.traderHandle, { color: theme.text.muted }]}
                  >
                    @{trade.twitter_username}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.timeText, { color: theme.text.muted }]}>
              {formatTimeAgo(trade.traded_at)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Trade Type Badge */}
        <View style={styles.tradeRow}>
          <View
            style={[
              styles.tradeTypeBadge,
              { backgroundColor: `${tradeInfo.color}20` },
            ]}
          >
            <Ionicons
              name={tradeInfo.icon as any}
              size={12}
              color={tradeInfo.color}
            />
            <Text style={[styles.tradeTypeText, { color: tradeInfo.color }]}>
              {tradeInfo.label}
            </Text>
          </View>

          {/* Chain Badge */}
          <View style={[styles.chainBadge, { backgroundColor: theme.border }]}>
            <Text style={[styles.chainText, { color: theme.text.secondary }]}>
              {trade.chain}
            </Text>
          </View>
        </View>

        {/* Trade Details */}
        <View style={styles.tradeDetails}>
          {/* Token Out (What they got) */}
          <View style={styles.tokenRow}>
            {trade.token_out_logo && (
              <Image
                source={{ uri: trade.token_out_logo }}
                style={styles.tokenLogo}
              />
            )}
            <View style={styles.tokenInfo}>
              <Text style={[styles.tokenSymbol, { color: theme.text.primary }]}>
                {trade.token_out_symbol || "???"}
              </Text>
              <Text style={[styles.tokenAmount, { color: theme.text.muted }]}>
                +{formatAmount(trade.token_out_amount)}
              </Text>
            </View>
            <Text style={[styles.tokenValue, { color: theme.success }]}>
              {formatUsd(getTradeUsdValue(trade))}
            </Text>
          </View>

          {/* Swap Arrow */}
          {trade.trade_type === "swap" && (
            <View style={styles.swapArrow}>
              <Ionicons name="arrow-down" size={16} color={theme.text.muted} />
            </View>
          )}

          {/* Token In (What they gave) */}
          {trade.token_in_symbol && (
            <View style={styles.tokenRow}>
              {trade.token_in_logo && (
                <Image
                  source={{ uri: trade.token_in_logo }}
                  style={styles.tokenLogo}
                />
              )}
              <View style={styles.tokenInfo}>
                <Text
                  style={[styles.tokenSymbol, { color: theme.text.primary }]}
                >
                  {trade.token_in_symbol}
                </Text>
                <Text style={[styles.tokenAmount, { color: theme.text.muted }]}>
                  -{formatAmount(trade.token_in_amount)}
                </Text>
              </View>
              <Text style={[styles.tokenValue, { color: theme.error }]}>
                {formatUsd(trade.token_in_usd_value)}
              </Text>
            </View>
          )}
        </View>

        {/* Footer: Position PnL (if available) or Trade Amount + Explorer Link */}
        <View style={styles.footer}>
          {/* Show position PnL if available, otherwise show trade amount */}
          {hasPositionPnl(trade) ? (
            <View
              style={[
                styles.pnlBadge,
                {
                  backgroundColor:
                    getPositionPnl(trade) >= 0
                      ? `${theme.success}20`
                      : `${theme.error}20`,
                },
              ]}
            >
              <Text
                style={[
                  styles.pnlText,
                  {
                    color:
                      getPositionPnl(trade) >= 0 ? theme.success : theme.error,
                  },
                ]}
              >
                {formatPnl(getPositionPnl(trade))}
                {trade.pnl_percentage !== null &&
                  trade.pnl_percentage !== undefined &&
                  ` (${trade.pnl_percentage >= 0 ? "+" : ""}${trade.pnl_percentage.toFixed(1)}%)`}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.pnlBadge,
                {
                  backgroundColor: `${theme.primary.DEFAULT}20`,
                },
              ]}
            >
              <Text style={[styles.pnlText, { color: theme.primary.DEFAULT }]}>
                {formatUsd(getTradeUsdValue(trade))}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleExplorerPress}
            style={styles.explorerButton}
          >
            <Ionicons name="open-outline" size={14} color={theme.text.muted} />
            <Text style={[styles.explorerText, { color: theme.text.muted }]}>
              View TX
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);
KolTradeCard.displayName = "KolTradeCard";

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  traderInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  traderAvatar: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  traderAvatarPlaceholder: {
    width: 32,
    height: 32,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  traderNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  traderName: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  traderHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  timeText: {
    fontSize: 12,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tradeTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  tradeTypeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chainText: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  tradeDetails: {
    marginBottom: 12,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  tokenLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: "600",
  },
  tokenAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  tokenValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  swapArrow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  pnlBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pnlText: {
    fontSize: 12,
    fontWeight: "600",
  },
  explorerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  explorerText: {
    fontSize: 12,
  },
});
