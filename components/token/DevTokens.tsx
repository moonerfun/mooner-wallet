/**
 * Dev Tokens Component
 * Displays tokens created by the same deployer wallet
 */

import { useTheme } from "@/contexts/ThemeContext";
import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import {
  formatMarketCap,
  formatPrice,
  formatTimeAgo,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface DevToken {
  address: string;
  blockchain: string;
  name: string;
  symbol: string;
  logo?: string;
  price: number;
  priceChange24h?: number;
  marketCap?: number;
  createdAt?: string;
  isMigrated?: boolean;
  liquidity?: number;
}

interface DevTokensProps {
  deployerAddress: string;
  blockchain: string;
  currentTokenAddress?: string;
}

export const DevTokens = memo(
  ({ deployerAddress, blockchain, currentTokenAddress }: DevTokensProps) => {
    const { theme } = useTheme();
    const router = useRouter();
    const [tokens, setTokens] = useState<DevToken[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const fetchDevTokens = async () => {
        if (!deployerAddress) return;

        setIsLoading(true);
        setError(null);

        try {
          const client = getMobulaClient();

          // Fetch tokens deployed by this wallet using the proper API endpoint
          // fetchWalletDeployer returns tokens created by the deployer wallet
          const response = await client.fetchWalletPortfolio({
            wallet: deployerAddress,
            blockchains: blockchain,
          });

          if (!response?.data) {
            setTokens([]);
            return;
          }

          // Map response to DevToken format
          // Filter out the current token we're viewing
          const devTokens: DevToken[] = (response.data.assets || [])
            .map((asset: any, index: number) => {
              // Get address from contracts array (first contract) or fallback
              const assetInfo = asset.asset as
                | Record<string, unknown>
                | undefined;
              const contracts = assetInfo?.contracts as string[] | undefined;
              const blockchains = assetInfo?.blockchains as
                | string[]
                | undefined;
              const tokenAddress = contracts?.[0] || `token-${index}`;
              const tokenBlockchain = blockchains?.[0] || blockchain;

              return {
                address: tokenAddress,
                blockchain: tokenBlockchain,
                name: (assetInfo?.name as string) || "Unknown",
                symbol: (assetInfo?.symbol as string) || "???",
                logo: (assetInfo?.logo as string) || undefined,
                price: Number(asset.price) || 0,
                priceChange24h:
                  asset.price_change_24h != null
                    ? Number(asset.price_change_24h)
                    : undefined,
                marketCap:
                  asset.market_cap != null
                    ? Number(asset.market_cap)
                    : undefined,
                createdAt: asset.created_at as string | undefined,
                liquidity:
                  asset.liquidity != null ? Number(asset.liquidity) : undefined,
                isMigrated: Boolean(asset.bonded),
              };
            })
            .filter(
              (t: DevToken) =>
                t.address.toLowerCase() !== currentTokenAddress?.toLowerCase(),
            );

          setTokens(devTokens);
        } catch (err) {
          console.error("Error fetching dev tokens:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load tokens",
          );
        } finally {
          setIsLoading(false);
        }
      };

      fetchDevTokens();
    }, [deployerAddress, blockchain, currentTokenAddress]);

    // Format time ago with "ago" suffix for DevTokens display
    const formatDevTokenTimeAgo = (dateString?: string) => {
      if (!dateString) return "—";
      const result = formatTimeAgo(dateString);
      if (result === "now") return "Today";
      return result ? `${result} ago` : "—";
    };

    const handleTokenPress = (token: DevToken) => {
      router.push(`/token/${token.blockchain}/${token.address}`);
    };

    const renderToken = ({ item }: { item: DevToken }) => {
      const priceChangeColor =
        (item.priceChange24h || 0) >= 0 ? theme.success : theme.error;

      return (
        <TouchableOpacity
          style={[styles.tokenRow, { borderBottomColor: theme.border }]}
          onPress={() => handleTokenPress(item)}
        >
          <View style={styles.tokenInfo}>
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={styles.tokenLogo} />
            ) : (
              <View
                style={[
                  styles.tokenLogoPlaceholder,
                  { backgroundColor: theme.border },
                ]}
              >
                <Text style={{ color: theme.text.muted, fontSize: 12 }}>
                  {item.symbol.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.tokenDetails}>
              <View style={styles.tokenNameRow}>
                <Text
                  style={[styles.tokenSymbol, { color: theme.text.primary }]}
                  numberOfLines={1}
                >
                  {item.symbol}
                </Text>
                {item.isMigrated && (
                  <View
                    style={[
                      styles.migratedBadge,
                      { backgroundColor: theme.success + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.migratedText, { color: theme.success }]}
                    >
                      Migrated
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.tokenName, { color: theme.text.secondary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>
          </View>

          <View style={styles.tokenStats}>
            <Text style={[styles.tokenPrice, { color: theme.text.primary }]}>
              {formatPrice(item.price)}
            </Text>
            {item.priceChange24h !== undefined && (
              <Text style={[styles.priceChange, { color: priceChangeColor }]}>
                {item.priceChange24h >= 0 ? "+" : ""}
                {item.priceChange24h.toFixed(2)}%
              </Text>
            )}
          </View>

          <View style={styles.tokenMeta}>
            <Text style={[styles.marketCap, { color: theme.text.primary }]}>
              {formatMarketCap(item.marketCap)}
            </Text>
            <Text style={[styles.createdAt, { color: theme.text.muted }]}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    };

    if (!deployerAddress) {
      return null;
    }

    if (isLoading) {
      return (
        <View
          style={[styles.loadingContainer, { backgroundColor: theme.surface }]}
        >
          <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading dev tokens...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View
          style={[styles.errorContainer, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="alert-circle" size={24} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text.secondary }]}>
            {error}
          </Text>
        </View>
      );
    }

    if (tokens.length === 0) {
      return (
        <View
          style={[styles.emptyContainer, { backgroundColor: theme.surface }]}
        >
          <Ionicons name="code-slash" size={40} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            No other tokens from this deployer
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <Ionicons
              name="code-slash"
              size={16}
              color={theme.primary.DEFAULT}
            />
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              Dev Tokens ({tokens.length})
            </Text>
          </View>
          <Text style={[styles.deployerAddress, { color: theme.text.muted }]}>
            {deployerAddress.slice(0, 6)}...{deployerAddress.slice(-4)}
          </Text>
        </View>

        {/* Column Headers */}
        <View
          style={[styles.columnHeaders, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[
              styles.columnHeader,
              styles.tokenColumn,
              { color: theme.text.muted },
            ]}
          >
            Token
          </Text>
          <Text
            style={[
              styles.columnHeader,
              styles.priceColumn,
              { color: theme.text.muted },
            ]}
          >
            Price / 24h
          </Text>
          <Text
            style={[
              styles.columnHeader,
              styles.mcapColumn,
              { color: theme.text.muted },
            ]}
          >
            MCap / Age
          </Text>
        </View>

        <FlashList
          data={tokens}
          keyExtractor={(item, index) => `${item.address || "token"}-${index}`}
          renderItem={renderToken}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </View>
    );
  },
);

DevTokens.displayName = "DevTokens";

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  deployerAddress: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  columnHeaders: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: "500",
  },
  tokenColumn: {
    flex: 2,
  },
  priceColumn: {
    flex: 1.2,
    textAlign: "center",
  },
  mcapColumn: {
    flex: 1,
    textAlign: "right",
  },
  list: {},
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tokenInfo: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenDetails: {
    flex: 1,
  },
  tokenNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenSymbol: {
    fontSize: 13,
    fontWeight: "600",
  },
  tokenName: {
    fontSize: 11,
    marginTop: 2,
  },
  migratedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  migratedText: {
    fontSize: 9,
    fontWeight: "600",
  },
  tokenStats: {
    flex: 1.2,
    alignItems: "center",
  },
  tokenPrice: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceChange: {
    fontSize: 11,
    marginTop: 2,
  },
  tokenMeta: {
    flex: 1,
    alignItems: "flex-end",
  },
  marketCap: {
    fontSize: 12,
    fontWeight: "600",
  },
  createdAt: {
    fontSize: 10,
    marginTop: 2,
  },
  loadingContainer: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 12,
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default DevTokens;
