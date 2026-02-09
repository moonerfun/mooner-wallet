/**
 * PulseTokenCard - Token card component for Pulse page
 * Shows token info, price, metrics, and social links
 */

import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { XIcon } from "@/components/ui/XIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { PulseToken } from "@/store/pulseStore";
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
  formatTimeAgo,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Helper to format numbers compactly
const formatNumber = (num?: number): string =>
  formatCompactNumber(num, { decimals: 1 });

interface PulseTokenCardProps {
  token: PulseToken;
  viewName: "new" | "bonding" | "bonded";
  onPress?: (token: PulseToken) => void;
}

// Stat badge component
const StatBadge = memo(
  ({
    icon,
    value,
    color,
    label,
  }: {
    icon: string;
    value: string;
    color: string;
    label: string;
  }) => {
    const { theme } = useTheme();

    return (
      <View style={[styles.statBadge, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon as any} size={10} color={color} />
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
    );
  },
);
StatBadge.displayName = "StatBadge";

// Social button component
const SocialButton = memo(
  ({ icon, url, theme }: { icon: string; url?: string; theme: any }) => {
    const handlePress = useCallback(() => {
      if (url) {
        Linking.openURL(url);
      }
    }, [url]);

    if (!url) return null;

    // Use XIcon for X/Twitter
    const isXIcon = icon === "logo-x";

    return (
      <TouchableOpacity onPress={handlePress} style={styles.socialButton}>
        {isXIcon ? (
          <XIcon size={14} color={theme.text.secondary} />
        ) : (
          <Ionicons name={icon as any} size={14} color={theme.text.secondary} />
        )}
      </TouchableOpacity>
    );
  },
);
SocialButton.displayName = "SocialButton";

export const PulseTokenCard = memo(
  ({ token, viewName, onPress }: PulseTokenCardProps) => {
    const { theme } = useTheme();
    const priceChange = token.priceChange24h || 0;
    const isPositive = priceChange >= 0;

    const handlePress = useCallback(() => {
      onPress?.(token);
    }, [token, onPress]);

    // Determine if we should show bonding progress
    const showBonding =
      viewName === "bonding" && typeof token.bondingPercentage === "number";

    return (
      <AnimatedPressable
        onPress={handlePress}
        {...AnimatedPressablePresets.card}
        style={[
          styles.container,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Top Row: Logo, Name, Price */}
        <View style={styles.topRow}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            {token.logo ? (
              <Image
                source={{ uri: token.logo }}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.logoPlaceholder,
                  { backgroundColor: theme.border },
                ]}
              >
                <Text
                  style={[styles.logoText, { color: theme.text.secondary }]}
                >
                  {token.symbol?.charAt(0) || "?"}
                </Text>
              </View>
            )}
          </View>

          {/* Token Info */}
          <View style={styles.tokenInfo}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.symbol, { color: theme.text.primary }]}
                numberOfLines={1}
              >
                {token.symbol}
              </Text>
              <Text style={[styles.time, { color: theme.text.secondary }]}>
                {formatTimeAgo(token.createdAt)}
              </Text>
            </View>
            <Text
              style={[styles.name, { color: theme.text.secondary }]}
              numberOfLines={1}
            >
              {token.name}
            </Text>
          </View>

          {/* Price */}
          <View style={styles.priceContainer}>
            <Text
              style={[styles.price, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {formatPrice(token.price)}
            </Text>
            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: isPositive
                    ? `${theme.success}20`
                    : `${theme.error}20`,
                },
              ]}
            >
              <Ionicons
                name={isPositive ? "caret-up" : "caret-down"}
                size={10}
                color={isPositive ? theme.success : theme.error}
              />
              <Text
                style={[
                  styles.changeText,
                  {
                    color: isPositive ? theme.success : theme.error,
                  },
                ]}
              >
                {Math.abs(priceChange).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
              MCap
            </Text>
            <Text style={[styles.metricValue, { color: theme.text.primary }]}>
              ${formatNumber(token.marketCap)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
              Liq
            </Text>
            <Text style={[styles.metricValue, { color: theme.text.primary }]}>
              ${formatNumber(token.liquidity)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
              Vol
            </Text>
            <Text style={[styles.metricValue, { color: theme.text.primary }]}>
              ${formatNumber(token.volume24h)}
            </Text>
          </View>
          {showBonding && (
            <View style={styles.metric}>
              <Text
                style={[styles.metricLabel, { color: theme.text.secondary }]}
              >
                Bonding
              </Text>
              <Text style={[styles.metricValue, { color: theme.success }]}>
                {formatPercent(token.bondingPercentage)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Row: Holders, Socials */}
        <View style={styles.bottomRow}>
          {/* Holder stats */}
          <View style={styles.stats}>
            {typeof token.holdersCount === "number" &&
              token.holdersCount > 0 && (
                <StatBadge
                  icon="people"
                  value={formatNumber(token.holdersCount)}
                  color={theme.success}
                  label="Holders"
                />
              )}
            {typeof token.top10Holdings === "number" && (
              <StatBadge
                icon="pie-chart"
                value={`${token.top10Holdings.toFixed(0)}%`}
                color={theme.success}
                label="Top 10"
              />
            )}
            {typeof token.devHoldingsPercentage === "number" && (
              <StatBadge
                icon="code"
                value={`${token.devHoldingsPercentage.toFixed(1)}%`}
                color={theme.warning}
                label="Dev"
              />
            )}
          </View>

          {/* Socials */}
          <View style={styles.socials}>
            <SocialButton
              icon="logo-x"
              url={token.socials?.twitter}
              theme={theme}
            />
            <SocialButton
              icon="globe"
              url={token.socials?.website}
              theme={theme}
            />
            <SocialButton
              icon="paper-plane"
              url={token.socials?.telegram}
              theme={theme}
            />
          </View>
        </View>
      </AnimatedPressable>
    );
  },
);
PulseTokenCard.displayName = "PulseTokenCard";

const styles = StyleSheet.create({
  container: {
    borderRadius: 10, // Reduced from 12
    borderWidth: 0.5, // Reduced from 1 - lighter visual weight
    padding: 10, // Reduced from 12
    marginBottom: 6, // Reduced from 8
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    marginRight: 8, // Reduced from 10
  },
  logo: {
    width: 40, // Standardized with other token cards
    height: 40,
    borderRadius: 20,
  },
  logoPlaceholder: {
    width: 40, // Standardized with other token cards
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 16,
    fontWeight: "700",
  },
  tokenInfo: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  symbol: {
    fontSize: 15,
    fontWeight: "700",
  },
  time: {
    fontSize: 11,
  },
  name: {
    fontSize: 12,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 15,
    fontWeight: "600",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    gap: 2,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    marginTop: 8, // Reduced from 10
    paddingTop: 8, // Reduced from 10
    borderTopWidth: 0.5, // Reduced from 1
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 8, // Reduced from 12
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    marginBottom: 1, // Reduced from 2
  },
  metricValue: {
    fontSize: 12, // Reduced from 13
    fontWeight: "600",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6, // Reduced from 10
    paddingTop: 6, // Reduced from 10
    borderTopWidth: 0.5, // Reduced from 1
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  stats: {
    flexDirection: "row",
    gap: 4, // Reduced from 6
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5, // Reduced from 6
    paddingVertical: 2, // Reduced from 3
    borderRadius: 4,
    gap: 3, // Reduced from 4
  },
  statValue: {
    fontSize: 10, // Reduced from 11
    fontWeight: "500",
  },
  socials: {
    flexDirection: "row",
    gap: 4, // Reduced from 8
  },
  socialButton: {
    padding: 2, // Reduced from 4
  },
});
