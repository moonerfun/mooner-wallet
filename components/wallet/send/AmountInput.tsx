/**
 * AmountInput Component
 * Amount input with token selector and MAX button
 */

import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AmountInputProps, getTokenLogo } from "./types";

export function AmountInput({
  amount,
  onAmountChange,
  onMax,
  selectedToken,
  onTokenPress,
  tokenSelectorDisabled,
  symbol,
  error,
  availableBalance,
}: AmountInputProps) {
  const { theme } = useTheme();

  const handleTextChange = (text: string) => {
    // Only allow valid number input
    const filtered = text.replace(/[^0-9.]/g, "");
    // Prevent multiple decimal points
    const parts = filtered.split(".");
    const formatted =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
    onAmountChange(formatted);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        Token & Amount
      </Text>

      {/* Token Selector */}
      <TouchableOpacity
        onPress={onTokenPress}
        style={[
          styles.tokenSelector,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        disabled={tokenSelectorDisabled}
      >
        {selectedToken ? (
          <View style={styles.selectedTokenInfo}>
            {(() => {
              const logoUrl = getTokenLogo(selectedToken);
              return logoUrl ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.tokenLogo}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.tokenLogoPlaceholder,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <Text style={{ color: theme.text.muted }}>
                    {selectedToken.symbol.charAt(0)}
                  </Text>
                </View>
              );
            })()}
            <View>
              <Text style={[styles.tokenSymbol, { color: theme.text.primary }]}>
                {selectedToken.symbol}
              </Text>
              <Text
                style={[
                  styles.tokenBalanceSmall,
                  { color: theme.text.secondary },
                ]}
              >
                {selectedToken.balance.toFixed(6)} available
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholderText, { color: theme.text.muted }]}>
            {tokenSelectorDisabled
              ? "Select wallet first"
              : "Select token to send"}
          </Text>
        )}
        <Ionicons name="chevron-down" size={20} color={theme.text.secondary} />
      </TouchableOpacity>

      {/* Amount Input */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.amountInput, { color: theme.text.primary }]}
          placeholder="0.00"
          placeholderTextColor={theme.text.muted}
          value={amount}
          onChangeText={handleTextChange}
          keyboardType="decimal-pad"
        />
        <View style={styles.amountSuffix}>
          <Text style={[styles.symbolText, { color: theme.text.primary }]}>
            {symbol}
          </Text>
          <TouchableOpacity
            onPress={onMax}
            style={[
              styles.maxButton,
              { backgroundColor: `${theme.primary.DEFAULT}20` },
            ]}
          >
            <Text
              style={[styles.maxButtonText, { color: theme.primary.DEFAULT }]}
            >
              MAX
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : null}

      {/* Balance Display */}
      <Text style={[styles.balanceText, { color: theme.text.muted }]}>
        Available: {availableBalance}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
  },
  tokenSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectedTokenInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tokenLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  tokenBalanceSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  placeholderText: {
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "600",
  },
  amountSuffix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: "600",
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  balanceText: {
    fontSize: 13,
    marginTop: 10,
  },
});
