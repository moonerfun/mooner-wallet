/**
 * Swap Module Types
 * Shared type definitions for the swap feature
 * Uses OneBalance for all swap operations
 */

import { OneBalanceSwapQuote } from "@/lib/api/oneBalance/oneBalanceTypes";

/**
 * Swap quote type (OneBalance only)
 */
export type UnifiedSwapQuote = OneBalanceSwapQuote;

/**
 * Check if quote is a OneBalance quote
 */
export function isOneBalanceQuote(
  quote: UnifiedSwapQuote,
): quote is OneBalanceSwapQuote {
  return quote.provider === "OneBalance";
}

/**
 * Token representation for swap operations
 */
export interface SwapToken {
  symbol: string;
  name: string;
  logo?: string;
  address: string;
  chainId: number;
  decimals: number;
  balance?: string;
  balanceUsd?: number;
}

/**
 * Swap execution parameters
 */
export interface SwapParams {
  fromToken: SwapToken;
  toToken: SwapToken;
  amount: string;
  quote: UnifiedSwapQuote;
  walletAddress: string;
}

/**
 * Swap execution status
 */
export type SwapStatus =
  | "idle"
  | "preparing"
  | "building"
  | "signing"
  | "broadcasting"
  | "confirming"
  | "polling"
  | "success"
  | "error";

/**
 * Swap execution state
 */
export interface SwapExecutionState {
  status: SwapStatus;
  currentStep: number;
  totalSteps: number;
  txHash: string;
  error?: string;
  statusMessage: string;
}

/**
 * Token selector mode
 */
export type TokenSelectorMode = "from" | "to" | null;

/**
 * Wallet account with chain information
 */
export interface SwapWalletAccount {
  address: string;
  chainName: string;
  chainSymbol: string;
  chainColor: string;
  chainLogo?: string;
  chainIcon?: string;
}

/**
 * EVM Transaction data
 */
export interface EvmTransactionData {
  to: string;
  from?: string;
  data?: string;
  value?: string;
  gas?: number | string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number;
}

/**
 * Solana Transaction data
 */
export interface SolanaTransactionData {
  instructions?: SolanaInstruction[];
  addressLookupTableAddresses?: string[];
  transaction?: string;
  serializedTransaction?: string;
}

/**
 * Solana instruction format
 */
export interface SolanaInstruction {
  keys: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  programId: string;
  data: string;
}

/**
 * Signature data for typed data signing
 */
export interface SignatureData {
  signatureKind: "eip191" | "eip712";
  message?: string;
  domain?: Record<string, unknown>;
  types?: Record<string, unknown>;
  value?: Record<string, unknown>;
  post?: {
    endpoint: string;
    method?: string;
    body?: Record<string, unknown>;
  };
}

/**
 * Turnkey wallet account for signing
 */
export interface TurnkeyWalletAccount {
  address: string;
  addressFormat: string;
  path?: string;
}
