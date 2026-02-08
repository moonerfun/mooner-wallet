/**
 * useUnifiedSwap Hook
 * Unified swap interface that uses OneBalance as the swap provider
 *
 * OneBalance provides:
 * - Unified cross-chain abstraction
 * - Aggregated asset balances
 * - Single API for all swap types
 *
 * Auto-provisions SOL when needed for Solana rent requirements.
 */

import { useWallet } from "@/contexts/WalletContext";
import { useCallback, useMemo, useState } from "react";
import {
  SwapToken,
  SwapWalletAccount,
  UnifiedSwapQuote,
  isOneBalanceQuote,
} from "../types";
import { useOneBalanceAccount } from "./useOneBalanceAccount";
import {
  OneBalanceExecuteSwapParams,
  OneBalanceSwapExecutionResult,
  useOneBalanceExecution,
} from "./useOneBalanceExecution";
import { useOneBalanceQuote } from "./useOneBalanceQuote";
import {
  MIN_SOL_FOR_RENT,
  MIN_USDC_FOR_PROVISION,
  SolanaRentCheckResult,
  useSolanaRentCheck,
} from "./useSolanaRentCheck";

/**
 * Unified swap parameters
 */
export interface UnifiedSwapParams {
  fromToken: SwapToken | null;
  toToken: SwapToken | null;
  fromAmount: string;
  slippage: string;
  selectedFromChain: SwapWalletAccount | null;
  selectedToChain: SwapWalletAccount | null;
}

/**
 * Unified swap hook return type
 */
export interface UseUnifiedSwapReturn {
  // Quote state
  quote: UnifiedSwapQuote | null;
  isLoadingQuote: boolean;
  quoteError: string | null;

  // Execution state
  executionState: ReturnType<typeof useOneBalanceExecution>["executionState"];
  isExecuting: boolean;

  // Solana rent provision state
  isProvisioningSOL: boolean;
  rentCheckResult: SolanaRentCheckResult | null;

  // Actions
  fetchQuote: () => Promise<void>;
  executeSwap: () => Promise<OneBalanceSwapExecutionResult>;
  resetExecution: () => void;
  clearQuote: () => void;

  // Provider info
  provider: "OneBalance" | null;
  isOneBalance: boolean;
}

/**
 * useUnifiedSwap Hook
 * Unified interface for all swap operations using OneBalance
 */
export function useUnifiedSwap(
  params: UnifiedSwapParams,
): UseUnifiedSwapReturn {
  const { consolidatedWallets, selectedWallet } = useWallet();
  const {
    fromToken,
    toToken,
    fromAmount,
    slippage,
    selectedFromChain,
    selectedToChain,
  } = params;

  // Get EVM and Solana addresses from consolidated wallets
  const { evmAddress, solanaAddress } = useMemo(() => {
    let evm: string | undefined;
    let solana: string | undefined;

    for (const wallet of consolidatedWallets) {
      if (wallet.walletType === "solana") {
        solana = wallet.address;
      } else if (
        wallet.walletType === "evm" ||
        wallet.walletType === "consolidated"
      ) {
        evm = wallet.address;
      }
    }

    return { evmAddress: evm, solanaAddress: solana };
  }, [consolidatedWallets]);

  // OneBalance account configuration - uses EIP-7702 where EOA = accountAddress
  const {
    evmAccountAddress,
    isLoading: isAccountLoading,
    isReady: isAccountReady,
  } = useOneBalanceAccount(evmAddress, solanaAddress);

  // OneBalance quote hook - pass EVM account address (same as EOA for EIP-7702)
  const {
    quote: oneBalanceQuote,
    isLoading: isLoadingQuote,
    error: quoteError,
    fetchQuote: fetchOneBalanceQuote,
    getQuoteForRetry,
    clearQuote,
  } = useOneBalanceQuote({
    fromToken,
    toToken,
    fromAmount,
    slippage,
    evmAddress,
    evmSmartAccountAddress: evmAccountAddress || undefined,
    solanaAddress,
    recipientAddress: selectedToChain?.address,
  });

  // OneBalance execution hook
  const {
    executionState,
    executeSwap: executeOneBalanceSwap,
    resetExecution,
    isExecuting: isExecutingSwap,
  } = useOneBalanceExecution(selectedWallet);

  // Solana rent check hook for auto-provisioning
  const {
    checkSolanaRent,
    getProvisionQuote,
    rentCheckResult,
    isProvisioning: isProvisioningSOL,
  } = useSolanaRentCheck();

  // Track if we're executing (includes provision step)
  const [isExecuting, setIsExecuting] = useState(false);

  // Current quote (cast to unified type)
  const quote: UnifiedSwapQuote | null = oneBalanceQuote;

  // Fetch quote action
  const fetchQuote = useCallback(async () => {
    await fetchOneBalanceQuote();
  }, [fetchOneBalanceQuote]);

  // Execute swap action with auto-provision for Solana rent
  const executeSwap =
    useCallback(async (): Promise<OneBalanceSwapExecutionResult> => {
      if (!quote || !isOneBalanceQuote(quote) || !fromToken || !toToken) {
        return { success: false, error: "Invalid quote or tokens" };
      }

      setIsExecuting(true);

      try {
        // Check if we need SOL for Solana rent
        const rentCheck = await checkSolanaRent(
          quote,
          solanaAddress,
          evmAddress,
        );

        // Check if user has ZERO SOL - this is a blocker, we can't help them
        if (rentCheck.hasZeroSOL && rentCheck.needsSOL) {
          console.error(
            "[UnifiedSwap] User has ZERO SOL - cannot auto-provision",
            {
              currentBalance: rentCheck.currentBalance,
              errorMessage: rentCheck.errorMessage,
            },
          );
          setIsExecuting(false);
          return {
            success: false,
            error:
              rentCheck.errorMessage ||
              "Your Solana wallet needs SOL to create token accounts. Please deposit at least 0.005 SOL first.",
          };
        }

        // Auto-provision SOL if needed and possible
        if (rentCheck.needsSOL && rentCheck.canAutoProvision && solanaAddress) {
          console.log(
            "[UnifiedSwap] User needs SOL for rent, auto-provisioning...",
            {
              currentBalance: rentCheck.currentBalance,
              required: MIN_SOL_FOR_RENT,
              availableUSDC: rentCheck.availableUSDC,
            },
          );

          // Get provision quote with dynamic amount based on available USDC
          const provisionQuote = await getProvisionQuote(
            solanaAddress,
            evmAddress,
            rentCheck.availableUSDC,
          );

          if (!provisionQuote) {
            console.warn(
              "[UnifiedSwap] Failed to get provision quote, proceeding without",
            );
          } else {
            // Create a minimal token for SOL
            const solToken: SwapToken = {
              symbol: "SOL",
              name: "Solana",
              decimals: 9,
              address: "11111111111111111111111111111111",
              chainId: 792703809, // Solana relay chain ID
              logo: "",
              balance: "0",
            };

            const usdcToken: SwapToken = {
              symbol: "USDC",
              name: "USD Coin",
              decimals: 6,
              address: "usdc",
              chainId: 0, // Aggregated asset (not chain-specific)
              logo: "",
              balance: "0",
            };

            // Execute the provision swap
            const provisionParams: OneBalanceExecuteSwapParams = {
              fromToken: usdcToken,
              toToken: solToken,
              fromAmount: provisionQuote.inputAmountFormatted || "0.5",
              quote: provisionQuote,
              evmWalletAddress: evmAddress,
              solanaWalletAddress: solanaAddress,
              maxRetries: 1,
            };

            console.log("[UnifiedSwap] Executing provision swap...", {
              provisionAmount: provisionQuote.inputAmountFormatted,
              expectedSOL: provisionQuote.outputAmountFormatted,
            });
            const provisionResult =
              await executeOneBalanceSwap(provisionParams);

            if (!provisionResult.success) {
              console.error(
                "[UnifiedSwap] Provision failed:",
                provisionResult.error,
              );
              // Return error instead of proceeding - the main swap will fail without SOL
              return {
                success: false,
                error: `Failed to provision SOL for rent: ${provisionResult.error}`,
              };
            } else {
              console.log(
                "[UnifiedSwap] SOL provision successful, refreshing quote...",
              );
              // Wait a moment for the balance to update
              await new Promise((resolve) => setTimeout(resolve, 2000));

              // Calculate remaining USDC after provision
              const provisionedAmount = parseFloat(
                provisionQuote.inputAmountFormatted || "0",
              );
              const originalAmount = parseFloat(fromAmount);
              const remainingAmount = Math.max(
                0,
                originalAmount - provisionedAmount,
              );

              console.log(
                "[UnifiedSwap] Re-fetching quote with remaining balance:",
                {
                  originalAmount,
                  provisionedAmount,
                  remainingAmount,
                },
              );

              if (remainingAmount <= 0) {
                return {
                  success: false,
                  error:
                    "No funds remaining after SOL provision. Please try with a larger amount.",
                };
              }

              // Get new quote with the remaining amount
              const newQuote = await getQuoteForRetry(
                0,
                remainingAmount.toFixed(6),
              );
              if (!newQuote) {
                return {
                  success: false,
                  error: "Failed to get new quote after SOL provision",
                };
              }

              // Update the quote reference for the main swap
              // Reset execution state before main swap
              resetExecution();

              // Execute main swap with the NEW quote
              const executeParams: OneBalanceExecuteSwapParams = {
                fromToken,
                toToken,
                fromAmount,
                quote: newQuote, // Use the refreshed quote
                evmWalletAddress: evmAddress,
                solanaWalletAddress: solanaAddress,
                refreshQuote: async (retryAttempt: number) => {
                  const refreshedQuote = await getQuoteForRetry(retryAttempt);
                  return refreshedQuote;
                },
                maxRetries: 2,
              };

              return executeOneBalanceSwap(executeParams);
            }
          }
        } else if (
          rentCheck.needsSOL &&
          !rentCheck.canAutoProvision &&
          solanaAddress
        ) {
          // User needs SOL but doesn't have enough USDC to provision
          const errorMsg =
            rentCheck.availableUSDC < MIN_USDC_FOR_PROVISION
              ? `Insufficient USDC for Solana fees. Need at least ${MIN_USDC_FOR_PROVISION} USDC to provision SOL for rent.`
              : "Unable to auto-provision SOL for rent.";
          console.warn(
            "[UnifiedSwap] User needs SOL but cannot auto-provision",
            {
              hasUSDC: rentCheck.availableUSDC,
              required: MIN_SOL_FOR_RENT,
              minUSDCNeeded: MIN_USDC_FOR_PROVISION,
            },
          );
          // Return error instead of proceeding with a swap that will fail
          return {
            success: false,
            error: errorMsg,
          };
        }

        // Reset execution state before main swap
        resetExecution();

        // Execute the main swap
        const executeParams: OneBalanceExecuteSwapParams = {
          fromToken,
          toToken,
          fromAmount,
          quote,
          evmWalletAddress: evmAddress,
          solanaWalletAddress: solanaAddress,
          refreshQuote: async (retryAttempt: number) => {
            const newQuote = await getQuoteForRetry(retryAttempt);
            return newQuote;
          },
          maxRetries: 2,
        };

        return executeOneBalanceSwap(executeParams);
      } finally {
        setIsExecuting(false);
      }
    }, [
      quote,
      fromToken,
      toToken,
      fromAmount,
      evmAddress,
      solanaAddress,
      checkSolanaRent,
      getProvisionQuote,
      getQuoteForRetry,
      executeOneBalanceSwap,
      resetExecution,
    ]);

  // Provider info
  const provider = quote?.provider || null;
  const isOneBalance = quote?.provider === "OneBalance";

  return {
    // Quote state
    quote,
    isLoadingQuote,
    quoteError,

    // Execution state
    executionState,
    isExecuting: isExecuting || isExecutingSwap,

    // Solana rent provision state
    isProvisioningSOL,
    rentCheckResult,

    // Actions
    fetchQuote,
    executeSwap,
    resetExecution,
    clearQuote,

    // Provider info
    provider,
    isOneBalance,
  };
}
