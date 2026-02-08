import { useTheme } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";

export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        // Use simple native animations - content animations handled by AnimatedScreen
        animation: "default",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      {/* Tabs - no additional animation, content uses AnimatedScreen */}
      <Stack.Screen
        name="(tabs)"
        options={{
          animation: "none",
        }}
      />
      {/* Token details use modal-style slide up */}
      <Stack.Screen
        name="token/[blockchain]/[address]"
        options={{
          animation: "slide_from_bottom",
          presentation: "card",
          gestureEnabled: true,
          gestureDirection: "vertical",
        }}
      />
      {/* Search results slide in from right */}
      <Stack.Screen
        name="search"
        options={{
          animation: "slide_from_right",
        }}
      />
      {/* Notification settings */}
      <Stack.Screen
        name="notification-settings"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
