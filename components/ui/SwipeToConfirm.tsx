/**
 * SwipeToConfirm Component
 * A slide-to-confirm button for instant swap execution
 * Uses react-native-gesture-handler and reanimated for smooth animations
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  theme: {
    primary: { DEFAULT: string };
    secondary: { dark: string };
    success: string;
    surface: string;
    text: { primary: string; secondary: string; muted: string };
    border: string;
    background: string;
  };
  style?: ViewStyle;
}

const SLIDER_HEIGHT = 60;
const THUMB_SIZE = 52;
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 1,
};

export function SwipeToConfirm({
  onConfirm,
  label = "Swipe to confirm",
  confirmLabel = "Release to confirm",
  disabled = false,
  loading = false,
  loadingLabel = "Processing...",
  theme,
  style,
}: SwipeToConfirmProps) {
  const translateX = useSharedValue(0);
  const isConfirming = useSharedValue(false);
  const containerWidth = useSharedValue(300);
  const hasTriggered = useSharedValue(false);

  // Reset when loading state changes
  useEffect(() => {
    if (!loading) {
      hasTriggered.value = false;
      translateX.value = withSpring(0, SPRING_CONFIG);
    }
  }, [loading, translateX, hasTriggered]);

  const triggerConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const panGesture = Gesture.Pan()
    .enabled(!disabled && !loading)
    .onUpdate((event) => {
      const maxX = containerWidth.value - THUMB_SIZE - 8;
      const newValue = Math.min(Math.max(0, event.translationX), maxX);
      translateX.value = newValue;
      isConfirming.value = newValue >= maxX * 0.85;
    })
    .onEnd(() => {
      const maxX = containerWidth.value - THUMB_SIZE - 8;
      const threshold = maxX * 0.85;
      if (translateX.value >= threshold && !hasTriggered.value) {
        hasTriggered.value = true;
        translateX.value = withTiming(maxX, { duration: 100 });
        runOnJS(triggerConfirm)();
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        isConfirming.value = false;
      }
    });

  const thumbStyle = useAnimatedStyle(() => {
    const maxX = containerWidth.value - THUMB_SIZE - 8;
    const progress = maxX > 0 ? translateX.value / maxX : 0;
    const backgroundColor = interpolateColor(
      progress,
      [0, 0.85, 1],
      [theme.primary.DEFAULT, theme.success, theme.success],
    );

    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor,
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const maxX = containerWidth.value - THUMB_SIZE - 8;
    const progress = maxX > 0 ? translateX.value / maxX : 0;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [1, 0.5, 0]),
    };
  });

  const checkmarkStyle = useAnimatedStyle(() => {
    const maxX = containerWidth.value - THUMB_SIZE - 8;
    const progress = maxX > 0 ? translateX.value / maxX : 0;
    return {
      opacity: interpolate(progress, [0.7, 1], [0, 1]),
      transform: [{ scale: interpolate(progress, [0.7, 1], [0.5, 1]) }],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    const maxX = containerWidth.value - THUMB_SIZE - 8;
    const progress = maxX > 0 ? translateX.value / maxX : 0;
    const backgroundColor = interpolateColor(
      progress,
      [0, 0.85, 1],
      [theme.surface, `${theme.success}30`, `${theme.success}40`],
    );
    const borderColor = interpolateColor(
      progress,
      [0, 0.85, 1],
      [theme.border, theme.success, theme.success],
    );

    return {
      backgroundColor,
      borderColor,
    };
  });

  const handleLayout = (event: {
    nativeEvent: { layout: { width: number } };
  }) => {
    containerWidth.value = event.nativeEvent.layout.width;
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: `${theme.primary.DEFAULT}20`,
            borderColor: theme.primary.DEFAULT,
          },
          style,
        ]}
      >
        <View style={styles.loadingContent}>
          <Animated.View style={styles.loadingDots}>
            <View
              style={[
                styles.loadingDot,
                { backgroundColor: theme.primary.DEFAULT },
              ]}
            />
            <View
              style={[
                styles.loadingDot,
                { backgroundColor: theme.primary.DEFAULT, opacity: 0.7 },
              ]}
            />
            <View
              style={[
                styles.loadingDot,
                { backgroundColor: theme.primary.DEFAULT, opacity: 0.4 },
              ]}
            />
          </Animated.View>
          <Text style={[styles.loadingText, { color: theme.primary.DEFAULT }]}>
            {loadingLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          disabled && styles.disabled,
          style,
        ]}
        onLayout={handleLayout}
      >
        {/* Background Text */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            {label}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.text.muted}
            style={styles.chevron}
          />
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.text.muted}
            style={[styles.chevron, { opacity: 0.6 }]}
          />
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.text.muted}
            style={[styles.chevron, { opacity: 0.3 }]}
          />
        </Animated.View>

        {/* Checkmark on complete */}
        <Animated.View style={[styles.checkmarkContainer, checkmarkStyle]}>
          <Text style={[styles.confirmText, { color: theme.success }]}>
            {confirmLabel}
          </Text>
        </Animated.View>

        {/* Sliding Thumb */}
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Ionicons
            name="arrow-forward"
            size={24}
            color={theme.secondary.dark}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SLIDER_HEIGHT,
    borderRadius: SLIDER_HEIGHT / 2,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  disabled: {
    opacity: 0.5,
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 0,
    right: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  chevron: {
    marginLeft: -8,
  },
  checkmarkContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
  },
  thumb: {
    position: "absolute",
    left: 4,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
