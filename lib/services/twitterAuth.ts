/**
 * Twitter OAuth2 Service
 * Handles X/Twitter OAuth2 PKCE authentication flow
 */

import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/api/supabase/supabaseClient";
import type { ChainType, User } from "@/lib/api/supabase/supabaseTypes";
import { triggerKolSync } from "@/lib/kol/kolSyncService";
import {
  getUserIdFromWallet,
  linkWalletToUser,
} from "@/lib/kol/kolTradeService";

// Storage keys for OAuth state (needed for Android deep link handling)
const OAUTH_CODE_VERIFIER_KEY = "@twitter_oauth_code_verifier";
const OAUTH_STATE_KEY = "@twitter_oauth_state";

// Ensure WebBrowser is warmed up for faster OAuth
WebBrowser.maybeCompleteAuthSession();

// Twitter OAuth2 configuration
const TWITTER_CLIENT_ID = process.env.EXPO_PUBLIC_X_CLIENT_ID;
const TWITTER_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "moonerwallet", // Your app scheme from app.json
  path: "oauth/twitter",
});

// Debug log on init
logger.log("[TwitterAuth] Redirect URI:", TWITTER_REDIRECT_URI);
logger.log("[TwitterAuth] Client ID exists:", !!TWITTER_CLIENT_ID);

// Twitter OAuth2 endpoints
const TWITTER_AUTH_ENDPOINT = "https://twitter.com/i/oauth2/authorize";
const TWITTER_TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";
const TWITTER_USER_ENDPOINT = "https://api.twitter.com/2/users/me";

// Scopes needed for reading user info
const TWITTER_SCOPES = ["tweet.read", "users.read", "offline.access"];

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified?: boolean;
}

interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Generate PKCE code verifier and challenge
async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  // Generate random code verifier (43-128 chars, URL-safe)
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .substring(0, 128);

  // Generate code challenge (SHA256 hash of verifier, base64url encoded)
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  const codeChallenge = digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { codeVerifier, codeChallenge };
}

// Generate random state for CSRF protection
async function generateState(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Store OAuth code verifier for deep link callback handling (Android)
 */
export async function storeOAuthState(
  codeVerifier: string,
  state: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(OAUTH_CODE_VERIFIER_KEY, codeVerifier);
    await AsyncStorage.setItem(OAUTH_STATE_KEY, state);
  } catch (err) {
    logger.error("[TwitterAuth] Failed to store OAuth state:", err);
  }
}

/**
 * Get stored code verifier for completing OAuth flow
 */
export async function getStoredCodeVerifier(): Promise<string | null> {
  try {
    const verifier = await AsyncStorage.getItem(OAUTH_CODE_VERIFIER_KEY);
    // Clear after reading (one-time use)
    if (verifier) {
      await AsyncStorage.removeItem(OAUTH_CODE_VERIFIER_KEY);
    }
    return verifier;
  } catch (err) {
    logger.error("[TwitterAuth] Failed to get stored code verifier:", err);
    return null;
  }
}

/**
 * Get stored OAuth state for CSRF validation
 */
export async function getStoredOAuthState(): Promise<string | null> {
  try {
    const state = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    // Clear after reading (one-time use)
    if (state) {
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
    }
    return state;
  } catch (err) {
    logger.error("[TwitterAuth] Failed to get stored OAuth state:", err);
    return null;
  }
}

/**
 * Initiate Twitter OAuth2 login flow
 */
export async function initiateTwitterLogin(): Promise<{
  authUrl: string;
  codeVerifier: string;
  state: string;
}> {
  if (!TWITTER_CLIENT_ID) {
    throw new Error(
      "Twitter Client ID not configured. Set EXPO_PUBLIC_X_CLIENT_ID in .env",
    );
  }

  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = await generateState();

  // Store for deep link callback handling (needed for Android)
  await storeOAuthState(codeVerifier, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope: TWITTER_SCOPES.join(" "),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${TWITTER_AUTH_ENDPOINT}?${params.toString()}`;

  logger.log("[TwitterAuth] Generated auth URL");
  logger.log("[TwitterAuth] Using redirect URI:", TWITTER_REDIRECT_URI);

  return { authUrl, codeVerifier, state };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<TwitterTokenResponse> {
  if (!TWITTER_CLIENT_ID) {
    throw new Error("Twitter Client ID not configured");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: TWITTER_REDIRECT_URI,
    code_verifier: codeVerifier,
    client_id: TWITTER_CLIENT_ID,
  });

  logger.log("[TwitterAuth] Exchanging code for token...");

  const response = await fetch(TWITTER_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      "[TwitterAuth] Token exchange error:",
      response.status,
      errorText,
    );
    throw new Error(`Failed to exchange code for token: ${response.status}`);
  }

  logger.log("[TwitterAuth] Token exchange successful");
  return response.json();
}

/**
 * Fetch Twitter user info using access token
 */
export async function fetchTwitterUser(
  accessToken: string,
): Promise<TwitterUser> {
  const response = await fetch(
    `${TWITTER_USER_ENDPOINT}?user.fields=profile_image_url,public_metrics,verified`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error("User fetch error:", error);
    throw new Error("Failed to fetch Twitter user info");
  }

  const data = await response.json();
  return data.data as TwitterUser;
}

/**
 * Complete Twitter OAuth flow and link to wallet
 * With multi-wallet support, we now:
 * 1. Find user by wallet address (via user_wallets table)
 * 2. Check if Twitter account is already linked to another user
 * 3. If no user exists, create user + wallet association
 * 4. Update user with Twitter info
 */
export async function completeTwitterAuth(
  code: string,
  codeVerifier: string,
  walletAddress: string,
  chainType: ChainType = "evm",
): Promise<User> {
  // Exchange code for token
  const tokenResponse = await exchangeCodeForToken(code, codeVerifier);

  // Fetch Twitter user info
  const twitterUser = await fetchTwitterUser(tokenResponse.access_token);

  logger.log("[TwitterAuth] Twitter user fetched:", twitterUser.username);

  // Check if this Twitter account is already linked to a user
  const { data: existingTwitterUser } = await supabase
    .from("users")
    .select("id")
    .eq("twitter_id", twitterUser.id)
    .single();

  // Check if user already exists via wallet
  let userId = await getUserIdFromWallet(walletAddress);

  // Case 1a: Twitter already linked to a different user AND wallet has a user
  // Unlink Twitter from old user and proceed to link to current wallet's user
  if (existingTwitterUser && userId && existingTwitterUser.id !== userId) {
    logger.log(
      "[TwitterAuth] Twitter account already linked to another user, transferring to current user",
    );
    // Unlink from old user first
    await supabase
      .from("users")
      .update({
        twitter_id: null,
        twitter_username: null,
        twitter_display_name: null,
        twitter_avatar_url: null,
        twitter_followers_count: 0,
        is_verified: false,
      })
      .eq("id", existingTwitterUser.id);
    // Fall through to Case 5 to link to current user
  }

  // Case 1b: Twitter already linked to another user AND wallet has NO user
  // In this case, we should link the wallet to the existing Twitter user
  if (existingTwitterUser && !userId) {
    logger.log(
      "[TwitterAuth] Twitter account exists, wallet has no user - linking wallet to existing Twitter user",
    );
    // Link wallet to existing Twitter user
    await linkWalletToUser(
      existingTwitterUser.id,
      walletAddress,
      chainType,
      true,
    );

    // Update Twitter info with fresh data from the API
    const { data, error } = await supabase
      .from("users")
      .update({
        twitter_username: twitterUser.username,
        twitter_display_name: twitterUser.name,
        twitter_avatar_url: twitterUser.profile_image_url?.replace(
          "_normal",
          "_400x400",
        ),
        twitter_followers_count:
          twitterUser.public_metrics?.followers_count ?? 0,
        is_verified: twitterUser.verified ?? false,
      })
      .eq("id", existingTwitterUser.id)
      .select()
      .single();

    if (error || !data) {
      logger.error("Supabase update error:", error);
      throw new Error("Failed to update user");
    }
    return data;
  }

  // Case 2: Twitter linked to existing user AND wallet belongs to same user - just return
  if (existingTwitterUser && userId && existingTwitterUser.id === userId) {
    logger.log(
      "[TwitterAuth] Twitter already linked to this wallet's user, refreshing data",
    );
    // Update with fresh Twitter info
    const { data, error } = await supabase
      .from("users")
      .update({
        twitter_username: twitterUser.username,
        twitter_display_name: twitterUser.name,
        twitter_avatar_url: twitterUser.profile_image_url?.replace(
          "_normal",
          "_400x400",
        ),
        twitter_followers_count:
          twitterUser.public_metrics?.followers_count ?? 0,
        is_verified: twitterUser.verified ?? false,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error || !data) {
      logger.error("Supabase update error:", error);
      throw new Error("Failed to update user");
    }
    return data;
  }

  // Note: Case 3 (existingTwitterUser && !userId) is handled by Case 1b above

  // Case 4: No user for this wallet AND no existing Twitter user - create new user
  if (!userId) {
    logger.log("[TwitterAuth] Creating new user with Twitter");
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        twitter_id: twitterUser.id,
        twitter_username: twitterUser.username,
        twitter_display_name: twitterUser.name,
        twitter_avatar_url: twitterUser.profile_image_url?.replace(
          "_normal",
          "_400x400",
        ),
        twitter_followers_count:
          twitterUser.public_metrics?.followers_count ?? 0,
        is_verified: twitterUser.verified ?? false,
      })
      .select()
      .single();

    if (createError || !newUser) {
      logger.error("Supabase create user error:", createError);
      throw new Error("Failed to create user");
    }

    // Link wallet to user
    await linkWalletToUser(newUser.id, walletAddress, chainType, true);

    // Trigger immediate sync so user appears in leaderboard
    triggerKolSync(newUser.id);

    return newUser;
  }

  // Case 5: User exists for wallet, link Twitter to them
  logger.log("[TwitterAuth] Linking Twitter to existing wallet user");
  const { data, error } = await supabase
    .from("users")
    .update({
      twitter_id: twitterUser.id,
      twitter_username: twitterUser.username,
      twitter_display_name: twitterUser.name,
      twitter_avatar_url: twitterUser.profile_image_url?.replace(
        "_normal",
        "_400x400",
      ),
      twitter_followers_count: twitterUser.public_metrics?.followers_count ?? 0,
      is_verified: twitterUser.verified ?? false,
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    logger.error("Supabase update error:", error);
    throw new Error("Failed to save user data");
  }

  // Trigger immediate sync so user appears in leaderboard
  triggerKolSync(data.id);

  return data;
}

/**
 * Unlink Twitter account from user
 */
export async function unlinkTwitterAccount(
  walletAddress: string,
): Promise<void> {
  const userId = await getUserIdFromWallet(walletAddress);

  if (!userId) {
    throw new Error("User not found");
  }

  const { error } = await supabase
    .from("users")
    .update({
      twitter_id: null,
      twitter_username: null,
      twitter_display_name: null,
      twitter_avatar_url: null,
      twitter_followers_count: 0,
      is_verified: false,
    })
    .eq("id", userId);

  if (error) {
    logger.error("Unlink error:", error);
    throw new Error("Failed to unlink Twitter account");
  }
}

/**
 * Get user by wallet address (via user_wallets table)
 * Falls back to direct join query if RLS blocks individual table access
 */
export async function getUserByWallet(
  walletAddress: string,
): Promise<User | null> {
  logger.log(
    "[getUserByWallet] Looking up:",
    walletAddress.slice(0, 10) + "...",
  );

  // Try a direct join query first - this might bypass RLS issues
  const { data: joinResult, error: joinError } = await supabase
    .from("users")
    .select(
      `
      *,
      user_wallets!inner(wallet_address)
    `,
    )
    .eq("user_wallets.wallet_address", walletAddress)
    .single();

  if (joinResult && !joinError) {
    logger.log(
      "[getUserByWallet] Found via join:",
      joinResult.twitter_username || "no twitter",
    );
    // Remove the nested user_wallets from the response
    const { user_wallets, ...user } = joinResult as any;
    return user as User;
  }

  if (joinError && joinError.code !== "PGRST116") {
    logger.log(
      "[getUserByWallet] Join query error:",
      joinError.code,
      joinError.message,
    );
  }

  // Fallback: Try direct wallet table query
  let { data: wallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("user_id, wallet_address")
    .eq("wallet_address", walletAddress)
    .single();

  // If not found, try case-insensitive for EVM addresses
  if (walletError?.code === "PGRST116" && walletAddress.startsWith("0x")) {
    logger.log("[getUserByWallet] Trying case-insensitive match...");
    const { data: walletLower } = await supabase
      .from("user_wallets")
      .select("user_id, wallet_address")
      .ilike("wallet_address", walletAddress)
      .single();
    wallet = walletLower;
    walletError = null;
  }

  if (walletError || !wallet) {
    // PGRST116 = "no rows returned" - this is expected when wallet is not linked
    if (walletError?.code === "PGRST116" || !wallet) {
      logger.log("[getUserByWallet] Wallet not found in DB (not linked yet)");
      return null;
    }
    // Only log as error for actual errors (not just "not found")
    logger.error(
      "[getUserByWallet] Database error:",
      walletError?.message || walletError,
    );
    return null;
  }

  logger.log("[getUserByWallet] Found wallet, user_id:", wallet.user_id);

  // Get user
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", wallet.user_id)
    .single();

  if (error) {
    logger.error("[getUserByWallet] Get user error:", error);
    return null;
  }

  logger.log(
    "[getUserByWallet] Found user:",
    data?.twitter_username || "no twitter",
  );
  return data;
}

/**
 * Wallet info for user creation
 */
export interface WalletInfo {
  address: string;
  chainType: ChainType;
}

/**
 * Create or get user by wallet (without Twitter linking)
 * Links ALL provided wallets to the user (both Solana and EVM)
 */
export async function getOrCreateUser(
  walletAddress: string,
  chainType: ChainType = "evm",
  additionalWallets?: WalletInfo[],
): Promise<User> {
  logger.log(
    "[getOrCreateUser] Starting for wallet:",
    walletAddress.slice(0, 10) + "...",
    additionalWallets?.length
      ? `(+${additionalWallets.length} additional)`
      : "",
  );

  // Combine all wallets into one list
  const allWallets: WalletInfo[] = [
    { address: walletAddress, chainType },
    ...(additionalWallets || []),
  ];

  // Try to get existing user via any of the wallets
  for (const wallet of allWallets) {
    const existingUser = await getUserByWallet(wallet.address);
    if (existingUser) {
      logger.log("[getOrCreateUser] Found existing user:", existingUser.id);
      // Link any missing wallets to this user
      for (const w of allWallets) {
        if (w.address !== wallet.address) {
          logger.log(
            "[getOrCreateUser] Linking additional wallet:",
            w.address.slice(0, 10) + "...",
            w.chainType,
          );
          await linkWalletToUser(
            existingUser.id,
            w.address,
            w.chainType,
            false,
          );
        }
      }
      return existingUser;
    }
  }

  // Double-check: wallet might exist but getUserByWallet failed for some reason
  // Query user_wallets directly to be sure
  for (const wallet of allWallets) {
    const { data: existingWallet } = await supabase
      .from("user_wallets")
      .select("user_id")
      .eq("wallet_address", wallet.address)
      .single();

    if (existingWallet) {
      logger.log(
        "[getOrCreateUser] Wallet exists! Fetching user directly:",
        existingWallet.user_id,
      );
      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", existingWallet.user_id)
        .single();
      if (user) {
        // Link any missing wallets
        for (const w of allWallets) {
          if (w.address !== wallet.address) {
            logger.log(
              "[getOrCreateUser] Linking additional wallet:",
              w.address.slice(0, 10) + "...",
              w.chainType,
            );
            await linkWalletToUser(user.id, w.address, w.chainType, false);
          }
        }
        return user;
      }
    }
  }

  logger.log("[getOrCreateUser] Creating new user...");

  // Create new user
  const { data: newUser, error: createError } = await supabase
    .from("users")
    .insert({})
    .select()
    .single();

  if (createError || !newUser) {
    logger.error("[getOrCreateUser] Create user error:", createError);
    throw createError;
  }

  logger.log("[getOrCreateUser] Created user:", newUser.id);

  // Link ALL wallets to user
  let isPrimary = true;
  for (const wallet of allWallets) {
    logger.log(
      "[getOrCreateUser] Linking wallet:",
      wallet.address.slice(0, 10) + "...",
      wallet.chainType,
      isPrimary ? "(primary)" : "",
    );
    await linkWalletToUser(
      newUser.id,
      wallet.address,
      wallet.chainType,
      isPrimary,
    );
    isPrimary = false; // Only first wallet is primary
  }

  return newUser;
}
