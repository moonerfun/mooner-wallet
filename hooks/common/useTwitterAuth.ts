/**
 * useTwitterAuth - Hook for managing Twitter/X OAuth authentication
 */

import { useWallet } from "@/contexts/WalletContext";
import type { ChainType } from "@/lib/api/supabase/supabaseTypes";
import { linkWalletToUser } from "@/lib/kol/kolTradeService";
import {
  completeTwitterAuth,
  getOrCreateUser,
  getUserByWallet,
  initiateTwitterLogin,
  unlinkTwitterAccount,
} from "@/lib/services/twitterAuth";
import { useKolStore } from "@/store/kolStore";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

// Store code verifier temporarily during OAuth flow
let pendingCodeVerifier: string | null = null;
let pendingState: string | null = null;

export function useTwitterAuth() {
  const { consolidatedWallets } = useWallet();
  const { setCurrentUser, setIsTwitterLinked, currentUser, isTwitterLinked } =
    useKolStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastCheckedWallets, setLastCheckedWallets] = useState<string | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);

  // Track app state for refresh on foreground
  const appState = useRef(AppState.currentState);
  const lastRefreshTime = useRef<number>(0);
  const REFRESH_COOLDOWN_MS = 30000; // 30 seconds cooldown between refreshes

  // Get all wallet addresses (already deduplicated in consolidatedWallets)
  const allWalletAddresses = useMemo(
    () => consolidatedWallets?.map((w) => w.address).filter(Boolean) || [],
    [consolidatedWallets],
  );
  const primaryWallet = consolidatedWallets?.[0];
  const primaryWalletAddress = primaryWallet?.address;

  // Map wallet type to chain type for API
  const getChainTypeForWallet = (wallet: typeof primaryWallet): ChainType => {
    if (!wallet?.walletType) return "evm";
    return wallet.walletType === "solana" ? "solana" : "evm";
  };
  const primaryChainType = getChainTypeForWallet(primaryWallet);

  // Get all wallets with their chain types (for linking both Solana and EVM)
  // consolidatedWallets already has unique wallets per type, no dedup needed
  const allWalletsWithChainType = useMemo(() => {
    if (!consolidatedWallets) return [];
    return consolidatedWallets
      .filter((w) => w.address)
      .map((w) => ({
        address: w.address,
        chainType: getChainTypeForWallet(w),
      }));
  }, [consolidatedWallets]);

  const walletsKey = allWalletAddresses.sort().join(","); // For dependency tracking

  // Function to refresh user data from the database
  const refreshUserFromDb = useCallback(async () => {
    if (allWalletAddresses.length === 0 || isChecking) return;

    const now = Date.now();
    if (now - lastRefreshTime.current < REFRESH_COOLDOWN_MS) {
      console.log("[TwitterAuth] Skipping refresh - cooldown active");
      return;
    }
    lastRefreshTime.current = now;

    console.log("[TwitterAuth] Refreshing user data from database...");
    try {
      let freshUser = null;
      for (const walletAddr of allWalletAddresses) {
        freshUser = await getUserByWallet(walletAddr);
        if (freshUser) {
          console.log(
            "[TwitterAuth] Refreshed user from DB:",
            freshUser.twitter_username || "no twitter",
            "avatar:",
            freshUser.twitter_avatar_url ? "present" : "missing",
          );
          break;
        }
      }

      if (freshUser) {
        // Check if the data has changed (especially avatar)
        if (
          currentUser?.twitter_avatar_url !== freshUser.twitter_avatar_url ||
          currentUser?.twitter_username !== freshUser.twitter_username ||
          currentUser?.twitter_id !== freshUser.twitter_id
        ) {
          console.log("[TwitterAuth] User data changed, updating store");
          setCurrentUser(freshUser);
          setIsTwitterLinked(!!freshUser.twitter_id);
        }
      } else if (currentUser?.twitter_id) {
        // User was in store but not found in DB - they may have been unlinked on another device
        console.log(
          "[TwitterAuth] User no longer found in DB, clearing Twitter link",
        );
        setCurrentUser({
          ...currentUser,
          twitter_id: null,
          twitter_username: null,
          twitter_display_name: null,
          twitter_avatar_url: null,
          twitter_followers_count: 0,
          is_verified: false,
        });
        setIsTwitterLinked(false);
      }
    } catch (err) {
      console.warn("[TwitterAuth] Failed to refresh user from DB:", err);
    }
  }, [
    allWalletAddresses,
    isChecking,
    currentUser,
    setCurrentUser,
    setIsTwitterLinked,
  ]);

  // Refresh user data when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log(
          "[TwitterAuth] App came to foreground, refreshing user data",
        );
        refreshUserFromDb();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [refreshUserFromDb]);

  // Check if user exists and has Twitter linked on mount
  // This runs when the app starts or when wallet changes
  useEffect(() => {
    async function checkUser() {
      // Skip if no wallets yet - will retry when wallets load
      if (allWalletAddresses.length === 0) {
        console.log("[TwitterAuth] Waiting for wallet to load...");
        return;
      }

      // Skip if we already checked these wallets
      if (lastCheckedWallets === walletsKey) {
        return;
      }

      // Skip if already checking (prevent race condition)
      if (isChecking) {
        console.log("[TwitterAuth] Already checking, skipping...");
        return;
      }

      setIsChecking(true);

      console.log(
        "[TwitterAuth] Wallets loaded:",
        allWalletAddresses.map((w) => w.slice(0, 8) + "...").join(", "),
      );

      // If we have a persisted user, just refresh
      if (currentUser) {
        console.log(
          "[TwitterAuth] Using persisted user:",
          currentUser.twitter_username || "no twitter",
        );
        setIsInitialized(true);

        // Refresh user data from server by checking ALL wallets
        try {
          let freshUser = null;
          for (const walletAddr of allWalletAddresses) {
            freshUser = await getUserByWallet(walletAddr);
            if (freshUser) {
              console.log(
                "[TwitterAuth] Found user via wallet:",
                walletAddr.slice(0, 8) + "...",
              );
              break;
            }
          }

          if (freshUser) {
            console.log(
              "[TwitterAuth] Refreshed user from server:",
              freshUser.twitter_username || "no twitter",
            );
            // Link any missing wallets to this existing user (backfill EVM wallets)
            for (const wallet of allWalletsWithChainType) {
              await linkWalletToUser(
                freshUser.id,
                wallet.address,
                wallet.chainType,
                false,
              );
            }
            setCurrentUser(freshUser);
            setIsTwitterLinked(!!freshUser.twitter_id);
          } else {
            // Persisted user but no match in DB - could be stale, create with primary wallet
            console.log(
              "[TwitterAuth] Persisted user not found in DB, creating fresh",
            );
            // Pass all wallets to link both Solana and EVM
            const additionalWallets = allWalletsWithChainType.filter(
              (w) => w.address !== primaryWalletAddress,
            );
            const newUser = await getOrCreateUser(
              primaryWalletAddress,
              primaryChainType,
              additionalWallets,
            );
            setCurrentUser(newUser);
            setIsTwitterLinked(!!newUser.twitter_id);
          }
        } catch (err) {
          console.warn("[TwitterAuth] Failed to refresh user:", err);
        }
        setLastCheckedWallets(walletsKey);
        setIsChecking(false);
        return;
      }

      // No persisted user - check ALL wallets to find existing user
      console.log("[TwitterAuth] No persisted user, checking all wallets...");
      try {
        let user = null;
        for (const walletAddr of allWalletAddresses) {
          user = await getUserByWallet(walletAddr);
          if (user) {
            console.log(
              "[TwitterAuth] Found user via wallet:",
              walletAddr.slice(0, 8) + "...",
            );
            break;
          }
        }

        if (user) {
          console.log(
            "[TwitterAuth] Found user:",
            user.twitter_username || "no twitter linked",
          );
          // Link any missing wallets to this existing user
          for (const wallet of allWalletsWithChainType) {
            console.log(
              "[TwitterAuth] Ensuring wallet linked:",
              wallet.address.slice(0, 8) + "...",
              wallet.chainType,
            );
            await linkWalletToUser(
              user.id,
              wallet.address,
              wallet.chainType,
              false,
            );
          }
          setCurrentUser(user);
          setIsTwitterLinked(!!user.twitter_id);
        } else {
          console.log(
            "[TwitterAuth] No user found for any wallet, creating new user",
          );
          // Create user entry with ALL wallets (both Solana and EVM)
          const additionalWallets = allWalletsWithChainType.filter(
            (w) => w.address !== primaryWalletAddress,
          );
          const newUser = await getOrCreateUser(
            primaryWalletAddress,
            primaryChainType,
            additionalWallets,
          );
          setCurrentUser(newUser);
          setIsTwitterLinked(false);
        }
      } catch (err) {
        console.error("[TwitterAuth] Failed to check user:", err);
      } finally {
        setIsInitialized(true);
        setLastCheckedWallets(walletsKey);
        setIsChecking(false);
      }
    }

    checkUser();
  }, [
    walletsKey,
    primaryWalletAddress,
    primaryChainType,
    allWalletAddresses,
    currentUser,
    lastCheckedWallets,
    isChecking,
    setCurrentUser,
    setIsTwitterLinked,
  ]);

  // Handle deep link callback
  const handleDeepLink = useCallback(
    async (url: string) => {
      if (!primaryWalletAddress || !pendingCodeVerifier) return;

      try {
        setIsLoading(true);
        setError(null);

        // Parse the callback URL
        const parsed = Linking.parse(url);

        // Check for error
        if (parsed.queryParams?.error) {
          throw new Error(
            (parsed.queryParams.error_description as string) ||
              "Twitter login failed",
          );
        }

        // Verify state
        if (parsed.queryParams?.state !== pendingState) {
          throw new Error("State mismatch - possible CSRF attack");
        }

        // Get authorization code
        const code = parsed.queryParams?.code as string;
        if (!code) {
          throw new Error("No authorization code received");
        }

        // Complete the auth flow
        const user = await completeTwitterAuth(
          code,
          pendingCodeVerifier,
          primaryWalletAddress,
          primaryChainType,
        );

        setCurrentUser(user);
        setIsTwitterLinked(true);

        // Clear pending data
        pendingCodeVerifier = null;
        pendingState = null;
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setIsLoading(false);
      }
    },
    [
      primaryWalletAddress,
      primaryChainType,
      setCurrentUser,
      setIsTwitterLinked,
    ],
  );

  // Listen for deep links
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("oauth/twitter")) {
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  // Initiate Twitter login
  const linkTwitter = useCallback(async () => {
    if (!primaryWalletAddress) {
      setError("No wallet connected");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Generate OAuth URL with PKCE
      const { authUrl, codeVerifier, state } = await initiateTwitterLogin();

      // Store for callback handling
      pendingCodeVerifier = codeVerifier;
      pendingState = state;

      // Build the redirect URL
      const redirectUrl = Linking.createURL("oauth/twitter");

      // Debug logging
      console.log("[TwitterAuth] Auth URL:", authUrl);
      console.log("[TwitterAuth] Redirect URL:", redirectUrl);
      console.log(
        "[TwitterAuth] Client ID set:",
        !!process.env.EXPO_PUBLIC_X_CLIENT_ID,
      );

      // Open browser for Twitter auth
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      console.log("[TwitterAuth] Browser result:", result.type);

      if (result.type === "cancel") {
        pendingCodeVerifier = null;
        pendingState = null;
        setIsLoading(false);
      } else if (result.type === "success" && result.url) {
        // Handle the callback
        await handleDeepLink(result.url);
      }
    } catch (err) {
      console.error("Twitter login error:", err);
      setError(err instanceof Error ? err.message : "Failed to start login");
      pendingCodeVerifier = null;
      pendingState = null;
      setIsLoading(false);
    }
  }, [primaryWalletAddress, handleDeepLink]);

  // Unlink Twitter account
  const unlinkTwitter = useCallback(async () => {
    if (!primaryWalletAddress) return;

    try {
      setIsLoading(true);
      setError(null);

      await unlinkTwitterAccount(primaryWalletAddress);

      // Update local state
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          twitter_id: null,
          twitter_username: null,
          twitter_display_name: null,
          twitter_avatar_url: null,
          twitter_followers_count: 0,
          is_verified: false,
        });
      }
      setIsTwitterLinked(false);
    } catch (err) {
      console.error("Unlink error:", err);
      setError(err instanceof Error ? err.message : "Failed to unlink account");
    } finally {
      setIsLoading(false);
    }
  }, [primaryWalletAddress, currentUser, setCurrentUser, setIsTwitterLinked]);

  return {
    isTwitterLinked,
    currentUser,
    isLoading,
    isInitialized,
    error,
    linkTwitter,
    unlinkTwitter,
    refreshUser: refreshUserFromDb,
    clearError: () => setError(null),
  };
}
