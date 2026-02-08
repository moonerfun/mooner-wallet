/**
 * WalletTokenCard - Simple list row for wallet page discover tabs
 * Shows: Logo | Ticker + MCap | Price + Change + Volume
 */

import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { PulseToken } from "@/store/pulseStore";
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
} from "@/utils/formatters";
import React, { memo, useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface WalletTokenCardProps {
  token: PulseToken;
  tabName: "verified" | "trending" | "mostHeld" | "graduated";
  onPress?: (token: PulseToken) => void;
}

// Helper to format numbers with $ prefix
const formatUSD = (num?: number): string =>
  formatCompactNumber(num, { prefix: "$", decimals: 1 });

export const WalletTokenCard = memo(
  ({ token, tabName, onPress }: WalletTokenCardProps) => {
    const { theme, borderRadius: br } = useTheme();
    const priceChange = token.priceChange1h ?? token.priceChange24h ?? 0;
    const isPositive = priceChange >= 0;

    const handlePress = useCallback(() => {
      onPress?.(token);
    }, [token, onPress]);

    return (
      <AnimatedPressable
        onPress={handlePress}
        {...AnimatedPressablePresets.card}
        style={styles.container}
      >
        {/* Logo */}
        {token.logo ? (
          <Image
            source={{ uri: token.logo }}
            style={[styles.logo, { borderRadius: br.full }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.logo,
              styles.logoPlaceholder,
              { backgroundColor: theme.border, borderRadius: br.full },
            ]}
          >
            <Text style={[styles.logoText, { color: theme.text.secondary }]}>
              {String(token.symbol || "?")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}

        {/* Ticker + MCap */}
        <View style={styles.infoContainer}>
          <Text
            style={[styles.symbol, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {String(token.symbol || "???")}
          </Text>
          <Text style={[styles.mcap, { color: theme.text.muted }]}>
            {formatUSD(token.marketCap)} MC
          </Text>
        </View>

        {/* Price + Change + Volume */}
        <View style={styles.rightContainer}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: theme.text.primary }]}>
              {formatPrice(token.price)}
            </Text>
            <Text
              style={[
                styles.change,
                { color: isPositive ? theme.success : theme.error },
              ]}
            >
              {formatPercent(priceChange, { showSign: true, decimals: 1 })}
            </Text>
          </View>
          <Text style={[styles.volume, { color: theme.text.muted }]}>
            Vol: {formatUSD(token.volume1h || token.volume24h)}
          </Text>
        </View>
      </AnimatedPressable>
    );
  },
);
WalletTokenCard.displayName = "WalletTokenCard";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoContainer: {
    flex: 1,
  },
  symbol: {
    fontSize: 15,
    fontWeight: "700",
  },
  mcap: {
    fontSize: 12,
    marginTop: 2,
  },
  rightContainer: {
    alignItems: "flex-end",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: "600",
  },
  change: {
    fontSize: 13,
    fontWeight: "600",
  },
  volume: {
    fontSize: 12,
    marginTop: 2,
  },
});
