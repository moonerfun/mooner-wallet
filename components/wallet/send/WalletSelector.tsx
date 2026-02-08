/**
 * WalletSelector Component
 * Renders wallet selection for send modal
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WalletSelectorProps } from "./types";

export function WalletSelector({
  wallets,
  selectedWallet,
  onSelect,
  formatAddress,
}: WalletSelectorProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        From Wallet
      </Text>
      <View style={styles.walletList}>
        {wallets.map((wallet) => {
          const isSelected = selectedWallet?.walletType === wallet.walletType;
          return (
            <TouchableOpacity
              key={wallet.walletType}
              onPress={() => onSelect(wallet)}
              style={[
                styles.walletButton,
                {
                  backgroundColor: isSelected
                    ? `${wallet.color}20`
                    : theme.surface,
                  borderColor: isSelected ? wallet.color : theme.border,
                },
              ]}
            >
              <ChainIcon
                chainName={wallet.walletTypeName}
                logoUrl={wallet.logo}
                fallbackIcon={wallet.icon}
                size={24}
              />
              <View style={styles.walletInfo}>
                <Text
                  style={[
                    styles.walletName,
                    { color: isSelected ? wallet.color : theme.text.primary },
                  ]}
                >
                  {wallet.walletTypeName}
                </Text>
                <Text
                  style={[
                    styles.walletAddress,
                    { color: theme.text.secondary },
                  ]}
                >
                  {formatAddress(wallet.address)}
                </Text>
              </View>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={wallet.color}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
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
  walletList: {
    gap: 12,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: "600",
  },
  walletAddress: {
    fontSize: 12,
    marginTop: 2,
  },
});
