/**
 * Toast - A beautiful toast notification component for React Native
 * Provides success, error, and info toast messages with smooth animations
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

// Toast colors - using theme-aligned colors
const TOAST_COLORS: Record<
  ToastType,
  { bg: string; icon: string; border: string; text: string; subtext: string }
> = {
  success: {
    bg: "#0D2818",
    icon: "#4ADE80",
    border: "#4ADE80",
    text: "#FFFFFF",
    subtext: "rgba(255,255,255,0.8)",
  },
  error: {
    bg: "#2D1111",
    icon: "#FF6B6B",
    border: "#FF6B6B",
    text: "#FFFFFF",
    subtext: "rgba(255,255,255,0.8)",
  },
  info: {
    bg: "#1A1A0A",
    icon: "#FFD700",
    border: "#FFD700",
    text: "#FFFFFF",
    subtext: "rgba(255,255,255,0.8)",
  },
};

const TOAST_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
    ]).start();

    // Auto dismiss
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const colors = TOAST_COLORS[toast.type];
  const icon = TOAST_ICONS[toast.type];

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={colors.icon} />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: colors.text }]}>
          {toast.title}
        </Text>
        {toast.message && (
          <Text style={[styles.message, { color: colors.subtext }]}>
            {toast.message}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={dismissToast} style={styles.closeButton}>
        <Ionicons name="close" size={18} color={colors.subtext} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Toast Manager singleton
class ToastManager {
  private static instance: ToastManager;
  private listeners: Set<(toasts: ToastMessage[]) => void> = new Set();
  private toasts: ToastMessage[] = [];

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  subscribe(listener: (toasts: ToastMessage[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(type: ToastType, title: string, message?: string, duration?: number) {
    const id = Date.now().toString();
    const toast: ToastMessage = { id, type, title, message, duration };
    this.toasts = [toast, ...this.toasts];
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  success(title: string, message?: string, duration?: number) {
    return this.show("success", title, message, duration);
  }

  error(title: string, message?: string, duration?: number) {
    return this.show("error", title, message, duration);
  }

  info(title: string, message?: string, duration?: number) {
    return this.show("info", title, message, duration);
  }
}

export const toast = ToastManager.getInstance();

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts);
    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  return (
    <View style={styles.providerContainer}>
      {children}
      <View
        style={[styles.toastWrapper, { top: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={handleDismiss} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
  },
  toastWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: SCREEN_WIDTH - 32,
    maxWidth: 400,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
