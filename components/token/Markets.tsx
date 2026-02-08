/**
 * Markets Component
 * Displays all trading pairs/markets for a token
 */

import { useTheme } from "@/contexts/ThemeContext";
import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import { formatPrice, formatVolume } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import React, { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface Market {
  id: string;
  exchange: string;
  exchangeLogo?: string;
  pair: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  priceChange24h?: number;
  volume24h: number;
  liquidity?: number;
  poolAddress?: string;
  dexUrl?: string;
}

interface MarketsProps {
  tokenAddress: string;
  blockchain: string;
}

// Exchange logo mapping
const EXCHANGE_LOGOS: Record<string, string> = {
  raydium: "https://cryptologos.cc/logos/raydium-ray-logo.png",
  orca: "https://cryptologos.cc/logos/orca-orca-logo.png",
  jupiter: "https://jup.ag/favicon.ico",
  uniswap: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  pancakeswap: "https://cryptologos.cc/logos/pancakeswap-cake-logo.png",
  sushiswap: "https://cryptologos.cc/logos/sushiswap-sushi-logo.png",
};

export const Markets = memo(({ tokenAddress, blockchain }: MarketsProps) => {
  const { theme } = useTheme();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!tokenAddress || !blockchain) return;

      setIsLoading(true);
      setError(null);

      try {
        const client = getMobulaClient();

        // Fetch market pairs/pools for this token using Mobula SDK
        const response = await client.fetchTokenMarkets({
          address: tokenAddress,
          blockchain,
        });

        if (!response?.data) {
          setMarkets([]);
          return;
        }

        // Map response to Market format
        const marketData: Market[] = response.data.map(
          (market: any, index: number) => ({
            id: market.address || `market-${index}`,
            exchange: market.exchange?.name || "Unknown",
            exchangeLogo:
              market.exchange?.logo ||
              EXCHANGE_LOGOS[market.exchange?.name?.toLowerCase()],
            pair: `${market.base?.symbol || "???"}/${market.quote?.symbol || "???"}`,
            baseToken: market.base?.symbol || "???",
            quoteToken: market.quote?.symbol || "???",
            price: market.priceUSD || 0,
            priceChange24h: market.priceChange24hPercentage,
            volume24h: market.volume24hUSD || 0,
            liquidity: market.base?.approximateReserveToken
              ? market.base.approximateReserveToken *
                (market.base.priceUSD || 0) *
                2
              : undefined,
            poolAddress: market.address,
            dexUrl: undefined, // Could be constructed based on exchange
          }),
        );

        setMarkets(marketData);
      } catch (err) {
        console.error("Error fetching markets:", err);
        setError(err instanceof Error ? err.message : "Failed to load markets");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
  }, [tokenAddress, blockchain]);

  const handleMarketPress = (market: Market) => {
    if (market.dexUrl) {
      Linking.openURL(market.dexUrl);
    }
  };

  const renderMarket = ({ item }: { item: Market }) => {
    const priceChangeColor =
      (item.priceChange24h || 0) >= 0 ? theme.success : theme.error;

    return (
      <TouchableOpacity
        style={[styles.marketRow, { borderBottomColor: theme.border }]}
        onPress={() => handleMarketPress(item)}
        disabled={!item.dexUrl}
      >
        {/* Exchange */}
        <View style={styles.exchangeColumn}>
          {item.exchangeLogo ? (
            <Image
              source={{ uri: item.exchangeLogo }}
              style={styles.exchangeLogo}
            />
          ) : (
            <View
              style={[
                styles.exchangeLogoPlaceholder,
                { backgroundColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text.muted, fontSize: 10 }}>
                {item.exchange.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.exchangeName, { color: theme.text.primary }]}>
              {item.exchange}
            </Text>
            <Text style={[styles.pairName, { color: theme.text.secondary }]}>
              {item.pair}
            </Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceColumn}>
          <Text style={[styles.price, { color: theme.text.primary }]}>
            {formatPrice(item.price)}
          </Text>
          {item.priceChange24h !== undefined && (
            <Text style={[styles.priceChange, { color: priceChangeColor }]}>
              {item.priceChange24h >= 0 ? "+" : ""}
              {item.priceChange24h.toFixed(2)}%
            </Text>
          )}
        </View>

        {/* Volume */}
        <View style={styles.volumeColumn}>
          <Text style={[styles.volume, { color: theme.text.primary }]}>
            {formatVolume(item.volume24h)}
          </Text>
          {item.liquidity && (
            <Text style={[styles.liquidity, { color: theme.text.muted }]}>
              Liq: {formatVolume(item.liquidity)}
            </Text>
          )}
        </View>

        {/* Arrow */}
        {item.dexUrl && (
          <Ionicons
            name="open-outline"
            size={14}
            color={theme.text.muted}
            style={styles.openIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.surface }]}
      >
        <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
          Loading markets...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.surface }]}>
        <Ionicons name="alert-circle" size={24} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.text.secondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  if (markets.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.surface }]}>
        <Ionicons name="swap-horizontal" size={40} color={theme.text.muted} />
        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
          No markets available
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          Markets ({markets.length})
        </Text>
      </View>

      {/* Column Headers */}
      <View style={[styles.columnHeaders, { borderBottomColor: theme.border }]}>
        <Text
          style={[
            styles.columnHeader,
            styles.exchangeHeaderColumn,
            { color: theme.text.muted },
          ]}
        >
          Exchange / Pair
        </Text>
        <Text
          style={[
            styles.columnHeader,
            styles.priceHeaderColumn,
            { color: theme.text.muted },
          ]}
        >
          Price
        </Text>
        <Text
          style={[
            styles.columnHeader,
            styles.volumeHeaderColumn,
            { color: theme.text.muted },
          ]}
        >
          24h Vol
        </Text>
      </View>

      <FlashList
        data={markets}
        keyExtractor={(item, index) => `${item.id || "market"}-${index}`}
        renderItem={renderMarket}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );
});

Markets.displayName = "Markets";

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
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
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
  exchangeHeaderColumn: {
    flex: 2,
  },
  priceHeaderColumn: {
    flex: 1.2,
    textAlign: "center",
  },
  volumeHeaderColumn: {
    flex: 1,
    textAlign: "right",
  },
  list: {},
  marketRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  exchangeColumn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exchangeLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  exchangeLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exchangeName: {
    fontSize: 12,
    fontWeight: "600",
  },
  pairName: {
    fontSize: 10,
    marginTop: 2,
  },
  priceColumn: {
    flex: 1.2,
    alignItems: "center",
  },
  price: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceChange: {
    fontSize: 10,
    marginTop: 2,
  },
  volumeColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  volume: {
    fontSize: 12,
    fontWeight: "600",
  },
  liquidity: {
    fontSize: 9,
    marginTop: 2,
  },
  openIcon: {
    marginLeft: 8,
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

export default Markets;
