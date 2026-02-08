/**
 * Skeleton - Animated placeholder for loading states
 * Creates a shimmer effect for smooth loading transitions
 */

import { useTheme } from "@/contexts/ThemeContext";
import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps {
  /** Width of the skeleton */
  width?: number | string;
  /** Height of the skeleton */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Whether it's a circle */
  circle?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * Basic skeleton placeholder with shimmer animation
 */
export const Skeleton = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  circle = false,
  style,
}: SkeletonProps) => {
  const { theme } = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerValue.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3],
    );
    return { opacity };
  });

  const size = circle ? (typeof height === "number" ? height : 40) : undefined;

  // Calculate dimensions
  const computedWidth = circle
    ? size
    : typeof width === "number"
      ? width
      : undefined;
  const computedHeight = circle ? size : height;

  return (
    <Animated.View
      style={[
        {
          width: computedWidth ?? "100%",
          height: computedHeight,
          borderRadius: circle ? (size ? size / 2 : 20) : borderRadius,
          backgroundColor: theme.surface,
        },
        // Apply string width separately for percentage support
        typeof width === "string" && !circle
          ? { width: width as any }
          : undefined,
        animatedStyle,
        style,
      ]}
    />
  );
};

/**
 * Skeleton text line
 */
export const SkeletonText = ({
  width = "100%",
  height = 14,
  style,
}: Omit<SkeletonProps, "circle">) => {
  return (
    <Skeleton width={width} height={height} borderRadius={4} style={style} />
  );
};

/**
 * Skeleton for a token header - matches TokenHeader layout
 */
export const TokenDetailSkeleton = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.socialPlaceholders}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width={32} height={32} borderRadius={16} />
        </View>
      </View>

      {/* Token Info Row */}
      <View style={styles.tokenInfoRow}>
        <View style={styles.tokenIdentity}>
          <Skeleton width={48} height={48} circle />
          <View style={styles.tokenNameContainer}>
            <SkeletonText width={120} height={18} />
            <View style={styles.tokenMeta}>
              <SkeletonText width={50} height={14} />
              <SkeletonText width={60} height={14} />
            </View>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <SkeletonText width={80} height={20} />
          <SkeletonText width={50} height={14} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Contract Address */}
      <View style={styles.addressRow}>
        <SkeletonText width={200} height={14} />
        <Skeleton width={20} height={20} borderRadius={4} />
      </View>

      {/* Chart Placeholder */}
      <View style={styles.chartSection}>
        <Skeleton width="100%" height={320} borderRadius={12} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Skeleton width={60} height={36} borderRadius={8} />
        <Skeleton width={60} height={36} borderRadius={8} />
        <Skeleton width={60} height={36} borderRadius={8} />
        <Skeleton width={80} height={36} borderRadius={8} />
      </View>

      {/* Content Placeholders */}
      <View style={styles.contentSection}>
        <View style={styles.statRow}>
          <SkeletonText width={100} height={14} />
          <SkeletonText width={80} height={14} />
        </View>
        <View style={styles.statRow}>
          <SkeletonText width={120} height={14} />
          <SkeletonText width={60} height={14} />
        </View>
        <View style={styles.statRow}>
          <SkeletonText width={90} height={14} />
          <SkeletonText width={100} height={14} />
        </View>
        <View style={styles.statRow}>
          <SkeletonText width={110} height={14} />
          <SkeletonText width={70} height={14} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  socialPlaceholders: {
    flexDirection: "row",
    gap: 8,
  },
  tokenInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  tokenIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenNameContainer: {
    gap: 6,
  },
  tokenMeta: {
    flexDirection: "row",
    gap: 8,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chartSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  contentSection: {
    gap: 16,
    paddingTop: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export default Skeleton;
