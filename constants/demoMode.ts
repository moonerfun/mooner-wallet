/**
 * Demo Mode Configuration for App Store Review
 *
 * This allows Apple reviewers to access the app using demo credentials
 * without going through real Turnkey authentication.
 *
 * Instructions for App Store Connect:
 * - Username: demo@apple-review.com
 * - Password: Demo123456
 *
 * The demo account will have access to view the app's features with
 * mock wallet data.
 */

// Demo credentials for Apple App Store Review
export const DEMO_EMAIL = "demo@apple-review.com";
export const DEMO_OTP_CODE = "123456";
export const DEMO_PASSWORD = "Demo123456"; // For App Store Connect form

// Check if email is a demo account
export const isDemoAccount = (email: string): boolean => {
  return email.toLowerCase().trim() === DEMO_EMAIL.toLowerCase();
};

// Demo wallet addresses (valid format addresses with no real funds)
// Using well-known empty/burn addresses
export const DEMO_WALLETS = {
  solana: {
    address: "EV7qS4WpNMtwVKtSzSFsBTK2FcA2P4xsaaJo8HAkJCJn", // Valid Solana format (system program adjacent)
    addressFormat: "ADDRESS_FORMAT_SOLANA",
    path: "m/44'/501'/0'/0'",
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
  },
  ethereum: {
    address: "0x075E8fe903a7Ce753FAb86d8C0265005c9242c3b", // Valid EVM precompile address
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
    path: "m/44'/60'/0'/0/0",
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
  },
};

// Demo user info
export const DEMO_USER = {
  userId: "demo-user-apple-review",
  userName: "Demo User",
  userEmail: DEMO_EMAIL,
};

// Demo session (expires in 24 hours from creation)
export const createDemoSession = () => ({
  publicKey: "demo-public-key-for-app-review",
  privateKey: "demo-private-key-for-app-review",
  expirationTime: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
});
