/**
 * OneBalance API Type Definitions
 * Chain abstraction toolkit for unified cross-chain swaps and balances
 * https://docs.onebalance.io
 */

// ============================================================================
// Account Types
// ============================================================================

/**
 * OneBalance Account Types
 * Supports EVM smart accounts and Solana accounts
 */
export type OneBalanceAccountType =
  | "kernel-v3.1-ecdsa" // EVM Smart Account (ERC4337)
  | "kernel-v3.3-ecdsa" // EVM EOA with EIP-7702
  | "solana"; // Native Solana account

/**
 * EVM Account for Role-Based configuration
 */
export interface OneBalanceEvmRoleBasedAccount {
  sessionAddress: string;
  adminAddress: string;
  accountAddress: string;
}

/**
 * EVM Account for Basic (kernel) configuration
 */
export interface OneBalanceEvmBasicAccount {
  type: "kernel-v3.1-ecdsa";
  deploymentType?: "ERC4337";
  signerAddress: string;
  accountAddress: string;
}

/**
 * EVM Account for EIP-7702 configuration
 */
export interface OneBalanceEvmEip7702Account {
  type: "kernel-v3.3-ecdsa";
  deploymentType: "EIP7702";
  signerAddress: string;
  accountAddress: string;
}

/**
 * Solana Account configuration
 */
export interface OneBalanceSolanaAccount {
  type: "solana";
  accountAddress: string;
}

/**
 * Union type for all account types
 */
export type OneBalanceAccount =
  | OneBalanceEvmRoleBasedAccount
  | OneBalanceEvmBasicAccount
  | OneBalanceEvmEip7702Account
  | OneBalanceSolanaAccount;

/**
 * Multi-account array for V3 endpoints
 */
export type OneBalanceAccountsArray = (
  | OneBalanceEvmBasicAccount
  | OneBalanceEvmEip7702Account
  | OneBalanceSolanaAccount
)[];

// ============================================================================
// Asset Types
// ============================================================================

/**
 * Aggregated Asset - represents a token across all chains
 * Examples: "ob:usdc", "ob:eth", "ob:sol"
 */
export interface OneBalanceAggregatedAsset {
  assetId: string; // "ob:usdc", "ob:eth", etc.
}

/**
 * Chain-specific Asset using CAIP-19 format
 * Examples:
 * - EVM: "eip155:42161/erc20:0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
 * - Solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501"
 */
export interface OneBalanceChainSpecificAsset {
  assetId: string;
}

// ============================================================================
// Balance Types
// ============================================================================

/**
 * Individual asset balance on a specific chain
 */
export interface OneBalanceIndividualAssetBalance {
  assetType: string; // CAIP-19 format
  balance: string; // Balance in smallest unit
  fiatValue: number;
}

/**
 * Aggregated asset balance across all chains
 */
export interface OneBalanceAggregatedAssetBalance {
  aggregatedAssetId: string; // "ob:usdc", etc.
  balance: string; // Total balance across all chains
  fiatValue: number;
  individualAssetBalances: OneBalanceIndividualAssetBalance[];
}

/**
 * Full balance response
 */
export interface OneBalanceBalanceResponse {
  balanceByAggregatedAsset: OneBalanceAggregatedAssetBalance[];
  balanceBySpecificAsset: {
    assetType: string;
    balance: string;
    fiatValue: number;
  }[];
  totalBalance: {
    fiatValue: number;
  };
}

// ============================================================================
// Quote Types
// ============================================================================

/**
 * Quote request for V1 (EVM only)
 */
export interface OneBalanceQuoteRequestV1 {
  from: {
    account:
      | OneBalanceEvmRoleBasedAccount
      | OneBalanceEvmBasicAccount
      | OneBalanceEvmEip7702Account;
    asset: OneBalanceAggregatedAsset | OneBalanceChainSpecificAsset;
    amount: string; // Amount in smallest unit (wei)
  };
  to: {
    asset: OneBalanceAggregatedAsset | OneBalanceChainSpecificAsset;
    account?: string; // Optional recipient (CAIP-10 format for transfers)
  };
  slippageTolerance?: number; // In basis points (e.g., 100 = 1%)
}

/**
 * Quote request for V3 (Multi-account: EVM + Solana)
 */
export interface OneBalanceQuoteRequestV3 {
  from: {
    accounts: OneBalanceAccountsArray;
    asset: OneBalanceAggregatedAsset | OneBalanceChainSpecificAsset;
    amount: string;
  };
  to: {
    asset: OneBalanceAggregatedAsset | OneBalanceChainSpecificAsset;
    account?: string; // Optional recipient
  };
  slippageTolerance?: number;
}

/**
 * Chain operation to be signed (EVM)
 * For EntryPoint 0.7, the userOp includes all fields needed for UserOperation hash computation
 */
export interface OneBalanceEvmChainOperation {
  type?: "evm";
  userOp: {
    sender: string;
    nonce: string;
    callData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    signature?: string;
    // EntryPoint 0.7 optional fields
    factory?: string;
    factoryData?: string;
    paymaster?: string;
    paymasterVerificationGasLimit?: string;
    paymasterPostOpGasLimit?: string;
    paymasterData?: string;
  };
  typedDataToSign: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  /** EIP-7702 delegation object (if EOA needs delegation on this chain) */
  delegation?: {
    contractAddress: string;
    nonce: number;
    chainId?: number;
    signature?: {
      chainId: number;
      contractAddress: string;
      nonce: number;
      r: string;
      s: string;
      v: string;
      yParity: number;
      type: "Signed" | "Unsigned";
    };
  };
  assetType?: string;
  amount?: string;
}

/**
 * Chain operation to be signed (Solana)
 * Note: dataToSign can be either:
 * - A base64 string (serialized transaction) - from V3 API
 * - An object with serializedTransaction field - legacy format
 */
export interface OneBalanceSolanaChainOperation {
  type: "solana";
  /** Base64-encoded serialized transaction, or object with serializedTransaction */
  dataToSign:
    | string
    | {
        serializedTransaction: string;
        addressLookupTableAddresses?: string[];
      };
  /** Address lookup table addresses for versioned transactions */
  addressLookupTableAddresses?: string[];
  /** Recent blockhash used in the transaction */
  recentBlockHash?: string;
  /** Fee payer address */
  feePayer?: string;
  /** Signature after signing */
  signature?: string;
}

/**
 * Union type for chain operations
 */
export type OneBalanceChainOperation =
  | OneBalanceEvmChainOperation
  | OneBalanceSolanaChainOperation;

/**
 * Origin/destination token info in quote response
 */
export interface OneBalanceQuoteTokenInfo {
  aggregatedAssetId?: string;
  assetType: string | string[];
  amount: string;
  minimumAmount?: string;
  fiatValue: string | { fiatValue: string; amount: string }[];
  minimumFiatValue?: string;
  recipientAccount?: string;
}

/**
 * Fee breakdown in quote
 */
export interface OneBalanceQuoteFees {
  protocolFees?: {
    amountUsd: string;
  };
  gasFees?: {
    amountUsd: string;
  };
  cumulativeUSD: string;
}

/**
 * Quote response
 */
export interface OneBalanceQuoteResponse {
  id: string;
  account?: OneBalanceAccount;
  accounts?: OneBalanceAccountsArray;
  originChainsOperations: OneBalanceChainOperation[];
  destinationChainOperation?: OneBalanceChainOperation;
  originToken?: OneBalanceQuoteTokenInfo;
  destinationToken?: OneBalanceQuoteTokenInfo;
  fees: OneBalanceQuoteFees;
  expirationTimestamp?: string;
  validUntil?: string;
  tamperProofSignature?: string;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execute quote request
 */
export interface OneBalanceExecuteQuoteRequest {
  id: string;
  account?: OneBalanceAccount;
  accounts?: OneBalanceAccountsArray;
  originChainsOperations: OneBalanceChainOperation[];
  destinationChainOperation?: OneBalanceChainOperation;
  tamperProofSignature?: string;
  expirationTimestamp?: string;
}

/**
 * Execution status values
 */
export type OneBalanceExecutionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "EXECUTED"
  | "COMPLETED"
  | "REFUNDED"
  | "FAILED";

/**
 * Execution status response
 */
export interface OneBalanceExecutionStatusResponse {
  quoteId: string;
  status: {
    status: OneBalanceExecutionStatus;
    failReason?: string;
  };
  transactionHashes?: {
    chainId: string;
    hash: string;
    explorerUrl?: string;
  }[];
}

// ============================================================================
// Transaction History Types
// ============================================================================

export interface OneBalanceTransactionHistoryItem {
  id: string;
  type: "SWAP" | "TRANSFER" | "CONTRACT_CALL";
  status: OneBalanceExecutionStatus;
  timestamp: string;
  originToken?: OneBalanceQuoteTokenInfo;
  destinationToken?: OneBalanceQuoteTokenInfo;
  transactionHashes?: {
    chainId: string;
    hash: string;
  }[];
}

export interface OneBalanceTransactionHistoryResponse {
  transactions: OneBalanceTransactionHistoryItem[];
  nextCursor?: string;
}

// ============================================================================
// Supported Chains & Assets
// ============================================================================

export interface OneBalanceSupportedChain {
  id: string;
  name: string;
  chainId: number;
  type: "evm" | "solana";
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
}

export interface OneBalanceAggregatedAssetInfo {
  id: string; // "ob:usdc"
  symbol: string;
  name: string;
  decimals: number;
  underlyingAssets: {
    chainId: string;
    assetType: string;
    address: string;
  }[];
}

// ============================================================================
// Predict Address Types
// ============================================================================

export interface OneBalancePredictAddressRequest {
  sessionAddress: string;
  adminAddress: string;
}

export interface OneBalancePredictAddressResponse {
  predictedAddress: string;
}

// ============================================================================
// Unified Quote Type for App Use
// ============================================================================

/**
 * Simplified quote format for UI consumption
 */
export interface OneBalanceSwapQuote {
  // Core identifiers
  id: string;
  provider: "OneBalance";

  // Input/output amounts
  inputAmount: string;
  inputAmountFormatted: string;
  inputAmountUsd: number;
  outputAmount: string;
  outputAmountFormatted: string;
  outputAmountUsd: number;
  minimumOutputAmount: string;

  // Price info
  priceImpact: number;
  rate: string;

  // Fees & gas
  estimatedGas: string;
  estimatedGasUsd: number;
  protocolFeeUsd: number;
  totalFeesUsd: number;

  // Timing
  timeEstimate: number;

  // Route info
  route: string[];
  isCrossChain: boolean;
  sourceChains: string[];
  destinationChain: string;

  // Raw response for execution
  rawQuote: OneBalanceQuoteResponse;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Native token addresses for different chains
 */
export const ONEBALANCE_NATIVE_ADDRESSES = {
  // Aggregated assets
  ETH: "ob:eth",
  USDC: "ob:usdc",
  USDT: "ob:usdt",
  SOL: "ob:sol",

  // Chain-specific native tokens (CAIP-19 format)
  ETHEREUM_ETH: "eip155:1/slip44:60",
  ARBITRUM_ETH: "eip155:42161/slip44:60",
  BASE_ETH: "eip155:8453/slip44:60",
  SOLANA_SOL: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501",
};

/**
 * Common USDC addresses by chain
 */
export const ONEBALANCE_USDC_ADDRESSES = {
  ETHEREUM: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  ARBITRUM: "eip155:42161/erc20:0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  BASE: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  SOLANA:
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

/**
 * Supported chain IDs
 */
export const ONEBALANCE_CHAIN_IDS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  POLYGON: 137,
  LINEA: 59144,
  BSC: 56,
  AVALANCHE: 43114,
  SOLANA: 0, // Solana uses different addressing
};
