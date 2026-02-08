/**
 * RPC URL Configuration for Swap Module
 * Chain-specific RPC endpoints for transaction broadcasting
 */

import { RELAY_CHAIN_IDS } from "@/constants/chains";

// RPC URLs for each chain (for broadcasting transactions)
// NOTE: Use environment variables for production API keys
export const CHAIN_RPC_URLS: Record<number, string> = {
  // EVM Chains
  [RELAY_CHAIN_IDS.ETHEREUM]:
    process.env.EXPO_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com",

  [RELAY_CHAIN_IDS.BSC]:
    process.env.EXPO_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org",

  [RELAY_CHAIN_IDS.BASE]:
    process.env.EXPO_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",

  // Solana - Use environment variable for Helius API key
  [RELAY_CHAIN_IDS.SOLANA]:
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com",
};

/**
 * Get RPC URL for a specific chain
 * @throws Error if chain is not supported
 */
export function getRpcUrl(chainId: number): string {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) {
    throw new Error(
      `No RPC URL configured for chain ${chainId}. Supported chains: ${Object.keys(CHAIN_RPC_URLS).join(", ")}`,
    );
  }
  return rpcUrl;
}

/**
 * Check if a chain has RPC support
 */
export function hasRpcSupport(chainId: number): boolean {
  return chainId in CHAIN_RPC_URLS;
}
