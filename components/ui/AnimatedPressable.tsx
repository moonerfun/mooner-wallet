/**
 * AnimatedPressable - Enhanced pressable component with haptic feedback and scale animation
 * Provides a more native feel compared to TouchableOpacity
 */

import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export type HapticType = "light" | "medium" | "heavy" | "selection" | "none";

interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  /**
   * Type of haptic feedback to trigger on press
   * @default "light"
   */
  haptic?: HapticType;
  /**
   * Scale factor when pressed (0.9 = 90% of original size)
   * @default 0.98
   */
  scaleDown?: number;
  /**
   * Whether to disable the scale animation
   * @default false
   */
  disableScale?: boolean;
  /**
   * Style for the pressable container
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Children elements
   */
  children: React.ReactNode;
}

/**
 * Trigger haptic feedback based on type
 */
export const triggerHaptic = (type: HapticType) => {
  switch (type) {
    case "light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case "heavy":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case "selection":
      Haptics.selectionAsync();
      break;
    case "none":
    default:
      break;
  }
};

/**
 * AnimatedPressable component with haptic feedback and scale animation
 */
export const AnimatedPressable = ({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  haptic = "light",
  scaleDown = 0.98,
  disableScale = false,
  disabled,
  ...props
}: AnimatedPressableProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      if (!disableScale) {
        scale.value = withSpring(scaleDown, {
          damping: 15,
          stiffness: 400,
        });
      }
      onPressIn?.(e);
    },
    [scaleDown, disableScale, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      if (!disableScale) {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 400,
        });
      }
      onPressOut?.(e);
    },
    [disableScale, onPressOut],
  );

  const handlePress = useCallback(
    (e: any) => {
      if (!disabled && haptic !== "none") {
        triggerHaptic(haptic);
      }
      onPress?.(e);
    },
    [haptic, onPress, disabled],
  );

  return (
    <AnimatedPressableComponent
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressableComponent>
  );
};

/**
 * Preset configurations for common use cases
 */
export const AnimatedPressablePresets = {
  /** For cards and list items */
  card: {
    haptic: "light" as HapticType,
    scaleDown: 0.985,
  },
  /** For buttons */
  button: {
    haptic: "light" as HapticType,
    scaleDown: 0.96,
  },
  /** For tab buttons and navigation */
  tab: {
    haptic: "selection" as HapticType,
    scaleDown: 0.95,
  },
  /** For small icon buttons */
  icon: {
    haptic: "light" as HapticType,
    scaleDown: 0.9,
  },
  /** For subtle interactions */
  subtle: {
    haptic: "selection" as HapticType,
    scaleDown: 0.99,
  },
};

export default AnimatedPressable;
