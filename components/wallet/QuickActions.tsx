import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface QuickAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: sp[3],
        paddingHorizontal: sp[3], // Aligned with Pulse page (12px)
      }}
    >
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          onPress={action.onPress}
          activeOpacity={0.7}
          style={{
            alignItems: "center",
            gap: sp[2],
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: br.full,
              backgroundColor: `${theme.primary.DEFAULT}15`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={action.icon}
              size={24}
              color={theme.primary.DEFAULT}
            />
          </View>
          <Text
            style={{
              fontSize: fs.sm,
              fontWeight: "500",
              color: theme.text.primary,
            }}
          >
            {action.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
