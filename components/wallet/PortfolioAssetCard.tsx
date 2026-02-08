/**
 * PortfolioAssetCard - Displays a single token holding from the user's portfolio
 * Shows token name, balance, price, value, and 24h change
 * Features shared element transitions for smooth navigation to token details
 */

import { useTheme } from "@/contexts/ThemeContext";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { PortfolioAsset } from "@/store/portfolioStore";
import {
  formatPercent,
  formatPrice,
  formatTokenAmount,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PortfolioAssetCardProps {
  asset: PortfolioAsset;
  onPress?: (asset: PortfolioAsset) => void;
  /** Index for staggered animation delay */
  index?: number;
}

// Format token balance with symbol
const formatBalanceWithSymbol = (balance: number, symbol: string): string => {
  return `${formatTokenAmount(balance)} ${symbol}`;
};

// Format percentage with sign
const formatPercentWithSign = (value: number): string => {
  return formatPercent(value, { decimals: 2, showSign: true });
};

export const PortfolioAssetCard = memo(
  ({ asset, onPress, index = 0 }: PortfolioAssetCardProps) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
    const priceChange = asset.priceChange24h || 0;
    const isPositive = priceChange >= 0;

    // Scale animation for press feedback
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    return (
      <AnimatedPressable
        onPress={() => onPress?.(asset)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          styles.container,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: br.lg,
          },
        ]}
      >
        {/* Token Logo */}
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: theme.background, borderRadius: br.full },
          ]}
        >
          {asset.logo ? (
            <Image
              source={{ uri: asset.logo }}
              style={styles.logo}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.logoPlaceholder,
                { backgroundColor: theme.primary.DEFAULT + "20" },
              ]}
            >
              <Text style={[styles.logoText, { color: theme.primary.DEFAULT }]}>
                {asset.symbol?.charAt(0) || "?"}
              </Text>
            </View>
          )}
        </View>

        {/* Token Info */}
        <View style={styles.infoContainer}>
          <View style={styles.topRow}>
            <View style={styles.nameContainer}>
              <Text
                style={[
                  styles.symbol,
                  { color: theme.text.primary, fontSize: 15 },
                ]}
                numberOfLines={1}
              >
                {asset.symbol}
              </Text>
              <Text
                style={[
                  styles.name,
                  { color: theme.text.secondary, fontSize: fs.xs },
                ]}
                numberOfLines={1}
              >
                {asset.name}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text
                style={[
                  styles.value,
                  { color: theme.text.primary, fontSize: 15 },
                ]}
              >
                {formatUSD(asset.valueUsd)}
              </Text>
              <View style={styles.changeContainer}>
                <Ionicons
                  name={isPositive ? "caret-up" : "caret-down"}
                  size={12}
                  color={isPositive ? theme.success : theme.error}
                />
                <Text
                  style={[
                    styles.change,
                    {
                      color: isPositive ? theme.success : theme.error,
                      fontSize: 13,
                    },
                  ]}
                >
                  {formatPercent(priceChange)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.balance,
                { color: theme.text.secondary, fontSize: fs.sm },
              ]}
              numberOfLines={1}
            >
              {formatBalanceWithSymbol(asset.balance, asset.symbol)}
            </Text>
            <Text
              style={[
                styles.price,
                { color: theme.text.muted, fontSize: fs.xs },
              ]}
            >
              @ {formatPrice(asset.price)}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  },
);
PortfolioAssetCard.displayName = "PortfolioAssetCard";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10, // Aligned with PulseTokenCard
    borderWidth: 0.5, // Lighter border like PulseTokenCard
    marginBottom: 6, // Aligned with PulseTokenCard
  },
  logoContainer: {
    width: 40, // Slightly smaller like PulseTokenCard
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    marginRight: 10, // Tighter spacing
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
  },
  infoContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  symbol: {
    fontWeight: "600",
  },
  name: {
    marginTop: 2,
  },
  valueContainer: {
    alignItems: "flex-end",
  },
  value: {
    fontWeight: "600",
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  change: {
    marginLeft: 2,
    fontWeight: "500",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balance: {
    flex: 1,
  },
  price: {},
});
