/**
 * Theme Toggle Section
 * Dark/Light mode toggle for settings
 */

import { Card } from "@/components";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Switch, Text, View } from "react-native";

export function ThemeToggleSection() {
  const {
    theme,
    isDarkMode,
    toggleTheme,
    borderRadius: br,
    fontSize: fs,
    spacing: sp,
  } = useTheme();

  return (
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
              name={isDarkMode ? "moon" : "sunny"}
              size={20}
              color={theme.primary.DEFAULT}
            />
          </View>
          <Text
            style={{
              fontSize: fs.base,
              fontWeight: "500",
              color: theme.text.primary,
            }}
          >
            {isDarkMode ? "Dark Mode" : "Light Mode"}
          </Text>
        </View>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{
            false: theme.border,
            true: theme.primary.DEFAULT,
          }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Card>
  );
}
