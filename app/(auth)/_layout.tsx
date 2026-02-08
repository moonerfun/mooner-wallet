import { useTheme } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        // Simple animations for auth - content animations handled by AnimatedScreen
        animation: "none",
        gestureEnabled: false, // Disable gestures in auth flow
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          animation: "none",
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          animation: "none",
        }}
      />
    </Stack>
  );
}
