/**
 * ProfileAvatar - 8-bit style profile avatar component
 * Shows Twitter avatar or real pixel art characters
 * Users can switch between Twitter and 8-bit avatars
 */

import { useTheme } from "@/contexts/ThemeContext";
import { useKolStore } from "@/store/kolStore";
import { useSettingsStore, type PixelAvatarId } from "@/store/settingsStore";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import {
  ImageStyle,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

// 8x8 pixel art patterns for each avatar
// 0 = transparent, 1-9 = color indices from palette
type PixelGrid = number[][];

interface PixelAvatarData {
  id: PixelAvatarId;
  name: string;
  grid: PixelGrid;
  palette: string[]; // Index 0 = bg, 1+ = colors
}

// Real 8-bit pixel art avatars
export const PIXEL_AVATARS: PixelAvatarData[] = [
  {
    id: "alien",
    name: "Space Invader",
    palette: ["#1a1a2e", "#9333EA", "#A855F7", "#C084FC", "#000000"],
    grid: [
      [0, 0, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 0],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ],
  },
  {
    id: "robot",
    name: "Robo Trader",
    palette: ["#0f172a", "#3B82F6", "#60A5FA", "#93C5FD", "#1E40AF", "#FCD34D"],
    grid: [
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 4, 2, 2, 4, 2, 1],
      [1, 2, 5, 2, 2, 5, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 3, 3, 3, 3, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ],
  },
  {
    id: "ghost",
    name: "Phantom",
    palette: ["#1f2937", "#F3F4F6", "#E5E7EB", "#D1D5DB", "#1F2937"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 4, 1, 1, 4, 1, 1],
      [1, 1, 4, 1, 1, 4, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 0, 0, 1, 0, 1],
    ],
  },
  {
    id: "skull",
    name: "WAGMI Skull",
    palette: ["#18181b", "#F5F5F4", "#E7E5E4", "#1C1917", "#000000"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 3, 1, 1, 3, 1, 1],
      [1, 1, 3, 1, 1, 3, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 3, 3, 1, 1, 0],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ],
  },
  {
    id: "rocket",
    name: "Moon Boy",
    palette: ["#0c0a09", "#EF4444", "#F87171", "#FCA5A5", "#FBBF24", "#F97316"],
    grid: [
      [0, 0, 0, 3, 3, 0, 0, 0],
      [0, 0, 3, 2, 2, 3, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 3, 3, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 4, 4, 4, 4, 0, 0],
      [0, 4, 5, 0, 0, 5, 4, 0],
    ],
  },
  {
    id: "diamond",
    name: "Diamond Hands",
    palette: ["#0e7490", "#06B6D4", "#22D3EE", "#67E8F9", "#A5F3FC", "#FFFFFF"],
    grid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 2, 2, 1, 0, 0],
      [0, 1, 2, 3, 3, 2, 1, 0],
      [1, 2, 3, 4, 4, 3, 2, 1],
      [1, 2, 3, 4, 4, 3, 2, 1],
      [0, 1, 2, 3, 3, 2, 1, 0],
      [0, 0, 1, 2, 2, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  {
    id: "fire",
    name: "Degen",
    palette: ["#1c1917", "#F97316", "#FB923C", "#FDBA74", "#FCD34D", "#FEF08A"],
    grid: [
      [0, 0, 0, 4, 0, 0, 0, 0],
      [0, 0, 4, 3, 4, 0, 0, 0],
      [0, 0, 3, 2, 3, 4, 0, 0],
      [0, 4, 2, 1, 2, 3, 0, 0],
      [0, 3, 1, 1, 1, 2, 4, 0],
      [4, 2, 1, 1, 1, 1, 3, 0],
      [3, 1, 1, 1, 1, 1, 2, 0],
      [0, 2, 1, 0, 0, 1, 0, 0],
    ],
  },
  {
    id: "money",
    name: "Profit King",
    palette: ["#14532d", "#22C55E", "#4ADE80", "#86EFAC", "#000000", "#FCD34D"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [1, 2, 4, 2, 2, 4, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 5, 5, 5, 5, 2, 1],
      [1, 2, 2, 5, 5, 2, 2, 1],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ],
  },
  {
    id: "nerd",
    name: "Chart Nerd",
    palette: ["#2e1065", "#8B5CF6", "#A78BFA", "#C4B5FD", "#000000", "#FBBF24"],
    grid: [
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 4, 4, 2, 2, 4, 4, 1],
      [1, 4, 5, 4, 4, 5, 4, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [0, 1, 2, 3, 3, 2, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
    ],
  },
  {
    id: "cool",
    name: "Cool Cat",
    palette: ["#78350f", "#FBBF24", "#FCD34D", "#FDE68A", "#000000", "#EC4899"],
    grid: [
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 0, 0, 0, 0, 1, 1],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [0, 2, 4, 4, 4, 4, 2, 0],
      [0, 2, 2, 2, 2, 2, 2, 0],
      [0, 2, 2, 5, 5, 2, 2, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
    ],
  },
  {
    id: "clown",
    name: "Rug Victim",
    palette: ["#831843", "#EC4899", "#F472B6", "#FBCFE8", "#EF4444", "#FBBF24"],
    grid: [
      [0, 5, 5, 0, 0, 5, 5, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 2, 3, 2, 2, 3, 2, 0],
      [2, 2, 3, 2, 2, 3, 2, 2],
      [2, 2, 2, 4, 4, 2, 2, 2],
      [2, 2, 4, 4, 4, 4, 2, 2],
      [0, 2, 2, 2, 2, 2, 2, 0],
      [0, 0, 2, 0, 0, 2, 0, 0],
    ],
  },
  {
    id: "monkey",
    name: "Ape",
    palette: ["#44403c", "#A78BFA", "#C4B5FD", "#DDD6FE", "#1C1917", "#78716C"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [5, 1, 2, 2, 2, 2, 1, 5],
      [5, 1, 2, 2, 2, 2, 1, 5],
      [0, 2, 4, 2, 2, 4, 2, 0],
      [0, 2, 2, 2, 2, 2, 2, 0],
      [0, 2, 3, 3, 3, 3, 2, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 0, 0, 2, 2, 0, 0, 0],
    ],
  },
  {
    id: "frog",
    name: "Pepe",
    palette: ["#14532d", "#10B981", "#34D399", "#6EE7B7", "#000000", "#FEF3C7"],
    grid: [
      [0, 1, 1, 0, 0, 1, 1, 0],
      [1, 5, 4, 1, 1, 4, 5, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 3, 3, 3, 3, 2, 2],
      [0, 2, 2, 2, 2, 2, 2, 0],
      [0, 0, 2, 0, 0, 2, 0, 0],
    ],
  },
  {
    id: "unicorn",
    name: "Unicorn",
    palette: ["#701a75", "#F472B6", "#F9A8D4", "#FBCFE8", "#FBBF24", "#FFFFFF"],
    grid: [
      [0, 0, 0, 4, 0, 0, 0, 0],
      [0, 0, 4, 5, 0, 0, 0, 0],
      [0, 1, 5, 5, 1, 1, 0, 0],
      [1, 2, 2, 2, 2, 2, 1, 0],
      [1, 2, 3, 2, 2, 2, 1, 0],
      [0, 2, 2, 2, 2, 2, 0, 0],
      [0, 0, 2, 0, 2, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 0, 0],
    ],
  },
  {
    id: "poop",
    name: "Shitcoiner",
    palette: ["#422006", "#92400E", "#B45309", "#D97706", "#000000", "#FBBF24"],
    grid: [
      [0, 0, 0, 2, 2, 0, 0, 0],
      [0, 0, 2, 3, 3, 2, 0, 0],
      [0, 2, 3, 2, 3, 3, 2, 0],
      [0, 2, 1, 1, 1, 1, 2, 0],
      [1, 1, 4, 1, 1, 4, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 5, 5, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
    ],
  },
  {
    id: "whale",
    name: "Whale",
    palette: ["#0c4a6e", "#0EA5E9", "#38BDF8", "#7DD3FC", "#000000", "#FFFFFF"],
    grid: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [1, 2, 4, 2, 2, 2, 2, 1],
      [1, 2, 2, 2, 2, 2, 3, 1],
      [1, 2, 2, 2, 2, 3, 3, 1],
      [0, 1, 2, 2, 2, 2, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 5],
      [0, 0, 0, 0, 0, 5, 5, 0],
    ],
  },
];

export { PixelAvatarId };

interface ProfileAvatarProps {
  size?: number;
  onPress?: () => void;
  showEditBadge?: boolean;
}

// Component to render pixel art from grid
const PixelArt = memo(
  ({ avatarId, size }: { avatarId: PixelAvatarId; size: number }) => {
    const avatar = PIXEL_AVATARS.find((a) => a.id === avatarId);
    if (!avatar) return null;

    const pixelSize = size / 8;
    const { grid, palette } = avatar;

    return (
      <View
        style={[
          viewStyles.pixelArtContainer,
          {
            width: size,
            height: size,
            backgroundColor: palette[0],
            borderRadius: size * 0.15,
          },
        ]}
      >
        {grid.map((row, rowIndex) => (
          <View key={rowIndex} style={viewStyles.pixelRow}>
            {row.map((colorIndex, colIndex) => (
              <View
                key={`${rowIndex}-${colIndex}`}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  backgroundColor:
                    colorIndex === 0 ? "transparent" : palette[colorIndex],
                }}
              />
            ))}
          </View>
        ))}
      </View>
    );
  },
);
PixelArt.displayName = "PixelArt";

// Pixelated image component for Twitter avatars
const PixelatedImage = memo(({ uri, size }: { uri: string; size: number }) => {
  return (
    <View style={[viewStyles.pixelContainer, { width: size, height: size }]}>
      <Image
        source={{ uri }}
        style={[
          imageStyles.pixelImage,
          {
            width: size,
            height: size,
            borderRadius: size * 0.15,
          },
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </View>
  );
});
PixelatedImage.displayName = "PixelatedImage";

// Avatar preview for selection grid
export const PixelAvatarPreview = memo(
  ({
    avatarId,
    size = 56,
    isSelected = false,
    onPress,
  }: {
    avatarId: PixelAvatarId;
    size?: number;
    isSelected?: boolean;
    onPress?: () => void;
  }) => {
    const { theme, borderRadius: br, spacing: sp, fontSize: fs } = useTheme();
    const avatar = PIXEL_AVATARS.find((a) => a.id === avatarId);

    if (!avatar) return null;

    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          viewStyles.avatarOption,
          {
            backgroundColor: isSelected
              ? theme.primary.DEFAULT + "30"
              : theme.surface,
            borderColor: isSelected ? theme.primary.DEFAULT : theme.border,
            borderRadius: br.lg,
            padding: sp[3],
          },
        ]}
      >
        <PixelArt avatarId={avatarId} size={size} />
        <Text
          style={[
            textStyles.avatarName,
            {
              color: theme.text.secondary,
              fontSize: fs.xs,
              marginTop: sp[1],
            },
          ]}
          numberOfLines={1}
        >
          {avatar.name}
        </Text>
      </TouchableOpacity>
    );
  },
);
PixelAvatarPreview.displayName = "PixelAvatarPreview";

// Export PixelArt for use in settings
export { PixelArt };

export const ProfileAvatar = memo(
  ({ size = 40, onPress, showEditBadge = false }: ProfileAvatarProps) => {
    const { theme } = useTheme();

    // Get Twitter user data from KOL store
    const { currentUser, isTwitterLinked } = useKolStore();

    // Get selected avatar and source preference from settings store
    const { selectedAvatarId, avatarSource } = useSettingsStore();

    const handlePress = () => {
      if (onPress) {
        onPress();
      }
    };

    // Determine what to render based on avatarSource preference
    const renderAvatar = () => {
      // If user prefers Twitter avatar AND has one available
      if (
        avatarSource === "twitter" &&
        isTwitterLinked &&
        currentUser?.twitter_avatar_url
      ) {
        return (
          <PixelatedImage uri={currentUser.twitter_avatar_url} size={size} />
        );
      }

      // Show pixel avatar (either selected or default)
      const avatarToShow = selectedAvatarId || "alien";
      return <PixelArt avatarId={avatarToShow} size={size} />;
    };

    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[viewStyles.container, { width: size, height: size }]}
      >
        {renderAvatar()}

        {/* Edit badge */}
        {showEditBadge && (
          <View
            style={[
              viewStyles.editBadge,
              {
                backgroundColor: theme.primary.DEFAULT,
                borderColor: theme.background,
              },
            ]}
          >
            <Ionicons name="pencil" size={10} color={theme.text.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);
ProfileAvatar.displayName = "ProfileAvatar";

// Helper to get avatar data by ID
export const getPixelAvatarById = (id: PixelAvatarId) => {
  return PIXEL_AVATARS.find((a) => a.id === id);
};

// Separate stylesheets for proper typing
const viewStyles = StyleSheet.create<{ [key: string]: ViewStyle }>({
  container: {
    position: "relative",
  },
  pixelContainer: {
    position: "relative",
    overflow: "hidden",
  },
  pixelArtContainer: {
    overflow: "hidden",
    // Add subtle border for definition
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
  },
  pixelRow: {
    flexDirection: "row",
  },
  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarOption: {
    alignItems: "center",
    borderWidth: 2,
    width: "30%" as any,
    minWidth: 90,
  },
});

const textStyles = StyleSheet.create<{ [key: string]: TextStyle }>({
  avatarName: {
    textAlign: "center",
  },
});

const imageStyles = StyleSheet.create<{ [key: string]: ImageStyle }>({
  pixelImage: {},
});
