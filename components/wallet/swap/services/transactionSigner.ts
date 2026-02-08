/**
 * Transaction Signer Service
 * Handles signing and broadcasting transactions via Turnkey
 */

import { isEVMChain, RELAY_CHAIN_IDS } from "@/constants/chains";
import { logger } from "@/utils/logger";
import { VersionedTransaction } from "@solana/web3.js";
import { getRpcUrl } from "../constants/rpcUrls";
import { SignatureData } from "../types";

// Default signature for unsigned versioned transactions (64 bytes of zeros)
const DEFAULT_SOLANA_SIGNATURE = new Uint8Array(64).fill(0);

/**
 * Check if a signature is the default (all zeros) placeholder
 */
function isDefaultSignature(signature: Uint8Array): boolean {
  return signature.every((byte, i) => byte === DEFAULT_SOLANA_SIGNATURE[i]);
}

/**
 * Extract the most meaningful error message from a Turnkey error
 * Turnkey errors often nest the actual error in .cause
 */
function extractTurnkeyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error || "Unknown error");
  }

  const errorWithCause = error as Error & { cause?: unknown; code?: string };

  // Recursively check for nested cause
  if (errorWithCause.cause) {
    const causeMessage = extractTurnkeyErrorMessage(errorWithCause.cause);
    if (causeMessage && causeMessage !== "Unknown error") {
      return causeMessage;
    }
  }

  // Return this error's message
  return error.message || "Unknown error";
}

/**
 * Wrap a Turnkey error with a more descriptive message
 * Preserves the original error chain for debugging
 */
function wrapTurnkeyError(error: unknown, operation: string): Error {
  const deepMessage = extractTurnkeyErrorMessage(error);

  // Create a new error with the deep message
  const wrappedError = new Error(deepMessage);

  // Preserve the original error as cause
  (wrappedError as any).cause = error;
  (wrappedError as any).operation = operation;

  logger.error(`[TransactionSigner] ${operation} error:`, {
    message: deepMessage,
    originalError: error instanceof Error ? error.message : error,
  });

  return wrappedError;
}

/**
 * Turnkey hooks interface
 * Uses 'any' for walletAccount to be compatible with Turnkey SDK types
 */
export interface TurnkeySigningHooks {
  signTransaction: (params: {
    walletAccount: any;
    unsignedTransaction: string;
    transactionType: any;
  }) => Promise<string>;
  signAndSendTransaction: (params: {
    walletAccount: any;
    unsignedTransaction: string;
    transactionType: any;
    rpcUrl: string;
  }) => Promise<string>;
  signMessage: (params: {
    walletAccount: any;
    message: string;
  }) => Promise<any>;
}

/**
 * Sign and broadcast result
 */
export interface SignAndBroadcastResult {
  txHash: string;
  success: boolean;
}

/**
 * Sign and broadcast an EVM transaction
 */
export async function signAndBroadcastEvmTransaction(
  unsignedTx: string,
  walletAccount: any,
  chainId: number,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<SignAndBroadcastResult> {
  const rpcUrl = getRpcUrl(chainId);

  logger.log("[TransactionSigner] Signing EVM transaction...");

  try {
    const result = await turnkeyHooks.signAndSendTransaction({
      walletAccount,
      unsignedTransaction: unsignedTx,
      transactionType: "TRANSACTION_TYPE_ETHEREUM",
      rpcUrl,
    });

    logger.log("[TransactionSigner] EVM transaction sent:", result);

    return {
      txHash: result || "",
      success: !!result,
    };
  } catch (error) {
    logger.error(
      "[TransactionSigner] Turnkey signAndSendTransaction error:",
      error,
    );
    throw wrapTurnkeyError(error, "EVM transaction signing");
  }
}

/**
 * Sign and broadcast a Solana transaction
 * Signs first, then broadcasts manually to avoid blockhash mismatch
 * Does quick confirmation check to catch immediate failures (slippage errors)
 */
export async function signAndBroadcastSolanaTransaction(
  unsignedTx: string,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<SignAndBroadcastResult> {
  const rpcUrl = getRpcUrl(RELAY_CHAIN_IDS.SOLANA);

  logger.log("[TransactionSigner] Signing Solana transaction...");
  logger.log("[TransactionSigner] Unsigned tx length:", unsignedTx.length);
  logger.log("[TransactionSigner] Wallet account:", {
    address: walletAccount?.address,
    addressFormat: walletAccount?.addressFormat,
  });

  // Sign the transaction
  let signedTx: string;
  try {
    signedTx = await turnkeyHooks.signTransaction({
      walletAccount,
      unsignedTransaction: unsignedTx,
      transactionType: "TRANSACTION_TYPE_SOLANA",
    });
  } catch (error) {
    logger.error("[TransactionSigner] Turnkey signTransaction error:", error);
    throw wrapTurnkeyError(error, "Solana transaction signing");
  }

  logger.log("[TransactionSigner] Solana transaction signed:", {
    signedTxLength: signedTx?.length,
    signedTxPrefix: signedTx?.substring(0, 32),
  });

  // Validate signed transaction
  if (!signedTx || signedTx.length === 0) {
    throw new Error("Turnkey returned empty signed transaction");
  }

  // Signed transaction should be larger than unsigned (signature added)
  if (signedTx.length <= unsignedTx.length) {
    logger.warn(
      "[TransactionSigner] Warning: Signed tx not larger than unsigned tx",
      {
        unsignedLength: unsignedTx.length,
        signedLength: signedTx.length,
      },
    );
  }

  // Deserialize and validate the signature before broadcasting
  try {
    const signedTxBytes = Buffer.from(signedTx, "hex");
    const deserializedTx = VersionedTransaction.deserialize(signedTxBytes);

    if (deserializedTx.signatures.length === 0) {
      throw new Error("Signed transaction has no signatures");
    }

    const firstSignature = deserializedTx.signatures[0];
    if (isDefaultSignature(firstSignature)) {
      logger.error(
        "[TransactionSigner] Transaction still has default (empty) signature",
      );
      throw new Error(
        "Transaction was not signed properly - signature is empty",
      );
    }

    logger.log(
      "[TransactionSigner] Signature validated, first 8 bytes:",
      Array.from(firstSignature.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch (validationError) {
    logger.error(
      "[TransactionSigner] Signature validation failed:",
      validationError,
    );
    throw validationError;
  }

  logger.log("[TransactionSigner] Broadcasting Solana transaction...");

  // Convert hex to base64 for Solana RPC
  const signedTxBase64 = Buffer.from(signedTx, "hex").toString("base64");

  // Broadcast to the same RPC we used for the blockhash
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        signedTxBase64,
        {
          encoding: "base64",
          skipPreflight: true, // Skip preflight to avoid blockhash expiry during simulation
          preflightCommitment: "finalized",
          maxRetries: 3,
        },
      ],
    }),
  });

  const result = await response.json();
  logger.log("[TransactionSigner] Solana broadcast result:", result);

  if (result.error) {
    throw new Error(
      result.error.message || "Failed to broadcast Solana transaction",
    );
  }

  const txHash = result.result || "";

  // Validate returned signature - all 1s indicates signing failure
  if (
    txHash ===
    "1111111111111111111111111111111111111111111111111111111111111111"
  ) {
    logger.error(
      "[TransactionSigner] RPC returned invalid signature (all zeros)",
    );
    throw new Error(
      "Transaction signing failed - invalid signature returned. The transaction may not have been properly signed.",
    );
  }

  // Quick confirmation check - wait a bit and check if tx failed immediately
  // This catches slippage errors quickly so we can retry with fresh quote
  logger.log("[TransactionSigner] Quick confirmation check...");
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for tx to land

  try {
    const statusResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[txHash], { searchTransactionHistory: true }],
      }),
    });

    const statusResult = await statusResponse.json();
    const status = statusResult?.result?.value?.[0];

    if (status?.err) {
      logger.error(
        "[TransactionSigner] Transaction failed on-chain:",
        status.err,
      );
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }

    if (status?.confirmationStatus) {
      logger.log(
        "[TransactionSigner] Quick check status:",
        status.confirmationStatus,
      );
    }
  } catch (error) {
    // If this is a transaction failure, throw it so retry can happen
    if (
      error instanceof Error &&
      error.message.includes("Transaction failed:")
    ) {
      throw error;
    }
    // Network errors during status check are fine - polling will handle it
    logger.warn("[TransactionSigner] Quick check failed, continuing:", error);
  }

  return {
    txHash,
    success: true,
  };
}

/**
 * Sign a message (for permits, gasless swaps)
 */
export async function signSwapMessage(
  sigData: SignatureData,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<string> {
  logger.log(
    "[TransactionSigner] Processing signature:",
    sigData.signatureKind,
  );

  let messageToSign: string;

  if (sigData.signatureKind === "eip191") {
    messageToSign = sigData.message || "";
  } else if (sigData.signatureKind === "eip712") {
    // For EIP-712 typed data, stringify the structured data
    messageToSign = JSON.stringify({
      domain: sigData.domain,
      types: sigData.types,
      value: sigData.value,
    });
  } else {
    throw new Error(`Unsupported signature kind: ${sigData.signatureKind}`);
  }

  try {
    const signature = await turnkeyHooks.signMessage({
      walletAccount,
      message: messageToSign,
    });

    logger.log("[TransactionSigner] Message signed");

    return signature;
  } catch (error) {
    logger.error("[TransactionSigner] Turnkey signMessage error:", error);
    throw wrapTurnkeyError(error, "Message signing");
  }
}

/**
 * Submit signature to Relay API post endpoint
 */
export async function submitSignature(
  signature: string,
  postConfig: NonNullable<SignatureData["post"]>,
): Promise<void> {
  logger.log(
    "[TransactionSigner] Submitting signature to:",
    postConfig.endpoint,
  );

  const response = await fetch(postConfig.endpoint, {
    method: postConfig.method || "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...postConfig.body,
      signature,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit signature");
  }

  logger.log("[TransactionSigner] Signature submitted successfully");
}

/**
 * Confirm Solana transaction on-chain
 * Throws if transaction fails (e.g., slippage error)
 */
export async function confirmSolanaTransaction(
  signature: string,
  maxRetries: number = 30,
  onProgress?: (attempt: number, maxRetries: number) => void,
): Promise<boolean> {
  const rpcUrl = getRpcUrl(RELAY_CHAIN_IDS.SOLANA);
  const retryIntervalMs = 2000;

  logger.log("[TransactionSigner] Confirming Solana transaction:", signature);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });

      const result = await response.json();
      const status = result?.result?.value?.[0];

      if (status) {
        if (status.err) {
          logger.error(
            "[TransactionSigner] Solana transaction failed:",
            status.err,
          );
          // Throw immediately - this is a real failure, don't retry polling
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }

        // Check for confirmation
        if (
          status.confirmationStatus === "finalized" ||
          status.confirmationStatus === "confirmed"
        ) {
          logger.log(
            "[TransactionSigner] Solana transaction confirmed:",
            status.confirmationStatus,
          );
          return true;
        }
      }

      onProgress?.(i + 1, maxRetries);
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    } catch (error) {
      // Check if this is a transaction failure error (not a network error)
      if (
        error instanceof Error &&
        error.message.includes("Transaction failed:")
      ) {
        // Re-throw transaction failures - these should trigger retry
        throw error;
      }
      // Network errors - log and continue polling
      logger.warn(
        "[TransactionSigner] Error checking Solana tx status:",
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }

  logger.warn("[TransactionSigner] Solana transaction confirmation timeout");
  return false;
}

/**
 * Broadcast a signed transaction manually (fallback)
 */
export async function broadcastSignedTransaction(
  signedTx: string,
  chainId: number,
): Promise<string> {
  const rpcUrl = getRpcUrl(chainId);
  const isEvm = isEVMChain(chainId);

  logger.log("[TransactionSigner] Broadcasting signed transaction...");

  const rpcMethod = isEvm ? "eth_sendRawTransaction" : "sendTransaction";
  const params = isEvm
    ? [signedTx.startsWith("0x") ? signedTx : `0x${signedTx}`]
    : [Buffer.from(signedTx, "hex").toString("base64"), { encoding: "base64" }];

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: rpcMethod,
      params,
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.message || "Failed to broadcast transaction");
  }

  logger.log("[TransactionSigner] Transaction broadcasted:", result.result);
  return result.result || "";
}
