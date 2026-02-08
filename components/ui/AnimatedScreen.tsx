/**
 * AnimatedScreen - Reusable animated screen wrapper for smooth page transitions
 * Provides entering/exiting animations for screen content
 */

import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  EntryAnimationsValues,
  ExitAnimationsValues,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  Layout,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideInUp,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
  SlideOutUp,
  withTiming,
} from "react-native-reanimated";

export type AnimationPreset =
  | "fade"
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scale"
  | "none";

interface AnimatedScreenProps {
  children: React.ReactNode;
  /**
   * Animation preset for entering animation
   * @default "fadeUp"
   */
  entering?: AnimationPreset;
  /**
   * Animation preset for exiting animation
   * @default "fadeDown"
   */
  exiting?: AnimationPreset;
  /**
   * Duration of the animation in milliseconds
   * @default 300
   */
  duration?: number;
  /**
   * Delay before animation starts in milliseconds
   * @default 0
   */
  delay?: number;
  /**
   * Whether to use spring animation
   * @default true
   */
  springify?: boolean;
  /**
   * Whether to enable layout animations
   * @default false
   */
  layoutAnimation?: boolean;
  /**
   * Additional styles for the container
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * AnimatedScreen component for smooth page content transitions
 */
export const AnimatedScreen = ({
  children,
  entering = "fadeUp",
  exiting = "fade",
  duration = 300,
  delay = 0,
  springify = false,
  layoutAnimation = false,
  style,
}: AnimatedScreenProps) => {
  // Build entering animation based on preset - no bounce, just smooth easing
  const getEnteringAnimation = () => {
    if (entering === "none") return undefined;

    const animations = {
      fade: FadeIn.duration(duration).delay(delay),
      fadeUp: FadeInUp.duration(duration).delay(delay),
      fadeDown: FadeInDown.duration(duration).delay(delay),
      fadeLeft: FadeInLeft.duration(duration).delay(delay),
      fadeRight: FadeInRight.duration(duration).delay(delay),
      slideUp: SlideInUp.duration(duration).delay(delay),
      slideDown: SlideInDown.duration(duration).delay(delay),
      slideLeft: SlideInLeft.duration(duration).delay(delay),
      slideRight: SlideInRight.duration(duration).delay(delay),
      scale: FadeIn.duration(duration).delay(delay),
    };

    return animations[entering];
  };

  // Build exiting animation based on preset
  const getExitingAnimation = () => {
    if (exiting === "none") return undefined;

    const exitDuration = Math.min(duration, 200);
    const animations = {
      fade: FadeOut.duration(exitDuration),
      fadeUp: FadeOutUp.duration(exitDuration),
      fadeDown: FadeOutDown.duration(exitDuration),
      fadeLeft: FadeOutLeft.duration(exitDuration),
      fadeRight: FadeOutRight.duration(exitDuration),
      slideUp: SlideOutUp.duration(exitDuration),
      slideDown: SlideOutDown.duration(exitDuration),
      slideLeft: SlideOutLeft.duration(exitDuration),
      slideRight: SlideOutRight.duration(exitDuration),
      scale: FadeOut.duration(exitDuration),
    };

    return animations[exiting];
  };

  return (
    <Animated.View
      entering={getEnteringAnimation()}
      exiting={getExitingAnimation()}
      layout={layoutAnimation ? Layout.duration(200) : undefined}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * AnimatedListItem - For animating list items with staggered delays
 */
interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  /**
   * Base delay in ms, each item will be delayed by index * staggerDelay
   * @default 50
   */
  staggerDelay?: number;
  /**
   * Animation preset
   * @default "fadeUp"
   */
  animation?: AnimationPreset;
  /**
   * Additional styles
   */
  style?: StyleProp<ViewStyle>;
}

export const AnimatedListItem = ({
  children,
  index,
  staggerDelay = 50,
  animation = "fadeUp",
  style,
}: AnimatedListItemProps) => {
  const delay = Math.min(index * staggerDelay, 500); // Cap at 500ms

  // Get entering animation with staggered delay - smooth easing, no bounce
  const getEnteringAnimation = () => {
    if (animation === "none") return undefined;

    const animations = {
      fade: FadeIn.delay(delay).duration(250),
      fadeUp: FadeInUp.delay(delay).duration(250),
      fadeDown: FadeInDown.delay(delay).duration(250),
      fadeLeft: FadeInLeft.delay(delay).duration(250),
      fadeRight: FadeInRight.delay(delay).duration(250),
      slideUp: SlideInUp.delay(delay).duration(250),
      slideDown: SlideInDown.delay(delay).duration(250),
      slideLeft: SlideInLeft.delay(delay).duration(250),
      slideRight: SlideInRight.delay(delay).duration(250),
      scale: FadeIn.delay(delay).duration(250),
    };

    return animations[animation];
  };

  return (
    <Animated.View
      entering={getEnteringAnimation()}
      layout={Layout.duration(200)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Custom scale animation for entering
 */
export const scaleEntering = (values: EntryAnimationsValues) => {
  "worklet";
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.95 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 250 }),
      transform: [{ scale: withTiming(1, { duration: 250 }) }],
    },
  };
};

/**
 * Custom scale animation for exiting
 */
export const scaleExiting = (values: ExitAnimationsValues) => {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    animations: {
      opacity: withTiming(0, { duration: 150 }),
      transform: [{ scale: withTiming(0.95, { duration: 150 }) }],
    },
  };
};

/**
 * Presets for common screen transition patterns
 */
export const ScreenTransitionPresets = {
  /** Default - fade in from bottom */
  default: {
    entering: "fadeUp" as AnimationPreset,
    exiting: "fade" as AnimationPreset,
    duration: 300,
  },
  /** Modal style - slide from bottom */
  modal: {
    entering: "slideUp" as AnimationPreset,
    exiting: "slideDown" as AnimationPreset,
    duration: 350,
  },
  /** Push navigation style */
  push: {
    entering: "fadeRight" as AnimationPreset,
    exiting: "fadeLeft" as AnimationPreset,
    duration: 250,
  },
  /** Fade only */
  fade: {
    entering: "fade" as AnimationPreset,
    exiting: "fade" as AnimationPreset,
    duration: 200,
  },
  /** Quick transition */
  quick: {
    entering: "fade" as AnimationPreset,
    exiting: "fade" as AnimationPreset,
    duration: 150,
  },
};

export default AnimatedScreen;
