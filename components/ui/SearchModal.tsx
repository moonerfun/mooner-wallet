/**
 * SearchModal - Full-screen search modal
 * Contains blockchain filters, trending tokens, search functionality
 * Slides up from UnifiedHeader search bar
 */

import { useTheme } from "@/contexts/ThemeContext";
import {
  getBlockchainName,
  getBlockchainSlug,
  SearchToken,
  SORT_OPTIONS,
  SortOption,
} from "@/lib/services/searchService";
import { SEARCH_CHAINS, useSearchStore } from "@/store/searchStore";
import { formatPrice } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const SEARCH_HISTORY_KEY = "@search_history_v2";

// Token logo component with fallback
const TokenLogo = ({
  logo,
  symbol,
  size = 40,
}: {
  logo: string | null;
  symbol: string;
  size?: number;
}) => {
  const { theme } = useTheme();
  const [hasError, setHasError] = useState(false);

  if (!logo || hasError) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primary.DEFAULT + "20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: theme.primary.DEFAULT,
            fontWeight: "bold",
            fontSize: size * 0.35,
          }}
        >
          {symbol?.slice(0, 2).toUpperCase() || "??"}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: logo }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.surface,
      }}
      onError={() => setHasError(true)}
    />
  );
};

// Percentage badge component
const PercentageBadge = ({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) => {
  const { theme, fontSize: fs, spacing: sp, borderRadius: br } = useTheme();
  const isPositive = value >= 0;

  const textSize = size === "sm" ? fs.xs : fs.sm;
  const padding = size === "sm" ? sp[1] : sp[1.5];

  return (
    <View
      style={{
        backgroundColor: isPositive ? theme.success + "15" : theme.error + "15",
        paddingHorizontal: sp[2],
        paddingVertical: padding,
        borderRadius: br.sm,
      }}
    >
      <Text
        style={{
          color: isPositive ? theme.success : theme.error,
          fontSize: textSize,
          fontWeight: "600",
        }}
      >
        {isPositive ? "+" : ""}
        {value?.toFixed(2) || "0.00"}%
      </Text>
    </View>
  );
};

// Blockchain chip component
const BlockchainChip = ({
  chain,
  selected,
  onPress,
}: {
  chain: { id: string; name: string; icon?: string };
  selected: boolean;
  onPress: () => void;
}) => {
  const { theme, fontSize: fs, spacing: sp, borderRadius: br } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: sp[3],
        paddingVertical: sp[2],
        borderRadius: br.full,
        backgroundColor: selected
          ? theme.primary.DEFAULT + "20"
          : theme.surface,
        borderWidth: 1,
        borderColor: selected ? theme.primary.DEFAULT : theme.border,
        gap: sp[1.5],
        marginRight: sp[2],
      }}
    >
      {chain.icon && (
        <Image
          source={{ uri: chain.icon }}
          style={{ width: 18, height: 18, borderRadius: 9 }}
        />
      )}
      <Text
        style={{
          color: selected ? theme.primary.DEFAULT : theme.text.secondary,
          fontSize: fs.sm,
          fontWeight: selected ? "600" : "500",
        }}
      >
        {chain.name}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={theme.primary.DEFAULT}
        />
      )}
    </TouchableOpacity>
  );
};

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SearchModal({ visible, onClose }: SearchModalProps) {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // Store state
  const {
    query,
    searchResults,
    trendingTokens,
    isSearching,
    isLoadingTrending,
    searchError,
    selectedChains,
    sortBy,
    searchHistory,
    setQuery,
    search,
    fetchTrending,
    setSelectedChains,
    setSortBy,
    addToHistory,
    removeFromHistory,
    clearHistory,
    clearSearch,
  } = useSearchStore();

  // Local state
  const [showFilters, setShowFilters] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (visible) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      // Fetch trending tokens
      fetchTrending();
    } else {
      // Clear search when modal closes
      setLocalQuery("");
      clearSearch();
    }
  }, [visible]);

  // Sync local query with store
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Load search history from storage on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Load search history
  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        const parsed = JSON.parse(history);
        parsed.forEach((q: string) => addToHistory(q));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  };

  // Save search history
  const saveSearchHistory = async () => {
    try {
      await AsyncStorage.setItem(
        SEARCH_HISTORY_KEY,
        JSON.stringify(searchHistory),
      );
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  };

  // Save history when it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      saveSearchHistory();
    }
  }, [searchHistory]);

  // Handle search input with debounce
  const handleSearchInput = useCallback(
    (text: string) => {
      setLocalQuery(text);
      setQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!text.trim()) {
        clearSearch();
        return;
      }

      debounceRef.current = setTimeout(() => {
        search(text);
      }, 300);
    },
    [search, setQuery, clearSearch],
  );

  // Handle search submit
  const handleSearchSubmit = useCallback(() => {
    if (localQuery.trim()) {
      addToHistory(localQuery.trim());
      search(localQuery);
    }
  }, [localQuery, search, addToHistory]);

  // Handle history item press
  const handleHistoryPress = useCallback(
    (historyQuery: string) => {
      setLocalQuery(historyQuery);
      setQuery(historyQuery);
      search(historyQuery);
    },
    [search, setQuery],
  );

  // Handle token press - navigate to detail
  const handleTokenPress = useCallback(
    (token: SearchToken) => {
      // Add to search history
      addToHistory(token.symbol);

      // Close modal first
      onClose();

      // Navigate to token detail page
      const blockchain = getBlockchainSlug(token.chainId);
      router.push({
        pathname: "/token/[blockchain]/[address]" as const,
        params: { blockchain, address: token.address },
      } as any);
    },
    [router, addToHistory, onClose],
  );

  // Handle clear search
  const handleClear = useCallback(() => {
    setLocalQuery("");
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  // Handle chain filter toggle
  const handleChainToggle = useCallback(
    (chainId: string) => {
      const newChains = selectedChains.includes(chainId)
        ? selectedChains.filter((id) => id !== chainId)
        : [...selectedChains, chainId];

      setSelectedChains(newChains);

      // Re-search or re-fetch with new filters
      if (localQuery.trim()) {
        search(localQuery, { blockchains: newChains });
      } else {
        fetchTrending({ blockchains: newChains });
      }
    },
    [selectedChains, setSelectedChains, localQuery, search, fetchTrending],
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSortBy(newSort);
      setShowFilters(false);

      // Re-search or re-fetch with new sort
      if (localQuery.trim()) {
        search(localQuery, { sortBy: newSort });
      } else {
        fetchTrending({ sortBy: newSort });
      }
    },
    [setSortBy, localQuery, search, fetchTrending],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (localQuery.trim()) {
      search(localQuery);
    } else {
      fetchTrending();
    }
  }, [localQuery, search, fetchTrending]);

  // Determine what to display
  const displayTokens = localQuery.length > 0 ? searchResults : trendingTokens;
  const isLoading = localQuery.length > 0 ? isSearching : isLoadingTrending;
  const sectionTitle = localQuery.length > 0 ? "Search Results" : "Trending";

  // Render token item
  const renderToken = useCallback(
    ({ item }: { item: SearchToken }) => (
      <TouchableOpacity
        onPress={() => handleTokenPress(item)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: sp[3],
          paddingHorizontal: sp[3],
          gap: sp[3],
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TokenLogo logo={item.logo} symbol={item.symbol} size={44} />

        <View style={{ flex: 1 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: sp[2] }}
          >
            <Text
              style={{
                fontSize: fs.base,
                fontWeight: "700",
                color: theme.text.primary,
              }}
              numberOfLines={1}
            >
              {item.symbol?.toUpperCase() || "???"}
            </Text>
            <View
              style={{
                backgroundColor: theme.surface,
                paddingHorizontal: sp[1.5],
                paddingVertical: 2,
                borderRadius: br.sm,
              }}
            >
              <Text style={{ fontSize: fs.xs, color: theme.text.muted }}>
                {item.blockchain || getBlockchainName(item.chainId)}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontSize: fs.sm,
              color: theme.text.secondary,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text
            style={{
              fontSize: fs.base,
              fontWeight: "600",
              color: theme.text.primary,
            }}
          >
            {formatPrice(item.priceUSD)}
          </Text>
          <PercentageBadge value={item.priceChange24hPercentage} size="sm" />
        </View>
      </TouchableOpacity>
    ),
    [theme, fs, sp, br, handleTokenPress],
  );

  // Render search history
  const renderSearchHistory = () => {
    if (localQuery.length > 0 || searchHistory.length === 0) {
      return null;
    }

    return (
      <View style={{ paddingHorizontal: sp[3], paddingVertical: sp[2] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: sp[2],
          }}
        >
          <Text
            style={{
              fontSize: fs.sm,
              fontWeight: "600",
              color: theme.text.secondary,
            }}
          >
            Recent Searches
          </Text>
          <TouchableOpacity onPress={clearHistory}>
            <Text style={{ fontSize: fs.sm, color: theme.primary.DEFAULT }}>
              Clear All
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: sp[3] }}
        >
          {searchHistory.map((item, index) => (
            <View
              key={`${item}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: sp[3],
                paddingVertical: sp[1.5],
                backgroundColor: theme.surface,
                borderRadius: br.full,
                borderWidth: 1,
                borderColor: theme.border,
                gap: sp[1],
                marginRight: sp[2],
              }}
            >
              <TouchableOpacity onPress={() => handleHistoryPress(item)}>
                <Text style={{ fontSize: fs.sm, color: theme.text.primary }}>
                  {item}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeFromHistory(item)}>
                <Ionicons name="close" size={14} color={theme.text.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background }}
        edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
      >
        {/* Header with Search Input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: sp[3],
            paddingVertical: sp[3],
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            gap: sp[3],
          }}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
          </TouchableOpacity>

          {/* Search Input */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              height: 40,
              borderRadius: br.lg,
              backgroundColor: theme.surface,
              borderWidth: 0.5,
              borderColor: localQuery ? theme.primary.DEFAULT : theme.border,
              paddingHorizontal: sp[3],
              gap: sp[2],
            }}
          >
            <Ionicons name="search" size={20} color={theme.text.muted} />
            <TextInput
              ref={inputRef}
              value={localQuery}
              onChangeText={handleSearchInput}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Search tokens, symbols, addresses..."
              placeholderTextColor={theme.text.muted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                fontSize: fs.base,
                color: theme.text.primary,
              }}
            />
            {localQuery.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.text.muted}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              style={{
                padding: sp[1],
                backgroundColor:
                  selectedChains.length > 0
                    ? theme.primary.DEFAULT + "20"
                    : "transparent",
                borderRadius: br.sm,
              }}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={
                  selectedChains.length > 0
                    ? theme.primary.DEFAULT
                    : theme.text.muted
                }
              />
              {selectedChains.length > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: theme.primary.DEFAULT,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 9,
                      fontWeight: "bold",
                    }}
                  >
                    {selectedChains.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Blockchain Filters - Horizontal Scroll */}
        <View style={{ paddingVertical: sp[2] }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: sp[3] }}
          >
            <BlockchainChip
              chain={{ id: "all", name: "All Chains" }}
              selected={selectedChains.length === 0}
              onPress={() => {
                setSelectedChains([]);
                if (localQuery.trim()) {
                  search(localQuery, { blockchains: [] });
                } else {
                  fetchTrending({ blockchains: [] });
                }
              }}
            />
            {SEARCH_CHAINS.map((chain) => (
              <BlockchainChip
                key={chain.id}
                chain={chain}
                selected={selectedChains.includes(chain.id)}
                onPress={() => handleChainToggle(chain.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Search History */}
        {renderSearchHistory()}

        {/* Section Title */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: sp[3],
            paddingTop: sp[3],
            paddingBottom: sp[2],
          }}
        >
          <Text
            style={{
              fontSize: fs.base,
              fontWeight: "600",
              color: theme.text.primary,
            }}
          >
            {sectionTitle}
            {displayTokens.length > 0 && (
              <Text style={{ color: theme.text.muted, fontWeight: "normal" }}>
                {" "}
                ({displayTokens.length})
              </Text>
            )}
          </Text>

          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: sp[1] }}
          >
            <Text style={{ fontSize: fs.sm, color: theme.text.secondary }}>
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && displayTokens.length === 0 && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
            <Text
              style={{
                marginTop: sp[4],
                color: theme.text.muted,
                fontSize: fs.sm,
              }}
            >
              {localQuery.length > 0 ? "Searching..." : "Loading trending..."}
            </Text>
          </View>
        )}

        {/* Error State */}
        {searchError && !isLoading && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: sp[3],
            }}
          >
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={theme.error}
            />
            <Text
              style={{
                marginTop: sp[4],
                color: theme.text.primary,
                fontSize: fs.base,
                textAlign: "center",
              }}
            >
              {searchError}
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                marginTop: sp[4],
                paddingHorizontal: sp[4],
                paddingVertical: sp[2],
                backgroundColor: theme.primary.DEFAULT,
                borderRadius: br.md,
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Token List */}
        {!isLoading && !searchError && (
          <FlashList
            data={displayTokens}
            keyExtractor={(item) => `${item.chainId}-${item.address}`}
            renderItem={renderToken}
            drawDistance={300}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={handleRefresh}
                tintColor={theme.primary.DEFAULT}
              />
            }
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: sp[12],
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={theme.text.muted}
                />
                <Text
                  style={{
                    marginTop: sp[4],
                    color: theme.text.muted,
                    fontSize: fs.base,
                    textAlign: "center",
                  }}
                >
                  {localQuery.length > 0
                    ? "No tokens found for your search"
                    : "No trending tokens available"}
                </Text>
                {localQuery.length > 0 && (
                  <Text
                    style={{
                      marginTop: sp[2],
                      color: theme.text.muted,
                      fontSize: fs.sm,
                      textAlign: "center",
                    }}
                  >
                    Try adjusting your filters or search term
                  </Text>
                )}
              </View>
            }
          />
        )}

        {/* Filter/Sort Modal */}
        <Modal
          visible={showFilters}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowFilters(false)}
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: theme.background }}
            edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: sp[4],
                paddingVertical: sp[3],
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <Text
                style={{
                  fontSize: fs.lg,
                  fontWeight: "bold",
                  color: theme.text.primary,
                }}
              >
                Sort & Filter
              </Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {/* Sort Options */}
              <View style={{ padding: sp[4] }}>
                <Text
                  style={{
                    fontSize: fs.base,
                    fontWeight: "600",
                    color: theme.text.primary,
                    marginBottom: sp[3],
                  }}
                >
                  Sort By
                </Text>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleSortChange(option.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: sp[3],
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.base,
                        color:
                          sortBy === option.value
                            ? theme.primary.DEFAULT
                            : theme.text.primary,
                        fontWeight: sortBy === option.value ? "600" : "normal",
                      }}
                    >
                      {option.label}
                    </Text>
                    {sortBy === option.value && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={theme.primary.DEFAULT}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Chain Filters */}
              <View style={{ padding: sp[4] }}>
                <Text
                  style={{
                    fontSize: fs.base,
                    fontWeight: "600",
                    color: theme.text.primary,
                    marginBottom: sp[3],
                  }}
                >
                  Blockchains
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedChains([]);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: sp[3],
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fs.base,
                      color:
                        selectedChains.length === 0
                          ? theme.primary.DEFAULT
                          : theme.text.primary,
                      fontWeight:
                        selectedChains.length === 0 ? "600" : "normal",
                    }}
                  >
                    All Chains
                  </Text>
                  {selectedChains.length === 0 && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.primary.DEFAULT}
                    />
                  )}
                </TouchableOpacity>
                {SEARCH_CHAINS.map((chain) => (
                  <TouchableOpacity
                    key={chain.id}
                    onPress={() => handleChainToggle(chain.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: sp[3],
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: sp[3],
                      }}
                    >
                      {chain.icon && (
                        <Image
                          source={{ uri: chain.icon }}
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                        />
                      )}
                      <Text
                        style={{
                          fontSize: fs.base,
                          color: selectedChains.includes(chain.id)
                            ? theme.primary.DEFAULT
                            : theme.text.primary,
                          fontWeight: selectedChains.includes(chain.id)
                            ? "600"
                            : "normal",
                        }}
                      >
                        {chain.name}
                      </Text>
                    </View>
                    {selectedChains.includes(chain.id) && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={theme.primary.DEFAULT}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Apply Button */}
            <View
              style={{
                padding: sp[4],
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowFilters(false);
                  handleRefresh();
                }}
                style={{
                  backgroundColor: theme.primary.DEFAULT,
                  paddingVertical: sp[3],
                  borderRadius: br.lg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "bold",
                    fontSize: fs.base,
                  }}
                >
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
