/**
 * Twitter OAuth Callback Handler
 * This route handles the deep link callback from Twitter OAuth on Android
 */

import { useWallet } from "@/contexts/WalletContext";
import type { ChainType } from "@/lib/api/supabase/supabaseTypes";
import { completeTwitterAuth } from "@/lib/services/twitterAuth";
import { useKolStore } from "@/store/kolStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function TwitterOAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();

  const { accounts } = useWallet();
  const { setCurrentUser, setIsTwitterLinked } = useKolStore();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedRef = useRef(false);

  const primaryAccount = accounts?.[0];
  const primaryWalletAddress = primaryAccount?.address;

  // Determine chain type from the primary account's addressFormat
  const getChainType = (): ChainType => {
    if (!primaryAccount?.addressFormat) return "evm";
    if (primaryAccount.addressFormat === "ADDRESS_FORMAT_SOLANA")
      return "solana";
    if (primaryAccount.addressFormat === "ADDRESS_FORMAT_ETHEREUM")
      return "evm";
    return "evm";
  };

  useEffect(() => {
    async function handleCallback() {
      // Prevent double processing
      if (processedRef.current) return;
      processedRef.current = true;

      console.log("[TwitterOAuth] Callback received:", {
        code: params.code ? "present" : "missing",
        state: params.state ? "present" : "missing",
        error: params.error,
      });

      // Check for OAuth error
      if (params.error) {
        setStatus("error");
        setErrorMessage(params.error_description || params.error);
        setTimeout(() => router.replace("/"), 2000);
        return;
      }

      // Check for required params
      if (!params.code) {
        setStatus("error");
        setErrorMessage("No authorization code received");
        setTimeout(() => router.replace("/"), 2000);
        return;
      }

      if (!primaryWalletAddress) {
        setStatus("error");
        setErrorMessage("No wallet connected");
        setTimeout(() => router.replace("/"), 2000);
        return;
      }

      // Get the stored code verifier from async storage or global state
      // Note: The code verifier should be passed via the useTwitterAuth hook's pending state
      // Since this is a deep link, we need to retrieve it from where it was stored
      const { getStoredCodeVerifier, getStoredOAuthState } =
        await import("@/lib/services/twitterAuth");

      // Validate state to prevent CSRF attacks
      const storedState = await getStoredOAuthState();
      if (storedState && params.state && storedState !== params.state) {
        setStatus("error");
        setErrorMessage("State mismatch - please try again");
        setTimeout(() => router.replace("/"), 2000);
        return;
      }

      const codeVerifier = await getStoredCodeVerifier();

      if (!codeVerifier) {
        setStatus("error");
        setErrorMessage("OAuth session expired. Please try again.");
        setTimeout(() => router.replace("/"), 2000);
        return;
      }

      try {
        // Complete the auth flow
        const user = await completeTwitterAuth(
          params.code,
          codeVerifier,
          primaryWalletAddress,
          getChainType(),
        );

        setCurrentUser(user);
        setIsTwitterLinked(true);
        setStatus("success");

        // Navigate back to the main app
        setTimeout(() => router.replace("/"), 1000);
      } catch (err) {
        console.error("[TwitterOAuth] Error:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Authentication failed",
        );
        setTimeout(() => router.replace("/"), 2000);
      }
    }

    handleCallback();
  }, [
    params,
    primaryWalletAddress,
    router,
    setCurrentUser,
    setIsTwitterLinked,
  ]);

  return (
    <View className="flex-1 bg-background items-center justify-center p-6">
      {status === "processing" && (
        <>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-white text-lg mt-4">
            Connecting your X account...
          </Text>
        </>
      )}
      {status === "success" && (
        <>
          <Text className="text-green-500 text-4xl mb-4">✓</Text>
          <Text className="text-white text-lg">
            X account connected successfully!
          </Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text className="text-red-500 text-4xl mb-4">✗</Text>
          <Text className="text-white text-lg text-center">
            {errorMessage || "Failed to connect X account"}
          </Text>
          <Text className="text-gray-400 text-sm mt-2">
            Redirecting back...
          </Text>
        </>
      )}
    </View>
  );
}
