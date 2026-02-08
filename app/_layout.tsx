// Note: react-native-get-random-values is imported in index.js (entry point)
import "../global.css";

import type {
  TurnkeyCallbacks,
  TurnkeyProviderConfig,
} from "@turnkey/react-native-wallet-kit";
import {
  AuthState,
  ClientState,
  TurnkeyProvider,
  useTurnkey,
} from "@turnkey/react-native-wallet-kit";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/Toast";
import {
  TURNKEY_API_BASE_URL,
  TURNKEY_AUTH_PROXY_CONFIG_ID,
  TURNKEY_AUTH_PROXY_URL,
  TURNKEY_ORGANIZATION_ID,
  TURNKEY_RPID,
} from "@/constants/turnkey";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useWallet, WalletProvider } from "@/contexts/WalletContext";

// Turnkey configuration
const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: TURNKEY_ORGANIZATION_ID,
  apiBaseUrl: TURNKEY_API_BASE_URL,
  authProxyUrl: TURNKEY_AUTH_PROXY_URL,
  ...(TURNKEY_AUTH_PROXY_CONFIG_ID
    ? { authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID }
    : {}),
  passkeyConfig: {
    rpId: TURNKEY_RPID || undefined,
  },
  auth: {
    otp: {
      email: true,
      sms: false,
    },
    autoRefreshSession: true,
  },
};

// Auth gate component that handles navigation based on auth state
function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { authState, clientState } = useTurnkey();
  const { theme } = useTheme();
  const { sessionState, setSessionState } = useWallet();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Mark navigation as ready after first render
  useEffect(() => {
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    // Don't navigate until navigation is ready
    if (!isNavigationReady) return;

    // Wait for client to be ready
    if (!clientState || clientState === ClientState.Loading) {
      // Only set to loading if not already authenticated (demo mode)
      if (sessionState !== "authenticated") {
        setSessionState("loading");
      }
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    // Check both Turnkey auth state AND our own session state (for demo mode)
    const isAuthenticated =
      authState === AuthState.Authenticated || sessionState === "authenticated";

    if (isAuthenticated) {
      setSessionState("authenticated");
      if (inAuthGroup) {
        router.replace("/(main)/(tabs)" as any);
      }
    } else {
      setSessionState("unauthenticated");
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    }
  }, [authState, clientState, segments, isNavigationReady, sessionState]);

  // Show loading while client is initializing
  if (!clientState || clientState === ClientState.Loading) {
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

  return <Slot />;
}

// Turnkey callbacks
const turnkeyCallbacks: TurnkeyCallbacks = {
  onError: (error) => {
    console.error("Turnkey error:", error);
  },
  onSessionExpired: () => {
    console.log("Session expired");
  },
};

// Inner layout with access to theme and wallet
function InnerLayout() {
  const { isDark } = useTheme();
  const { accounts, selectedWallet } = useWallet();

  // Get the active wallet address for notifications
  // Priority: selected wallet's Solana account > first Solana account > first account
  const activeWalletAddress = useMemo(() => {
    // If a wallet is selected, get its Solana address
    if (selectedWallet?.accounts) {
      const solanaAccount = selectedWallet.accounts.find(
        (acc: any) => acc.addressFormat === "ADDRESS_FORMAT_SOLANA",
      );
      if (solanaAccount?.address) return solanaAccount.address;
      // Fall back to first account in selected wallet
      if (selectedWallet.accounts[0]?.address) {
        return selectedWallet.accounts[0].address;
      }
    }
    // Fall back to accounts from context (enriched with chain info)
    return (
      accounts.find((a) => a.chainName === "Solana")?.address ||
      accounts[0]?.address ||
      null
    );
  }, [selectedWallet, accounts]);

  // Get ALL unique wallet addresses for multi-wallet notification support
  // This ensures the user receives notifications for follows from any of their wallets
  const allWalletAddresses = useMemo(() => {
    const addressSet = new Set<string>();

    // Add all addresses from enriched accounts
    accounts.forEach((acc) => {
      if (acc.address) addressSet.add(acc.address);
    });

    // Also add addresses from selected wallet if available
    if (selectedWallet?.accounts) {
      selectedWallet.accounts.forEach((acc: any) => {
        if (acc.address) addressSet.add(acc.address);
      });
    }

    return Array.from(addressSet);
  }, [accounts, selectedWallet]);

  return (
    <TurnkeyProvider config={turnkeyConfig} callbacks={turnkeyCallbacks}>
      <NotificationProvider
        walletAddress={activeWalletAddress}
        allWalletAddresses={allWalletAddresses}
      >
        <AuthGate />
      </NotificationProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
    </TurnkeyProvider>
  );
}

// Root layout
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <WalletProvider>
            <ToastProvider>
              <InnerLayout />
            </ToastProvider>
          </WalletProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
