/**
 * Portfolio Transformers
 * Centralized functions for transforming Mobula API responses to portfolio assets
 * Extracted from portfolioStore.ts to eliminate duplication
 */

import { SUPPORTED_CHAINS } from "@/constants/chains";
import {
  SCAM_MAX_TOP_HOLDERS,
  SCAM_MIN_LIQUIDITY,
  SCAM_NAME_PATTERNS,
  SCAM_TOKEN_ADDRESSES,
} from "@/constants/defaults";

/**
 * Cross-chain balance data from Mobula API
 */
export interface CrossChainBalance {
  balance: number;
  balanceRaw: string;
  chainId: string;
  address: string;
}

/**
 * Portfolio asset structure
 */
export interface PortfolioAsset {
  name: string;
  symbol: string;
  logo?: string;
  address: string;
  blockchain: string;
  blockchains: string[];
  crossChainBalances: Record<string, CrossChainBalance>;
  balance: number;
  balanceRaw: string;
  decimals?: number;
  price: number;
  priceChange24h: number;
  valueUsd: number;
  allocation: number;
}

/**
 * Get the proper token address, falling back to native token address
 * when contracts array is empty (for native tokens like SOL, ETH, BNB)
 */
export function getTokenAddress(
  contracts: string[] | undefined,
  blockchain: string,
): string {
  const chainKey = blockchain?.toLowerCase() || "ethereum";

  // For Solana, validate that we have a proper Solana address
  if (chainKey === "solana") {
    const contractAddress = contracts?.[0];
    // Valid Solana addresses are base58 encoded and don't start with "0x"
    if (
      contractAddress &&
      !contractAddress.startsWith("0x") &&
      contractAddress.length >= 32 &&
      contractAddress.length <= 44
    ) {
      return contractAddress;
    }
    // Fall back to Wrapped SOL address which works better with APIs
    return "So11111111111111111111111111111111111111112";
  }

  // For EVM chains, use the contract address if available
  if (contracts && contracts.length > 0 && contracts[0]) {
    return contracts[0];
  }

  // Otherwise, use the native token address for this blockchain
  const chainConfig = SUPPORTED_CHAINS[chainKey];
  if (chainConfig?.nativeTokenAddress) {
    return chainConfig.nativeTokenAddress;
  }

  // Fallback to empty string if no chain config found
  return "";
}

/**
 * Parse cross-chain balances from Mobula API response
 */
export function parseCrossChainBalances(
  rawBalances: Record<string, any> | undefined,
): Record<string, CrossChainBalance> {
  const crossChainBalances: Record<string, CrossChainBalance> = {};

  if (!rawBalances) return crossChainBalances;

  for (const [chainName, balanceData] of Object.entries(rawBalances)) {
    const ccData = balanceData as any;
    crossChainBalances[chainName] = {
      balance: ccData.balance || 0,
      balanceRaw: ccData.balanceRaw || "0",
      chainId: ccData.chainId || "",
      address: ccData.address || "",
    };
  }

  return crossChainBalances;
}

/**
 * Extract raw balance with fallback logic for API inconsistencies
 * Priority: 1) token_balance_raw, 2) contracts_balances[0].balanceRaw, 3) calculated from token_balance
 */
export function extractRawBalance(asset: any, tokenDecimals: number): string {
  let rawBalance = asset.token_balance_raw;

  if (!rawBalance && asset.contracts_balances?.[0]) {
    rawBalance = asset.contracts_balances[0].balanceRaw;
  }

  // If still no rawBalance, calculate from token_balance with detected decimals
  if (!rawBalance && asset.token_balance) {
    rawBalance = Math.floor(
      asset.token_balance * Math.pow(10, tokenDecimals),
    ).toString();
  }

  return rawBalance || "0";
}

/**
 * Detect token decimals from asset data
 */
export function detectTokenDecimals(
  asset: any,
  defaultDecimals: number = 18,
): number {
  return (
    asset.contracts_balances?.[0]?.decimals ??
    asset.asset?.decimals ??
    (parseInt(asset.asset?.decimals?.[0], 10) || defaultDecimals)
  );
}

/**
 * Transform a single Mobula asset to PortfolioAsset format
 * This is the centralized transformation used by both single and multi-wallet portfolio fetches
 */
export function transformMobulaAsset(
  asset: any,
  totalBalance: number,
): PortfolioAsset {
  // Get blockchains array from nested asset object
  const blockchains: string[] = asset.asset?.blockchains || [];

  // Parse cross_chain_balances
  const crossChainBalances = parseCrossChainBalances(
    asset.cross_chain_balances,
  );

  // Detect decimals from the data
  const tokenDecimals = detectTokenDecimals(asset);

  // Extract raw balance with fallback logic
  const rawBalance = extractRawBalance(asset, tokenDecimals);

  // Primary blockchain (first in the list)
  const primaryBlockchain = blockchains[0] || "ethereum";

  return {
    name: asset.asset?.name || "Unknown",
    symbol: asset.asset?.symbol || "???",
    logo: asset.asset?.logo,
    address: getTokenAddress(asset.asset?.contracts, primaryBlockchain),
    blockchain: primaryBlockchain,
    blockchains,
    crossChainBalances,
    balance: asset.token_balance || 0,
    balanceRaw: rawBalance,
    decimals: tokenDecimals,
    price: asset.price || 0,
    priceChange24h: asset.price_change_24h || 0,
    valueUsd: asset.estimated_balance || 0,
    allocation:
      totalBalance > 0
        ? ((asset.estimated_balance || 0) / totalBalance) * 100
        : 0,
  };
}

/**
 * Check if a raw Mobula asset is a potential scam token
 * @param asset Raw asset from Mobula API
 * @returns true if the token appears to be a scam
 */
export function isScamToken(asset: any): boolean {
  // Check 1: Zero or very low liquidity
  const liquidity = asset.liquidity ?? 0;
  if (liquidity < SCAM_MIN_LIQUIDITY) {
    // Exception: Allow legitimate tokens with zero balance that user may have interacted with
    // But still filter if the name/symbol looks suspicious
    const name = asset.asset?.name || "";
    const symbol = asset.asset?.symbol || "";

    // If it has zero liquidity AND a suspicious name, it's definitely a scam
    const hasScamName = SCAM_NAME_PATTERNS.some(
      (pattern) => pattern.test(name) || pattern.test(symbol),
    );
    if (hasScamName) {
      return true;
    }

    // Zero liquidity with unknown asset ID (id=0) is suspicious
    if (liquidity === 0 && asset.asset?.id === 0) {
      return true;
    }
  }

  // Check 2: Suspicious names/symbols (URLs, "claim airdrop", etc.)
  const name = asset.asset?.name || "";
  const symbol = asset.asset?.symbol || "";
  const hasScamName = SCAM_NAME_PATTERNS.some(
    (pattern) => pattern.test(name) || pattern.test(symbol),
  );
  if (hasScamName) {
    return true;
  }

  // Check 3: Frozen tokens (can't be transferred/sold)
  const security = asset.contracts_balances?.[0]?.security;
  if (security?.frozen === true) {
    return true;
  }

  // Check 4: Extreme holder concentration (top 10 holders own >99%)
  if (security?.top10Holders) {
    const top10Percentage = parseFloat(security.top10Holders);
    if (top10Percentage >= SCAM_MAX_TOP_HOLDERS) {
      // Only flag as scam if also has low liquidity
      if (liquidity < SCAM_MIN_LIQUIDITY * 10) {
        return true;
      }
    }
  }

  // Check 5: Known scam addresses
  const contracts = asset.asset?.contracts || [];
  for (const contract of contracts) {
    if (SCAM_TOKEN_ADDRESSES.has(contract?.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Filter out scam tokens from raw Mobula assets
 * @param assets Raw assets from Mobula API
 * @returns Filtered assets without scam tokens
 */
export function filterScamTokens(assets: any[]): any[] {
  return (assets || []).filter((asset) => {
    const isScam = isScamToken(asset);
    if (isScam) {
      console.log(
        `[ScamFilter] Filtered out suspicious token: ${asset.asset?.name} (${asset.asset?.symbol})`,
        {
          liquidity: asset.liquidity,
          assetId: asset.asset?.id,
        },
      );
    }
    return !isScam;
  });
}

/**
 * Transform array of Mobula assets to PortfolioAsset array
 * Automatically filters out scam tokens
 */
export function transformMobulaAssets(
  assets: any[],
  totalBalance: number,
): PortfolioAsset[] {
  // Filter out scam tokens before transforming
  const filteredAssets = filterScamTokens(assets);

  return filteredAssets.map((asset) =>
    transformMobulaAsset(asset, totalBalance),
  );
}

/**
 * Calculate 24h change from individual asset price changes
 * Formula: sum of (valueUsd * priceChange24h / 100) for each asset
 */
export function calculateTotalChange24h(assets: PortfolioAsset[]): number {
  return assets.reduce((sum, asset) => {
    const change = (asset.valueUsd * asset.priceChange24h) / 100;
    return sum + change;
  }, 0);
}

/**
 * Extract API-provided PnL as fallback
 */
export function extractApiPnl24h(data: any): number {
  const pnlHistory24h = data?.total_pnl_history?.["24h"];
  return pnlHistory24h
    ? (pnlHistory24h.realized || 0) + (pnlHistory24h.unrealized || 0)
    : 0;
}

/**
 * Calculate final 24h change values
 */
export function calculateFinalChange24h(
  calculatedChange: number,
  apiChange: number,
  totalBalance: number,
): { change24h: number; changePercentage24h: number } {
  const finalChange = calculatedChange !== 0 ? calculatedChange : apiChange;
  const finalPercentage =
    totalBalance > 0 ? (finalChange / totalBalance) * 100 : 0;

  return {
    change24h: finalChange,
    changePercentage24h: finalPercentage,
  };
}
