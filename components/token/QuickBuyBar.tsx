/**
 * QuickBuyBar Component
 * Compact quick buy buttons for instant token purchases
 * Executes swaps directly without opening a modal
 */

import { useTheme } from "@/contexts/ThemeContext";
import { useQuickBuy } from "@/hooks/useQuickBuy";
import { useSettingsStore } from "@/store/settingsStore";
import { TokenDetails } from "@/store/tokenStore";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface QuickBuyBarProps {
  token: TokenDetails;
}

export function QuickBuyBar({ token }: QuickBuyBarProps) {
  const { theme } = useTheme();
  const quickBuyAmounts = useSettingsStore((s) => s.quickBuyAmounts);
  const quickBuyDefaultAmount = useSettingsStore(
    (s) => s.quickBuyDefaultAmount,
  );
  const setQuickBuyDefaultAmount = useSettingsStore(
    (s) => s.setQuickBuyDefaultAmount,
  );

  // Use the quick buy hook for instant execution
  const { executeBuy, state, usdcBalance } = useQuickBuy(token);

  const handlePress = useCallback(
    async (amount: number) => {
      if (state.isExecuting) return;
      // Execute the buy directly - haptic feedback is handled in the hook
      await executeBuy(amount);
    },
    [state.isExecuting, executeBuy],
  );

  const handleLongPress = useCallback(
    (amount: number) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      setQuickBuyDefaultAmount(amount);
    },
    [setQuickBuyDefaultAmount],
  );

  const canAfford = useCallback(
    (amount: number) => usdcBalance >= amount,
    [usdcBalance],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text.secondary }]}>
        Quick Buy
      </Text>
      <View style={styles.buttonsRow}>
        {quickBuyAmounts.map((amount) => {
          const isDefault = amount === quickBuyDefaultAmount;
          const affordable = canAfford(amount);
          const isCurrentlyExecuting =
            state.isExecuting && state.executingAmount === amount;

          return (
            <TouchableOpacity
              key={amount}
              style={[
                styles.button,
                {
                  backgroundColor: isDefault ? theme.success : theme.surface,
                  borderColor: isDefault ? theme.success : theme.border,
                  opacity: affordable ? 1 : 0.4,
                },
              ]}
              onPress={() => handlePress(amount)}
              onLongPress={() => handleLongPress(amount)}
              disabled={!affordable || state.isExecuting}
              activeOpacity={0.7}
            >
              {isCurrentlyExecuting ? (
                <ActivityIndicator
                  size="small"
                  color={isDefault ? "#fff" : theme.primary.DEFAULT}
                />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: isDefault ? "#fff" : theme.text.primary,
                      fontWeight: isDefault ? "700" : "600",
                    },
                  ]}
                >
                  ${amount}
                </Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
  },
});
