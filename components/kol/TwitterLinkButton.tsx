/**
 * TwitterLinkButton - Button component for linking/unlinking X account
 */

import { XIcon } from "@/components/ui/XIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { useKolStore } from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface TwitterLinkButtonProps {
  onPress: () => void;
  isLoading?: boolean;
}

export const TwitterLinkButton = memo(
  ({ onPress, isLoading = false }: TwitterLinkButtonProps) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
    const { isTwitterLinked, currentUser } = useKolStore();

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isLoading}
        style={[
          styles.container,
          {
            backgroundColor: isTwitterLinked ? theme.surface : "#000",
            borderRadius: br.lg,
            borderWidth: isTwitterLinked ? 1 : 0,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.leftContent}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isTwitterLinked
                  ? "#000"
                  : "rgba(255,255,255,0.2)",
              },
            ]}
          >
            <XIcon size={20} color="#fff" />
          </View>

          <View style={styles.textContainer}>
            <Text
              style={[
                styles.title,
                { color: isTwitterLinked ? theme.text.primary : "#fff" },
              ]}
            >
              {isTwitterLinked ? "X Account Linked" : "Link X Account"}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: isTwitterLinked
                    ? theme.text.muted
                    : "rgba(255,255,255,0.8)",
                },
              ]}
            >
              {isTwitterLinked
                ? `@${currentUser?.twitter_username || "connected"}`
                : "Join the KOL leaderboard"}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isTwitterLinked ? theme.primary.DEFAULT : "#fff"}
          />
        ) : (
          <View
            style={[
              styles.actionBadge,
              {
                backgroundColor: isTwitterLinked
                  ? theme.border
                  : "rgba(255,255,255,0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                { color: isTwitterLinked ? theme.text.secondary : "#fff" },
              ]}
            >
              {isTwitterLinked ? "Unlink" : "Connect"}
            </Text>
            <Ionicons
              name={isTwitterLinked ? "close" : "chevron-forward"}
              size={14}
              color={isTwitterLinked ? theme.text.secondary : "#fff"}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);
TwitterLinkButton.displayName = "TwitterLinkButton";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
