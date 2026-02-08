/**
 * TokenRow Component
 * Individual token row for the token selector list
 */

import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SwapToken } from "../types";

interface TokenRowProps {
  token: SwapToken;
  onPress: () => void;
  theme: {
    text: { primary: string; secondary: string; muted: string };
    border: string;
  };
}

export function TokenRow({ token, onPress, theme }: TokenRowProps) {
  return (
    <TouchableOpacity
      style={[styles.tokenRow, { borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {token.logo ? (
        <Image source={{ uri: token.logo }} style={styles.tokenRowLogo} />
      ) : (
        <View
          style={[
            styles.tokenRowLogoPlaceholder,
            { backgroundColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.text.muted, fontSize: 14 }}>
            {token.symbol.charAt(0)}
          </Text>
        </View>
      )}
      <View style={styles.tokenRowInfo}>
        <Text style={[styles.tokenRowSymbol, { color: theme.text.primary }]}>
          {token.symbol}
        </Text>
        <Text style={[styles.tokenRowName, { color: theme.text.secondary }]}>
          {token.name}
        </Text>
      </View>
      {token.balance && (
        <View style={styles.tokenRowBalance}>
          <Text
            style={[
              styles.tokenRowBalanceAmount,
              { color: theme.text.primary },
            ]}
          >
            {token.balance}
          </Text>
          {token.balanceUsd !== undefined && (
            <Text
              style={[
                styles.tokenRowBalanceUsd,
                { color: theme.text.secondary },
              ]}
            >
              ${token.balanceUsd.toFixed(2)}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  tokenRowLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tokenRowLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenRowInfo: {
    flex: 1,
  },
  tokenRowSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  tokenRowName: {
    fontSize: 13,
    marginTop: 2,
  },
  tokenRowBalance: {
    alignItems: "flex-end",
  },
  tokenRowBalanceAmount: {
    fontSize: 14,
    fontWeight: "500",
  },
  tokenRowBalanceUsd: {
    fontSize: 12,
    marginTop: 2,
  },
});
