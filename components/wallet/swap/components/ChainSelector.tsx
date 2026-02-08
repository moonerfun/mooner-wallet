/**
 * ChainSelector Component
 * Horizontal scrolling chain selection
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SwapWalletAccount } from "../types";

interface ChainSelectorProps {
  label: string;
  accounts: SwapWalletAccount[];
  selectedAccount: SwapWalletAccount | null;
  onSelectAccount: (account: SwapWalletAccount) => void;
  theme: {
    surface: string;
    border: string;
    text: { primary: string; secondary: string };
  };
}

export function ChainSelector({
  label,
  accounts,
  selectedAccount,
  onSelectAccount,
  theme,
}: ChainSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chainList}
      >
        {accounts.map((account) => {
          // For EVM chains, same address is used across all chains, so compare by chainName too
          const isSelected = 
            selectedAccount?.address === account.address &&
            selectedAccount?.chainName === account.chainName;
          return (
            <TouchableOpacity
              key={`${account.chainName}-${account.address}`}
              onPress={() => onSelectAccount(account)}
              style={[
                styles.chainButton,
                {
                  backgroundColor: isSelected
                    ? `${account.chainColor}20`
                    : theme.surface,
                  borderColor: isSelected ? account.chainColor : theme.border,
                },
              ]}
            >
              <ChainIcon
                chainName={account.chainName}
                logoUrl={account.chainLogo}
                fallbackIcon={account.chainIcon}
                size={18}
              />
              <Text
                style={[
                  styles.chainName,
                  {
                    color: isSelected ? account.chainColor : theme.text.primary,
                  },
                ]}
              >
                {account.chainName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    marginBottom: 12,
  },
  chainList: {
    gap: 12,
  },
  chainButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  chainName: {
    fontSize: 14,
    fontWeight: "600",
  },
});
