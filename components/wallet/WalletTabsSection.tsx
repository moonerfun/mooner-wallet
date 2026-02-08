/**
 * WalletTabsSection - Horizontal tabs with token lists
 * Tabs: Verified, Trending, Most Held, Graduated
 * Uses live WebSocket data from Pulse V2
 */

import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { getBlockchainSlug } from "@/constants/chains";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useWalletPulseStream,
  useWalletTab,
} from "@/hooks";
import { PulseToken } from "@/store/pulseStore";
import { useWalletTabsStore, WalletTabName } from "@/store/walletTabsStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WalletTokenCard } from "./WalletTokenCard";

interface TabConfig {
  name: WalletTabName;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { name: "trending", label: "Trending", icon: "flame-outline" },
  { name: "verified", label: "Verified", icon: "checkmark-circle-outline" },
  { name: "mostHeld", label: "Most Held", icon: "people-outline" },
  { name: "graduated", label: "Graduated", icon: "school-outline" },
];

// Tab button component
const TabButton = memo(
  ({
    tab,
    isActive,
    onPress,
    tokenCount,
  }: {
    tab: TabConfig;
    isActive: boolean;
    onPress: () => void;
    tokenCount?: number;
  }) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

    return (
      <AnimatedPressable
        onPress={onPress}
        {...AnimatedPressablePresets.tab}
        style={[
          styles.tabButton,
          {
            backgroundColor: isActive
              ? theme.primary.DEFAULT + "20"
              : theme.surface,
            borderColor: isActive ? theme.primary.DEFAULT : theme.border,
            borderRadius: br.lg,
          },
        ]}
      >
        <Ionicons
          name={tab.icon as any}
          size={16}
          color={isActive ? theme.primary.DEFAULT : theme.text.secondary}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: isActive ? theme.primary.DEFAULT : theme.text.secondary,
              fontSize: fs.sm,
            },
          ]}
        >
          {tab.label}
        </Text>
        {tokenCount && tokenCount > 0 && (
          <View
            style={[
              styles.tabBadge,
              {
                backgroundColor: isActive
                  ? theme.primary.DEFAULT
                  : theme.text.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                { color: isActive ? theme.secondary.dark : theme.text.primary },
              ]}
            >
              {tokenCount > 99 ? "99+" : tokenCount}
            </Text>
          </View>
        )}
      </AnimatedPressable>
    );
  },
);
TabButton.displayName = "TabButton";

// Token list for active tab
const TokenList = memo(
  ({
    tabName,
    onTokenPress,
  }: {
    tabName: WalletTabName;
    onTokenPress: (token: PulseToken) => void;
  }) => {
    const { theme, spacing: sp } = useTheme();
    const { tokens, loading, error, tokenCount } = useWalletTab(tabName);

    if (loading && tokens.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading tokens...
          </Text>
        </View>
      );
    }

    if (error && tokens.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        </View>
      );
    }

    if (tokens.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={32} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No tokens found
          </Text>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: sp[4] }}>
        {tokens.map((token) => (
          <WalletTokenCard
            key={`${token.chainId}-${token.address}`}
            token={token}
            tabName={tabName}
            onPress={onTokenPress}
          />
        ))}
      </View>
    );
  },
);
TokenList.displayName = "TokenList";

export function WalletTabsSection() {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const router = useRouter();

  // Initialize WebSocket connection
  const {
    isConnected,
    isStreaming,
    isPaused,
    error: wsError,
    pauseStream,
    resumeStream,
  } = useWalletPulseStream({
    enabled: true,
  });

  // Pause stream when screen loses focus, resume when focused
  useFocusEffect(
    useCallback(() => {
      console.log("[WalletTabs] Screen focused - resuming stream");
      resumeStream();

      return () => {
        console.log("[WalletTabs] Screen unfocused - pausing stream");
        pauseStream();
      };
    }, [pauseStream, resumeStream]),
  );

  // Get active tab and setter
  const activeTab = useWalletTabsStore((state) => state.activeTab);
  const setActiveTab = useWalletTabsStore((state) => state.setActiveTab);

  // Get token counts for badges
  const verifiedCount = useWalletTabsStore(
    (state) => state.tabs.verified.tokens.length,
  );
  const trendingCount = useWalletTabsStore(
    (state) => state.tabs.trending.tokens.length,
  );
  const mostHeldCount = useWalletTabsStore(
    (state) => state.tabs.mostHeld.tokens.length,
  );
  const graduatedCount = useWalletTabsStore(
    (state) => state.tabs.graduated.tokens.length,
  );

  const getTokenCount = (tabName: WalletTabName): number => {
    switch (tabName) {
      case "verified":
        return verifiedCount;
      case "trending":
        return trendingCount;
      case "mostHeld":
        return mostHeldCount;
      case "graduated":
        return graduatedCount;
      default:
        return 0;
    }
  };

  const handleTabPress = useCallback(
    (tabName: WalletTabName) => {
      setActiveTab(tabName);
    },
    [setActiveTab],
  );

  const handleTokenPress = useCallback(
    (token: PulseToken) => {
      // Navigate to token detail page
      // Use getBlockchainSlug to properly convert chainId (e.g. "evm:1" -> "ethereum", "solana:solana" -> "solana")
      const blockchain = getBlockchainSlug(token.chainId || "solana:solana");

      // Debug logging to help diagnose "token not found" issues
      console.log("[WalletTabs] Navigating to token detail:", {
        address: token.address,
        chainId: token.chainId,
        blockchain,
        symbol: token.symbol,
        name: token.name,
        hasLogo: !!token.logo,
        tokenKeys: Object.keys(token),
      });

      router.push({
        pathname: "/token/[blockchain]/[address]" as const,
        params: { blockchain, address: token.address },
      } as any);
    },
    [router],
  );

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={[styles.header, { paddingHorizontal: sp[4] }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.title,
              { color: theme.text.primary, fontSize: fs.lg },
            ]}
          >
            Discover
          </Text>
        </View>
        {wsError && (
          <Ionicons name="alert-circle" size={16} color={theme.error} />
        )}
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.tabsContainer,
          { paddingHorizontal: sp[4] },
        ]}
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.name}
            tab={tab}
            isActive={activeTab === tab.name}
            onPress={() => handleTabPress(tab.name)}
            // tokenCount={getTokenCount(tab.name)}
          />
        ))}
      </ScrollView>

      {/* Token List */}
      <View style={[styles.listContainer, { marginTop: sp[3] }]}>
        <TokenList tabName={activeTab} onTokenPress={handleTokenPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontWeight: "600",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontWeight: "600",
  },
  tabsContainer: {
    gap: 8,
    paddingBottom: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    gap: 6,
  },
  tabLabel: {
    fontWeight: "500",
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  listContainer: {
    minHeight: 200,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  moreText: {
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 8,
  },
});
