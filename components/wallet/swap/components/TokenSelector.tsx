/**
 * TokenSelector Component
 * Full-screen token selection with search
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTokenSearch } from "../hooks/useTokenSearch";
import { SwapToken, TokenSelectorMode } from "../types";
import { TokenRow } from "./TokenRow";

interface TokenSelectorProps {
  mode: TokenSelectorMode;
  chainId: number;
  onSelectToken: (token: SwapToken) => void;
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
  };
}

export function TokenSelector({
  mode,
  chainId,
  onSelectToken,
  onClose,
  getTokenBalance,
  theme,
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { results, isSearching, searchTokens, clearSearch, getPopularTokens } =
    useTokenSearch(chainId, getTokenBalance);

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

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    clearSearch();
  }, [clearSearch]);

  const handleSelectToken = useCallback(
    (token: SwapToken) => {
      onSelectToken(token);
      handleClearSearch();
    },
    [onSelectToken, handleClearSearch],
  );

  const handleClose = useCallback(() => {
    handleClearSearch();
    onClose();
  }, [onClose, handleClearSearch]);

  const popularTokens = getPopularTokens();
  const displayTokens = searchQuery.trim() ? results : popularTokens;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Select {mode === "from" ? "From" : "To"} Token
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search */}
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
            placeholder="Search by name or address"
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

      {/* Token List */}
      <ScrollView style={styles.tokenList} showsVerticalScrollIndicator={false}>
        {/* Show loading indicator */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.primary.DEFAULT} />
            <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
              Searching...
            </Text>
          </View>
        )}

        {/* Show results or popular tokens */}
        {!isSearching && displayTokens.length > 0 && (
          <>
            <Text
              style={[styles.tokenListLabel, { color: theme.text.secondary }]}
            >
              {searchQuery.trim() ? "Search Results" : "Popular Tokens"}
            </Text>
            {displayTokens.map((token, index) => (
              <TokenRow
                key={`${token.address}-${token.chainId}-${index}`}
                token={token}
                onPress={() => handleSelectToken(token)}
                theme={theme}
              />
            ))}
          </>
        )}

        {/* No results */}
        {!isSearching && searchQuery.trim() && results.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.text.muted}
            />
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No tokens found
            </Text>
          </View>
        )}
      </ScrollView>
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
    padding: 16,
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
  tokenList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tokenListLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
