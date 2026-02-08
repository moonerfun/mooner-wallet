/**
 * KolLeaderboardHeader - Header with user's rank and link Twitter CTA
 */

import { useTheme } from "@/contexts/ThemeContext";
import { useKolStore } from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface KolLeaderboardHeaderProps {
  onLinkTwitter: () => void;
}

export const KolLeaderboardHeader = memo(
  ({ onLinkTwitter }: KolLeaderboardHeaderProps) => {
    const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
    const { currentUser, isTwitterLinked, getCurrentUserRank, leaderboard } =
      useKolStore();

    const userRank = getCurrentUserRank();
    const totalTraders = leaderboard.length;

    return (
      <View style={styles.container}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            KOL Leaderboard
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            Track top traders and their performance
          </Text>
        </View>

        {/* User Stats Card */}
        {isTwitterLinked && currentUser ? (
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: theme.surface,
                borderRadius: br.lg,
                borderWidth: 0.5,
                borderColor: theme.primary.DEFAULT,
              },
            ]}
          >
            <View style={styles.userCardLeft}>
              {currentUser.twitter_avatar_url ? (
                <Image
                  source={{ uri: currentUser.twitter_avatar_url }}
                  style={[styles.userAvatar, { borderRadius: br.full }]}
                />
              ) : (
                <View
                  style={[
                    styles.userAvatarPlaceholder,
                    {
                      backgroundColor: theme.border,
                      borderRadius: br.full,
                    },
                  ]}
                >
                  <Ionicons name="person" size={20} color={theme.text.muted} />
                </View>
              )}
              <View>
                <Text style={[styles.userName, { color: theme.text.primary }]}>
                  {currentUser.twitter_display_name || "Your Profile"}
                </Text>
                {currentUser.twitter_username && (
                  <Text
                    style={[styles.userHandle, { color: theme.text.muted }]}
                  >
                    @{currentUser.twitter_username}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.userCardRight}>
              <Text style={[styles.rankLabel, { color: theme.text.muted }]}>
                Your Rank
              </Text>
              <Text
                style={[styles.rankValue, { color: theme.primary.DEFAULT }]}
              >
                {userRank ? `#${userRank}` : "-"}
              </Text>
              <Text style={[styles.rankTotal, { color: theme.text.muted }]}>
                of {totalTraders}
              </Text>
            </View>
          </View>
        ) : (
          /* Link Twitter CTA */
          <TouchableOpacity
            onPress={onLinkTwitter}
            style={[
              styles.linkTwitterCard,
              {
                backgroundColor: theme.surface,
                borderRadius: br.lg,
                borderWidth: 0.5,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.linkTwitterLeft}>
              <View
                style={[
                  styles.twitterIconContainer,
                  { backgroundColor: "#1DA1F2" },
                ]}
              >
                <Ionicons name="logo-twitter" size={24} color="#fff" />
              </View>
              <View style={styles.linkTwitterText}>
                <Text
                  style={[
                    styles.linkTwitterTitle,
                    { color: theme.text.primary },
                  ]}
                >
                  Link your X account
                </Text>
                <Text
                  style={[
                    styles.linkTwitterSubtitle,
                    { color: theme.text.muted },
                  ]}
                >
                  Join the leaderboard and track your trades
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.muted}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  userCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  userCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  userCardRight: {
    alignItems: "flex-end",
  },
  rankLabel: {
    fontSize: 11,
  },
  rankValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  rankTotal: {
    fontSize: 11,
  },
  linkTwitterCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  linkTwitterLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  twitterIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  linkTwitterText: {
    flex: 1,
  },
  linkTwitterTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  linkTwitterSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
KolLeaderboardHeader.displayName = "KolLeaderboardHeader";
