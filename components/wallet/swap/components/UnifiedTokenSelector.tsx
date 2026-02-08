/**
 * UnifiedTokenSelector Component
 * Modern token selection modal inspired by Bitget Wallet
 *
 * Features:
 * - Chain filter tabs at the top (All chains or specific chain)
 * - Tokens grouped by chain with chain badges
 * - Portfolio tokens shown first (sorted by USD value)
 * - Search across all chains simultaneously
 * - Auto-detects cross-chain vs same-chain swap based on selection
 * - No separate network selection step - chain is embedded in token selection
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { SUPPORTED_CHAINS } from "@/constants/chains";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMultiChainTokenSearch } from "../hooks/useMultiChainTokenSearch";
import { SwapToken, SwapWalletAccount, TokenSelectorMode } from "../types";

interface UnifiedTokenSelectorProps {
  mode: TokenSelectorMode;
  accounts: SwapWalletAccount[];
  onSelectToken: (token: SwapToken, chain: SwapWalletAccount) => void;
  onClose: () => void;
  getTokenBalance?: (
    token: SwapToken,
  ) => { balance: string; balanceUsd: number } | null;
  theme: {
    background: string;
    surface: string;
    border: string;
    primary: { DEFAULT: string };
    text: { primary: string; secondary: string; muted: string };
    status?: { success?: string };
  };
  /** Pre-selected chain key for filtering (optional) */
  initialChainFilter?: string | null;
  /** Other token already selected (to show route indicator) */
  otherToken?: SwapToken | null;
}

interface ChainTab {
  key: string | null; // null = "All"
  name: string;
  logo?: string;
  color: string;
  icon?: string;
}

export function UnifiedTokenSelector({
  mode,
  accounts,
  onSelectToken,
  onClose,
  getTokenBalance,
  theme,
  initialChainFilter = null,
  otherToken,
}: UnifiedTokenSelectorProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChainFilter, setSelectedChainFilter] = useState<string | null>(
    initialChainFilter,
  );

  // Build chain tabs from available accounts
  const chainTabs: ChainTab[] = useMemo(() => {
    const tabs: ChainTab[] = [
      { key: null, name: "All", color: theme.primary.DEFAULT },
    ];

    // Get unique chains from accounts
    const seenChains = new Set<string>();
    accounts.forEach((account) => {
      if (!seenChains.has(account.chainName)) {
        seenChains.add(account.chainName);
        tabs.push({
          key: account.chainName,
          name: account.chainName,
          logo: account.chainLogo,
          color: account.chainColor,
          icon: account.chainIcon,
        });
      }
    });

    return tabs;
  }, [accounts, theme.primary.DEFAULT]);

  // Get chain IDs for search based on filter
  const searchChainIds = useMemo(() => {
    if (selectedChainFilter) {
      // Find the chain config for the selected filter
      const chainConfig = Object.values(SUPPORTED_CHAINS).find(
        (c) => c.name === selectedChainFilter,
      );
      return chainConfig ? [chainConfig.relayChainId] : [];
    }
    // Return all chain IDs from accounts
    return accounts
      .map((account) => {
        const chainConfig = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.name === account.chainName,
        );
        return chainConfig?.relayChainId;
      })
      .filter((id): id is number => id !== undefined);
  }, [selectedChainFilter, accounts]);

  // Multi-chain token search hook
  const {
    results,
    portfolioTokens,
    popularTokens,
    isSearching,
    isLoadingTrending,
    searchTokens,
    clearSearch,
  } = useMultiChainTokenSearch(searchChainIds, getTokenBalance);

  // Handle search input
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.trim()) {
        searchTokens(text);
      } else {
        clearSearch();
      }
    },
    [searchTokens, clearSearch],
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    clearSearch();
  }, [clearSearch]);

  // Handle token selection
  const handleSelectToken = useCallback(
    (token: SwapToken) => {
      // Find the matching account for this token's chain
      const chainConfig = Object.values(SUPPORTED_CHAINS).find(
        (c) => c.relayChainId === token.chainId,
      );
      const account = accounts.find((a) => a.chainName === chainConfig?.name);

      if (account) {
        onSelectToken(token, account);
        handleClearSearch();
      }
    },
    [accounts, onSelectToken, handleClearSearch],
  );

  // Filter and sort tokens for display
  // When not searching: show all popular tokens with held tokens on top
  // When searching: show search results
  const displayTokens = useMemo(() => {
    if (searchQuery.trim()) {
      // Searching - show search results, filter by chain if selected
      let tokens = results;
      if (selectedChainFilter) {
        const chainConfig = Object.values(SUPPORTED_CHAINS).find(
          (c) => c.name === selectedChainFilter,
        );
        if (chainConfig) {
          tokens = tokens.filter((t) => t.chainId === chainConfig.relayChainId);
        }
      }
      return tokens;
    }

    // Not searching - show popular tokens with held tokens on top
    let tokens = [...popularTokens];

    // Filter by selected chain if not "All"
    if (selectedChainFilter) {
      const chainConfig = Object.values(SUPPORTED_CHAINS).find(
        (c) => c.name === selectedChainFilter,
      );
      if (chainConfig) {
        tokens = tokens.filter((t) => t.chainId === chainConfig.relayChainId);
      }
    }

    // Sort: tokens with balance first (by USD value), then tokens without balance
    return tokens.sort((a, b) => {
      const aBalance = parseFloat(a.balance || "0");
      const bBalance = parseFloat(b.balance || "0");
      const aHasBalance = aBalance > 0;
      const bHasBalance = bBalance > 0;

      // Tokens with balance come first
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;

      // Among tokens with balance, sort by USD value
      if (aHasBalance && bHasBalance) {
        const aUsd = a.balanceUsd || 0;
        const bUsd = b.balanceUsd || 0;
        return bUsd - aUsd;
      }

      // Tokens without balance - keep original order (popular tokens order)
      return 0;
    });
  }, [searchQuery, results, popularTokens, selectedChainFilter]);

  // Check if selecting this token would create a cross-chain swap
  const isCrossChainToken = useCallback(
    (token: SwapToken): boolean => {
      if (!otherToken) return false;
      return token.chainId !== otherToken.chainId;
    },
    [otherToken],
  );

  // Get chain info for a token
  const getChainInfo = useCallback((chainId: number) => {
    return Object.values(SUPPORTED_CHAINS).find(
      (c) => c.relayChainId === chainId,
    );
  }, []);

  // Render chain filter tab
  const renderChainTab = useCallback(
    (tab: ChainTab) => {
      const isSelected = selectedChainFilter === tab.key;
      return (
        <TouchableOpacity
          key={tab.key || "all"}
          onPress={() => setSelectedChainFilter(tab.key)}
          style={[
            styles.chainTab,
            {
              backgroundColor: isSelected ? `${tab.color}20` : theme.surface,
              borderColor: isSelected ? tab.color : theme.border,
            },
          ]}
        >
          {tab.logo ? (
            <ChainIcon
              chainName={tab.name}
              logoUrl={tab.logo}
              fallbackIcon={tab.icon}
              size={18}
            />
          ) : tab.key === null ? (
            <Ionicons name="layers-outline" size={18} color={tab.color} />
          ) : null}
          <Text
            style={[
              styles.chainTabText,
              { color: isSelected ? tab.color : theme.text.primary },
            ]}
          >
            {tab.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedChainFilter, theme],
  );

  // Render token row
  const renderTokenRow = useCallback(
    ({ item: token }: { item: SwapToken }) => {
      const chainInfo = getChainInfo(token.chainId);
      const isCrossChain = isCrossChainToken(token);
      const balanceData = getTokenBalance?.(token);
      const displayBalance = balanceData?.balance || token.balance || "0";
      const displayBalanceUsd =
        balanceData?.balanceUsd || token.balanceUsd || 0;

      return (
        <TouchableOpacity
          style={[styles.tokenRow, { borderBottomColor: theme.border }]}
          onPress={() => handleSelectToken(token)}
          activeOpacity={0.7}
        >
          {/* Token Logo with Chain Badge */}
          <View style={styles.tokenLogoContainer}>
            {token.logo ? (
              <Image source={{ uri: token.logo }} style={styles.tokenLogo} />
            ) : (
              <View
                style={[
                  styles.tokenLogoPlaceholder,
                  { backgroundColor: theme.border },
                ]}
              >
                <Text
                  style={[styles.tokenLogoText, { color: theme.text.muted }]}
                >
                  {token.symbol.charAt(0)}
                </Text>
              </View>
            )}
            {/* Chain Badge */}
            {chainInfo && (
              <View
                style={[
                  styles.chainBadge,
                  {
                    backgroundColor: chainInfo.color,
                    borderColor: theme.background,
                  },
                ]}
              >
                <ChainIcon
                  chainName={chainInfo.name}
                  logoUrl={chainInfo.logo}
                  fallbackIcon={chainInfo.icon}
                  size={12}
                />
              </View>
            )}
          </View>

          {/* Token Info */}
          <View style={styles.tokenInfo}>
            <View style={styles.tokenNameRow}>
              <Text
                style={[styles.tokenSymbol, { color: theme.text.primary }]}
                numberOfLines={1}
              >
                {token.symbol}
              </Text>
              {isCrossChain && (
                <View
                  style={[
                    styles.crossChainBadge,
                    { backgroundColor: `${theme.primary.DEFAULT}20` },
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={10}
                    color={theme.primary.DEFAULT}
                  />
                  <Text
                    style={[
                      styles.crossChainBadgeText,
                      { color: theme.primary.DEFAULT },
                    ]}
                  >
                    Bridge
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.tokenSubRow}>
              <Text
                style={[styles.tokenName, { color: theme.text.secondary }]}
                numberOfLines={1}
              >
                {token.name}
              </Text>
            </View>
          </View>

          {/* Balance Info */}
          <View style={styles.balanceContainer}>
            <Text
              style={[styles.balanceAmount, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {parseFloat(displayBalance).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}
            </Text>
            {displayBalanceUsd > 0 && (
              <Text
                style={[styles.balanceUsd, { color: theme.text.secondary }]}
              >
                $
                {displayBalanceUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [
      theme,
      getChainInfo,
      isCrossChainToken,
      getTokenBalance,
      handleSelectToken,
      selectedChainFilter,
    ],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.border,
            paddingTop: insets.top > 0 ? 8 : 16,
          },
        ]}
      >
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Select {mode === "from" ? "Token to Swap" : "Token to Receive"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInput,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={20} color={theme.text.muted} />
          <TextInput
            style={[styles.searchText, { color: theme.text.primary }]}
            placeholder="Search by name, symbol, or address"
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chain Filter Tabs */}
      <View style={styles.chainTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chainTabsList}
        >
          {chainTabs.map(renderChainTab)}
        </ScrollView>
      </View>

      {/* Token List */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primary.DEFAULT} size="large" />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Searching across chains...
          </Text>
        </View>
      ) : displayTokens.length > 0 ? (
        <FlashList
          data={displayTokens}
          keyExtractor={(item, index) =>
            `${item.address}-${item.chainId}-${index}`
          }
          renderItem={renderTokenRow}
          drawDistance={300}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tokenList}
          ListHeaderComponent={
            <View style={styles.listHeaderRow}>
              <Text
                style={[styles.sectionLabel, { color: theme.text.secondary }]}
              >
                {searchQuery.trim()
                  ? "Search Results"
                  : selectedChainFilter
                    ? `${selectedChainFilter} Tokens`
                    : "Select Token"}
              </Text>
              {isLoadingTrending && !searchQuery.trim() && (
                <ActivityIndicator
                  size="small"
                  color={theme.text.muted}
                  style={styles.trendingLoader}
                />
              )}
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {searchQuery.trim()
              ? "No tokens found"
              : `No tokens available${selectedChainFilter ? ` on ${selectedChainFilter}` : ""}`}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.text.muted }]}>
            {searchQuery.trim()
              ? "Try searching by name, symbol, or contract address"
              : "Try selecting a different network or search for a token"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
  },
  chainTabsContainer: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "transparent", // Will be set by theme
  },
  chainTabsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chainTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chainTabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tokenList: {
    paddingBottom: 20,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  trendingLoader: {
    marginLeft: 8,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tokenLogoContainer: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tokenLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenLogoText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chainBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenInfo: {
    flex: 1,
    marginRight: 12,
  },
  tokenNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  crossChainBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  crossChainBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  tokenSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 8,
  },
  tokenName: {
    fontSize: 13,
    flex: 1,
  },
  tokenChain: {
    fontSize: 11,
    fontWeight: "500",
  },
  balanceContainer: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: "500",
  },
  balanceUsd: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: "center",
  },
});
