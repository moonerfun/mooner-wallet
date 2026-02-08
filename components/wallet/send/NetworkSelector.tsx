/**
 * NetworkSelector Component
 * Horizontal scrollable network selection for EVM chains
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { NETWORKS } from "@/constants/turnkey";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NetworkSelectorProps } from "./types";

export function NetworkSelector({
  networks,
  selectedNetwork,
  onSelect,
  getNetworkBalance,
}: NetworkSelectorProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        Network
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.networkList}
      >
        {networks.map((networkKey) => {
          const network = NETWORKS[networkKey];
          const isSelected = selectedNetwork === networkKey;
          const balance = getNetworkBalance(networkKey);

          return (
            <TouchableOpacity
              key={networkKey}
              onPress={() => onSelect(networkKey)}
              style={[
                styles.networkButton,
                {
                  backgroundColor: isSelected
                    ? `${network.color}20`
                    : theme.surface,
                  borderColor: isSelected ? network.color : theme.border,
                },
              ]}
            >
              <ChainIcon
                chainName={network.name}
                logoUrl={network.logo}
                fallbackIcon={network.icon}
                size={18}
              />
              <View>
                <Text
                  style={[
                    styles.networkName,
                    { color: isSelected ? network.color : theme.text.primary },
                  ]}
                >
                  {network.name}
                </Text>
                {balance && (
                  <Text
                    style={[
                      styles.networkBalance,
                      { color: theme.text.secondary },
                    ]}
                  >
                    {balance.balance.toFixed(4)} {balance.symbol}
                  </Text>
                )}
              </View>
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
    marginBottom: 10,
  },
  networkList: {
    gap: 10,
  },
  networkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    minWidth: 100,
  },
  networkName: {
    fontSize: 13,
    fontWeight: "500",
  },
  networkBalance: {
    fontSize: 10,
    marginTop: 2,
  },
});
