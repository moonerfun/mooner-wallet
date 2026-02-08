/**
 * useOneBalanceExecution Hook
 * Orchestrates swap execution flow using OneBalance API
 * Handles signing and execution for both EVM and Solana operations
 */

import {
  getOneBalanceClient,
  isEvmOperation,
  isSolanaOperation,
} from "@/lib/api/oneBalance/oneBalanceClient";
import {
  OneBalanceChainOperation,
  OneBalanceEvmChainOperation,
  OneBalanceExecuteQuoteRequest,
  OneBalanceSolanaChainOperation,
  OneBalanceSwapQuote,
} from "@/lib/api/oneBalance/oneBalanceTypes";
import {
  extractFailReason,
  getFailReasonMessage,
  isSlippageError,
  parseSwapError,
} from "@/utils/swapErrorParser";
import { MessageV0, VersionedTransaction } from "@solana/web3.js";
import { bs58 } from "@turnkey/encoding";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import { useCallback, useRef, useState } from "react";
import { fromHex, hashMessage, serializeSignature, type Hex } from "viem";
import {
  entryPoint07Address,
  getUserOperationHash,
} from "viem/account-abstraction";
import { hashAuthorization } from "viem/experimental";
import { SwapExecutionState, SwapToken } from "../types";

/**
 * Swap execution parameters
 */
export interface OneBalanceExecuteSwapParams {
  fromToken: SwapToken;
  toToken: SwapToken;
  fromAmount: string;
  quote: OneBalanceSwapQuote;
  evmWalletAddress?: string;
  solanaWalletAddress?: string;
  /** Optional callback to refresh quote for retry. Receives retry attempt number for progressive slippage. */
  refreshQuote?: (retryAttempt: number) => Promise<OneBalanceSwapQuote | null>;
  /** Max retry attempts on slippage/transient errors (default: 2) */
  maxRetries?: number;
}

/**
 * Wallet with accounts for signing
 */
interface Wallet {
  walletId?: string;
  accounts?: any[];
}

/**
 * Swap execution result
 */
export interface OneBalanceSwapExecutionResult {
  success: boolean;
  error?: string;
  quoteId?: string;
  transactionHashes?: { chainId: string; hash: string }[];
}

/**
 * Hook return type
 */
export interface UseOneBalanceExecutionReturn {
  executionState: SwapExecutionState;
  executeSwap: (
    params: OneBalanceExecuteSwapParams,
  ) => Promise<OneBalanceSwapExecutionResult>;
  resetExecution: () => void;
  isExecuting: boolean;
}

const initialState: SwapExecutionState = {
  status: "idle",
  currentStep: 0,
  totalSteps: 0,
  txHash: "",
  statusMessage: "",
};

/**
 * Turnkey signing hooks interface
 * Uses signRawPayload (via httpClient) for EVM operations to bypass
 * signMessage's UTF-8 encoding which corrupts raw byte hashes.
 * See: https://docs.onebalance.io/concepts/signing#eip-7702-account-signing
 */
interface TurnkeySigningHooks {
  signTransaction: (params: {
    walletAccount: any;
    unsignedTransaction: string;
    transactionType: any;
  }) => Promise<string>;
  signRawPayload: (params: {
    signWith: string;
    payload: string;
    encoding: string;
    hashFunction: string;
  }) => Promise<{ r: string; s: string; v: string }>;
}

// =============================================================================
// Helper: Deserialize serialized UserOp strings into UserOperation<'0.7'>
// =============================================================================
function deserializeUserOp(userOp: OneBalanceEvmChainOperation["userOp"]) {
  return {
    sender: userOp.sender as Hex,
    nonce: BigInt(userOp.nonce),
    callData: (userOp.callData || "0x") as Hex,
    callGasLimit: BigInt(userOp.callGasLimit),
    verificationGasLimit: BigInt(userOp.verificationGasLimit),
    preVerificationGas: BigInt(userOp.preVerificationGas),
    maxFeePerGas: BigInt(userOp.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas),
    factory: (userOp.factory || undefined) as Hex | undefined,
    factoryData: (userOp.factoryData || undefined) as Hex | undefined,
    paymaster: (userOp.paymaster || undefined) as Hex | undefined,
    paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
      ? BigInt(userOp.paymasterVerificationGasLimit)
      : undefined,
    paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
      ? BigInt(userOp.paymasterPostOpGasLimit)
      : undefined,
    paymasterData: (userOp.paymasterData || undefined) as Hex | undefined,
    signature: (userOp.signature || "0x") as Hex,
  };
}

/**
 * Serialize Turnkey's {r, s, v} signature into a standard EVM signature hex string.
 * Turnkey returns r and s as hex strings (without 0x prefix) and v as "00"/"01" or "1b"/"1c".
 * This follows the same pattern as the OneBalance Turnkey integration example.
 */
function serializeTurnkeyEvmSignature(sig: {
  r: string;
  s: string;
  v: string;
}): Hex {
  // Turnkey returns r and s as raw hex without 0x prefix
  const rHex = `0x${sig.r.padStart(64, "0")}` as Hex;
  const sHex = `0x${sig.s.padStart(64, "0")}` as Hex;

  // Convert v to yParity
  let yParity: 0 | 1;
  switch (sig.v) {
    case "00":
    case "1b":
      yParity = 0;
      break;
    case "01":
    case "1c":
      yParity = 1;
      break;
    default:
      // Try parsing as number
      const vNum = parseInt(sig.v, 16);
      yParity = vNum === 0 || vNum === 27 ? 0 : 1;
      break;
  }

  return serializeSignature({ r: rHex, s: sHex, yParity });
}

/**
 * Sign an EVM chain operation using Turnkey
 *
 * For EIP-7702 / Kernel v3.3 accounts, we must:
 * 1. Sign EIP-7702 delegation authorization (if present)
 * 2. Compute the UserOperation hash (EntryPoint 0.7) using viem
 * 3. Sign it using EIP-191 personal_sign (signMessage with raw hash)
 * 4. Properly serialize the {r, s, v} signature
 *
 * This is different from role-based accounts which use signTypedData.
 * See: https://docs.onebalance.io/concepts/signing#eip-7702-account-signing
 */
async function signEvmOperation(
  operation: OneBalanceEvmChainOperation,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<OneBalanceEvmChainOperation> {
  console.log("[OneBalanceExecution] Signing EVM operation...");

  const typedData = operation.typedDataToSign;
  if (!typedData) {
    throw new Error("No typed data to sign for EVM operation");
  }

  // Extract chain ID from typed data domain
  const chainId = Number(typedData.domain.chainId);
  if (!chainId) {
    throw new Error("No chainId found in typedDataToSign.domain");
  }

  // Make a mutable copy of the operation
  let signedOperation = { ...operation };

  // =========================================================================
  // Step 1: Sign EIP-7702 delegation authorization (if present)
  // This is REQUIRED for EIP-7702 accounts. Without it, the delegation
  // won't be authorized and the bundler will reject the UserOperation on-chain.
  // See: https://docs.onebalance.io/concepts/signing#eip-7702-account-signing
  // =========================================================================
  if (operation.delegation) {
    console.log(
      "[OneBalanceExecution] Signing EIP-7702 delegation for contract:",
      operation.delegation.contractAddress,
    );

    const authTuple = {
      contractAddress: operation.delegation.contractAddress as Hex,
      chainId: chainId,
      nonce: operation.delegation.nonce,
    };

    // Compute the EIP-7702 authorization hash
    // This is keccak256(MAGIC || rlp([chain_id, address, nonce]))
    const authHash = hashAuthorization(authTuple);

    console.log("[OneBalanceExecution] Delegation auth hash:", authHash);

    // Sign the authorization hash directly with Turnkey
    // No additional hashing needed — hashAuthorization already produces the final digest
    const authSignResult = await turnkeyHooks.signRawPayload({
      signWith: walletAccount.address,
      payload: authHash,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });

    // Convert Turnkey's {r, s, v} to the delegation signature format
    const rHex = `0x${authSignResult.r.padStart(64, "0")}` as Hex;
    const sHex = `0x${authSignResult.s.padStart(64, "0")}` as Hex;
    let yParity: 0 | 1;
    switch (authSignResult.v) {
      case "00":
      case "1b":
        yParity = 0;
        break;
      case "01":
      case "1c":
        yParity = 1;
        break;
      default:
        const vNum = parseInt(authSignResult.v, 16);
        yParity = vNum === 0 || vNum === 27 ? 0 : 1;
        break;
    }
    const vHex = `0x${yParity === 0 ? "1b" : "1c"}` as Hex;

    signedOperation = {
      ...signedOperation,
      delegation: {
        ...operation.delegation,
        signature: {
          chainId: chainId,
          contractAddress: operation.delegation.contractAddress,
          nonce: operation.delegation.nonce,
          r: rHex,
          s: sHex,
          v: vHex,
          yParity: yParity,
          type: "Signed",
        },
      },
    };

    console.log("[OneBalanceExecution] Delegation signed successfully");
  }

  // =========================================================================
  // Step 2: Compute UserOperation hash using viem's getUserOperationHash
  // This is the standard ERC-4337 v0.7 hash computation.
  // =========================================================================
  const deserializedUserOp = deserializeUserOp(operation.userOp);
  const userOpHash = getUserOperationHash({
    userOperation: deserializedUserOp,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
    chainId: chainId,
  });

  console.log("[OneBalanceExecution] UserOp hash computed:", userOpHash);

  // =========================================================================
  // Step 3: Compute EIP-191 message hash and sign
  // This is equivalent to viem's: signMessage({ message: { raw: userOpHash } })
  // which prepends "\x19Ethereum Signed Message:\n32" and keccak256 hashes
  // =========================================================================
  const messageHash = hashMessage({ raw: fromHex(userOpHash, "bytes") });

  console.log("[OneBalanceExecution] EIP-191 message hash:", messageHash);

  // Sign the pre-computed hash using Turnkey's httpClient.signRawPayload
  // We use signRawPayload directly (instead of signMessage) because signMessage
  // always converts the message to UTF-8 bytes via ethers.toUtf8Bytes(), which
  // turns our 64-char hex string into 64 bytes instead of the 32 bytes we need.
  const signResult = await turnkeyHooks.signRawPayload({
    signWith: walletAccount.address,
    payload: messageHash, // 0x-prefixed hex of 32-byte EIP-191 hash
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  // Step 4: Serialize the signature properly
  const signature = serializeTurnkeyEvmSignature(signResult);

  console.log(
    "[OneBalanceExecution] EVM signature obtained, length:",
    signature.length,
  );

  // Return operation with delegation signature + userOp signature
  return {
    ...signedOperation,
    userOp: {
      ...signedOperation.userOp,
      signature,
    },
  };
}

/**
 * Sign a Solana chain operation using Turnkey
 *
 * OneBalance Solana signing flow:
 * 1. dataToSign is a base64-encoded serialized VersionedTransaction
 * 2. We sign it with Turnkey (which adds the signature to the transaction)
 * 3. We extract just the 64-byte signature from the signed transaction
 * 4. We encode the signature as base58 (OneBalance expects base58 signatures for Solana)
 */
async function signSolanaOperation(
  operation: OneBalanceSolanaChainOperation,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<OneBalanceSolanaChainOperation> {
  console.log("[OneBalanceExecution] Signing Solana operation...");
  console.log("[OneBalanceExecution] Wallet account:", {
    address: walletAccount?.address,
    addressFormat: walletAccount?.addressFormat,
    hasAccount: !!walletAccount,
  });

  // Validate wallet account
  if (!walletAccount) {
    throw new Error("No Solana wallet account provided for signing");
  }

  // Extract serialized transaction - handle both string and object formats
  const dataToSign = operation.dataToSign;
  let base64Transaction: string;

  if (typeof dataToSign === "string") {
    // V3 API returns base64 string directly
    base64Transaction = dataToSign;
    console.log("[OneBalanceExecution] Using dataToSign as base64 string");
  } else if (dataToSign?.serializedTransaction) {
    // Legacy format with nested object
    base64Transaction = dataToSign.serializedTransaction;
    console.log("[OneBalanceExecution] Using dataToSign.serializedTransaction");
  } else {
    console.error(
      "[OneBalanceExecution] Invalid dataToSign format:",
      typeof dataToSign,
      dataToSign,
    );
    throw new Error("No transaction data to sign for Solana operation");
  }

  console.log(
    "[OneBalanceExecution] Base64 transaction length:",
    base64Transaction.length,
  );

  // OneBalance sends a MessageV0, not a full VersionedTransaction
  // We need to deserialize it as MessageV0, wrap in VersionedTransaction, then serialize for Turnkey
  const msgBuffer = Buffer.from(base64Transaction, "base64");

  // Deserialize as MessageV0
  const message = MessageV0.deserialize(msgBuffer);
  console.log("[OneBalanceExecution] Deserialized MessageV0 successfully");

  // Create a VersionedTransaction from the message
  const transaction = new VersionedTransaction(message);
  console.log(
    "[OneBalanceExecution] Created VersionedTransaction with",
    transaction.signatures.length,
    "signature slots",
  );

  // Serialize the transaction for Turnkey (hex format)
  const txBytes = transaction.serialize();
  const hexTransaction = Buffer.from(txBytes).toString("hex");

  console.log(
    "[OneBalanceExecution] Serialized transaction hex length:",
    hexTransaction.length,
  );

  try {
    // Sign the transaction using Turnkey
    // Turnkey returns the complete signed transaction (with signature embedded) in hex format
    const signedHex = await turnkeyHooks.signTransaction({
      walletAccount,
      unsignedTransaction: hexTransaction,
      transactionType: "TRANSACTION_TYPE_SOLANA",
    });

    if (!signedHex || signedHex.length === 0) {
      throw new Error("Turnkey returned empty signed transaction");
    }

    console.log(
      "[OneBalanceExecution] Turnkey signed transaction hex length:",
      signedHex.length,
    );

    // Deserialize the signed transaction to extract the signature
    const signedTxBytes = Buffer.from(signedHex, "hex");
    const signedTx = VersionedTransaction.deserialize(signedTxBytes);

    if (signedTx.signatures.length === 0) {
      throw new Error("Signed transaction has no signatures");
    }

    // Get the user's signature from the signed transaction
    // OneBalance docs specify: always use signatures[signatures.length - 1]
    // In the transaction, signers are ordered: [feePayer, ...otherSigners, userWallet]
    // The user's wallet is always the last signer, so the last signature is ours
    // See: https://docs.onebalance.io/guides/solana-getting-started
    const signatureBytes = signedTx.signatures[signedTx.signatures.length - 1];

    if (!signatureBytes || !signatureBytes.some((byte: number) => byte !== 0)) {
      throw new Error("Could not find valid signature in signed transaction");
    }

    // Encode the signature as base58 (OneBalance expects base58 for Solana signatures)
    const signatureBase58 = bs58.encode(signatureBytes);

    console.log("[OneBalanceExecution] Extracted signature:", {
      signatureLength: signatureBytes.length,
      signatureBase58Length: signatureBase58.length,
      signaturePreview: signatureBase58.substring(0, 20) + "...",
    });

    // Return operation with base58-encoded signature (as required by OneBalance)
    return {
      ...operation,
      signature: signatureBase58,
    };
  } catch (error: any) {
    console.error("[OneBalanceExecution] Turnkey signing error details:", {
      errorMessage: error?.message,
      errorName: error?.name,
      errorCode: error?.code,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    throw error;
  }
}

/**
 * useOneBalanceExecution Hook
 * Handles the complete swap execution flow using OneBalance
 */
export function useOneBalanceExecution(
  selectedWallet: Wallet | null | undefined,
): UseOneBalanceExecutionReturn {
  const [executionState, setExecutionState] =
    useState<SwapExecutionState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Turnkey hooks for signing
  // We use httpClient.signRawPayload for EVM operations to bypass signMessage's
  // internal UTF-8 encoding (ethers.toUtf8Bytes) which corrupts raw hash payloads
  const { signTransaction, httpClient } = useTurnkey();

  // Create Turnkey hooks adapter
  const turnkeyHooks: TurnkeySigningHooks = {
    signTransaction,
    signRawPayload: async (params) => {
      if (!httpClient) {
        throw new Error("Turnkey httpClient not initialized");
      }
      const response = await httpClient.signRawPayload({
        signWith: params.signWith,
        payload: params.payload,
        encoding: params.encoding as any,
        hashFunction: params.hashFunction as any,
      });
      return { r: response.r, s: response.s, v: response.v };
    },
  };

  /**
   * Get wallet account for a specific address format
   */
  const getWalletAccount = useCallback(
    (addressFormat: "evm" | "solana", targetAddress?: string): any | null => {
      if (!selectedWallet?.accounts) {
        console.warn(
          "[OneBalanceExecution] No selected wallet or accounts available",
        );
        return null;
      }

      const turnkeyFormat =
        addressFormat === "solana"
          ? "ADDRESS_FORMAT_SOLANA"
          : "ADDRESS_FORMAT_ETHEREUM";

      // Find account by format and optionally by address
      const account = selectedWallet.accounts.find((acc: any) => {
        if (acc.addressFormat !== turnkeyFormat) return false;
        if (!targetAddress) return true;

        // Compare addresses (case-insensitive for EVM)
        if (turnkeyFormat === "ADDRESS_FORMAT_ETHEREUM") {
          return acc.address.toLowerCase() === targetAddress.toLowerCase();
        }
        return acc.address === targetAddress;
      });

      return account || null;
    },
    [selectedWallet],
  );

  /**
   * Update execution state helper
   */
  const updateState = useCallback((updates: Partial<SwapExecutionState>) => {
    setExecutionState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset execution state
   */
  const resetExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setExecutionState(initialState);
  }, []);

  /**
   * Execute the swap using OneBalance
   */
  const executeSwap = useCallback(
    async (
      params: OneBalanceExecuteSwapParams,
    ): Promise<OneBalanceSwapExecutionResult> => {
      const {
        fromToken,
        toToken,
        fromAmount,
        evmWalletAddress,
        solanaWalletAddress,
        refreshQuote,
        maxRetries = 2,
      } = params;

      let currentQuote = params.quote;
      let retryCount = 0;

      // Validate quote
      const rawQuote = currentQuote.rawQuote;
      if (!rawQuote) {
        const errorMsg = "Invalid quote - missing raw quote data";
        updateState({
          status: "error",
          error: errorMsg,
          statusMessage: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      const originOperations = rawQuote.originChainsOperations;
      if (!originOperations || originOperations.length === 0) {
        const errorMsg = "No operations to execute";
        updateState({
          status: "error",
          error: errorMsg,
          statusMessage: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      // Initialize
      abortControllerRef.current = new AbortController();
      const client = getOneBalanceClient();

      // Determine which accounts we need
      const needsEvm = originOperations.some((op) => isEvmOperation(op));
      const needsSolana = originOperations.some((op) => isSolanaOperation(op));

      // Get wallet accounts
      const evmWalletAccount = needsEvm
        ? getWalletAccount("evm", evmWalletAddress)
        : null;
      const solanaWalletAccount = needsSolana
        ? getWalletAccount("solana", solanaWalletAddress)
        : null;

      if (needsEvm && !evmWalletAccount) {
        const errorMsg = "EVM wallet not configured";
        updateState({
          status: "error",
          error: errorMsg,
          statusMessage: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      if (needsSolana && !solanaWalletAccount) {
        const errorMsg = "Solana wallet not configured";
        updateState({
          status: "error",
          error: errorMsg,
          statusMessage: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      // Retry loop for slippage errors
      while (retryCount <= maxRetries) {
        updateState({
          status: "preparing",
          currentStep: 0,
          totalSteps: originOperations.length,
          txHash: "",
          error: undefined,
          statusMessage:
            retryCount > 0
              ? `Retrying swap (attempt ${retryCount + 1})...`
              : "Preparing swap...",
        });

        try {
          // Step 1: Sign all origin chain operations
          updateState({
            status: "signing",
            statusMessage: "Signing transactions...",
          });

          const signedOperations: OneBalanceChainOperation[] = [];

          for (let i = 0; i < originOperations.length; i++) {
            const operation = originOperations[i];
            updateState({
              currentStep: i + 1,
              statusMessage: `Signing operation ${i + 1} of ${originOperations.length}...`,
            });

            if (isSolanaOperation(operation)) {
              const signedOp = await signSolanaOperation(
                operation,
                solanaWalletAccount,
                turnkeyHooks,
              );
              signedOperations.push(signedOp);
            } else if (isEvmOperation(operation)) {
              const signedOp = await signEvmOperation(
                operation,
                evmWalletAccount,
                turnkeyHooks,
              );
              signedOperations.push(signedOp);
            } else {
              signedOperations.push(operation);
            }
          }

          // Step 2: Sign destination operation if present
          let signedDestinationOp = rawQuote.destinationChainOperation;
          if (signedDestinationOp) {
            updateState({
              statusMessage: "Signing destination operation...",
            });

            if (isSolanaOperation(signedDestinationOp)) {
              signedDestinationOp = await signSolanaOperation(
                signedDestinationOp,
                solanaWalletAccount,
                turnkeyHooks,
              );
            } else if (isEvmOperation(signedDestinationOp)) {
              signedDestinationOp = await signEvmOperation(
                signedDestinationOp,
                evmWalletAccount,
                turnkeyHooks,
              );
            }
          }

          // Step 3: Execute the quote
          updateState({
            status: "broadcasting",
            statusMessage: "Executing swap...",
          });

          // Spread the entire original quote to preserve all fields validated by tamper proof signature
          // Then override only the operations with signed versions
          const executeRequest: OneBalanceExecuteQuoteRequest = {
            ...rawQuote,
            originChainsOperations: signedOperations,
            destinationChainOperation: signedDestinationOp,
          };

          // Determine if we need V3 (multi-account)
          const useV3 =
            needsSolana || (rawQuote.accounts && rawQuote.accounts.length > 0);

          if (useV3) {
            await client.executeQuoteV3(executeRequest);
          } else {
            await client.executeQuote(executeRequest);
          }

          // Step 4: Poll for status
          updateState({
            status: "polling",
            statusMessage: "Confirming transaction...",
          });

          const statusResult = await client.pollExecutionStatus(rawQuote.id, {
            useV3,
            maxAttempts: 60,
            intervalMs: 2000,
            onUpdate: (status) => {
              if (
                status.transactionHashes &&
                status.transactionHashes.length > 0
              ) {
                const firstHash = status.transactionHashes[0];
                updateState({
                  txHash: firstHash.hash,
                  statusMessage: `Confirming: ${status.status.status}...`,
                });
              }
            },
          });

          // Success!
          updateState({
            status: "success",
            statusMessage: "Swap completed!",
            txHash: statusResult.transactionHashes?.[0]?.hash || "",
          });

          return {
            success: true,
            quoteId: rawQuote.id,
            transactionHashes: statusResult.transactionHashes,
          };
        } catch (error: unknown) {
          console.error("[OneBalanceExecution] Error:", error);

          // Parse the error
          const errorMessage =
            error instanceof Error ? error.message : "Swap failed";

          // Extract OneBalance fail reason if present
          const failReason = extractFailReason(errorMessage);
          const parsedError = failReason
            ? getFailReasonMessage(failReason)
            : parseSwapError(errorMessage);

          // Check if it's a retryable error and we can retry
          if (
            isSlippageError(errorMessage) &&
            retryCount < maxRetries &&
            refreshQuote
          ) {
            console.log(
              `[OneBalanceExecution] Retryable error (${failReason || "unknown"}), retrying (${retryCount + 1}/${maxRetries})...`,
            );

            // Show user what's happening
            updateState({
              statusMessage: failReason
                ? getFailReasonMessage(failReason)
                : "Price changed, getting fresh quote...",
            });

            retryCount++;

            // Get fresh quote with progressive slippage
            // retryCount is already incremented, so attempt 1 gets 1.5x slippage, attempt 2 gets 2.25x, etc.
            const newQuote = await refreshQuote(retryCount);
            if (newQuote) {
              currentQuote = newQuote;
              continue; // Retry with new quote
            }
          }

          // Failed - no more retries
          updateState({
            status: "error",
            error: parsedError,
            statusMessage: parsedError,
          });

          return { success: false, error: parsedError };
        }
      }

      // Should not reach here
      return { success: false, error: "Max retries exceeded" };
    },
    [getWalletAccount, turnkeyHooks, updateState],
  );

  return {
    executionState,
    executeSwap,
    resetExecution,
    isExecuting:
      executionState.status !== "idle" &&
      executionState.status !== "success" &&
      executionState.status !== "error",
  };
}
