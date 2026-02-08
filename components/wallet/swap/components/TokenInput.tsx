/**
 * TokenInput Component
 * Token selection and amount input with proper decimal handling
 * Enhanced to show chain badge on selected token
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { SUPPORTED_CHAINS } from "@/constants/chains";
import { formatBalance, formatUsd, parseAmountInput } from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SwapToken } from "../types";

interface TokenInputProps {
  label: string;
  token: SwapToken | null;
  amount?: string;
  outputAmount?: string;
  outputAmountUsd?: number;
  isLoading?: boolean;
  isEditable?: boolean;
  onAmountChange?: (amount: string) => void;
  onSelectToken: () => void;
  onMaxPress?: () => void;
  theme: {
    surface: string;
    border: string;
    primary: { DEFAULT: string };
    text: { primary: string; secondary: string; muted: string };
  };
}

export function TokenInput({
  label,
  token,
  amount,
  outputAmount,
  outputAmountUsd,
  isLoading,
  isEditable = true,
  onAmountChange,
  onSelectToken,
  onMaxPress,
  theme,
}: TokenInputProps) {
  const showBalance = token && isEditable;
  // Show max button if balance exists and is non-zero (handle both string and number formats)
  const hasBalance =
    token?.balance !== undefined &&
    token.balance !== null &&
    token.balance !== "" &&
    parseFloat(String(token.balance)) > 0;
  const showMaxButton = showBalance && hasBalance && onMaxPress;

  // Handle amount input with proper validation
  const handleAmountChange = useCallback(
    (text: string) => {
      onAmountChange?.(parseAmountInput(text));
    },
    [onAmountChange],
  );

  // Get chain info for the token
  const chainInfo = useMemo(() => {
    if (!token) return null;
    return Object.values(SUPPORTED_CHAINS).find(
      (c) => c.relayChainId === token.chainId,
    );
  }, [token]);

  // Format balance for display
  const displayBalance = token?.balance
    ? formatBalance(token.balance, token.decimals)
    : "0.00";

  // Format USD balance
  const displayBalanceUsd =
    token?.balanceUsd !== undefined && token.balanceUsd > 0
      ? formatUsd(token.balanceUsd)
      : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Token Selector with Chain Badge */}
        <TouchableOpacity style={styles.tokenSelector} onPress={onSelectToken}>
          {token ? (
            <>
              <View style={styles.tokenLogoContainer}>
                {token.logo ? (
                  <Image
                    source={{ uri: token.logo }}
                    style={styles.tokenLogo}
                  />
                ) : (
                  <View
                    style={[
                      styles.tokenLogoPlaceholder,
                      { backgroundColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tokenLogoText,
                        { color: theme.text.muted },
                      ]}
                    >
                      {token.symbol.charAt(0)}
                    </Text>
                  </View>
                )}
                {/* Chain Badge */}
                {chainInfo && (
                  <View
                    style={[
                      styles.chainBadge,
                      {
                        backgroundColor: chainInfo.color,
                        borderColor: theme.surface,
                      },
                    ]}
                  >
                    <ChainIcon
                      chainName={chainInfo.name}
                      logoUrl={chainInfo.logo}
                      fallbackIcon={chainInfo.icon}
                      size={10}
                    />
                  </View>
                )}
              </View>
              <View style={styles.tokenTextContainer}>
                <Text
                  style={[styles.tokenSymbol, { color: theme.text.primary }]}
                >
                  {token.symbol}
                </Text>
                {chainInfo && (
                  <Text style={[styles.chainName, { color: theme.text.muted }]}>
                    {chainInfo.name}
                  </Text>
                )}
              </View>
            </>
          ) : (
            <Text style={[styles.selectText, { color: theme.primary.DEFAULT }]}>
              Select token
            </Text>
          )}
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.text.secondary}
          />
        </TouchableOpacity>

        {/* Amount Input or Output */}
        {isEditable ? (
          <TextInput
            style={[styles.amountInput, { color: theme.text.primary }]}
            placeholder="0.0"
            placeholderTextColor={theme.text.muted}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
          />
        ) : (
          <View style={styles.outputContainer}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
            ) : (
              <Text
                style={[
                  styles.outputAmount,
                  {
                    color: outputAmount ? theme.text.primary : theme.text.muted,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {outputAmount ? String(outputAmount) : "0.0"}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Balance and Max Button */}
      {showBalance && (
        <View style={styles.balanceRow}>
          <Text style={[styles.balanceLabel, { color: theme.text.secondary }]}>
            Balance: {displayBalance} {token.symbol}
            {displayBalanceUsd && ` (${displayBalanceUsd})`}
          </Text>
          {showMaxButton && (
            <TouchableOpacity
              onPress={onMaxPress}
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
          )}
        </View>
      )}

      {/* USD Value for output */}
      {!isEditable && outputAmountUsd !== undefined && outputAmountUsd > 0 && (
        <Text style={[styles.usdValue, { color: theme.text.secondary }]}>
          ≈ {formatUsd(outputAmountUsd)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "visible",
  },
  tokenSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  tokenLogoContainer: {
    width: 36,
    height: 36,
    position: "relative",
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
  tokenLogoText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chainBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenTextContainer: {
    flexDirection: "column",
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  chainName: {
    fontSize: 11,
    marginTop: 1,
  },
  selectText: {
    fontSize: 16,
    fontWeight: "600",
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "600",
    textAlign: "right",
    marginLeft: 16,
  },
  outputContainer: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 16,
    minWidth: 100,
  },
  outputAmount: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "right",
    paddingRight: 2,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  balanceLabel: {
    fontSize: 13,
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  usdValue: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
});
