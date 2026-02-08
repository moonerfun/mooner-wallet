/**
 * Pulse Screen - Real-time token discovery
 * Shows New Pairs, Final Stretch (Bonding), and Migrated tokens
 * Similar to MTT's Pulse page
 */

import { UnifiedHeader } from "@/components";
import { PulseFilterModal, PulseSection } from "@/components/pulse";
import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { usePulseStream } from "@/hooks";
import { PulseToken, ViewName } from "@/store/pulseStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Tab config
const TABS: {
  title: string;
  viewName: ViewName;
}[] = [
  { title: "New Pairs", viewName: "new" },
  { title: "Final Stretch", viewName: "bonding" },
  { title: "Migrated", viewName: "bonded" },
];

export default function PulseScreen() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate bottom padding to ensure content scrolls above tab bar
  const tabBarHeight =
    56 +
    Platform.select({
      android: Math.max(insets.bottom, 16),
      ios: insets.bottom,
      default: insets.bottom,
    });
  const contentPaddingBottom = tabBarHeight + 16;

  // Active tab
  const [activeTab, setActiveTab] = useState<ViewName>("new");

  // Active section for filter modal
  const [filterViewName, setFilterViewName] = useState<ViewName | null>(null);

  // Handle scroll end to update active tab
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
      const newTab = TABS[pageIndex]?.viewName;
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
      }
    },
    [activeTab],
  );

  // Handle tab press to scroll to section
  const handleTabPress = useCallback((viewName: ViewName) => {
    const tabIndex = TABS.findIndex((t) => t.viewName === viewName);
    if (tabIndex >= 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: tabIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTab(viewName);
  }, []);

  // Connect to Pulse stream
  const {
    isConnected,
    isStreaming,
    isPaused,
    error,
    pauseStream,
    resumeStream,
    applyFilters,
  } = usePulseStream({
    enabled: true,
    chainIds: ["solana:solana"], // Default chain, filters can override per-view
  });

  const handleFilterPress = useCallback((viewName: ViewName) => {
    setFilterViewName(viewName);
  }, []);

  const handleCloseFilter = useCallback(() => {
    setFilterViewName(null);
  }, []);

  const handleApplyFilter = useCallback(() => {
    if (filterViewName) {
      applyFilters(filterViewName);
    }
  }, [filterViewName, applyFilters]);

  const handleTokenPress = useCallback(
    (token: PulseToken) => {
      console.log("Token pressed:", token.symbol, token.address);
      // Navigate to token detail page
      // Convert chainId (e.g. "solana:solana") to blockchain name for URL
      const blockchain = token.chainId?.split(":")[0] || "solana";
      router.push({
        pathname: "/token/[blockchain]/[address]" as const,
        params: { blockchain, address: token.address },
      } as any);
    },
    [router],
  );

  // Pause stream when screen loses focus (navigating to token detail, etc.)
  // Resume when screen regains focus
  useFocusEffect(
    useCallback(() => {
      console.log("[Pulse] Screen focused - resuming stream");
      resumeStream();

      return () => {
        console.log("[Pulse] Screen unfocused - pausing stream");
        pauseStream();
      };
    }, [pauseStream, resumeStream]),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <UnifiedHeader
        onProfilePress={() => router.push("/(main)/(tabs)/settings")}
      />

      {/* Error banner */}
      {error && (
        <View
          style={[styles.errorBanner, { backgroundColor: theme.error + "20" }]}
        >
          <Ionicons name="alert-circle" size={16} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Tab Switcher with Pause Button */}
      <View style={styles.tabRow}>
        <View
          style={[
            styles.tabContainer,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {TABS.map((tab) => (
            <AnimatedPressable
              key={tab.viewName}
              onPress={() => handleTabPress(tab.viewName)}
              {...AnimatedPressablePresets.tab}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    activeTab === tab.viewName
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
                      activeTab === tab.viewName
                        ? theme.secondary.dark
                        : theme.text.secondary,
                  },
                ]}
              >
                {tab.title}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* Pause/Resume button */}
        <AnimatedPressable
          style={[styles.actionButton, { backgroundColor: theme.surface }]}
          onPress={isPaused ? resumeStream : pauseStream}
          {...AnimatedPressablePresets.icon}
        >
          <Ionicons
            name={isPaused ? "play" : "pause"}
            size={16}
            color={theme.text.primary}
          />
        </AnimatedPressable>
      </View>

      {/* Sections - Horizontal scroll with swipe */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.sectionsContainer}
        contentContainerStyle={styles.sectionsContent}
      >
        {TABS.map((tab) => (
          <View
            key={tab.viewName}
            style={[styles.sectionWrapper, { width: SCREEN_WIDTH }]}
          >
            <PulseSection
              title={tab.title}
              viewName={tab.viewName}
              isStreaming={isStreaming}
              isPaused={isPaused}
              contentPaddingBottom={contentPaddingBottom}
              onFilterPress={() => handleFilterPress(tab.viewName)}
              onTokenPress={handleTokenPress}
            />
          </View>
        ))}
      </ScrollView>

      {/* Filter Modal */}
      {filterViewName && (
        <PulseFilterModal
          visible={!!filterViewName}
          onClose={handleCloseFilter}
          viewName={filterViewName}
          onApply={handleApplyFilter}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12, // Aligned with list/card padding
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
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12, // Aligned with list/card padding
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
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
  sectionsContainer: {
    flex: 1,
  },
  sectionsContent: {
    // No padding needed since each section takes full width
  },
  sectionWrapper: {
    paddingHorizontal: 0, // Removed - list handles padding
    paddingTop: 0,
  },
});
