/**
 * Token Trades Component
 * Displays recent trades for the token with gradient backgrounds
 */

import { useTheme } from "@/contexts/ThemeContext";
import { Trade } from "@/store/tokenStore";
import { useTraderModalStore } from "@/store/traderModalStore";
import {
  formatCompactNumber,
  formatTimeAgo,
  truncateAddress,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TokenTradesProps {
  trades: Trade[];
  blockchain: string;
  deployerAddress?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const TokenTrades = memo(
  ({
    trades,
    blockchain,
    deployerAddress,
    isLoading,
    onRefresh,
  }: TokenTradesProps) => {
    const { theme } = useTheme();
    const { openModal } = useTraderModalStore();
    const [showDevOnly, setShowDevOnly] = useState(false);

    // Memoize filtered trades to prevent recalculation on every render
    const filteredTrades = useMemo(() => {
      if (showDevOnly && deployerAddress) {
        return trades.filter(
          (t) => t.maker.toLowerCase() === deployerAddress.toLowerCase(),
        );
      }
      return trades;
    }, [trades, showDevOnly, deployerAddress]);

    // Memoize max trade amount for bar width calculations
    const maxTradeAmount = useMemo(() => {
      return Math.max(...trades.map((t) => t.amountUsd), 1);
    }, [trades]);

    // Use unified formatters
    const formatAmount = (amount: number) =>
      formatCompactNumber(amount, { prefix: "$", decimals: 2 });

    const formatTime = (timestamp: string) => {
      const result = formatTimeAgo(timestamp);
      if (result === "now") return "Just now";
      return result ? `${result} ago` : "";
    };

    const shortenAddress = (address: string) => truncateAddress(address, 4, 4);

    // Calculate relative trade size for value bar
    const getTradeBarWidth = useCallback(
      (amount: number) => {
        return Math.min((amount / maxTradeAmount) * 100, 100);
      },
      [maxTradeAmount],
    );

    const handleTraderPress = useCallback(
      (maker: string) => {
        openModal(maker, blockchain);
      },
      [openModal, blockchain],
    );

    const renderTrade = ({ item }: { item: Trade }) => {
      const isBuy = item.type === "buy";
      const color = isBuy ? theme.success : theme.error;
      const isDev =
        deployerAddress &&
        item.maker.toLowerCase() === deployerAddress.toLowerCase();
      const barWidth = getTradeBarWidth(item.amountUsd);

      return (
        <TouchableOpacity
          style={[styles.tradeRowContainer]}
          onPress={() => handleTraderPress(item.maker)}
          activeOpacity={0.7}
        >
          {/* Background bar for visual trade size indication */}
          <View
            style={[
              styles.tradeBar,
              {
                backgroundColor: isBuy
                  ? `${theme.success}15`
                  : `${theme.error}10`,
                width: `${barWidth}%`,
              },
            ]}
          />

          <View style={[styles.tradeRow, { borderBottomColor: theme.border }]}>
            <View
              style={[styles.typeIndicator, { backgroundColor: color + "20" }]}
            >
              <Ionicons
                name={isBuy ? "arrow-up" : "arrow-down"}
                size={14}
                color={color}
              />
            </View>

            <View style={styles.tradeInfo}>
              <Text style={[styles.tradeAmount, { color }]}>
                {formatAmount(item.amountUsd)}
              </Text>
              <View style={styles.makerRow}>
                <Text
                  style={[styles.tradeMaker, { color: theme.text.secondary }]}
                >
                  {shortenAddress(item.maker)}
                </Text>
                {isDev && (
                  <View
                    style={[
                      styles.devBadge,
                      { backgroundColor: theme.warning + "20" },
                    ]}
                  >
                    <Text style={[styles.devText, { color: theme.warning }]}>
                      DEV
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.tradeTime}>
              <Text style={[styles.timeText, { color: theme.text.muted }]}>
                {formatTime(item.timestamp)}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={14}
              color={theme.text.muted}
            />
          </View>
        </TouchableOpacity>
      );
    };

    if (trades.length === 0 && !isLoading) {
      return (
        <View
          style={[styles.emptyContainer, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="swap-horizontal" size={40} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No recent trades
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Recent Trades ({filteredTrades.length})
          </Text>
          <View style={styles.headerActions}>
            {deployerAddress && (
              <TouchableOpacity
                style={[
                  styles.devFilter,
                  showDevOnly && { backgroundColor: theme.warning + "20" },
                ]}
                onPress={() => setShowDevOnly(!showDevOnly)}
              >
                <Text
                  style={[
                    styles.devFilterText,
                    {
                      color: showDevOnly ? theme.warning : theme.text.secondary,
                    },
                  ]}
                >
                  👨‍💻 DEV
                </Text>
              </TouchableOpacity>
            )}
            {onRefresh && (
              <TouchableOpacity onPress={onRefresh}>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlashList
          data={filteredTrades}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderTrade}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </View>
    );
  },
);

TokenTrades.displayName = "TokenTrades";

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  devFilter: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devFilterText: {
    fontSize: 11,
    fontWeight: "600",
  },
  list: {},
  tradeRowContainer: {
    position: "relative",
    overflow: "hidden",
  },
  tradeBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  typeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tradeInfo: {
    flex: 1,
  },
  tradeAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  makerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tradeMaker: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  devBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  devText: {
    fontSize: 8,
    fontWeight: "700",
  },
  tradeTime: {
    alignItems: "flex-end",
  },
  timeText: {
    fontSize: 11,
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
});
