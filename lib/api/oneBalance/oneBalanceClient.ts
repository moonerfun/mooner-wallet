/**
 * OneBalance API Client
 * Chain abstraction toolkit for unified cross-chain swaps and balances
 * https://docs.onebalance.io
 *
 * Features:
 * - Unified USDC balance across all chains
 * - Cross-chain swaps without manual bridging
 * - Smart account management
 * - Gas abstraction (pay with any token)
 */

import { REQUEST_TIMEOUT } from "@/constants/network";
import {
  OneBalanceAccountsArray,
  OneBalanceAggregatedAssetInfo,
  OneBalanceBalanceResponse,
  OneBalanceChainOperation,
  OneBalanceEvmChainOperation,
  OneBalanceExecuteQuoteRequest,
  OneBalanceExecutionStatus,
  OneBalanceExecutionStatusResponse,
  OneBalancePredictAddressRequest,
  OneBalancePredictAddressResponse,
  OneBalanceQuoteRequestV1,
  OneBalanceQuoteRequestV3,
  OneBalanceQuoteResponse,
  OneBalanceSolanaChainOperation,
  OneBalanceSupportedChain,
  OneBalanceSwapQuote,
  OneBalanceTransactionHistoryResponse,
} from "./oneBalanceTypes";

// ============================================================================
// Configuration
// ============================================================================

const ONEBALANCE_API_BASE_URL =
  process.env.EXPO_PUBLIC_ONEBALANCE_API_URL || "https://be.onebalance.io/api";
const ONEBALANCE_API_KEY = process.env.EXPO_PUBLIC_ONEBALANCE_API_KEY;

// Enable debug logging in development
const DEBUG = __DEV__;

// ============================================================================
// Utility Functions
// ============================================================================

function log(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[OneBalanceClient] ${message}`, data ?? "");
  }
}

function logError(message: string, error?: unknown): void {
  console.error(`[OneBalanceClient] ${message}`, error ?? "");
}

/**
 * Format a number with smart decimal places
 */
function formatAmount(value: string, decimals: number): string {
  const num = parseFloat(value) / Math.pow(10, decimals);
  if (isNaN(num)) return "0";

  if (num === 0) return "0";
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(6);
  return num.toExponential(4);
}

/**
 * Get decimals for a known asset
 */
function getAssetDecimals(assetId: string): number {
  if (assetId.includes("usdc") || assetId.includes("usdt")) return 6;
  if (assetId.includes("eth") || assetId.includes("weth")) return 18;
  if (assetId.includes("sol")) return 9;
  if (assetId.includes("wbtc")) return 8;
  return 18; // Default to 18
}

/**
 * Get chain name from CAIP-2 chain ID
 */
function getChainNameFromCaip(caipChainId: string): string {
  const chainMap: Record<string, string> = {
    "eip155:1": "Ethereum",
    "eip155:42161": "Arbitrum",
    "eip155:10": "Optimism",
    "eip155:8453": "Base",
    "eip155:137": "Polygon",
    "eip155:56": "BSC",
    "eip155:59144": "Linea",
    "eip155:43114": "Avalanche",
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
  };
  return chainMap[caipChainId] || caipChainId;
}

// ============================================================================
// API Client Class
// ============================================================================

class OneBalanceClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = ONEBALANCE_API_BASE_URL, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || ONEBALANCE_API_KEY;
  }

  /**
   * Make an API request with timeout and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    try {
      log(`Request: ${options.method || "GET"} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        log(`Error response: ${endpoint}`, errorData);
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        if (typeof errorData.message === "string") {
          errorMessage = errorData.message;
        } else if (typeof errorData.error === "string") {
          errorMessage = errorData.error;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      log(`Response: ${endpoint}`, data);
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }

      logError(`Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Account Management
  // ==========================================================================

  /**
   * Predict smart account address before deployment
   * Used for EVM accounts with role-based configuration
   */
  async predictAddress(
    params: OneBalancePredictAddressRequest,
  ): Promise<OneBalancePredictAddressResponse> {
    return this.request<OneBalancePredictAddressResponse>(
      "/account/predict-address",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  // ==========================================================================
  // Balance APIs
  // ==========================================================================

  /**
   * Get aggregated balance for an EVM smart account (V2)
   */
  async getAggregatedBalance(
    address: string,
    assetIds?: string[],
  ): Promise<OneBalanceBalanceResponse> {
    let endpoint = `/v2/balances/aggregated-balance?address=${address}`;
    if (assetIds && assetIds.length > 0) {
      endpoint += `&assetId=${assetIds.join(",")}`;
    }
    return this.request<OneBalanceBalanceResponse>(endpoint);
  }

  /**
   * Get aggregated balance for multiple accounts including Solana (V3)
   * Accepts CAIP-10 account format: "solana:address" or "eip155:chainId:address"
   */
  async getAggregatedBalanceV3(
    accounts: string[],
    assetIds?: string[],
  ): Promise<OneBalanceBalanceResponse> {
    // Default to primary aggregated assets if none specified
    // API requires at least one of assetId or aggregatedAssetId
    const aggregatedAssetIds =
      assetIds && assetIds.length > 0
        ? assetIds
        : ["ob:usdc", "ob:eth", "ob:usdt", "ob:sol"];

    let endpoint = `/v3/balances/aggregated-balance?account=${accounts.join(",")}&aggregatedAssetId=${aggregatedAssetIds.join(",")}`;
    return this.request<OneBalanceBalanceResponse>(endpoint);
  }

  /**
   * Get USDC balance across all chains
   * Convenience method for the most common use case
   */
  async getUsdcBalance(address: string): Promise<{
    total: string;
    totalUsd: number;
    byChain: { chainId: string; balance: string; fiatValue: number }[];
  }> {
    const balance = await this.getAggregatedBalance(address, ["ob:usdc"]);
    const usdcAsset = balance.balanceByAggregatedAsset.find(
      (a) => a.aggregatedAssetId === "ob:usdc",
    );

    if (!usdcAsset) {
      return { total: "0", totalUsd: 0, byChain: [] };
    }

    return {
      total: usdcAsset.balance,
      totalUsd: usdcAsset.fiatValue,
      byChain: usdcAsset.individualAssetBalances.map((b) => ({
        chainId: b.assetType.split("/")[0],
        balance: b.balance,
        fiatValue: b.fiatValue,
      })),
    };
  }

  // ==========================================================================
  // Quote APIs
  // ==========================================================================

  /**
   * Get quote for swap/transfer (V1 - EVM only)
   */
  async getQuote(
    params: OneBalanceQuoteRequestV1,
  ): Promise<OneBalanceQuoteResponse> {
    return this.request<OneBalanceQuoteResponse>("/v1/quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Get quote for swap/transfer (V3 - Multi-account: EVM + Solana)
   */
  async getQuoteV3(
    params: OneBalanceQuoteRequestV3,
  ): Promise<OneBalanceQuoteResponse> {
    return this.request<OneBalanceQuoteResponse>("/v3/quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Get a user-friendly swap quote
   * Automatically selects V1 or V3 based on account types
   */
  async getSwapQuote(params: {
    // Account info - For EIP-7702 (kernel-v3.3-ecdsa), evmAddress equals evmSignerAddress (both are EOA)
    evmAddress?: string; // For EIP-7702, this is the EOA address (same as signerAddress)
    solanaAddress?: string;
    evmSignerAddress?: string; // EOA signer address (same as evmAddress for EIP-7702)

    // Asset info
    fromAssetId: string; // "ob:usdc" or CAIP-19 format
    toAssetId: string;
    amount: string; // In smallest unit

    // Options
    slippageTolerance?: number; // Basis points (100 = 1%)
    recipient?: string; // Optional recipient address (will be converted to CAIP-10)
  }): Promise<OneBalanceSwapQuote> {
    const {
      evmAddress, // For EIP-7702: same as EOA
      solanaAddress,
      evmSignerAddress, // EOA signer
      fromAssetId,
      toAssetId,
      amount,
      slippageTolerance = 100,
      recipient,
    } = params;

    // For EIP-7702 (kernel-v3.3-ecdsa) accounts:
    // - accountAddress = signerAddress = EOA (they are the same)
    // This is simpler than ERC-4337 which requires a separate smart account address
    const signerAddress = evmSignerAddress;

    log("getSwapQuote params:", {
      evmAddress, // Should be predicted smart account
      signerAddress, // Should be EOA
      solanaAddress,
      fromAssetId,
      toAssetId,
      amount,
    });

    // Determine if we need V3 (multi-account with Solana)
    const hasSolana = !!solanaAddress;
    const usesAggregatedAssets =
      fromAssetId.startsWith("ob:") || toAssetId.startsWith("ob:");

    // Check if this is a Solana-sourced swap
    const isSolanaSource =
      fromAssetId === "ob:sol" || fromAssetId.startsWith("solana:");
    const isSolanaDest =
      toAssetId === "ob:sol" || toAssetId.startsWith("solana:");

    // Convert recipient to CAIP-10 format if provided
    let recipientCaip10: string | undefined;
    if (recipient) {
      // If recipient looks like an EVM address
      if (recipient.startsWith("0x") && recipient.length === 42) {
        // Default to Ethereum mainnet for CAIP-10
        recipientCaip10 = `eip155:1:${recipient}`;
      }
      // If recipient looks like a Solana address (base58, 32-44 chars)
      else if (
        recipient.length >= 32 &&
        recipient.length <= 44 &&
        !recipient.startsWith("0x")
      ) {
        recipientCaip10 = `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${recipient}`;
      }
      // Already in CAIP-10 format
      else if (recipient.includes(":")) {
        recipientCaip10 = recipient;
      }
    }

    let quoteResponse: OneBalanceQuoteResponse;

    if (hasSolana || (usesAggregatedAssets && solanaAddress)) {
      // Use V3 for Solana or multi-account operations
      const accounts: OneBalanceAccountsArray = [];

      // Order accounts based on source/destination asset
      // The primary account (source of funds or destination chain) should be first
      // OneBalance examples show Solana first when:
      // - Source is Solana (ob:sol or solana:... asset)
      // - Destination is a Solana token (even if source is ob:usdc aggregated)
      // This helps OneBalance route optimally (e.g., using Solana USDC directly
      // instead of bridging from EVM when buying a Solana token)
      const solanaFirst = isSolanaSource || isSolanaDest;

      if (solanaFirst && solanaAddress) {
        // Solana is primary - put it first
        accounts.push({
          type: "solana",
          accountAddress: solanaAddress,
        });

        if (evmAddress && signerAddress) {
          accounts.push({
            type: "kernel-v3.3-ecdsa",
            deploymentType: "EIP7702",
            signerAddress,
            accountAddress: evmAddress, // For EIP-7702, this equals signerAddress (EOA)
          });
        }
      } else {
        // EVM is primary - put it first
        if (evmAddress && signerAddress) {
          accounts.push({
            type: "kernel-v3.3-ecdsa",
            deploymentType: "EIP7702",
            signerAddress,
            accountAddress: evmAddress, // For EIP-7702, this equals signerAddress (EOA)
          });
        }

        if (solanaAddress) {
          accounts.push({
            type: "solana",
            accountAddress: solanaAddress,
          });
        }
      }

      const request: OneBalanceQuoteRequestV3 = {
        from: {
          accounts,
          asset: { assetId: fromAssetId },
          amount,
        },
        to: {
          asset: { assetId: toAssetId },
          // Only include account if we have a valid CAIP-10 recipient
          ...(recipientCaip10 ? { account: recipientCaip10 } : {}),
        },
        slippageTolerance,
      };

      quoteResponse = await this.getQuoteV3(request);
    } else {
      // Use V1 for EVM-only operations
      if (!evmAddress) {
        throw new Error("EVM smart account address required for V1 quotes");
      }

      if (!signerAddress) {
        throw new Error("EVM signer address required for V1 quotes");
      }

      const request: OneBalanceQuoteRequestV1 = {
        from: {
          account: {
            type: "kernel-v3.3-ecdsa",
            deploymentType: "EIP7702",
            signerAddress: signerAddress,
            accountAddress: evmAddress, // For EIP-7702, this equals signerAddress (EOA)
          },
          asset: { assetId: fromAssetId },
          amount,
        },
        to: {
          asset: { assetId: toAssetId },
          // Convert recipient to CAIP-10 for V1 as well
          ...(recipientCaip10 ? { account: recipientCaip10 } : {}),
        },
        slippageTolerance,
      };

      quoteResponse = await this.getQuote(request);
    }

    // Transform to user-friendly format
    return this.transformQuoteResponse(quoteResponse, fromAssetId, toAssetId);
  }

  /**
   * Transform raw quote response to user-friendly format
   */
  private transformQuoteResponse(
    response: OneBalanceQuoteResponse,
    fromAssetId: string,
    toAssetId: string,
  ): OneBalanceSwapQuote {
    const originToken = response.originToken;
    const destToken = response.destinationToken;

    // Parse amounts
    const inputAmount = originToken?.amount || "0";
    const outputAmount = destToken?.amount || "0";
    const minimumOutputAmount = destToken?.minimumAmount || outputAmount;

    // Get decimals
    const inputDecimals = getAssetDecimals(fromAssetId);
    const outputDecimals = getAssetDecimals(toAssetId);

    // Format amounts
    const inputAmountFormatted = formatAmount(inputAmount, inputDecimals);
    const outputAmountFormatted = formatAmount(outputAmount, outputDecimals);

    // Parse fiat values
    let inputAmountUsd = 0;
    let outputAmountUsd = 0;

    if (originToken?.fiatValue) {
      if (typeof originToken.fiatValue === "string") {
        inputAmountUsd = parseFloat(originToken.fiatValue);
      } else if (Array.isArray(originToken.fiatValue)) {
        inputAmountUsd = originToken.fiatValue.reduce(
          (sum, f) => sum + parseFloat(f.fiatValue || "0"),
          0,
        );
      }
    }

    if (destToken?.fiatValue) {
      if (typeof destToken.fiatValue === "string") {
        outputAmountUsd = parseFloat(destToken.fiatValue);
      }
    }

    // Calculate price impact
    const priceImpact =
      inputAmountUsd > 0
        ? ((inputAmountUsd - outputAmountUsd) / inputAmountUsd) * 100
        : 0;

    // Parse fees
    const protocolFeeUsd = parseFloat(
      response.fees?.protocolFees?.amountUsd || "0",
    );
    const gasFeeUsd = parseFloat(response.fees?.gasFees?.amountUsd || "0");
    const totalFeesUsd = parseFloat(response.fees?.cumulativeUSD || "0");

    // Calculate rate
    const inputNum = parseFloat(inputAmount) / Math.pow(10, inputDecimals);
    const outputNum = parseFloat(outputAmount) / Math.pow(10, outputDecimals);
    const rate = inputNum > 0 ? (outputNum / inputNum).toFixed(6) : "0";

    // Determine source chains
    const sourceChains: string[] = [];
    if (originToken?.assetType) {
      const assetTypes = Array.isArray(originToken.assetType)
        ? originToken.assetType
        : [originToken.assetType];
      assetTypes.forEach((at) => {
        const chainPart = at.split("/")[0];
        const chainName = getChainNameFromCaip(chainPart);
        if (!sourceChains.includes(chainName)) {
          sourceChains.push(chainName);
        }
      });
    }

    // Determine destination chain
    let destinationChain = "Unknown";
    if (destToken?.assetType && typeof destToken.assetType === "string") {
      const chainPart = destToken.assetType.split("/")[0];
      destinationChain = getChainNameFromCaip(chainPart);
    }

    // Build route
    const route =
      sourceChains.length > 0
        ? [...sourceChains, "→", destinationChain]
        : [fromAssetId, "→", toAssetId];

    // Determine if cross-chain
    const isCrossChain =
      sourceChains.length > 1 ||
      (sourceChains.length === 1 && sourceChains[0] !== destinationChain);

    return {
      id: response.id,
      provider: "OneBalance",
      inputAmount,
      inputAmountFormatted,
      inputAmountUsd,
      outputAmount,
      outputAmountFormatted,
      outputAmountUsd,
      minimumOutputAmount,
      priceImpact,
      rate,
      estimatedGas: gasFeeUsd.toString(),
      estimatedGasUsd: gasFeeUsd,
      protocolFeeUsd,
      totalFeesUsd,
      timeEstimate: isCrossChain ? 30 : 10, // Rough estimate
      route,
      isCrossChain,
      sourceChains,
      destinationChain,
      rawQuote: response,
    };
  }

  // ==========================================================================
  // Execution APIs
  // ==========================================================================

  /**
   * Execute a signed quote (V1 - EVM only)
   */
  async executeQuote(
    params: OneBalanceExecuteQuoteRequest,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/quotes/execute-quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Execute a signed quote (V3 - Multi-account)
   */
  async executeQuoteV3(
    params: OneBalanceExecuteQuoteRequest,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/v3/quote/execute-quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ==========================================================================
  // Status APIs
  // ==========================================================================

  /**
   * Get execution status (V1)
   */
  async getExecutionStatus(
    quoteId: string,
  ): Promise<OneBalanceExecutionStatusResponse> {
    return this.request<OneBalanceExecutionStatusResponse>(
      `/status/get-execution-status?quoteId=${quoteId}`,
    );
  }

  /**
   * Get execution status (V3)
   */
  async getExecutionStatusV3(
    quoteId: string,
  ): Promise<OneBalanceExecutionStatusResponse> {
    return this.request<OneBalanceExecutionStatusResponse>(
      `/v3/status/get-execution-status?quoteId=${quoteId}`,
    );
  }

  /**
   * Poll for execution completion
   */
  async pollExecutionStatus(
    quoteId: string,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      useV3?: boolean;
      onUpdate?: (status: OneBalanceExecutionStatusResponse) => void;
    } = {},
  ): Promise<OneBalanceExecutionStatusResponse> {
    const {
      maxAttempts = 60,
      intervalMs = 2000,
      useV3 = false,
      onUpdate,
    } = options;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rawStatus = useV3
        ? await this.getExecutionStatusV3(quoteId)
        : await this.getExecutionStatus(quoteId);

      // Handle case where status is not yet available (empty object)
      if (!rawStatus || Object.keys(rawStatus).length === 0) {
        console.log(
          `[OneBalanceClient] Status not available yet, attempt ${attempt + 1}/${maxAttempts}`,
        );
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      // Normalize status format - V3 returns status as string, V1 returns as object
      const statusValue =
        typeof rawStatus.status === "string"
          ? rawStatus.status
          : rawStatus.status?.status;

      const failReason =
        typeof rawStatus.status === "object"
          ? rawStatus.status?.failReason
          : undefined;

      if (!statusValue) {
        console.log(
          `[OneBalanceClient] Status value not available yet, attempt ${attempt + 1}/${maxAttempts}`,
        );
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      // Normalize to expected format for onUpdate callback
      const normalizedStatus: OneBalanceExecutionStatusResponse = {
        quoteId: rawStatus.quoteId || quoteId,
        status: {
          status: statusValue as OneBalanceExecutionStatus,
          failReason,
        },
        transactionHashes:
          (rawStatus as any).originChainOperations?.map((op: any) => ({
            chainId: op.chain || "",
            hash: op.hash || "",
            explorerUrl: op.explorerUrl,
          })) ||
          (rawStatus as any).destinationChainOperations?.map((op: any) => ({
            chainId: op.chain || "",
            hash: op.hash || "",
            explorerUrl: op.explorerUrl,
          })) ||
          rawStatus.transactionHashes,
      };

      onUpdate?.(normalizedStatus);

      if (statusValue === "COMPLETED" || statusValue === "EXECUTED") {
        // COMPLETED: All operations finished successfully
        // EXECUTED: Transaction executed on destination chain (origin may still be pending)
        // Both are terminal success states - return to caller
        return normalizedStatus;
      }

      if (statusValue === "FAILED" || statusValue === "REFUNDED") {
        log(
          `Transaction ${statusValue} with failReason: ${failReason || "none"}`,
        );
        throw new Error(
          `Transaction ${statusValue}: ${failReason || "Unknown error"}`,
        );
      }

      log(`Status: ${statusValue}, attempt ${attempt + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error("Execution status polling timeout");
  }

  // ==========================================================================
  // Transaction History
  // ==========================================================================

  /**
   * Get transaction history (V1)
   */
  async getTransactionHistory(
    address: string,
    cursor?: string,
    limit?: number,
  ): Promise<OneBalanceTransactionHistoryResponse> {
    let endpoint = `/status/get-tx-history?address=${address}`;
    if (cursor) endpoint += `&cursor=${cursor}`;
    if (limit) endpoint += `&limit=${limit}`;
    return this.request<OneBalanceTransactionHistoryResponse>(endpoint);
  }

  /**
   * Get transaction history (V3 - multi-account)
   */
  async getTransactionHistoryV3(
    accounts: string[],
    cursor?: string,
    limit?: number,
  ): Promise<OneBalanceTransactionHistoryResponse> {
    let endpoint = `/v3/status/get-tx-history?account=${accounts.join(",")}`;
    if (cursor) endpoint += `&cursor=${cursor}`;
    if (limit) endpoint += `&limit=${limit}`;
    return this.request<OneBalanceTransactionHistoryResponse>(endpoint);
  }

  // ==========================================================================
  // Supported Assets & Chains
  // ==========================================================================

  /**
   * Get list of supported chains
   */
  async getSupportedChains(): Promise<OneBalanceSupportedChain[]> {
    const response = await this.request<{ chains: OneBalanceSupportedChain[] }>(
      "/chains/supported-list",
    );
    return response.chains || [];
  }

  /**
   * Get list of aggregated assets
   */
  async getAggregatedAssets(): Promise<OneBalanceAggregatedAssetInfo[]> {
    const response = await this.request<{
      assets: OneBalanceAggregatedAssetInfo[];
    }>("/assets/list");
    return response.assets || [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _oneBalanceClientInstance: OneBalanceClient | null = null;

/**
 * Get or create a singleton instance of the OneBalance client
 */
export function getOneBalanceClient(): OneBalanceClient {
  if (!_oneBalanceClientInstance) {
    _oneBalanceClientInstance = new OneBalanceClient();
  }
  return _oneBalanceClientInstance;
}

/**
 * Reset the OneBalance client (useful for testing or reconnection)
 */
export function resetOneBalanceClient(): void {
  _oneBalanceClientInstance = null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an operation is a Solana chain operation
 */
export function isSolanaOperation(
  op: OneBalanceChainOperation,
): op is OneBalanceSolanaChainOperation {
  return "type" in op && op.type === "solana";
}

/**
 * Check if an operation is an EVM chain operation
 */
export function isEvmOperation(
  op: OneBalanceChainOperation,
): op is OneBalanceEvmChainOperation {
  return !("type" in op) || op.type === "evm" || op.type === undefined;
}

/**
 * Convert an EVM address to a CAIP-10 account format
 */
export function toEvmCaip10(chainId: number, address: string): string {
  return `eip155:${chainId}:${address}`;
}

/**
 * Convert a Solana address to a CAIP-10 account format
 */
export function toSolanaCaip10(address: string): string {
  return `solana:${address}`;
}

/**
 * Convert an asset to aggregated format if it's a common token
 */
export function toAggregatedAssetId(symbol: string): string | null {
  const symbolLower = symbol.toLowerCase();
  const aggregatedMap: Record<string, string> = {
    usdc: "ob:usdc",
    usdt: "ob:usdt",
    eth: "ob:eth",
    weth: "ob:eth",
    sol: "ob:sol",
    wbtc: "ob:wbtc",
  };
  return aggregatedMap[symbolLower] || null;
}

/**
 * Build a CAIP-19 asset ID for ERC20 tokens
 */
export function toEvmAssetId(chainId: number, tokenAddress: string): string {
  // Native ETH
  if (
    tokenAddress === "0x0000000000000000000000000000000000000000" ||
    tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
  ) {
    return `eip155:${chainId}/slip44:60`;
  }
  return `eip155:${chainId}/erc20:${tokenAddress}`;
}

/**
 * Build a CAIP-19 asset ID for Solana tokens
 */
export function toSolanaAssetId(tokenAddress?: string): string {
  // Native SOL
  if (!tokenAddress || tokenAddress === "11111111111111111111111111111111") {
    return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501";
  }
  return `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:${tokenAddress}`;
}

// ============================================================================
// Exports
// ============================================================================

export * from "./oneBalanceTypes";
export { OneBalanceClient };

// Default singleton instance for convenience
export const oneBalanceClient = getOneBalanceClient();
