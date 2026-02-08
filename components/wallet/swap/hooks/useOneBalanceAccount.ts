/**
 * useOneBalanceAccount Hook
 * Manages OneBalance account configuration for EIP-7702 accounts
 *
 * OneBalance supports two account types:
 * 1. ERC-4337 (kernel-v3.1-ecdsa): Uses predicted smart account address
 * 2. EIP-7702 (kernel-v3.3-ecdsa): Uses EOA directly (no prediction needed)
 *
 * We use EIP-7702 because:
 * - Simpler: accountAddress = signerAddress = EOA
 * - No prediction step needed
 * - Preserves existing EOA addresses
 * - Gas efficient delegation model
 *
 * Key concepts for EIP-7702:
 * - accountAddress: The EOA address (same as signer)
 * - signerAddress: The EOA address
 * - type: "kernel-v3.3-ecdsa"
 * - deploymentType: "EIP7702"
 */

export interface OneBalanceAccountInfo {
  // EVM Account - for EIP-7702, accountAddress = signerAddress = EOA
  evmAccountAddress: string | null;
  evmSignerAddress: string | null;

  // Solana (same address for both)
  solanaAddress: string | null;

  // Account type info
  accountType: "kernel-v3.3-ecdsa";
  deploymentType: "EIP7702";

  // Status
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

/**
 * useOneBalanceAccount Hook
 * Configures OneBalance account using EIP-7702 (EOA-based smart account)
 *
 * With EIP-7702, no prediction is needed - the EOA address is used directly
 * for both accountAddress and signerAddress.
 */
export function useOneBalanceAccount(
  evmWalletAddress?: string,
  solanaWalletAddress?: string,
): OneBalanceAccountInfo {
  // For EIP-7702, accountAddress = signerAddress = EOA
  // No prediction needed!
  const evmAccountAddress = evmWalletAddress || null;
  const evmSignerAddress = evmWalletAddress || null;

  const isReady = !!(evmAccountAddress || solanaWalletAddress);

  // Log once when addresses are available (handled by caller)

  return {
    evmAccountAddress,
    evmSignerAddress,
    solanaAddress: solanaWalletAddress || null,
    accountType: "kernel-v3.3-ecdsa",
    deploymentType: "EIP7702",
    isLoading: false, // No async operation needed for EIP-7702
    error: null,
    isReady,
  };
}

export default useOneBalanceAccount;
