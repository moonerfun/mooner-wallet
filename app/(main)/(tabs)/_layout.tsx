import { triggerHaptic } from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Custom tab bar button with haptic feedback (no scale animation)
const HapticTabButton = (props: any) => {
  return (
    <Pressable
      {...props}
      onPress={(e) => {
        triggerHaptic("selection");
        props.onPress?.(e);
      }}
    />
  );
};

export default function TabsLayout() {
  const { theme, borderRadius: br } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate proper bottom padding for the tab bar
  // This ensures the tab bar content is not obscured by the navigation bar
  // Android gesture navigation typically reports 0 for insets.bottom but still needs padding
  // to avoid collision with the system gesture area (home indicator swipe zone)
  // Using a minimum of 16 on Android ensures enough clearance for gesture navigation
  const tabBarPaddingBottom = Platform.select({
    android: Math.max(insets.bottom, 16),
    ios: insets.bottom,
    default: insets.bottom,
  });
  // Base height of 64 + safe area padding, with extra padding for comfortable touch targets
  const tabBarHeight = 64 + tabBarPaddingBottom;

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTabButton,
        animation: "shift",
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: theme.background },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom + 4,
        },
        tabBarActiveTintColor: theme.primary.DEFAULT,
        tabBarInactiveTintColor: theme.text.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pulse"
        options={{
          title: "Pulse",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kol"
        options={{
          title: "KOLs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
