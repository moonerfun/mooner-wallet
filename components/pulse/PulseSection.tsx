/**
 * PulseSection - Section component for Pulse page
 * Shows a list of tokens with search and filter
 */

import { useTheme } from "@/contexts/ThemeContext";
import { usePulseSection } from "@/hooks";
import { PulseToken, ViewName } from "@/store/pulseStore";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PulseTokenCard } from "./PulseTokenCard";

interface PulseSectionProps {
  title: string;
  viewName: ViewName;
  isStreaming: boolean;
  isPaused: boolean;
  contentPaddingBottom?: number;
  onFilterPress?: () => void;
  onTokenPress?: (token: PulseToken) => void;
}

// Status badge component
const StatusBadge = memo(
  ({
    isStreaming,
    isPaused,
    count,
  }: {
    isStreaming: boolean;
    isPaused: boolean;
    count: number;
  }) => {
    const { theme } = useTheme();

    const statusColor = isPaused
      ? theme.warning
      : isStreaming
        ? theme.success
        : theme.error;

    const statusText = isPaused ? "PAUSED" : isStreaming ? "LIVE" : "OFFLINE";

    return (
      <View
        style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>
        {count > 0 && (
          <Text style={[styles.countText, { color: theme.text.secondary }]}>
            · {count}
          </Text>
        )}
      </View>
    );
  },
);
StatusBadge.displayName = "StatusBadge";

export const PulseSection = memo(
  ({
    title,
    viewName,
    isStreaming,
    isPaused,
    contentPaddingBottom = 100,
    onFilterPress,
    onTokenPress,
  }: PulseSectionProps) => {
    const { theme } = useTheme();

    // Get section data from hook
    const {
      tokens,
      filteredTokens,
      isLoading,
      error,
      searchQuery,
      setSearch,
      hasFilters,
    } = usePulseSection(viewName);

    const handleSearchChange = useCallback(
      (text: string) => {
        setSearch(text);
      },
      [setSearch],
    );

    const handleClearSearch = useCallback(() => {
      setSearch("");
    }, [setSearch]);

    // Render token item
    const renderItem = useCallback(
      ({ item }: { item: PulseToken }) => (
        <PulseTokenCard
          token={item}
          viewName={viewName}
          onPress={onTokenPress}
        />
      ),
      [viewName, onTokenPress],
    );

    // Key extractor - must always return unique string
    // Include index to guarantee uniqueness even if duplicates slip through
    const keyExtractor = useCallback((item: PulseToken, index: number) => {
      if (item.chainId && item.address) {
        return `${index}-${item.chainId}-${item.address}`;
      }
      // Fallback with index for tokens missing required fields
      return `token-${index}-${item.symbol || "unknown"}`;
    }, []);

    // Empty state
    const renderEmptyState = useCallback(() => {
      if (isLoading) {
        return (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              Loading tokens...
            </Text>
          </View>
        );
      }

      if (error) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle" size={32} color={theme.error} />
            <Text style={[styles.emptyText, { color: theme.error }]}>
              {error}
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="pulse" size={32} color={theme.text.secondary} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {searchQuery
              ? "No tokens match your search"
              : "Waiting for tokens..."}
          </Text>
        </View>
      );
    }, [isLoading, error, theme, searchQuery]);

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              {title}
            </Text>
            <StatusBadge
              isStreaming={isStreaming}
              isPaused={isPaused}
              count={filteredTokens.length}
            />
          </View>
          <Text style={[styles.count, { color: theme.text.secondary }]}>
            {filteredTokens.length} / {tokens.length}
          </Text>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            onPress={onFilterPress}
            style={[
              styles.filterButton,
              {
                backgroundColor: hasFilters
                  ? `${theme.primary.DEFAULT}20`
                  : theme.surface,
              },
            ]}
          >
            <Ionicons
              name="filter"
              size={16}
              color={hasFilters ? theme.primary.DEFAULT : theme.text.secondary}
            />
          </TouchableOpacity>

          <View
            style={[styles.searchContainer, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="search" size={14} color={theme.text.secondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder="Search tokens..."
              placeholderTextColor={theme.text.secondary}
              value={searchQuery}
              onChangeText={handleSearchChange}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Token List */}
        <FlashList
          data={filteredTokens}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          drawDistance={300}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: contentPaddingBottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {}}
              tintColor={theme.primary.DEFAULT}
            />
          }
        />
      </View>
    );
  },
);
PulseSection.displayName = "PulseSection";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Removed border - cleaner look, cards provide visual separation
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12, // Aligned with list padding
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  countText: {
    fontSize: 10,
    fontWeight: "500",
  },
  count: {
    fontSize: 12,
    fontWeight: "500",
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 12, // Aligned with list padding
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12, // Standardized to LAYOUT.cardPaddingSm
    borderRadius: 8,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  list: {
    paddingHorizontal: 12, // Reduced from 16
    paddingTop: 4, // Reduced from 8
    paddingBottom: 0, // Let contentPaddingBottom handle this
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
