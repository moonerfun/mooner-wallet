/**
 * TokenSelectorModal Component
 * Modal for selecting tokens to send
 */

import { useTheme } from "@/contexts/ThemeContext";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TokenSelectorModalProps, getTokenLogo } from "./types";

export function TokenSelectorModal({
  visible,
  onClose,
  tokens,
  onSelect,
  networkName,
}: TokenSelectorModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Select Token
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Token List */}
        <ScrollView style={styles.tokenList}>
          {tokens.map((token, index) => {
            const logoUrl = getTokenLogo(token);
            return (
              <TouchableOpacity
                key={`${token.symbol}-${index}`}
                style={[styles.tokenRow, { borderBottomColor: theme.border }]}
                onPress={() => {
                  onSelect(token);
                  onClose();
                }}
              >
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.tokenLogo}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View
                    style={[
                      styles.tokenLogoPlaceholder,
                      { backgroundColor: theme.border },
                    ]}
                  >
                    <Text style={{ color: theme.text.muted }}>
                      {token.symbol.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.tokenInfo}>
                  <Text
                    style={[styles.tokenSymbol, { color: theme.text.primary }]}
                  >
                    {token.symbol}
                  </Text>
                  <Text
                    style={[styles.tokenName, { color: theme.text.secondary }]}
                  >
                    {token.name}
                  </Text>
                </View>
                <View style={styles.tokenBalance}>
                  <Text
                    style={[
                      styles.tokenBalanceAmount,
                      { color: theme.text.primary },
                    ]}
                  >
                    {token.balance.toFixed(6)}
                  </Text>
                  <Text
                    style={[
                      styles.tokenBalanceUsd,
                      { color: theme.text.secondary },
                    ]}
                  >
                    {formatUSD(token.valueUsd)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Empty State */}
          {tokens.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="wallet-outline"
                size={48}
                color={theme.text.muted}
              />
              <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                No tokens found on {networkName || "this network"}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  tokenList: {
    flex: 1,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
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
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  tokenName: {
    fontSize: 13,
    marginTop: 2,
  },
  tokenBalance: {
    alignItems: "flex-end",
  },
  tokenBalanceAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  tokenBalanceUsd: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
