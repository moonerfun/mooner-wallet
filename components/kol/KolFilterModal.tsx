/**
 * KolFilterModal - Compact filter modal for KOL leaderboard
 * Similar style to PulseFilterModal
 */

import { useTheme } from "@/contexts/ThemeContext";
import {
  LeaderboardSortBy,
  LeaderboardTimeframe,
  useKolStore,
} from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface KolFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================================
// FILTER CHIP COMPONENT
// ============================================================================

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
          backgroundColor: isSelected ? theme.primary.DEFAULT : theme.surface,
          borderColor: isSelected ? theme.primary.DEFAULT : theme.border,
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

// ============================================================================
// FILTER SECTION COMPONENT
// ============================================================================

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

const FilterSection = memo(({ title, children }: FilterSectionProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
});
FilterSection.displayName = "FilterSection";

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

export const KolFilterModal = memo(
  ({ visible, onClose }: KolFilterModalProps) => {
    const { theme, borderRadius: br } = useTheme();
    const insets = useSafeAreaInsets();

    // Calculate bottom padding for safe area
    const bottomPadding = Platform.select({
      android: Math.max(insets.bottom, 16) + 16,
      ios: insets.bottom + 16,
      default: 34,
    });

    const {
      timeframe,
      sortBy,
      showFollowingOnly,
      setTimeframe,
      setSortBy,
      setShowFollowingOnly,
    } = useKolStore();

    // Local state for applying changes
    const [localTimeframe, setLocalTimeframe] =
      useState<LeaderboardTimeframe>(timeframe);
    const [localSortBy, setLocalSortBy] = useState<LeaderboardSortBy>(sortBy);
    const [localFollowingOnly, setLocalFollowingOnly] =
      useState(showFollowingOnly);

    // Reset local state when modal opens
    React.useEffect(() => {
      if (visible) {
        setLocalTimeframe(timeframe);
        setLocalSortBy(sortBy);
        setLocalFollowingOnly(showFollowingOnly);
      }
    }, [visible, timeframe, sortBy, showFollowingOnly]);

    const handleApply = useCallback(() => {
      setTimeframe(localTimeframe);
      setSortBy(localSortBy);
      setShowFollowingOnly(localFollowingOnly);
      onClose();
    }, [
      localTimeframe,
      localSortBy,
      localFollowingOnly,
      setTimeframe,
      setSortBy,
      setShowFollowingOnly,
      onClose,
    ]);

    const handleReset = useCallback(() => {
      setLocalTimeframe("7d");
      setLocalSortBy("pnl");
      setLocalFollowingOnly(false);
    }, []);

    const timeframes: { value: LeaderboardTimeframe; label: string }[] = [
      { value: "7d", label: "7 Days" },
      { value: "30d", label: "30 Days" },
      { value: "all", label: "All Time" },
    ];

    const sortOptions: {
      value: LeaderboardSortBy;
      label: string;
      icon: string;
    }[] = [
      { value: "pnl", label: "PnL", icon: "trending-up" },
      { value: "volume", label: "Volume", icon: "bar-chart" },
      { value: "trades", label: "Trades", icon: "swap-horizontal" },
      { value: "winRate", label: "Win Rate", icon: "trophy" },
    ];

    // Count active filters
    const activeFilterCount = [
      localTimeframe !== "7d",
      localSortBy !== "pnl",
      localFollowingOnly,
    ].filter(Boolean).length;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />

          <View
            style={[
              styles.container,
              {
                backgroundColor: theme.background,
                borderTopLeftRadius: br.xl,
                borderTopRightRadius: br.xl,
                paddingBottom: bottomPadding,
              },
            ]}
          >
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: theme.border }]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Filters
              </Text>
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetButton}
              >
                <Ionicons name="refresh" size={18} color={theme.text.muted} />
                <Text style={[styles.resetText, { color: theme.text.muted }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Timeframe Section */}
              <FilterSection title="Timeframe">
                <View style={styles.chipsRow}>
                  {timeframes.map((tf) => (
                    <FilterChip
                      key={tf.value}
                      label={tf.label}
                      isSelected={localTimeframe === tf.value}
                      onPress={() => setLocalTimeframe(tf.value)}
                    />
                  ))}
                </View>
              </FilterSection>

              {/* Sort By Section */}
              <FilterSection title="Sort By">
                <View style={styles.chipsRow}>
                  {sortOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setLocalSortBy(option.value)}
                      style={[
                        styles.sortOption,
                        {
                          backgroundColor:
                            localSortBy === option.value
                              ? theme.primary.DEFAULT
                              : theme.surface,
                          borderColor:
                            localSortBy === option.value
                              ? theme.primary.DEFAULT
                              : theme.border,
                          borderRadius: br.md,
                        },
                      ]}
                    >
                      <Ionicons
                        name={option.icon as any}
                        size={16}
                        color={
                          localSortBy === option.value
                            ? theme.secondary.dark
                            : theme.text.secondary
                        }
                      />
                      <Text
                        style={[
                          styles.sortOptionText,
                          {
                            color:
                              localSortBy === option.value
                                ? theme.secondary.dark
                                : theme.text.secondary,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FilterSection>

              {/* Following Toggle */}
              <FilterSection title="Filter">
                <TouchableOpacity
                  onPress={() => setLocalFollowingOnly(!localFollowingOnly)}
                  style={[
                    styles.toggleOption,
                    {
                      backgroundColor: localFollowingOnly
                        ? `${theme.primary.DEFAULT}20`
                        : theme.surface,
                      borderColor: localFollowingOnly
                        ? theme.primary.DEFAULT
                        : theme.border,
                      borderRadius: br.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={localFollowingOnly ? "heart" : "heart-outline"}
                    size={18}
                    color={
                      localFollowingOnly
                        ? theme.primary.DEFAULT
                        : theme.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.toggleOptionText,
                      {
                        color: localFollowingOnly
                          ? theme.primary.DEFAULT
                          : theme.text.secondary,
                      },
                    ]}
                  >
                    Following Only
                  </Text>
                  {localFollowingOnly && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.primary.DEFAULT}
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              </FilterSection>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.footerButton,
                  styles.cancelButton,
                  { borderColor: theme.border, borderRadius: br.md },
                ]}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: theme.text.secondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApply}
                style={[
                  styles.footerButton,
                  styles.applyButton,
                  {
                    backgroundColor: theme.primary.DEFAULT,
                    borderRadius: br.md,
                  },
                ]}
              >
                <Text style={styles.applyButtonText}>
                  Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  },
);
KolFilterModal.displayName = "KolFilterModal";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    maxHeight: "70%",
    // paddingBottom is set dynamically based on safe area insets
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionContent: {},
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  toggleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  checkIcon: {
    marginLeft: "auto",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  applyButton: {},
  applyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F1E33",
  },
});
