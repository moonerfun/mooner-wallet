import { useTheme } from "@/contexts/ThemeContext";
import {
  AuthState,
  ClientState,
  useTurnkey,
} from "@turnkey/react-native-wallet-kit";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { authState, clientState } = useTurnkey();
  const { theme } = useTheme();

  // Show loading while client is initializing
  if (clientState === ClientState.Loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
      </View>
    );
  }

  // Redirect based on auth state
  if (authState === AuthState.Authenticated) {
    return <Redirect href={"/(main)/(tabs)" as any} />;
  }

  return <Redirect href="/(auth)/login" />;
}
