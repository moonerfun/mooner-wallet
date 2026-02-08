/**
 * useSolanaRentCheck Hook
 * Checks if user has enough SOL for Solana rent and auto-provisions if needed
 *
 * Solana requires accounts to maintain a minimum balance (rent-exempt reserve).
 * When swapping to/from Solana tokens, users need ~0.005 SOL for:
 * - wSOL account rent (~0.00204 SOL)
 * - Token account creation rent
 * - Safety buffer for fees
 *
 * This hook checks the user's SOL balance before Solana operations and can
 * automatically swap a small amount of USDC to SOL if needed.
 */

import { getOneBalanceClient } from "@/lib/api/oneBalance/oneBalanceClient";
import {
  OneBalanceChainOperation,
  OneBalanceSwapQuote,
} from "@/lib/api/oneBalance/oneBalanceTypes";
import { useCallback, useRef, useState } from "react";

// Minimum SOL required for rent-exempt accounts and fees
// Based on OneBalance docs: "Fund account with ~0.005 SOL"
export const MIN_SOL_FOR_RENT = 0.005;

// Minimum SOL needed for ATA creation (wSOL account rent)
// Without this, the provision swap itself will fail
export const MIN_SOL_FOR_ATA_CREATION = 0.00204;

// Amount of SOL to provision (slightly more than minimum for buffer)
export const SOL_PROVISION_AMOUNT = 0.01;

// Minimum USDC needed for provision (~$0.25, enough for ~0.003 SOL at $80/SOL)
export const MIN_USDC_FOR_PROVISION = 0.25;

// Default USDC amount to swap for SOL provision when user has plenty
// Use smaller amount to preserve more for the actual swap
export const DEFAULT_USDC_FOR_SOL_PROVISION = "500000"; // 0.5 USDC (6 decimals)

// Maximum USDC to use for provision (cap at 0.5 USDC)
export const MAX_USDC_FOR_PROVISION = 0.5;

// Solana chain identifier
const SOLANA_CHAIN_ID = 792703809;
const SOLANA_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/**
 * Check if an operation is a Solana operation
 */
function isSolanaOperation(op: OneBalanceChainOperation): boolean {
  return "type" in op && op.type === "solana";
}

/**
 * Rent check result
 */
export interface SolanaRentCheckResult {
  /** Whether the user needs SOL for rent */
  needsSOL: boolean;
  /** Current SOL balance */
  currentBalance: number;
  /** Required SOL amount */
  requiredBalance: number;
  /** Whether we can auto-provision (has USDC available) */
  canAutoProvision: boolean;
  /** Amount of USDC available for provision */
  availableUSDC: number;
  /** Whether user has 0 SOL (absolute zero, not just below threshold) */
  hasZeroSOL: boolean;
  /** Error message if cannot proceed */
  errorMessage?: string;
}

/**
 * Provision result
 */
export interface SolanaProvisionResult {
  success: boolean;
  error?: string;
  quoteId?: string;
}

/**
 * Hook return type
 */
export interface UseSolanaRentCheckReturn {
  /** Check if user needs SOL for a given quote */
  checkSolanaRent: (
    quote: OneBalanceSwapQuote,
    solanaAddress?: string,
    evmAddress?: string,
  ) => Promise<SolanaRentCheckResult>;

  /** Get a quote to provision SOL (swap USDC to SOL) */
  getProvisionQuote: (
    solanaAddress: string,
    evmAddress?: string,
    availableUSDC?: number,
  ) => Promise<OneBalanceSwapQuote | null>;

  /** Execute the provision swap */
  executeProvision: (
    quote: OneBalanceSwapQuote,
    executeSwapFn: (
      quote: OneBalanceSwapQuote,
    ) => Promise<SolanaProvisionResult>,
  ) => Promise<SolanaProvisionResult>;

  /** Current rent check result */
  rentCheckResult: SolanaRentCheckResult | null;

  /** Whether rent check is in progress */
  isChecking: boolean;

  /** Whether provision is in progress */
  isProvisioning: boolean;

  /** Error message */
  error: string | null;
}

/**
 * useSolanaRentCheck Hook
 * Handles checking and auto-provisioning SOL for Solana rent requirements
 */
export function useSolanaRentCheck(): UseSolanaRentCheckReturn {
  const [rentCheckResult, setRentCheckResult] =
    useState<SolanaRentCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Check if the quote involves Solana operations
   */
  const quoteInvolvesSolana = useCallback(
    (quote: OneBalanceSwapQuote): boolean => {
      // Check origin operations
      const hasOriginSolana = quote.rawQuote?.originChainsOperations?.some(
        (op) => isSolanaOperation(op),
      );

      // Check destination chain
      const destChain = quote.destinationChain;
      const isDestSolana =
        destChain?.includes("solana") || destChain?.includes("Solana");

      // Check asset types
      const fromAsset = quote.rawQuote?.originToken?.assetType;
      const toAsset = quote.rawQuote?.destinationToken?.assetType;
      const assetInvolvesSolana =
        (typeof fromAsset === "string" && fromAsset.includes("solana")) ||
        (Array.isArray(fromAsset) &&
          fromAsset.some((a) => a.includes("solana"))) ||
        (typeof toAsset === "string" && toAsset.includes("solana"));

      return hasOriginSolana || isDestSolana || assetInvolvesSolana;
    },
    [],
  );

  /**
   * Get current SOL balance for a Solana address
   */
  const getSOLBalance = useCallback(
    async (solanaAddress: string): Promise<number> => {
      try {
        const client = getOneBalanceClient();
        const caip10 = `${SOLANA_CAIP2}:${solanaAddress}`;

        const response = await client.getAggregatedBalanceV3(
          [caip10],
          ["ob:sol"],
        );

        const solAsset = response.balanceByAggregatedAsset?.find(
          (a) => a.aggregatedAssetId === "ob:sol",
        );

        if (!solAsset) {
          return 0;
        }

        // Convert from lamports (9 decimals) to SOL
        const lamports = BigInt(solAsset.balance || "0");
        const sol = Number(lamports) / 1e9;

        console.log("[SolanaRentCheck] SOL balance:", {
          lamports: lamports.toString(),
          sol,
          address: solanaAddress,
        });

        return sol;
      } catch (error) {
        console.error("[SolanaRentCheck] Error getting SOL balance:", error);
        return 0;
      }
    },
    [],
  );

  /**
   * Get available USDC balance (aggregated across all chains)
   */
  const getUSDCBalance = useCallback(
    async (evmAddress?: string, solanaAddress?: string): Promise<number> => {
      try {
        const client = getOneBalanceClient();
        const accounts: string[] = [];

        if (evmAddress) {
          accounts.push(`eip155:1:${evmAddress}`);
        }
        if (solanaAddress) {
          accounts.push(`${SOLANA_CAIP2}:${solanaAddress}`);
        }

        if (accounts.length === 0) {
          return 0;
        }

        const response = await client.getAggregatedBalanceV3(accounts, [
          "ob:usdc",
        ]);

        const usdcAsset = response.balanceByAggregatedAsset?.find(
          (a) => a.aggregatedAssetId === "ob:usdc",
        );

        if (!usdcAsset) {
          return 0;
        }

        // USDC has 6 decimals
        const usdcRaw = BigInt(usdcAsset.balance || "0");
        const usdc = Number(usdcRaw) / 1e6;

        console.log("[SolanaRentCheck] USDC balance:", {
          raw: usdcRaw.toString(),
          usdc,
        });

        return usdc;
      } catch (error) {
        console.error("[SolanaRentCheck] Error getting USDC balance:", error);
        return 0;
      }
    },
    [],
  );

  /**
   * Check if user needs SOL for rent
   */
  const checkSolanaRent = useCallback(
    async (
      quote: OneBalanceSwapQuote,
      solanaAddress?: string,
      evmAddress?: string,
    ): Promise<SolanaRentCheckResult> => {
      setIsChecking(true);
      setError(null);

      try {
        // If quote doesn't involve Solana, no rent needed
        if (!quoteInvolvesSolana(quote)) {
          const result: SolanaRentCheckResult = {
            needsSOL: false,
            currentBalance: 0,
            requiredBalance: 0,
            canAutoProvision: false,
            availableUSDC: 0,
            hasZeroSOL: false,
          };
          setRentCheckResult(result);
          return result;
        }

        // If no Solana address, can't check
        if (!solanaAddress) {
          const result: SolanaRentCheckResult = {
            needsSOL: true,
            currentBalance: 0,
            requiredBalance: MIN_SOL_FOR_RENT,
            canAutoProvision: false,
            availableUSDC: 0,
            hasZeroSOL: true,
            errorMessage: "No Solana wallet address available",
          };
          setRentCheckResult(result);
          return result;
        }

        // Get current SOL balance
        const solBalance = await getSOLBalance(solanaAddress);

        // Check if sufficient
        const needsSOL = solBalance < MIN_SOL_FOR_RENT;

        // Check if user has absolute zero SOL - this is a blocker!
        // The provision swap itself needs SOL to create the wSOL ATA
        const hasZeroSOL = solBalance < MIN_SOL_FOR_ATA_CREATION;

        // If needs SOL, check if we can auto-provision with USDC
        let canAutoProvision = false;
        let availableUSDC = 0;
        let errorMessage: string | undefined;

        if (needsSOL) {
          availableUSDC = await getUSDCBalance(evmAddress, solanaAddress);

          if (hasZeroSOL) {
            // User has 0 SOL - cannot auto-provision because the swap itself
            // needs SOL to create the wSOL Associated Token Account
            canAutoProvision = false;
            errorMessage =
              "Your Solana wallet needs a small amount of SOL to create token accounts. You can:\n\n• Buy SOL directly on an exchange and send ~0.01 SOL to your wallet\n• Use a fiat onramp to purchase SOL\n\nOnce you have SOL, future swaps will work automatically.";
            console.warn(
              "[SolanaRentCheck] User has ZERO SOL - cannot auto-provision",
              {
                solBalance,
                availableUSDC,
                reason: "wSOL ATA creation requires existing SOL",
              },
            );
          } else {
            // User has some SOL (but less than needed) - can try auto-provision
            // Need at least 0.25 USDC to provision SOL (~$0.25 = ~0.003 SOL)
            canAutoProvision = availableUSDC >= MIN_USDC_FOR_PROVISION;
          }
        }

        const result: SolanaRentCheckResult = {
          needsSOL,
          currentBalance: solBalance,
          requiredBalance: MIN_SOL_FOR_RENT,
          canAutoProvision,
          availableUSDC,
          hasZeroSOL,
          errorMessage,
        };

        setRentCheckResult(result);
        console.log("[SolanaRentCheck] Result:", result);

        return result;
      } catch (err) {
        console.error("[SolanaRentCheck] Check error:", err);
        const errMsg =
          err instanceof Error ? err.message : "Failed to check rent";
        setError(errMsg);

        const result: SolanaRentCheckResult = {
          needsSOL: true,
          currentBalance: 0,
          requiredBalance: MIN_SOL_FOR_RENT,
          canAutoProvision: false,
          availableUSDC: 0,
          hasZeroSOL: true,
          errorMessage: errMsg,
        };
        setRentCheckResult(result);
        return result;
      } finally {
        setIsChecking(false);
      }
    },
    [quoteInvolvesSolana, getSOLBalance, getUSDCBalance],
  );

  /**
   * Get a quote to provision SOL (swap USDC → SOL)
   * @param availableUSDC Optional - if provided, uses smart amount calculation
   */
  const getProvisionQuote = useCallback(
    async (
      solanaAddress: string,
      evmAddress?: string,
      availableUSDC?: number,
    ): Promise<OneBalanceSwapQuote | null> => {
      try {
        const client = getOneBalanceClient();

        // Calculate optimal provision amount:
        // - If user has > 0.5 USDC, use 0.5 USDC for provision
        // - If user has less, use 50% of their balance (min 0.25 USDC)
        let provisionAmount: string;
        if (availableUSDC !== undefined) {
          if (availableUSDC >= MAX_USDC_FOR_PROVISION * 2) {
            // User has plenty, use default (0.5 USDC)
            provisionAmount = DEFAULT_USDC_FOR_SOL_PROVISION;
          } else {
            // Use half of available USDC, capped at MAX_USDC_FOR_PROVISION
            const halfBalance = Math.min(
              availableUSDC / 2,
              MAX_USDC_FOR_PROVISION,
            );
            // Ensure minimum of 0.25 USDC
            const finalAmount = Math.max(halfBalance, MIN_USDC_FOR_PROVISION);
            provisionAmount = Math.floor(finalAmount * 1e6).toString();
          }
        } else {
          provisionAmount = DEFAULT_USDC_FOR_SOL_PROVISION;
        }

        console.log("[SolanaRentCheck] Getting provision quote:", {
          solanaAddress,
          evmAddress,
          amount: provisionAmount,
          availableUSDC,
        });

        // Request quote: USDC → SOL
        // Use high slippage (5%) for provision to ensure it succeeds
        // This is a small amount and we prioritize success over getting best rate
        const quote = await client.getSwapQuote({
          evmAddress,
          solanaAddress,
          evmSignerAddress: evmAddress,
          fromAssetId: "ob:usdc",
          toAssetId: "ob:sol",
          amount: provisionAmount,
          slippageTolerance: 500, // 5% slippage for provision - prioritize success
        });

        console.log("[SolanaRentCheck] Provision quote received:", {
          quoteId: quote.id,
          outputAmount: quote.outputAmountFormatted,
        });

        return quote;
      } catch (err) {
        console.error("[SolanaRentCheck] Error getting provision quote:", err);
        setError(
          err instanceof Error ? err.message : "Failed to get provision quote",
        );
        return null;
      }
    },
    [],
  );

  /**
   * Execute the provision swap
   */
  const executeProvision = useCallback(
    async (
      quote: OneBalanceSwapQuote,
      executeSwapFn: (
        quote: OneBalanceSwapQuote,
      ) => Promise<SolanaProvisionResult>,
    ): Promise<SolanaProvisionResult> => {
      setIsProvisioning(true);
      setError(null);

      try {
        console.log("[SolanaRentCheck] Executing provision swap...");

        const result = await executeSwapFn(quote);

        if (result.success) {
          console.log(
            "[SolanaRentCheck] Provision successful:",
            result.quoteId,
          );
          // Clear the rent check result since we now have SOL
          setRentCheckResult(null);
        } else {
          console.error("[SolanaRentCheck] Provision failed:", result.error);
          setError(result.error || "Provision failed");
        }

        return result;
      } catch (err) {
        console.error("[SolanaRentCheck] Provision error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Provision failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsProvisioning(false);
      }
    },
    [],
  );

  return {
    checkSolanaRent,
    getProvisionQuote,
    executeProvision,
    rentCheckResult,
    isChecking,
    isProvisioning,
    error,
  };
}
