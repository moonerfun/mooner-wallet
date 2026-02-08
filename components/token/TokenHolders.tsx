/**
 * Token Holders Component
 * Displays token holder distribution with wallet addresses
 */

import { useTheme } from "@/contexts/ThemeContext";
import { Holder } from "@/store/tokenStore";
import { useTraderModalStore } from "@/store/traderModalStore";
import { formatCompactNumber, truncateAddress } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TokenHoldersProps {
  holders: Holder[];
  blockchain: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onHolderPress?: (holder: Holder) => void;
}

export const TokenHolders = memo(
  ({
    holders,
    blockchain,
    isLoading,
    onRefresh,
    onHolderPress,
  }: TokenHoldersProps) => {
    const { theme } = useTheme();
    const { openModal } = useTraderModalStore();

    // Use unified formatters
    const formatBalance = (balance: number) =>
      formatCompactNumber(balance, { decimals: 2 });

    const shortenAddress = (address: string) => truncateAddress(address, 6, 4);

    const handleHolderPress = (holder: Holder) => {
      if (onHolderPress) {
        onHolderPress(holder);
      } else {
        openModal(holder.address, blockchain);
      }
    };

    const renderHolder = ({ item, index }: { item: Holder; index: number }) => {
      const isTop10 = index < 10;

      return (
        <TouchableOpacity
          style={[styles.holderRow, { borderBottomColor: theme.border }]}
          onPress={() => handleHolderPress(item)}
        >
          <View style={styles.rankContainer}>
            <Text
              style={[
                styles.rank,
                {
                  color: isTop10 ? theme.primary.DEFAULT : theme.text.muted,
                },
              ]}
            >
              #{index + 1}
            </Text>
          </View>

          <View style={styles.holderInfo}>
            <View style={styles.addressRow}>
              <Text style={[styles.address, { color: theme.text.primary }]}>
                {shortenAddress(item.address)}
              </Text>
              {item.isContract && (
                <View
                  style={[
                    styles.contractBadge,
                    { backgroundColor: theme.warning + "20" },
                  ]}
                >
                  <Text style={[styles.contractText, { color: theme.warning }]}>
                    Contract
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.balance, { color: theme.text.secondary }]}>
              {formatBalance(item.balance)} tokens
            </Text>
          </View>

          <View style={styles.percentContainer}>
            <Text style={[styles.percent, { color: theme.text.primary }]}>
              {item.percentage.toFixed(2)}%
            </Text>
            <View
              style={[styles.percentBar, { backgroundColor: theme.border }]}
            >
              <View
                style={[
                  styles.percentFill,
                  {
                    backgroundColor: theme.primary.DEFAULT,
                    width: `${Math.min(item.percentage * 2, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.text.muted}
            style={styles.chevron}
          />
        </TouchableOpacity>
      );
    };

    if (holders.length === 0 && !isLoading) {
      return (
        <View
          style={[styles.emptyContainer, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="people" size={40} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No holder data available
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Top Holders ({holders.length})
          </Text>
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh}>
              <Ionicons name="refresh" size={18} color={theme.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <FlashList
          data={holders}
          keyExtractor={(item, index) => `${item.address}-${index}`}
          renderItem={renderHolder}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </View>
    );
  },
);

TokenHolders.displayName = "TokenHolders";

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
  list: {},
  holderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  rankContainer: {
    width: 30,
  },
  rank: {
    fontSize: 12,
    fontWeight: "700",
  },
  holderInfo: {
    flex: 1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  address: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "monospace",
  },
  contractBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contractText: {
    fontSize: 9,
    fontWeight: "700",
  },
  balance: {
    fontSize: 11,
    marginTop: 2,
  },
  percentContainer: {
    alignItems: "flex-end",
    width: 80,
  },
  percent: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  percentBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  percentFill: {
    height: "100%",
    borderRadius: 2,
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
  chevron: {
    marginLeft: 4,
  },
});
