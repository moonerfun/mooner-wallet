/**
 * Centralized Chain Configuration
 * Single source of truth for all blockchain configurations
 *
 * This file consolidates chain definitions that were previously scattered across:
 * - constants/turnkey.ts (NETWORKS, CHAINS)
 * - components/wallet/swap/constants/chainConfig.ts
 * - hooks/useBlockchains.ts (CHAIN_LOGOS, CHAIN_NAME_ALIASES)
 * - constants/pulseFilters.ts (PULSE_CHAINS)
 * - And various inline definitions throughout the codebase
 */

// =============================================================================
// CHAIN CONFIGURATION - Single Source of Truth
// =============================================================================

export interface ChainConfig {
  /** Unique identifier key */
  key: string;
  /** Display name */
  name: string;
  /** Native token symbol */
  symbol: string;
  /** Relay protocol chain ID (used for swaps) */
  relayChainId: number;
  /** EVM chain ID (null for non-EVM chains like Solana) */
  evmChainId: number | null;
  /** Mobula API chain ID format (e.g., "evm:56", "solana:solana") */
  mobulaChainId: string;
  /** Mobula API blockchain name for endpoints like /token/holders (e.g., "BNB Smart Chain (BEP20)") */
  mobulaBlockchainName: string;
  /** Chain logo URL */
  logo: string;
  /** Brand color (hex) */
  color: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Path format for transaction links */
  explorerTxPath: string;
  /** Path format for address/account links */
  explorerAddressPath: string;
  /** Whether this is an EVM-compatible chain */
  isEvm: boolean;
  /** Native token address (zero address for EVM, specific for Solana) */
  nativeTokenAddress: string;
  /** Alternative names/aliases for this chain */
  aliases: string[];
  /** Emoji icon */
  icon: string;
  /** Wallet type for Turnkey */
  walletType: "solana" | "evm";
  /** Turnkey address format */
  addressFormat: string;
}

/**
 * All supported chains configuration
 * Add new chains here - all other files derive from this
 */
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  solana: {
    key: "solana",
    name: "Solana",
    symbol: "SOL",
    relayChainId: 792703809,
    evmChainId: null,
    mobulaChainId: "solana:solana",
    mobulaBlockchainName: "Solana",
    logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    color: "#9945FF",
    explorerUrl: "https://solscan.io",
    explorerTxPath: "/tx/",
    explorerAddressPath: "/account/",
    isEvm: false,
    nativeTokenAddress: "11111111111111111111111111111111",
    aliases: ["solana", "sol"],
    icon: "◎",
    walletType: "solana",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  },
  ethereum: {
    key: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    relayChainId: 1,
    evmChainId: 1,
    mobulaChainId: "evm:1",
    mobulaBlockchainName: "Ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    color: "#627EEA",
    explorerUrl: "https://etherscan.io",
    explorerTxPath: "/tx/",
    explorerAddressPath: "/address/",
    isEvm: true,
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    aliases: ["ethereum", "eth", "mainnet"],
    icon: "💎",
    walletType: "evm",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  },
  base: {
    key: "base",
    name: "Base",
    symbol: "ETH",
    relayChainId: 8453,
    evmChainId: 8453,
    mobulaChainId: "evm:8453",
    mobulaBlockchainName: "Base",
    logo: "https://assets.coingecko.com/asset_platforms/images/131/large/base.jpeg",
    color: "#0052FF",
    explorerUrl: "https://basescan.org",
    explorerTxPath: "/tx/",
    explorerAddressPath: "/address/",
    isEvm: true,
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    aliases: ["base"],
    icon: "🔵",
    walletType: "evm",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  },
  bnb: {
    key: "bnb",
    name: "BNB Chain",
    symbol: "BNB",
    relayChainId: 56,
    evmChainId: 56,
    mobulaChainId: "evm:56",
    mobulaBlockchainName: "BNB Smart Chain (BEP20)",
    logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    color: "#F0B90B",
    explorerUrl: "https://bscscan.com",
    explorerTxPath: "/tx/",
    explorerAddressPath: "/address/",
    isEvm: true,
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    aliases: [
      "bnb",
      "bsc",
      "bnb chain",
      "binance smart chain",
      "bnb smart chain",
      "bnb smart chain (bep20)",
    ],
    icon: "💛",
    walletType: "evm",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  },
} as const;

// =============================================================================
// DERIVED CONSTANTS - Computed from SUPPORTED_CHAINS
// =============================================================================

/** Chain keys as a type */
export type ChainKey = keyof typeof SUPPORTED_CHAINS;

/** Array of all chain keys */
export const CHAIN_KEYS = Object.keys(SUPPORTED_CHAINS) as ChainKey[];

/** Array of EVM chain keys */
export const EVM_CHAIN_KEYS = CHAIN_KEYS.filter(
  (key) => SUPPORTED_CHAINS[key].isEvm,
);

/**
 * Relay chain IDs (for swap/bridge operations)
 * Maps chain key to Relay protocol chain ID
 */
export const RELAY_CHAIN_IDS = {
  SOLANA: SUPPORTED_CHAINS.solana.relayChainId,
  ETHEREUM: SUPPORTED_CHAINS.ethereum.relayChainId,
  BASE: SUPPORTED_CHAINS.base.relayChainId,
  BSC: SUPPORTED_CHAINS.bnb.relayChainId,
} as const;

/**
 * Set of EVM chain IDs for quick lookup
 */
export const EVM_CHAIN_ID_SET = new Set(
  Object.values(SUPPORTED_CHAINS)
    .filter((c) => c.isEvm)
    .map((c) => c.relayChainId),
);

/**
 * Chain logos by key (for backward compatibility)
 */
export const CHAIN_LOGOS: Record<string, string> = Object.fromEntries([
  ...Object.entries(SUPPORTED_CHAINS).map(([key, config]) => [
    key,
    config.logo,
  ]),
  // Add alias mappings
  ...Object.entries(SUPPORTED_CHAINS).flatMap(([_, config]) =>
    config.aliases.map((alias) => [alias.toLowerCase(), config.logo]),
  ),
]);

/**
 * Chain name aliases for normalization
 */
export const CHAIN_NAME_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SUPPORTED_CHAINS).map(([key, config]) => [
    key,
    config.aliases,
  ]),
);

/**
 * Native token addresses
 */
export const NATIVE_TOKEN_ADDRESS =
  "0x0000000000000000000000000000000000000000";
export const SOLANA_NATIVE_ADDRESS = SUPPORTED_CHAINS.solana.nativeTokenAddress;
export const SOLANA_WRAPPED_SOL_ADDRESS =
  "So11111111111111111111111111111111111111112";

// =============================================================================
// UTILITY FUNCTIONS - Chain lookups and conversions
// =============================================================================

/**
 * Get chain config by key
 */
export function getChainByKey(key: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[key.toLowerCase()];
}

/**
 * Get chain config by Relay chain ID
 */
export function getChainByRelayId(
  relayChainId: number,
): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find(
    (c) => c.relayChainId === relayChainId,
  );
}

/**
 * Get chain config by EVM chain ID
 */
export function getChainByEvmId(evmChainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find(
    (c) => c.evmChainId === evmChainId,
  );
}

/**
 * Get chain config by any identifier (key, alias, or chain ID)
 */
export function getChain(identifier: string | number): ChainConfig | undefined {
  // If it's a number, try relay chain ID first, then EVM chain ID
  if (typeof identifier === "number") {
    return getChainByRelayId(identifier) || getChainByEvmId(identifier);
  }

  const normalized = identifier.toLowerCase().trim();

  // Try direct key lookup
  if (SUPPORTED_CHAINS[normalized]) {
    return SUPPORTED_CHAINS[normalized];
  }

  // Try alias lookup
  for (const config of Object.values(SUPPORTED_CHAINS)) {
    if (config.aliases.some((a) => a.toLowerCase() === normalized)) {
      return config;
    }
  }

  // Try Mobula chain ID format (e.g., "evm:1", "solana:solana")
  for (const config of Object.values(SUPPORTED_CHAINS)) {
    if (config.mobulaChainId === identifier) {
      return config;
    }
  }

  return undefined;
}

/**
 * Get chain name from any identifier
 */
export function getChainName(identifier: string | number): string {
  const chain = getChain(identifier);
  return chain?.name || String(identifier);
}

/**
 * Get chain key from any identifier
 */
export function getChainKey(identifier: string | number): ChainKey | undefined {
  const chain = getChain(identifier);
  return chain?.key as ChainKey | undefined;
}

/**
 * Find the matching key in a cross_chain_balances object for a given network.
 * Handles cases where Mobula returns chain names like "BNB Smart Chain (BEP20)"
 * which need to be matched against our aliases.
 *
 * @param crossChainBalances - The cross_chain_balances object from Mobula API
 * @param networkKey - Our network key (e.g., "bnb", "ethereum", "base")
 * @returns The matching key from crossChainBalances, or undefined if not found
 */
export function findCrossChainBalanceKey(
  crossChainBalances: Record<string, unknown> | undefined,
  networkKey: ChainKey,
): string | undefined {
  if (!crossChainBalances) return undefined;

  const networkConfig = SUPPORTED_CHAINS[networkKey];
  if (!networkConfig) return undefined;

  // Try exact match with our network name first
  if (crossChainBalances[networkConfig.name]) {
    return networkConfig.name;
  }

  // Try to find a key that matches any of our aliases
  const allAliases = [
    networkConfig.name.toLowerCase(),
    networkKey,
    ...networkConfig.aliases.map((a) => a.toLowerCase()),
  ];

  for (const mobulaKey of Object.keys(crossChainBalances)) {
    const normalizedKey = mobulaKey.toLowerCase();
    if (allAliases.includes(normalizedKey)) {
      return mobulaKey;
    }
  }

  return undefined;
}

/**
 * Get Relay chain ID from chain name
 */
export function getRelayChainId(chainName: string): number {
  const chain = getChain(chainName);
  return chain?.relayChainId || RELAY_CHAIN_IDS.ETHEREUM;
}

/**
 * Get chain logo by any identifier
 */
export function getChainLogo(identifier: string | number): string {
  const chain = getChain(identifier);
  return chain?.logo || "";
}

/**
 * Check if chain ID is EVM-compatible
 */
export function isEVMChain(chainId: number): boolean {
  const chain = getChainByRelayId(chainId);
  return chain?.isEvm ?? true; // Default to EVM if unknown
}

/**
 * Check if chain ID is Solana
 */
export function isSolanaChain(chainId: number): boolean {
  return chainId === RELAY_CHAIN_IDS.SOLANA;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(
  chainIdentifier: string | number,
  txHash: string,
): string {
  const chain = getChain(chainIdentifier);
  if (!chain) return "";
  return `${chain.explorerUrl}${chain.explorerTxPath}${txHash}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(
  chainIdentifier: string | number,
  address: string,
): string {
  const chain = getChain(chainIdentifier);
  if (!chain) return "";
  return `${chain.explorerUrl}${chain.explorerAddressPath}${address}`;
}

/**
 * Get Turnkey address format for a chain
 */
export function getTurnkeyAddressFormat(chainName: string): string {
  const chain = getChain(chainName);
  return chain?.addressFormat || "ADDRESS_FORMAT_ETHEREUM";
}

/**
 * Get Turnkey transaction type for a chain
 */
export function getTurnkeyTransactionType(chainId: number): string {
  if (isSolanaChain(chainId)) {
    return "TRANSACTION_TYPE_SOLANA";
  }
  return "TRANSACTION_TYPE_ETHEREUM";
}

/**
 * Convert chain name to Mobula API chain ID format
 */
export function toMobulaChainId(chainIdentifier: string | number): string {
  const chain = getChain(chainIdentifier);
  return chain?.mobulaChainId || chainIdentifier.toString();
}

/**
 * Convert chain identifier to Mobula API blockchain name format
 * Used for endpoints like /token/holders, /token/trader-positions that require
 * the full blockchain name (e.g., "BNB Smart Chain (BEP20)" instead of "bnb")
 */
export function toMobulaBlockchainName(
  chainIdentifier: string | number,
): string {
  const chain = getChain(chainIdentifier);
  return chain?.mobulaBlockchainName || chainIdentifier.toString();
}

/**
 * Convert Mobula chain ID to chain key
 */
export function fromMobulaChainId(mobulaChainId: string): ChainKey | undefined {
  const chain = Object.values(SUPPORTED_CHAINS).find(
    (c) => c.mobulaChainId === mobulaChainId,
  );
  return chain?.key as ChainKey | undefined;
}

/**
 * Get blockchain display name from Mobula chain ID
 */
export function getBlockchainName(chainId: string): string {
  // Handle Mobula format (evm:1, solana:solana)
  const chain = Object.values(SUPPORTED_CHAINS).find(
    (c) =>
      c.mobulaChainId === chainId ||
      c.key === chainId.toLowerCase() ||
      c.evmChainId?.toString() === chainId ||
      c.aliases.some((a) => a.toLowerCase() === chainId.toLowerCase()),
  );
  return chain?.name || chainId;
}

/**
 * Convert chain ID to blockchain slug for routing
 */
export function getBlockchainSlug(chainId: string): string {
  // Handle Solana
  if (chainId.includes("solana")) return "solana";

  // Handle EVM chains - extract the numeric part
  const evmMatch = chainId.match(/^(?:evm:)?(\d+)$/);
  if (evmMatch) {
    const numericId = parseInt(evmMatch[1], 10);
    const chain = getChainByEvmId(numericId);
    return chain?.key || evmMatch[1];
  }

  return chainId;
}

// =============================================================================
// PULSE FILTER CHAINS - For Pulse UI
// =============================================================================

export interface PulseChain {
  id: string;
  name: string;
  icon: string;
}

/**
 * Chains available for Pulse filters
 */
export const PULSE_CHAINS: PulseChain[] = Object.values(SUPPORTED_CHAINS).map(
  (config) => ({
    id:
      config.mobulaChainId === "solana:solana"
        ? "solana:solana"
        : config.evmChainId?.toString() || config.key,
    name: config.name,
    icon: config.logo,
  }),
);

/**
 * Get chain by Pulse ID
 */
export function getChainByPulseId(pulseId: string): ChainConfig | undefined {
  if (pulseId === "solana:solana" || pulseId === "solana") {
    return SUPPORTED_CHAINS.solana;
  }
  const evmId = parseInt(pulseId, 10);
  if (!isNaN(evmId)) {
    return getChainByEvmId(evmId);
  }
  return getChain(pulseId);
}

// =============================================================================
// CHAIN ID TO NAME MAPPINGS - For backward compatibility
// =============================================================================

/**
 * Relay chain ID to display name mapping
 */
export const CHAIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.values(SUPPORTED_CHAINS).map((c) => [c.relayChainId, c.name]),
);

/**
 * Chain name to Relay chain ID mapping
 */
export const CHAIN_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.values(SUPPORTED_CHAINS).map((c) => [c.name, c.relayChainId]),
);

/**
 * Mobula chain ID to chain key mapping
 */
export const MOBULA_CHAIN_ID_TO_KEY: Record<string, string> =
  Object.fromEntries(
    Object.values(SUPPORTED_CHAINS).map((c) => [c.mobulaChainId, c.key]),
  );

// =============================================================================
// WALLET TYPE HELPERS - For Turnkey wallet management
// =============================================================================

export type WalletType = "solana" | "evm";

/**
 * Get wallet type for a chain
 */
export function getWalletType(chainIdentifier: string | number): WalletType {
  const chain = getChain(chainIdentifier);
  return chain?.walletType || "evm";
}

/**
 * Get all chains for a wallet type
 */
export function getChainsForWalletType(walletType: WalletType): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(
    (c) => c.walletType === walletType,
  );
}

/**
 * Get EVM networks (chains that share EVM wallet)
 */
export function getEvmNetworks(): ChainConfig[] {
  return getChainsForWalletType("evm");
}
