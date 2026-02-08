import { AnimatedScreen, Button, TextInput } from "@/components";
import { OTPInput } from "@/components/auth";
import {
  createDemoSession,
  DEMO_OTP_CODE,
  DEMO_USER,
  DEMO_WALLETS,
  isDemoAccount,
} from "@/constants/demoMode";
import { DEFAULT_WALLET_CONFIG } from "@/constants/turnkey";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { Ionicons } from "@expo/vector-icons";
import { OtpType, useTurnkey } from "@turnkey/react-native-wallet-kit";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthStep = "email" | "otp" | "passkey";

export default function LoginScreen() {
  const router = useRouter();
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const { setSessionState, setSession, setUser, setAccounts } = useWallet();

  const {
    initOtp,
    completeOtp, // Use completeOtp instead of separate verify/login/signup
    loginWithPasskey,
    signUpWithPasskey,
    handleGoogleOauth,
    handleAppleOauth,
    handleDiscordOauth,
    authState,
  } = useTurnkey();

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle demo mode login (for Apple App Store Review)
  const handleDemoLogin = () => {
    // Set up demo session
    setSession(createDemoSession());
    setUser(DEMO_USER);
    setAccounts([DEMO_WALLETS.solana, DEMO_WALLETS.ethereum]);
    setSessionState("authenticated");
    router.replace("/(main)/(tabs)" as any);
  };

  // Handle email submission
  const handleEmailSubmit = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if this is a demo account for Apple review
    if (isDemoAccount(email)) {
      setOtpId("demo-otp-id");
      setStep("otp");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const id = await initOtp({
        otpType: OtpType.Email,
        contact: email,
      });

      if (id) {
        setOtpId(id);
        setStep("otp");
      } else {
        setError("Failed to send verification code");
      }
    } catch (err: any) {
      console.error("OTP init error:", err);
      setError(err?.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification using completeOtp (handles both login and signup)
  const handleOTPComplete = async (code: string) => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit verification code");
      return;
    }

    // Handle demo mode for Apple App Store Review
    if (isDemoAccount(email)) {
      if (code === DEMO_OTP_CODE) {
        handleDemoLogin();
        return;
      } else {
        setError("Invalid verification code. Use: 123456");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // completeOtp handles verification, login/signup, and session creation
      const result = await completeOtp({
        otpId,
        otpCode: code,
        contact: email,
        otpType: OtpType.Email,
        createSubOrgParams: {
          customWallet: DEFAULT_WALLET_CONFIG,
        },
      });

      if (result?.sessionToken) {
        setSessionState("authenticated");
        router.replace("/(main)/(tabs)" as any);
      } else {
        throw new Error("Authentication failed - no session token");
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err?.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle passkey login
  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await loginWithPasskey();
      setSessionState("authenticated");
      router.replace("/(main)/(tabs)" as any);
    } catch (err: any) {
      console.error("Passkey login error:", err);
      // If login fails, offer signup
      Alert.alert(
        "No Passkey Found",
        "Would you like to create a new wallet with a passkey?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Create Wallet", onPress: handlePasskeySignup },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle passkey signup
  const handlePasskeySignup = async () => {
    setLoading(true);
    setError("");

    try {
      await signUpWithPasskey({
        passkeyDisplayName: `Wallet-${Date.now()}`,
        createSubOrgParams: {
          userName: email || "User",
          customWallet: DEFAULT_WALLET_CONFIG,
        },
      });
      setSessionState("authenticated");
      router.replace("/(main)/(tabs)" as any);
    } catch (err: any) {
      console.error("Passkey signup error:", err);
      setError(err?.message || "Failed to create passkey");
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth
  const handleOAuth = async (provider: "google" | "apple" | "discord") => {
    setLoading(true);
    setError("");

    try {
      if (provider === "google") {
        await handleGoogleOauth?.();
      } else if (provider === "apple") {
        await handleAppleOauth?.();
      } else if (provider === "discord") {
        await handleDiscordOauth?.();
      }
      setSessionState("authenticated");
      router.replace("/(main)/(tabs)" as any);
    } catch (err: any) {
      console.error(`${provider} OAuth error:`, err);
      setError(err?.message || `Failed to sign in with ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    // For demo mode, just show a message
    if (isDemoAccount(email)) {
      Alert.alert(
        "Demo Mode",
        "This is a demo account. Use verification code: 123456",
      );
      return;
    }

    setLoading(true);
    try {
      const id = await initOtp({
        otpType: OtpType.Email,
        contact: email,
      });
      if (id) {
        setOtpId(id);
        Alert.alert(
          "Code Sent",
          "A new verification code has been sent to your email.",
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <AnimatedScreen entering="fadeUp" exiting="none" duration={350}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: sp[5],
              paddingVertical: sp[6],
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: sp[10] }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: br.xl,
                  backgroundColor: theme.primary.DEFAULT,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: sp[4],
                }}
              >
                <Ionicons
                  name="moon"
                  size={40}
                  color="#FFFFFF"
                  style={{ transform: [{ scaleX: -1 }] }}
                />
              </View>
              <Text
                style={{
                  fontSize: fs["3xl"],
                  fontWeight: "700",
                  color: theme.text.primary,
                  textAlign: "center",
                }}
              >
                {step === "otp" ? "Verify Your Email" : "Mooner.fun"}
              </Text>
              <Text
                style={{
                  fontSize: fs.base,
                  color: theme.text.secondary,
                  textAlign: "center",
                  marginTop: sp[2],
                }}
              >
                {step === "otp"
                  ? `Enter the code sent to ${email}`
                  : "Sign in to your multichain wallet"}
              </Text>
            </View>

            {/* Email Step */}
            {step === "email" && (
              <View style={{ gap: sp[5] }}>
                <TextInput
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  leftIcon="mail-outline"
                  error={error}
                />

                <Button
                  title="Continue with Email"
                  onPress={handleEmailSubmit}
                  loading={loading}
                  fullWidth
                />

                {/* Divider */}
                {/* <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginVertical: sp[2],
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: theme.border }}
                />
                <Text
                  style={{
                    marginHorizontal: sp[3],
                    color: theme.text.muted,
                    fontSize: fs.sm,
                  }}
                >
                  or continue with
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: theme.border }}
                />
              </View> */}

                {/* Passkey Button */}
                {/* <Button
                title="Sign in with Passkey"
                variant="outline"
                onPress={handlePasskeyLogin}
                loading={loading}
                fullWidth
                leftIcon={
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color={theme.text.primary}
                  />
                }
              /> */}

                {/* Social Buttons */}
                {/* <SocialButtonsGrid
                onGooglePress={() => handleOAuth("google")}
                onApplePress={() => handleOAuth("apple")}
                onDiscordPress={() => handleOAuth("discord")}
                loading={loading}
              /> */}
              </View>
            )}

            {/* OTP Step */}
            {step === "otp" && (
              <View style={{ gap: sp[6], alignItems: "center" }}>
                <OTPInput
                  length={6}
                  onComplete={handleOTPComplete}
                  onResend={handleResendOTP}
                  loading={loading}
                  error={error}
                />

                <Button
                  title="Back to Email"
                  variant="ghost"
                  onPress={() => {
                    setStep("email");
                    setError("");
                  }}
                />
              </View>
            )}

            {/* Footer */}
            <View style={{ marginTop: "auto", paddingTop: sp[6] }}>
              <Text
                style={{
                  fontSize: fs.xs,
                  color: theme.text.muted,
                  textAlign: "center",
                }}
              >
                By continuing, you agree to our Terms of Service and Privacy
                Policy
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </AnimatedScreen>
    </SafeAreaView>
  );
}
