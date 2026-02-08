import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface SocialButtonProps {
  provider: "google" | "apple" | "discord" | "facebook" | "x";
  onPress: () => void;
  loading?: boolean;
}

const providerConfig = {
  google: {
    name: "Google",
    icon: "logo-google" as const,
    color: "#DB4437",
  },
  apple: {
    name: "Apple",
    icon: "logo-apple" as const,
    color: "#000000",
  },
  discord: {
    name: "Discord",
    icon: "logo-discord" as const,
    color: "#5865F2",
  },
  facebook: {
    name: "Facebook",
    icon: "logo-facebook" as const,
    color: "#1877F2",
  },
  x: {
    name: "X",
    icon: "logo-twitter" as const,
    color: "#000000",
  },
};

export function SocialButton({
  provider,
  onPress,
  loading,
}: SocialButtonProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const config = providerConfig[provider];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: sp[2],
        paddingVertical: sp[3],
        paddingHorizontal: sp[4],
        borderRadius: br.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Ionicons name={config.icon} size={20} color={config.color} />
      <Text
        style={{
          fontSize: fs.base,
          fontWeight: "500",
          color: theme.text.primary,
        }}
      >
        {config.name}
      </Text>
    </TouchableOpacity>
  );
}

interface SocialButtonsGridProps {
  onGooglePress?: () => void;
  onApplePress?: () => void;
  onDiscordPress?: () => void;
  onFacebookPress?: () => void;
  onXPress?: () => void;
  loading?: boolean;
}

export function SocialButtonsGrid({
  onGooglePress,
  onApplePress,
  onDiscordPress,
  onFacebookPress,
  onXPress,
  loading,
}: SocialButtonsGridProps) {
  const { spacing: sp } = useTheme();

  return (
    <View style={{ gap: sp[3] }}>
      <View style={{ flexDirection: "row", gap: sp[3] }}>
        {onGooglePress && (
          <View style={{ flex: 1 }}>
            <SocialButton
              provider="google"
              onPress={onGooglePress}
              loading={loading}
            />
          </View>
        )}
        {onApplePress && (
          <View style={{ flex: 1 }}>
            <SocialButton
              provider="apple"
              onPress={onApplePress}
              loading={loading}
            />
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: sp[3] }}>
        {onDiscordPress && (
          <View style={{ flex: 1 }}>
            <SocialButton
              provider="discord"
              onPress={onDiscordPress}
              loading={loading}
            />
          </View>
        )}
        {onXPress && (
          <View style={{ flex: 1 }}>
            <SocialButton provider="x" onPress={onXPress} loading={loading} />
          </View>
        )}
      </View>
    </View>
  );
}
