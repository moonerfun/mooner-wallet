/**
 * Notification Settings Link
 * Card that navigates to notification settings
 */

import { Card } from "@/components";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export function NotificationSettingsLink() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(main)/notification-settings" as any)}
    >
      <Card>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sp[3],
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: br.lg,
                backgroundColor: theme.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="notifications"
                size={20}
                color={theme.primary.DEFAULT}
              />
            </View>
            <View>
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "500",
                  color: theme.text.primary,
                }}
              >
                Notification Settings
              </Text>
              <Text
                style={{
                  fontSize: fs.sm,
                  color: theme.text.muted,
                }}
              >
                Whale alerts, KOL activity, portfolio
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.secondary}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );
}
