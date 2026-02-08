/**
 * SwapPreviewInline Component
 * An inline swipe-to-confirm component for instant swap execution via OneBalance
 */

import { SwipeToConfirm } from "@/components/ui/SwipeToConfirm";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SwapExecutionState } from "../types";

interface SwapPreviewInlineProps {
  executionState: SwapExecutionState;
  isExecuting: boolean;
  isProvisioningSOL?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  theme: {
    background: string;
    surface: string;
    border: string;
    primary: { DEFAULT: string };
    secondary: { dark: string };
    text: { primary: string; secondary: string; muted: string };
    success: string;
    warning: string;
    error: string;
  };
}

export function SwapPreviewInline({
  executionState,
  isExecuting,
  isProvisioningSOL,
  onConfirm,
  onCancel,
  theme,
}: SwapPreviewInlineProps) {
  // Get loading status message
  const getLoadingLabel = () => {
    // Show provisioning message when auto-swapping USDC to SOL for rent
    if (isProvisioningSOL) {
      return "Preparing SOL for fees...";
    }
    if (executionState.statusMessage) {
      return executionState.statusMessage;
    }
    return "Processing swap...";
  };

  return (
    <View style={styles.container}>
      {/* Swipe to Confirm */}
      <View style={styles.swipeContainer}>
        <SwipeToConfirm
          onConfirm={onConfirm}
          label="Swipe to swap"
          confirmLabel="Swapping..."
          disabled={isExecuting}
          loading={isExecuting}
          loadingLabel={getLoadingLabel()}
          theme={theme}
        />
      </View>

      {/* Cancel Link */}
      {onCancel && !isExecuting && (
        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={[styles.cancelText, { color: theme.text.muted }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  swipeContainer: {
    marginBottom: 8,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
