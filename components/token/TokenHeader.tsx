/**
 * Token Header Component
 * Displays token name, price, socials, and key info
 */

import { toast } from "@/components/ui/Toast";
import { useTheme } from "@/contexts/ThemeContext";
import { TokenDetails } from "@/store/tokenStore";
import {
  formatPrice,
  formatPriceChange,
  formatTimeAgo,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { memo, useCallback } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface TokenHeaderProps {
  token: TokenDetails;
  onBack?: () => void;
  isLive?: boolean;
}

export const TokenHeader = memo(
  ({ token, onBack, isLive }: TokenHeaderProps) => {
    const { theme } = useTheme();

    // Ensure string values for display (API might return numbers)
    const tokenName = String(token.name || "Unknown");
    const tokenSymbol = String(token.symbol || "???");

    const formatChange = (change?: number) => {
      if (change === undefined || change === null) return null;
      const isPositive = change >= 0;
      return {
        value: formatPriceChange(change),
        color: isPositive ? theme.success : theme.error,
      };
    };

    const handleCopyAddress = useCallback(async () => {
      await Clipboard.setStringAsync(token.address);
      toast.success("Copied", "Contract address copied to clipboard");
    }, [token.address]);

    const handleOpenLink = useCallback((url?: string) => {
      if (url) {
        Linking.openURL(url.startsWith("http") ? url : `https://${url}`);
      }
    }, []);

    const formatAge = (createdAt?: string) => {
      if (!createdAt) return null;
      return formatTimeAgo(createdAt) || null;
    };

    const priceChange = formatChange(token.priceChange24h);
    const age = formatAge(token.createdAt);

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Top Row: Back button and socials */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
          </TouchableOpacity>

          <View style={styles.socialLinks}>
            {token.twitter && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface },
                ]}
                onPress={() =>
                  handleOpenLink(`https://twitter.com/${token.twitter}`)
                }
              >
                <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
              </TouchableOpacity>
            )}
            {token.telegram && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface },
                ]}
                onPress={() => handleOpenLink(`https://t.me/${token.telegram}`)}
              >
                <Ionicons name="paper-plane" size={16} color="#0088cc" />
              </TouchableOpacity>
            )}
            {token.website && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface },
                ]}
                onPress={() => handleOpenLink(token.website)}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Token Info Row */}
        <View style={styles.tokenInfoRow}>
          {/* Logo and Name - with shared transition tag for smooth navigation */}
          <View style={styles.tokenIdentity}>
            <View style={styles.tokenLogoContainer}>
              {token.logo ? (
                <Image
                  source={{ uri: token.logo }}
                  style={styles.tokenLogo}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.tokenLogoPlaceholder,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenLogoText,
                      { color: theme.text.secondary },
                    ]}
                  >
                    {tokenSymbol.charAt(0) || "?"}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.tokenNameContainer}>
              <Text
                style={[styles.tokenName, { color: theme.text.primary }]}
                numberOfLines={1}
              >
                {tokenName}
              </Text>
              <View style={styles.tokenMeta}>
                <Text
                  style={[styles.tokenSymbol, { color: theme.text.secondary }]}
                >
                  {tokenSymbol}
                </Text>
                {token.exchange?.name && (
                  <View
                    style={[
                      styles.exchangeBadge,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.exchangeName,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {String(token.exchange.name)}
                    </Text>
                  </View>
                )}
                {age && (
                  <Text style={[styles.age, { color: theme.text.muted }]}>
                    {age} ago
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: theme.text.primary }]}>
                {formatPrice(token.price)}
              </Text>
              {isLive && (
                <View style={styles.liveBadge}>
                  <View
                    style={[styles.liveDot, { backgroundColor: theme.success }]}
                  />
                  <Text style={[styles.liveText, { color: theme.success }]}>
                    LIVE
                  </Text>
                </View>
              )}
            </View>
            {priceChange && (
              <Text style={[styles.priceChange, { color: priceChange.color }]}>
                {priceChange.value}
              </Text>
            )}
          </View>
        </View>

        {/* Address Row */}
        <TouchableOpacity
          style={[styles.addressRow, { backgroundColor: theme.surface }]}
          onPress={handleCopyAddress}
        >
          <Text style={[styles.addressLabel, { color: theme.text.secondary }]}>
            CA:
          </Text>
          <Text
            style={[styles.address, { color: theme.text.primary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {token.address}
          </Text>
          <Ionicons
            name="copy-outline"
            size={14}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
      </View>
    );
  },
);

TokenHeader.displayName = "TokenHeader";

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  socialLinks: {
    flexDirection: "row",
    gap: 8,
  },
  socialButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  tokenLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  tokenLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tokenLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenLogoText: {
    fontSize: 20,
    fontWeight: "700",
  },
  tokenNameContainer: {
    flex: 1,
  },
  tokenName: {
    fontSize: 18,
    fontWeight: "700",
  },
  tokenMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: "500",
  },
  exchangeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exchangeName: {
    fontSize: 11,
    fontWeight: "600",
  },
  age: {
    fontSize: 12,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  address: {
    fontSize: 12,
    fontFamily: "monospace",
    flex: 1,
  },
});
