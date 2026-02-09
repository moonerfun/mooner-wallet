/**
 * Quick Buy Settings Screen
 * Dedicated screen for managing quick buy preferences
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QuickBuySettings } from "@/components/settings";
import { useTheme } from "@/contexts/ThemeContext";

export default function QuickBuySettingsScreen() {
  const router = useRouter();
  const { theme, spacing: sp } = useTheme();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: sp[4],
          paddingVertical: sp[3],
          gap: sp[3],
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Settings Content */}
      <QuickBuySettings />
    </SafeAreaView>
  );
}
