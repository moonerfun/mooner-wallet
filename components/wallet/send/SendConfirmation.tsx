/**
 * SendConfirmation Component
 * Confirmation screen with swipe-to-confirm for send transactions
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { SwipeToConfirm } from "@/components/ui/SwipeToConfirm";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SendConfirmationProps } from "./types";

export function SendConfirmation({
  fromAddress,
  toAddress,
  amount,
  tokenSymbol,
  networkName,
  networkLogo,
  networkIcon,
  onConfirm,
  onCancel,
  isLoading,
  formatAddress,
}: SendConfirmationProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${theme.primary.DEFAULT}20` },
            ]}
          >
            <Ionicons name="arrow-up" size={32} color={theme.primary.DEFAULT} />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Confirm Transaction
          </Text>
        </View>

        {/* From */}
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            From
          </Text>
          <Text style={[styles.value, { color: theme.text.primary }]}>
            {formatAddress(fromAddress, 8, 6)}
          </Text>
        </View>

        {/* To */}
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            To
          </Text>
          <Text style={[styles.value, { color: theme.text.primary }]}>
            {formatAddress(toAddress, 8, 6)}
          </Text>
        </View>

        {/* Amount */}
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            Amount
          </Text>
          <Text style={[styles.amount, { color: theme.text.primary }]}>
            {amount} {tokenSymbol}
          </Text>
        </View>

        {/* Network */}
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            Network
          </Text>
          <View style={styles.networkBadge}>
            <ChainIcon
              chainName={networkName}
              logoUrl={networkLogo}
              fallbackIcon={networkIcon}
              size={18}
            />
            <Text style={[styles.networkName, { color: theme.text.primary }]}>
              {networkName}
            </Text>
          </View>
        </View>

        {/* Gas Estimate Info */}
        <View
          style={[styles.gasInfo, { backgroundColor: `${theme.text.muted}10` }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.text.muted}
          />
          <Text style={[styles.gasText, { color: theme.text.secondary }]}>
            Network fee will be calculated before broadcast
          </Text>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.cancelButton, { borderColor: theme.border }]}
          disabled={isLoading}
        >
          <Text
            style={[styles.cancelButtonText, { color: theme.text.secondary }]}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        {/* Swipe to Confirm */}
        <View style={styles.swipeContainer}>
          <SwipeToConfirm
            onConfirm={onConfirm}
            label={`Swipe to send ${amount} ${tokenSymbol}`}
            confirmLabel="Release to send"
            loading={isLoading}
            loadingLabel="Sending..."
            disabled={isLoading}
            theme={theme}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkName: {
    fontSize: 14,
    fontWeight: "500",
  },
  gasInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  gasText: {
    flex: 1,
    fontSize: 12,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  swipeContainer: {
    marginTop: 16,
  },
});
