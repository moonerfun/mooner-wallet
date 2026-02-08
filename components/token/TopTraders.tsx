/**
 * Top Traders Component
 * Displays top traders for a token with PNL metrics
 */

import { useTheme } from "@/contexts/ThemeContext";
import {
  TRADER_LABELS,
  TopTrader,
  TraderLabel,
  useTopTradersStore,
} from "@/store/topTradersStore";
import { useTraderModalStore } from "@/store/traderModalStore";
import { formatCompactNumber, truncateAddress } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface TopTradersProps {
  traders: TopTrader[];
  blockchain: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const TopTraders = memo(
  ({ traders, blockchain, isLoading, onRefresh }: TopTradersProps) => {
    const { theme } = useTheme();
    const {
      selectedLabel,
      showRealizedPnl,
      setSelectedLabel,
      togglePnlDisplay,
    } = useTopTradersStore();
    const { openModal } = useTraderModalStore();

    const filteredTraders = selectedLabel
      ? traders.filter(
          (t) => t.label === selectedLabel || t.labels?.includes(selectedLabel),
        )
      : traders;

    // Use unified formatters
    const formatAmount = (
      amount: number | undefined | null,
      showSign = false,
    ) => {
      const num = Number(amount) || 0;
      const prefix = showSign && num > 0 ? "+" : "";
      return prefix + formatCompactNumber(num, { prefix: "$", decimals: 2 });
    };

    const shortenAddress = (address: string) => truncateAddress(address, 4, 4);

    const handleTraderPress = (trader: TopTrader) => {
      openModal(trader.address, blockchain);
    };

    const renderLabel = (label: TraderLabel) => {
      const config = TRADER_LABELS[label];
      const isSelected = selectedLabel === label;

      return (
        <TouchableOpacity
          key={label}
          style={[
            styles.labelChip,
            {
              backgroundColor: isSelected
                ? config.color + "30"
                : theme.border + "50",
              borderColor: isSelected ? config.color : "transparent",
            },
          ]}
          onPress={() => setSelectedLabel(isSelected ? null : label)}
        >
          <Text style={styles.labelEmoji}>{config.icon}</Text>
          <Text
            style={[
              styles.labelText,
              { color: isSelected ? config.color : theme.text.secondary },
            ]}
          >
            {config.name}
          </Text>
        </TouchableOpacity>
      );
    };

    const renderTrader = ({
      item,
      index,
    }: {
      item: TopTrader;
      index: number;
    }) => {
      const pnl = showRealizedPnl ? item.realizedPnl : item.unrealizedPnl;
      const pnlColor = pnl >= 0 ? theme.success : theme.error;
      const isTop5 = index < 5;

      return (
        <TouchableOpacity
          style={[styles.traderRow, { borderBottomColor: theme.border }]}
          onPress={() => handleTraderPress(item)}
        >
          {/* Rank & Address */}
          <View style={styles.traderInfo}>
            <Text
              style={[
                styles.rank,
                { color: isTop5 ? theme.primary.DEFAULT : theme.text.muted },
              ]}
            >
              #{index + 1}
            </Text>
            <View>
              <View style={styles.addressRow}>
                <Text style={[styles.address, { color: theme.text.primary }]}>
                  {shortenAddress(item.address)}
                </Text>
              </View>
            </View>
          </View>

          {/* Bought / Sold */}
          <View style={styles.tradingColumn}>
            <Text style={[styles.bought, { color: theme.success }]}>
              {formatAmount(item.bought)}
            </Text>
            <Text style={[styles.sold, { color: theme.error }]}>
              {formatAmount(item.sold)}
            </Text>
          </View>

          {/* Remaining */}
          <View style={styles.remainingColumn}>
            <Text style={[styles.remaining, { color: theme.text.primary }]}>
              {formatAmount(item.remaining)}
            </Text>
            <View
              style={[styles.progressBar, { backgroundColor: theme.border }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.primary.DEFAULT,
                    width: `${Math.min(Number(item.remainingPercentage) || 0, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* PNL */}
          <View style={styles.pnlColumn}>
            <Text style={[styles.pnl, { color: pnlColor }]}>
              {formatAmount(pnl, true)}
            </Text>
            <Text style={[styles.pnlLabel, { color: theme.text.muted }]}>
              {showRealizedPnl ? "Realized" : "Unrealized"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    };

    if (traders.length === 0 && !isLoading) {
      return (
        <View
          style={[styles.emptyContainer, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="trending-up" size={40} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No top traders data available
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Top Traders ({filteredTraders.length})
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={togglePnlDisplay}
              style={styles.pnlToggle}
            >
              <Text
                style={[styles.pnlToggleText, { color: theme.text.secondary }]}
              >
                {showRealizedPnl ? "Realized" : "Unrealized"}
              </Text>
              <Ionicons
                name="swap-horizontal"
                size={14}
                color={theme.text.secondary}
              />
            </TouchableOpacity>
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

        {/* Label Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.labelFilters}
          contentContainerStyle={styles.labelFiltersContent}
        >
          {(Object.keys(TRADER_LABELS) as TraderLabel[]).map(renderLabel)}
        </ScrollView>

        {/* Column Headers */}
        <View
          style={[styles.columnHeaders, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[
              styles.columnHeader,
              styles.traderColumn,
              { color: theme.text.muted },
            ]}
          >
            Trader
          </Text>
          <Text
            style={[
              styles.columnHeader,
              styles.tradingHeader,
              { color: theme.text.muted },
            ]}
          >
            Bought/Sold
          </Text>
          <Text
            style={[
              styles.columnHeader,
              styles.remainingHeader,
              { color: theme.text.muted },
            ]}
          >
            Remaining
          </Text>
          <TouchableOpacity style={styles.pnlHeader} onPress={togglePnlDisplay}>
            <Text style={[styles.columnHeader, { color: theme.text.muted }]}>
              PNL
            </Text>
            <Ionicons name="chevron-down" size={12} color={theme.text.muted} />
          </TouchableOpacity>
        </View>

        <FlashList
          data={filteredTraders}
          keyExtractor={(item, index) => `${item.address || "trader"}-${index}`}
          renderItem={renderTrader}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </View>
    );
  },
);

TopTraders.displayName = "TopTraders";

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
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
  pnlToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pnlToggleText: {
    fontSize: 12,
  },
  labelFilters: {
    maxHeight: 44,
  },
  labelFiltersContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  labelChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  labelEmoji: {
    fontSize: 12,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "500",
  },
  columnHeaders: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: "500",
  },
  traderColumn: {
    flex: 1.5,
  },
  tradingHeader: {
    flex: 1,
    textAlign: "center",
  },
  remainingHeader: {
    flex: 1,
    textAlign: "center",
  },
  pnlHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  list: {},
  traderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  traderInfo: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rank: {
    fontSize: 12,
    fontWeight: "600",
    width: 24,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  address: {
    fontSize: 12,
    fontWeight: "500",
  },
  traderLabelEmoji: {
    fontSize: 12,
  },
  extraLabels: {
    flexDirection: "row",
    marginTop: 2,
    gap: 2,
  },
  miniLabel: {
    fontSize: 10,
  },
  tradingColumn: {
    flex: 1,
    alignItems: "center",
  },
  bought: {
    fontSize: 11,
    fontWeight: "600",
  },
  sold: {
    fontSize: 11,
    fontWeight: "600",
  },
  remainingColumn: {
    flex: 1,
    alignItems: "center",
  },
  remaining: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  progressBar: {
    width: "80%",
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  pnlColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  pnl: {
    fontSize: 12,
    fontWeight: "700",
  },
  pnlLabel: {
    fontSize: 9,
    marginTop: 2,
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default TopTraders;
