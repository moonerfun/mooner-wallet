/**
 * ChainIcon - Reusable component for displaying blockchain icons
 * Displays actual blockchain logos with fallback to emoji icons
 */

import { getChainLogo } from "@/hooks";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface ChainIconProps {
  /** Chain name (e.g., "Ethereum", "Solana", "Bitcoin") */
  chainName: string;
  /** Optional direct logo URL (takes priority over lookup) */
  logoUrl?: string;
  /** Fallback emoji icon to show if image fails */
  fallbackIcon?: string;
  /** Size of the icon (default: 24) */
  size?: number;
  /** Background color for the icon container */
  backgroundColor?: string;
  /** Whether to show the container with background */
  showBackground?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

export function ChainIcon({
  chainName,
  logoUrl,
  fallbackIcon = "🔗",
  size = 24,
  backgroundColor,
  showBackground = false,
  style,
}: ChainIconProps) {
  // Track if image failed to load
  const [imageError, setImageError] = useState(false);
  
  // Get logo URL from cache/API or use provided URL
  const logo = useMemo(() => {
    if (logoUrl) return logoUrl;
    return getChainLogo(chainName);
  }, [chainName, logoUrl]);

  const containerSize = showBackground ? size * 1.75 : size;
  const imageSize = showBackground ? size : size;

  // Render fallback icon
  const renderFallback = () => (
    <Text style={[styles.fallbackIcon, { fontSize: size * 0.8 }]}>
      {fallbackIcon}
    </Text>
  );

  // If we have a logo URL and no error, show the image
  if (logo && !imageError) {
    return (
      <View
        style={[
          styles.container,
          showBackground && styles.withBackground,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: showBackground
              ? backgroundColor || "rgba(128,128,128,0.1)"
              : "transparent",
          },
          style,
        ]}
      >
        <Image
          source={{ uri: logo }}
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
          }}
          contentFit="cover"
          transition={200}
          placeholder={undefined}
          onError={() => {
            // Image failed to load, show fallback
            console.debug(`[ChainIcon] Failed to load logo for ${chainName}`);
            setImageError(true);
          }}
        />
      </View>
    );
  }

  // Fallback to emoji icon
  return (
    <View
      style={[
        styles.container,
        showBackground && styles.withBackground,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: showBackground
            ? backgroundColor || "rgba(128,128,128,0.1)"
            : "transparent",
        },
        style,
      ]}
    >
      {renderFallback()}
    </View>
  );
}

/**
 * Compact chain icon for inline use (e.g., in lists, buttons)
 */
export function ChainIconCompact({
  chainName,
  logoUrl,
  fallbackIcon,
  size = 18,
}: Omit<ChainIconProps, "showBackground" | "backgroundColor" | "style">) {
  const logo = useMemo(() => {
    if (logoUrl) return logoUrl;
    return getChainLogo(chainName);
  }, [chainName, logoUrl]);

  if (logo) {
    return (
      <Image
        source={{ uri: logo }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return <Text style={{ fontSize: size * 0.8 }}>{fallbackIcon || "🔗"}</Text>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  withBackground: {
    padding: 4,
  },
  fallbackIcon: {
    textAlign: "center",
  },
});
