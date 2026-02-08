import { PercentageBadge, TokenLogo } from "@/components/market";
import { useTheme } from "@/contexts/ThemeContext";
import { getBlockchainSlug, SearchToken } from "@/lib/services/searchService";
import { useSearchStore } from "@/store/searchStore";
import { formatPrice } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SEARCH_HISTORY_KEY = "@search_history";
const MAX_HISTORY_ITEMS = 10;

export default function SearchScreen() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  const [localQuery, setLocalQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use new search store with fast-search API
  const {
    searchResults,
    trendingTokens,
    isSearching,
    isLoadingTrending,
    search,
    fetchTrending,
    clearSearch,
  } = useSearchStore();

  // Load search history and fetch trending on mount
  useEffect(() => {
    loadSearchHistory();
    fetchTrending();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  };

  const saveSearchHistory = async (history: string[]) => {
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  };

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (h) => h.toLowerCase() !== trimmed.toLowerCase(),
      );
      const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setLocalQuery(query);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!query.trim()) {
        clearSearch();
        return;
      }

      debounceRef.current = setTimeout(() => {
        search(query);
      }, 300);
    },
    [search, clearSearch],
  );

  const handleHistoryPress = (query: string) => {
    setLocalQuery(query);
    search(query);
  };

  const handleTokenPress = useCallback(
    (token: SearchToken) => {
      // Add to search history
      addToHistory(token.symbol || token.name);

      // Navigate to token detail page with blockchain and address
      const blockchain = getBlockchainSlug(token.chainId);
      router.push({
        pathname: "/token/[blockchain]/[address]" as const,
        params: { blockchain, address: token.address },
      } as any);
    },
    [router, addToHistory],
  );

  const clearHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
  };

  const removeHistoryItem = (item: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== item);
      saveSearchHistory(filtered);
      return filtered;
    });
  };

  const renderToken = ({ item }: { item: SearchToken }) => (
    <TouchableOpacity
      onPress={() => handleTokenPress(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: sp[3],
        paddingHorizontal: sp[4],
        gap: sp[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <TokenLogo logo={item.logo ?? undefined} symbol={item.symbol} size="md" />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: fs.base,
            fontWeight: "600",
            color: theme.text.primary,
          }}
          numberOfLines={1}
        >
          {(item.symbol || "???").toUpperCase()}
        </Text>
        <Text
          style={{ fontSize: fs.sm, color: theme.text.secondary }}
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
  );

  const displayTokens = localQuery.length > 0 ? searchResults : trendingTokens;
  const isLoading = localQuery.length > 0 ? isSearching : isLoadingTrending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Search Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: sp[4],
          paddingVertical: sp[3],
          gap: sp[3],
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: br.full,
            backgroundColor: theme.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            height: 44,
            borderRadius: br.lg,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.primary.DEFAULT,
            paddingHorizontal: sp[3],
            gap: sp[2],
          }}
        >
          <Ionicons name="search" size={20} color={theme.text.muted} />
          <TextInput
            value={localQuery}
            onChangeText={handleSearch}
            placeholder="Search tokens, addresses..."
            placeholderTextColor={theme.text.muted}
            autoFocus
            style={{
              flex: 1,
              fontSize: fs.base,
              color: theme.text.primary,
            }}
          />
          {localQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setLocalQuery("");
                clearSearch();
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search History */}
      {localQuery.length === 0 && searchHistory.length > 0 && (
        <View style={{ paddingHorizontal: sp[4], paddingVertical: sp[2] }}>
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp[2] }}>
            {searchHistory.map((item, index) => (
              <View
                key={index}
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
                }}
              >
                <TouchableOpacity onPress={() => handleHistoryPress(item)}>
                  <Text style={{ fontSize: fs.sm, color: theme.text.primary }}>
                    {item}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeHistoryItem(item)}>
                  <Ionicons name="close" size={14} color={theme.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Section Title */}
      <View
        style={{
          paddingHorizontal: sp[4],
          paddingTop: sp[4],
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
          {localQuery.length > 0 ? "Search Results" : "Trending Tokens"}
        </Text>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
          <Text
            style={{
              marginTop: sp[4],
              color: theme.text.muted,
              fontSize: fs.sm,
            }}
          >
            {localQuery.length > 0 ? "Searching..." : "Loading tokens..."}
          </Text>
        </View>
      )}

      {/* Token List */}
      {!isLoading && (
        <FlashList
          data={displayTokens}
          keyExtractor={(item) => `${item.chainId}-${item.address}`}
          renderItem={renderToken}
          drawDistance={300}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: sp[8],
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
                }}
              >
                {localQuery.length > 0
                  ? "No tokens found"
                  : "No trending tokens available"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
