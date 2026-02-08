/**
 * QuoteDetails Component
 * Displays swap quote information for OneBalance
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { UnifiedSwapQuote } from "../types";

interface QuoteDetailsProps {
  quote: UnifiedSwapQuote;
  theme: {
    surface: string;
    border: string;
    primary: { DEFAULT: string };
    text: { primary: string; secondary: string };
    success: string;
    warning: string;
  };
}

export function QuoteDetails({ quote, theme }: QuoteDetailsProps) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {/* Cross-Chain Banner */}
      {quote.isCrossChain && (
        <View style={[styles.row, styles.crossChainBanner]}>
          <View style={styles.crossChainInfo}>
            <Ionicons name="flash" size={16} color={theme.primary.DEFAULT} />
            <Text
              style={[
                styles.label,
                { color: theme.primary.DEFAULT, fontWeight: "600" },
              ]}
            >
              Cross-Chain via OneBalance
            </Text>
          </View>
          <Text style={[styles.value, { color: theme.success }]}>
            ~{quote.timeEstimate}s
          </Text>
        </View>
      )}

      {/* Price Impact */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          Price Impact
        </Text>
        <Text
          style={[
            styles.value,
            {
              color: quote.priceImpact > 1 ? theme.warning : theme.success,
            },
          ]}
        >
          {quote.priceImpact.toFixed(2)}%
        </Text>
      </View>

      {/* Network Fee */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          Network Fee
        </Text>
        <Text style={[styles.value, { color: theme.text.primary }]}>
          ~${quote.estimatedGasUsd.toFixed(2)}
        </Text>
      </View>

      {/* Route */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          Route
        </Text>
        <Text style={[styles.value, { color: theme.text.primary }]}>
          via {quote.provider}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  crossChainBanner: {
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  crossChainInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: "500",
  },
});
