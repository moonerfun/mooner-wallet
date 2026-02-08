/**
 * useSendValidation Hook
 * Handles validation logic for send transactions
 */

import { useCallback, useState } from "react";

/**
 * Validation patterns for different wallet types
 */
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type WalletType = "evm" | "solana";

export interface UseSendValidationReturn {
  addressError: string;
  amountError: string;
  setAddressError: (error: string) => void;
  setAmountError: (error: string) => void;
  validateAddress: (address: string, walletType?: WalletType) => string;
  validateAmount: (value: string, maxBalance?: number) => string;
  isValidAddress: (address: string, walletType?: WalletType) => boolean;
  isValidAmount: (value: string, maxBalance?: number) => boolean;
  resetErrors: () => void;
}

/**
 * Hook for send transaction validation
 */
export function useSendValidation(): UseSendValidationReturn {
  const [addressError, setAddressError] = useState("");
  const [amountError, setAmountError] = useState("");

  /**
   * Validate recipient address based on wallet type
   */
  const validateAddress = useCallback(
    (address: string, walletType?: WalletType): string => {
      if (!address.trim()) {
        return "Recipient address is required";
      }

      if (!walletType) return "";

      if (walletType === "evm") {
        if (!EVM_ADDRESS_PATTERN.test(address)) {
          return "Invalid EVM address format";
        }
      } else if (walletType === "solana") {
        if (!SOLANA_ADDRESS_PATTERN.test(address)) {
          return "Invalid Solana address format";
        }
      }

      return "";
    },
    [],
  );

  /**
   * Validate amount
   */
  const validateAmount = useCallback(
    (value: string, maxBalance?: number): string => {
      if (!value.trim()) {
        return "Amount is required";
      }

      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) {
        return "Please enter a valid amount";
      }

      if (maxBalance !== undefined && numValue > maxBalance) {
        return "Amount exceeds available balance";
      }

      return "";
    },
    [],
  );

  /**
   * Check if address is valid (returns boolean)
   */
  const isValidAddress = useCallback(
    (address: string, walletType?: WalletType): boolean => {
      return validateAddress(address, walletType) === "";
    },
    [validateAddress],
  );

  /**
   * Check if amount is valid (returns boolean)
   */
  const isValidAmount = useCallback(
    (value: string, maxBalance?: number): boolean => {
      return validateAmount(value, maxBalance) === "";
    },
    [validateAmount],
  );

  /**
   * Reset all errors
   */
  const resetErrors = useCallback(() => {
    setAddressError("");
    setAmountError("");
  }, []);

  return {
    addressError,
    amountError,
    setAddressError,
    setAmountError,
    validateAddress,
    validateAmount,
    isValidAddress,
    isValidAmount,
    resetErrors,
  };
}
