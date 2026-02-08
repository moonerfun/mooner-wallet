import { useTheme } from "@/contexts/ThemeContext";
import { usePortfolioStore } from "@/store/portfolioStore";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ProfileAvatar } from "./ProfileAvatar";

interface WalletHeaderProps {
  onProfilePress?: () => void;
  onSearchPress?: () => void;
}

export function WalletHeader({
  onProfilePress,
  onSearchPress,
}: WalletHeaderProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  // Get real-time stream connection status
  const isPositionsStreamConnected = usePortfolioStore(
    (state) => state.isPositionsStreamConnected,
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: sp[3],
        paddingVertical: sp[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: sp[3],
      }}
    >
      {/* Left side - Profile Avatar with 8-bit style */}
      <View style={{ position: "relative" }}>
        <ProfileAvatar
          size={40}
          onPress={onProfilePress}
          showEditBadge={false}
        />
        {/* Live indicator dot */}
        {isPositionsStreamConnected && (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.success,
              borderWidth: 2,
              borderColor: theme.background,
            }}
          />
        )}
      </View>

      {/* Right side - Search Bar */}
      <TouchableOpacity
        onPress={onSearchPress}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          height: 40,
          borderRadius: br.lg,
          backgroundColor: theme.surface,
          borderWidth: 0.5,
          borderColor: theme.border,
          paddingHorizontal: sp[3],
          gap: sp[2],
        }}
      >
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <Text
          style={{
            flex: 1,
            fontSize: fs.base,
            color: theme.text.muted,
          }}
        >
          Search tokens, ca...
        </Text>
        <View style={{ padding: sp[1] }}>
          <Ionicons name="options-outline" size={20} color={theme.text.muted} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
