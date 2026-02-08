/**
 * KolFilters - Filter controls for the leaderboard
 */

import { useTheme } from "@/contexts/ThemeContext";
import type { KolTier } from "@/lib/api/supabase/supabaseTypes";
import {
  LeaderboardSortBy,
  LeaderboardTimeframe,
  useKolStore,
} from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const FilterChip = memo(({ label, isSelected, onPress }: FilterChipProps) => {
  const { theme, borderRadius: br } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? theme.primary.DEFAULT : theme.border,
          borderRadius: br.md,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: isSelected ? theme.secondary.dark : theme.text.secondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});
FilterChip.displayName = "FilterChip";

export const KolFilters = memo(() => {
  const { theme, borderRadius: br, spacing: sp } = useTheme();
  const {
    timeframe,
    sortBy,
    tierFilter,
    showFollowingOnly,
    setTimeframe,
    setSortBy,
    setTierFilter,
    setShowFollowingOnly,
  } = useKolStore();

  const timeframes: { value: LeaderboardTimeframe; label: string }[] = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "all", label: "All Time" },
  ];

  const sortOptions: { value: LeaderboardSortBy; label: string }[] = [
    { value: "pnl", label: "PnL" },
    { value: "volume", label: "Volume" },
    { value: "trades", label: "Trades" },
    { value: "winRate", label: "Win Rate" },
  ];

  const tiers: { value: KolTier | "all"; label: string }[] = [
    { value: "all", label: "All Tiers" },
    { value: "diamond", label: "💎 Diamond" },
    { value: "platinum", label: "🏆 Platinum" },
    { value: "gold", label: "🥇 Gold" },
    { value: "silver", label: "🥈 Silver" },
    { value: "bronze", label: "🥉 Bronze" },
  ];

  return (
    <View style={styles.container}>
      {/* Timeframe Filter */}
      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: theme.text.muted }]}>
          Timeframe
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {timeframes.map((tf) => (
            <FilterChip
              key={tf.value}
              label={tf.label}
              isSelected={timeframe === tf.value}
              onPress={() => setTimeframe(tf.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Sort By Filter */}
      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: theme.text.muted }]}>
          Sort By
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {sortOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              isSelected={sortBy === option.value}
              onPress={() => setSortBy(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Tier Filter */}
      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: theme.text.muted }]}>
          Tier
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {tiers.map((tier) => (
            <FilterChip
              key={tier.value}
              label={tier.label}
              isSelected={tierFilter === tier.value}
              onPress={() => setTierFilter(tier.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Following Toggle */}
      <TouchableOpacity
        onPress={() => setShowFollowingOnly(!showFollowingOnly)}
        style={[
          styles.followingToggle,
          {
            backgroundColor: showFollowingOnly
              ? theme.primary.DEFAULT
              : theme.border,
            borderRadius: br.md,
          },
        ]}
      >
        <Ionicons
          name={showFollowingOnly ? "heart" : "heart-outline"}
          size={16}
          color={
            showFollowingOnly ? theme.secondary.dark : theme.text.secondary
          }
        />
        <Text
          style={[
            styles.followingText,
            {
              color: showFollowingOnly
                ? theme.secondary.dark
                : theme.text.secondary,
            },
          ]}
        >
          Following Only
        </Text>
      </TouchableOpacity>
    </View>
  );
});
KolFilters.displayName = "KolFilters";

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  followingToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
  },
  followingText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
