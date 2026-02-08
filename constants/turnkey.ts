// Turnkey configuration constants
export const TURNKEY_ORGANIZATION_ID =
  process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID || "";
export const TURNKEY_API_BASE_URL =
  process.env.EXPO_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com";
export const TURNKEY_AUTH_PROXY_URL =
  process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL ||
  "https://authproxy.turnkey.com";
export const TURNKEY_AUTH_PROXY_CONFIG_ID =
  process.env.EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID || "";
export const TURNKEY_RPID = process.env.EXPO_PUBLIC_TURNKEY_RPID || "";
export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || "moonerwallet";

// Import chain configuration from centralized source
import {
  getChainByEvmId,
  getEvmNetworks as getEvmNetworksFromChains,
  SUPPORTED_CHAINS,
  type ChainConfig,
  type ChainKey,
  type WalletType,
} from "./chains";

// Re-export for backward compatibility
export { SUPPORTED_CHAINS, type ChainConfig, type ChainKey };

// Default wallet configuration for multichain support
// Supports Solana, Ethereum (and all EVM chains: Base, BNB Smart Chain, etc.)
export const DEFAULT_WALLET_CONFIG = {
  walletName: "Default Wallet",
  walletAccounts: [
    // Solana wallet - uses Ed25519 curve
    {
      curve: "CURVE_ED25519" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: "m/44'/501'/0'/0'",
      addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
    },
    // Ethereum wallet - uses Secp256k1 curve
    // This address works across ALL EVM chains: Ethereum, Base, BNB Smart Chain, etc.
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: "m/44'/60'/0'/0/0",
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
  ],
};

// =============================================================================
// WALLET TYPES - The actual wallet addresses (Solana vs EVM)
// =============================================================================
// These represent the two distinct address formats/wallet types we support.
// EVM wallet = 1 address that works on ALL EVM networks (Ethereum, Base, BNB, etc.)
// Solana wallet = 1 address for the Solana network
export type WalletTypeKey = WalletType;

export const WALLET_TYPES = {
  solana: {
    key: "solana" as const,
    name: "Solana",
    shortName: "SOL",
    icon: SUPPORTED_CHAINS.solana.icon,
    logo: SUPPORTED_CHAINS.solana.logo,
    color: SUPPORTED_CHAINS.solana.color,
    addressFormat: SUPPORTED_CHAINS.solana.addressFormat,
    networks: ["solana"] as const,
  },
  evm: {
    key: "evm" as const,
    name: "EVM",
    shortName: "EVM",
    icon: "⬡",
    logo: SUPPORTED_CHAINS.ethereum.logo,
    color: SUPPORTED_CHAINS.ethereum.color,
    addressFormat: SUPPORTED_CHAINS.ethereum.addressFormat,
    networks: ["ethereum", "base", "bnb"] as const,
  },
} as const;

// =============================================================================
// NETWORKS - Derived from SUPPORTED_CHAINS for backward compatibility
// =============================================================================
export type NetworkKey = ChainKey;

// Build NETWORKS from SUPPORTED_CHAINS
export const NETWORKS = Object.fromEntries(
  Object.entries(SUPPORTED_CHAINS).map(([key, config]) => [
    key,
    {
      key: config.key,
      name: config.name,
      symbol: config.symbol,
      icon: config.icon,
      logo: config.logo,
      color: config.color,
      chainId: config.evmChainId,
      walletType: config.walletType,
      explorerUrl: config.explorerUrl,
      isEvm: config.isEvm,
    },
  ]),
) as Record<
  NetworkKey,
  {
    key: string;
    name: string;
    symbol: string;
    icon: string;
    logo: string;
    color: string;
    chainId: number | null;
    walletType: "solana" | "evm";
    explorerUrl: string;
    isEvm: boolean;
  }
>;

// Helper to get network by chain ID
export function getNetworkByChainId(
  chainId: number | null,
): (typeof NETWORKS)[NetworkKey] | undefined {
  if (chainId === null) return NETWORKS.solana;
  const chain = getChainByEvmId(chainId);
  if (!chain) return undefined;
  return NETWORKS[chain.key as NetworkKey];
}

// Helper to get all EVM networks
export function getEvmNetworks() {
  return getEvmNetworksFromChains().map((c) => NETWORKS[c.key as NetworkKey]);
}

// Helper to get networks for a wallet type
export function getNetworksForWalletType(walletType: WalletTypeKey) {
  const config = WALLET_TYPES[walletType];
  return config.networks.map((key) => NETWORKS[key as NetworkKey]);
}

// =============================================================================
// LEGACY: CHAINS - Derived from SUPPORTED_CHAINS for backward compatibility
// =============================================================================
export const CHAINS = Object.fromEntries(
  Object.entries(SUPPORTED_CHAINS).map(([key, config]) => [
    key,
    {
      name: config.name,
      symbol: config.symbol,
      icon: config.icon,
      logo: config.logo,
      color: config.color,
      addressFormat: config.addressFormat,
      chainId: config.evmChainId,
    },
  ]),
) as Record<
  ChainKey,
  {
    name: string;
    symbol: string;
    icon: string;
    logo: string;
    color: string;
    addressFormat: string;
    chainId: number | null;
  }
>;
