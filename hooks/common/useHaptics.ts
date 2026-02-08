/**
 * useHaptics - Custom hook for haptic feedback
 * Provides easy access to haptic feedback functions throughout the app
 */

import * as Haptics from "expo-haptics";
import { useCallback } from "react";

export type HapticFeedbackType =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "success"
  | "warning"
  | "error";

/**
 * Hook providing haptic feedback functions
 */
export const useHaptics = () => {
  /**
   * Light impact - for subtle interactions like tapping cards
   */
  const lightImpact = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  /**
   * Medium impact - for more significant actions like confirming
   */
  const mediumImpact = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  /**
   * Heavy impact - for major actions or errors
   */
  const heavyImpact = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  /**
   * Selection feedback - for tab switching, toggles, pickers
   */
  const selectionFeedback = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  /**
   * Success notification - for successful operations
   */
  const successNotification = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  /**
   * Warning notification - for warnings
   */
  const warningNotification = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  /**
   * Error notification - for errors
   */
  const errorNotification = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  /**
   * Trigger haptic based on type string
   */
  const trigger = useCallback((type: HapticFeedbackType) => {
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
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }, []);

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    selectionFeedback,
    successNotification,
    warningNotification,
    errorNotification,
    trigger,
  };
};

export default useHaptics;
