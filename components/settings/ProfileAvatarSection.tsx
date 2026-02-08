/**
 * Profile Avatar Section
 * Avatar selection and display for settings
 */

import { Card, ProfileAvatar } from "@/components";
import { PIXEL_AVATARS, PixelArt } from "@/components/wallet/ProfileAvatar";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettingsStore } from "@/store";
import type { PixelAvatarId } from "@/store/settingsStore";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ProfileAvatarSectionProps {
  /** Whether Twitter is linked */
  isTwitterLinked: boolean;
  /** Current Twitter user data */
  twitterUser?: {
    twitter_username?: string;
    twitter_display_name?: string;
    twitter_avatar_url?: string;
  } | null;
}

export function ProfileAvatarSection({
  isTwitterLinked,
  twitterUser,
}: ProfileAvatarSectionProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const selectedAvatarId = useSettingsStore((s) => s.selectedAvatarId);
  const setSelectedAvatarId = useSettingsStore((s) => s.setSelectedAvatarId);
  const avatarSource = useSettingsStore((s) => s.avatarSource);
  const setAvatarSource = useSettingsStore((s) => s.setAvatarSource);

  // Get current avatar display name
  const getCurrentAvatarName = () => {
    if (
      avatarSource === "twitter" &&
      isTwitterLinked &&
      twitterUser?.twitter_avatar_url
    ) {
      return twitterUser.twitter_display_name || "X Profile";
    }
    const avatar = PIXEL_AVATARS.find(
      (a) => a.id === (selectedAvatarId || "alien"),
    );
    return avatar?.name || "Space Invader";
  };

  // Handle avatar selection
  const handleSelectPixelAvatar = (id: PixelAvatarId) => {
    setSelectedAvatarId(id);
    setAvatarSource("pixel");
    setShowAvatarModal(false);
  };

  // Handle switching to Twitter avatar
  const handleSelectTwitterAvatar = () => {
    setAvatarSource("twitter");
    setShowAvatarModal(false);
  };

  return (
    <>
      <Card>
        <View style={{ gap: sp[3] }}>
          <Text
            style={{
              fontSize: fs.base,
              fontWeight: "600",
              color: theme.text.primary,
            }}
          >
            Profile Avatar
          </Text>
          <Text
            style={{
              fontSize: fs.sm,
              color: theme.text.muted,
            }}
          >
            {avatarSource === "twitter" && isTwitterLinked
              ? "Using your X profile picture"
              : "Using 8-bit pixel avatar"}
          </Text>

          <TouchableOpacity
            onPress={() => setShowAvatarModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sp[3],
              paddingVertical: sp[2],
            }}
          >
            <ProfileAvatar size={56} showEditBadge />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "500",
                  color: theme.text.primary,
                }}
              >
                {getCurrentAvatarName()}
              </Text>
              <Text
                style={{
                  fontSize: fs.sm,
                  color: theme.primary.DEFAULT,
                }}
              >
                Tap to change
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.text.muted}
            />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <SafeAreaView
          edges={["top"]}
          style={{ flex: 1, backgroundColor: theme.background }}
        >
          {/* Modal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: sp[4],
              paddingVertical: sp[3],
              borderBottomColor: theme.border,
              borderBottomWidth: 1,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowAvatarModal(false)}
              style={{ width: 40, alignItems: "center" }}
            >
              <Ionicons name="close" size={24} color={theme.text.primary} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "600",
                color: theme.text.primary,
              }}
            >
              Choose Your Avatar
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar Grid */}
          <ScrollView
            contentContainerStyle={{
              padding: sp[4],
              gap: sp[4],
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* X Profile Option - only show if Twitter is linked */}
            {isTwitterLinked && twitterUser?.twitter_avatar_url && (
              <>
                <Text
                  style={{
                    fontSize: fs.sm,
                    fontWeight: "600",
                    color: theme.text.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  X Profile Picture
                </Text>
                <TouchableOpacity
                  onPress={handleSelectTwitterAvatar}
                  style={{
                    alignItems: "center",
                    padding: sp[4],
                    backgroundColor:
                      avatarSource === "twitter"
                        ? theme.primary.DEFAULT + "20"
                        : theme.surface,
                    borderRadius: br.lg,
                    borderWidth: 2,
                    borderColor:
                      avatarSource === "twitter"
                        ? theme.primary.DEFAULT
                        : theme.border,
                    position: "relative",
                  }}
                >
                  {avatarSource === "twitter" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: theme.primary.DEFAULT,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.secondary.dark}
                      />
                    </View>
                  )}
                  <Image
                    source={{ uri: twitterUser.twitter_avatar_url }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                    }}
                    contentFit="cover"
                  />
                  <Text
                    style={{
                      marginTop: sp[2],
                      fontSize: fs.base,
                      fontWeight: "500",
                      color: theme.text.primary,
                    }}
                  >
                    {twitterUser.twitter_display_name}
                  </Text>
                  <Text
                    style={{
                      fontSize: fs.sm,
                      color: theme.primary.DEFAULT,
                    }}
                  >
                    @{twitterUser.twitter_username}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* 8-bit Avatars Section */}
            <Text
              style={{
                fontSize: fs.sm,
                fontWeight: "600",
                color: theme.text.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              8-bit Pixel Avatars
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: sp[3],
                justifyContent: "flex-start",
              }}
            >
              {PIXEL_AVATARS.map((avatar) => {
                const isSelected =
                  avatarSource === "pixel" && selectedAvatarId === avatar.id;

                return (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() => handleSelectPixelAvatar(avatar.id)}
                    style={{
                      width: "30%",
                      aspectRatio: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: sp[2],
                      backgroundColor: isSelected
                        ? theme.primary.DEFAULT + "20"
                        : theme.surface,
                      borderRadius: br.lg,
                      borderWidth: 2,
                      borderColor: isSelected
                        ? theme.primary.DEFAULT
                        : theme.border,
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: theme.primary.DEFAULT,
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                        }}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={theme.secondary.dark}
                        />
                      </View>
                    )}
                    <PixelArt avatarId={avatar.id} size={48} />
                    <Text
                      style={{
                        marginTop: sp[1],
                        fontSize: fs.xs,
                        color: theme.text.secondary,
                        textAlign: "center",
                      }}
                      numberOfLines={1}
                    >
                      {avatar.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
