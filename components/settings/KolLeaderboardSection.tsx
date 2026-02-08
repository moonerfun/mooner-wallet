/**
 * KOL Leaderboard Section
 * Twitter linking and leaderboard access for settings
 */

import { Card } from "@/components";
import { TwitterLinkButton } from "@/components/kol";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

interface KolLeaderboardSectionProps {
  /** Whether Twitter is linked */
  isTwitterLinked: boolean;
  /** Whether Twitter auth is loading */
  isLoading: boolean;
  /** Current Twitter username */
  twitterUsername?: string;
  /** Handler to link Twitter */
  onLinkTwitter: () => void;
  /** Handler to unlink Twitter */
  onUnlinkTwitter: () => void;
}

export function KolLeaderboardSection({
  isTwitterLinked,
  isLoading,
  twitterUsername,
  onLinkTwitter,
  onUnlinkTwitter,
}: KolLeaderboardSectionProps) {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  const handleTwitterPress = () => {
    if (isTwitterLinked) {
      Alert.alert(
        "Unlink X Account",
        `Are you sure you want to unlink @${twitterUsername}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlink",
            style: "destructive",
            onPress: onUnlinkTwitter,
          },
        ],
      );
    } else {
      onLinkTwitter();
    }
  };

  const handleKolPress = () => {
    router.push("/(main)/(tabs)/kol" as any);
  };

  return (
    <Card>
      <View style={{ gap: sp[3] }}>
        <Text
          style={{
            fontSize: fs.base,
            fontWeight: "600",
            color: theme.text.primary,
          }}
        >
          KOL Leaderboard
        </Text>
        <Text
          style={{
            fontSize: fs.sm,
            color: theme.text.muted,
          }}
        >
          Link your X account to join the leaderboard and track your trading
          performance.
        </Text>

        {/* Twitter Link Button */}
        <TwitterLinkButton onPress={handleTwitterPress} isLoading={isLoading} />

        {/* View Leaderboard Button */}
        <TouchableOpacity
          onPress={handleKolPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: sp[3],
            paddingHorizontal: sp[4],
            backgroundColor: theme.surface,
            borderRadius: br.lg,
            borderWidth: 1,
            borderColor: theme.border,
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
                borderRadius: br.full,
                backgroundColor: theme.primary.DEFAULT + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trophy" size={20} color={theme.primary.DEFAULT} />
            </View>
            <View>
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "500",
                  color: theme.text.primary,
                }}
              >
                View Leaderboard
              </Text>
              <Text
                style={{
                  fontSize: fs.xs,
                  color: theme.text.muted,
                }}
              >
                See top traders and their performance
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}
