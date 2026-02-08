/**
 * Pulse Filter Constants
 * Chain and protocol options for Pulse filters (matching MTT)
 */

// Import chain configuration from centralized source
import { PULSE_CHAINS as CENTRALIZED_PULSE_CHAINS } from "./chains";

export interface Chain {
  id: string;
  name: string;
  icon?: string;
}

export interface Protocol {
  id: string;
  name: string;
  icon?: string;
  chainId: string;
}

// Re-export from centralized chains for backward compatibility
export const PULSE_CHAINS: Chain[] = CENTRALIZED_PULSE_CHAINS;

// Default chain IDs
export const DEFAULT_CHAIN_IDS = ["solana:solana"];

// Protocols available for each chain (primarily Solana)
export const PULSE_PROTOCOLS: Protocol[] = [
  // Solana protocols
  {
    id: "pumpfun",
    name: "pump.fun",
    icon: "https://pump.fun/favicon.ico",
    chainId: "solana:solana",
  },
  {
    id: "pumpswap",
    name: "PumpSwap",
    icon: "https://pump.fun/favicon.ico",
    chainId: "solana:solana",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    icon: "https://moonshot.money/favicon.ico",
    chainId: "solana:solana",
  },
  {
    id: "boop",
    name: "Boop",
    icon: "https://boop.fun/favicon.ico",
    chainId: "solana:solana",
  },
  {
    id: "gte",
    name: "GTE",
    icon: "https://gte.io/favicon.ico",
    chainId: "solana:solana",
  },
  {
    id: "raydium",
    name: "Raydium",
    icon: "https://cryptologos.cc/logos/raydium-ray-logo.png",
    chainId: "solana:solana",
  },
  {
    id: "meteora",
    name: "Meteora",
    icon: "https://www.meteora.ag/icons/v2/logo.svg",
    chainId: "solana:solana",
  },
  {
    id: "orca",
    name: "Orca",
    icon: "https://cryptologos.cc/logos/orca-orca-logo.png",
    chainId: "solana:solana",
  },
  // Ethereum protocols
  {
    id: "uniswap",
    name: "Uniswap",
    icon: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
    chainId: "1",
  },
  // Base protocols
  {
    id: "aerodrome",
    name: "Aerodrome",
    icon: "https://aerodrome.finance/favicon.ico",
    chainId: "8453",
  },
];

/**
 * Get protocols available for selected chains
 */
export function getProtocolsForChains(chainIds: string[]): Protocol[] {
  if (chainIds.length === 0) return PULSE_PROTOCOLS;
  return PULSE_PROTOCOLS.filter((p) => chainIds.includes(p.chainId));
}

/**
 * Get chain by ID
 */
export function getChainById(chainId: string): Chain | undefined {
  return PULSE_CHAINS.find((c) => c.id === chainId);
}

/**
 * Format chain name for display
 */
export function formatChainName(chainIds: string[]): string {
  if (chainIds.length === 0) return "All Chains";
  if (chainIds.length === 1) {
    const chain = getChainById(chainIds[0]);
    return chain?.name || chainIds[0];
  }
  return `${chainIds.length} Chains`;
}
