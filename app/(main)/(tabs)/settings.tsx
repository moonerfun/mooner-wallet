import { Card, ProfileAvatar } from "@/components";
import { TwitterLinkButton } from "@/components/kol";
import { WalletSettings } from "@/components/settings";
import { PIXEL_AVATARS, PixelArt } from "@/components/wallet/ProfileAvatar";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { useTwitterAuth } from "@/hooks";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { useSettingsStore } from "@/store";
import type { PixelAvatarId } from "@/store/settingsStore";
import { Ionicons } from "@expo/vector-icons";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Dummy data for demonstration
const DUMMY_RECENT_TRANSACTIONS = [
  {
    id: "1",
    type: "send",
    amount: "0.05 ETH",
    to: "0x1234...5678",
    date: "Today",
  },
  {
    id: "2",
    type: "receive",
    amount: "100 USDC",
    from: "0xabcd...efgh",
    date: "Yesterday",
  },
  { id: "3", type: "swap", amount: "0.1 ETH → 250 USDC", date: "2 days ago" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    theme,
    isDarkMode,
    toggleTheme,
    borderRadius: br,
    fontSize: fs,
    spacing: sp,
  } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate bottom padding to ensure content scrolls above tab bar
  const tabBarHeight =
    56 +
    Platform.select({
      android: Math.max(insets.bottom, 16),
      ios: insets.bottom,
      default: insets.bottom,
    });
  const contentPaddingBottom = tabBarHeight + 16;

  const {
    wallets,
    consolidatedWallets,
    clearState,
    // Portfolio from shared context (no API call needed!)
    portfolioBalance: totalBalanceUsd,
    isLoadingPortfolio,
    refetchPortfolio,
  } = useWallet();
  const { logout } = useTurnkey();

  // Avatar selection modal state
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
      currentUser?.twitter_avatar_url
    ) {
      return currentUser.twitter_display_name || "X Profile";
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

  // Get persisted settings from store
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(
    (s) => s.setNotificationsEnabled,
  );
  const hideBalances = useSettingsStore((s) => s.hideBalances);
  const setHideBalances = useSettingsStore((s) => s.setHideBalances);

  // Callback for when wallet changes in WalletSettings
  const handleWalletChange = useCallback(() => {
    refetchPortfolio();
  }, [refetchPortfolio]);

  // Twitter auth
  const {
    isTwitterLinked,
    currentUser,
    isLoading: isTwitterLoading,
    error: twitterError,
    linkTwitter,
    unlinkTwitter,
    clearError,
  } = useTwitterAuth();

  // Handle Twitter link/unlink
  const handleTwitterPress = () => {
    if (isTwitterLinked) {
      Alert.alert(
        "Unlink X Account",
        `Are you sure you want to unlink @${currentUser?.twitter_username}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlink",
            style: "destructive",
            onPress: unlinkTwitter,
          },
        ],
      );
    } else {
      linkTwitter();
    }
  };

  // Navigate to KOL leaderboard
  const handleKolPress = () => {
    router.push("/(main)/(tabs)/kol" as any);
  };

  // Calculate total balance display
  const totalBalance =
    isLoadingPortfolio && consolidatedWallets.length === 0
      ? "Loading..."
      : formatUSD(totalBalanceUsd);

  const handleLogout = async () => {
    try {
      await logout?.();
      clearState();
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

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
          paddingHorizontal: sp[3],
          paddingVertical: sp[3],
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          gap: sp[3],
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: theme.text.primary,
            flex: 1,
          }}
        >
          Settings
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: sp[3], // Aligned with Pulse page (12px)
          gap: sp[4],
          paddingBottom: contentPaddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance */}
        <Card>
          <View style={{ alignItems: "center", paddingVertical: sp[4] }}>
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.secondary,
                marginBottom: sp[1],
              }}
            >
              Total Balance
            </Text>
            <Text
              style={{
                fontSize: fs["4xl"],
                fontWeight: "700",
                color: theme.text.primary,
              }}
            >
              {totalBalance}
            </Text>
          </View>
        </Card>

        {/* Profile Avatar Section */}
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

        {/* Wallet Settings - Switch, Create, Export */}
        <WalletSettings onWalletChange={handleWalletChange} />

        {/* Theme Toggle */}
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

        {/* Notifications Settings */}
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

        {/* KOL Leaderboard Section */}
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
            <TwitterLinkButton
              onPress={handleTwitterPress}
              isLoading={isTwitterLoading}
            />

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
                  <Ionicons
                    name="trophy"
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
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>
        </Card>

        {/* App Version */}
        <View
          style={{
            alignItems: "center",
            paddingVertical: sp[4],
          }}
        >
          <Text style={{ fontSize: fs.xs, color: theme.text.muted }}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>

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
            {isTwitterLinked && currentUser?.twitter_avatar_url && (
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
                    source={{ uri: currentUser.twitter_avatar_url }}
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
                    {currentUser.twitter_display_name}
                  </Text>
                  <Text
                    style={{
                      fontSize: fs.sm,
                      color: theme.primary.DEFAULT,
                    }}
                  >
                    @{currentUser.twitter_username}
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
                marginTop: isTwitterLinked ? sp[2] : 0,
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
                  avatarSource === "pixel" &&
                  (selectedAvatarId === avatar.id ||
                    (!selectedAvatarId && avatar.id === "alien"));

                return (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() =>
                      handleSelectPixelAvatar(avatar.id as PixelAvatarId)
                    }
                    style={{
                      alignItems: "center",
                      padding: sp[3],
                      backgroundColor: isSelected
                        ? theme.primary.DEFAULT + "20"
                        : theme.surface,
                      borderRadius: br.lg,
                      borderWidth: 2,
                      borderColor: isSelected
                        ? theme.primary.DEFAULT
                        : theme.border,
                      width: "30%",
                      minWidth: 90,
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: theme.primary.DEFAULT,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={theme.secondary.dark}
                        />
                      </View>
                    )}
                    <PixelArt avatarId={avatar.id as PixelAvatarId} size={56} />
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
    </SafeAreaView>
  );
}
