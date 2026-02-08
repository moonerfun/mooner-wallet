/**
 * Send Service
 * Handles building, signing, and broadcasting native token and token transfers
 * Supports both Solana (SOL/SPL tokens) and EVM chains (ETH/ERC20 tokens)
 */

import { RELAY_CHAIN_IDS, SUPPORTED_CHAINS } from "@/constants/chains";
import { NetworkKey, NETWORKS } from "@/constants/turnkey";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

// =============================================================================
// TYPES
// =============================================================================

export interface SendTransactionParams {
  /** Sender address */
  fromAddress: string;
  /** Recipient address */
  toAddress: string;
  /** Amount to send (in human-readable format, e.g., "1.5") */
  amount: string;
  /** Network key (e.g., "solana", "ethereum", "base", "bnb") */
  network: NetworkKey;
  /** Token symbol (optional - if not provided, sends native token) */
  tokenSymbol?: string;
  /** Token contract address (required for non-native tokens) */
  tokenAddress?: string;
  /** Token decimals (required for non-native tokens, defaults to 9 for Solana, 18 for EVM) */
  tokenDecimals?: number;
}

export interface SendTransactionResult {
  /** Transaction hash/signature */
  txHash: string;
  /** Whether the transaction was successful */
  success: boolean;
  /** Explorer URL for the transaction */
  explorerUrl?: string;
}

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
}

// =============================================================================
// RPC CONFIGURATION
// =============================================================================

const RPC_URLS: Record<number, string> = {
  [RELAY_CHAIN_IDS.SOLANA]:
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com",
  [RELAY_CHAIN_IDS.ETHEREUM]:
    process.env.EXPO_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com",
  [RELAY_CHAIN_IDS.BASE]:
    process.env.EXPO_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
  [RELAY_CHAIN_IDS.BSC]:
    process.env.EXPO_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org",
};

function getRpcUrl(chainId: number): string {
  const url = RPC_URLS[chainId];
  if (!url) {
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);
  }
  return url;
}

// =============================================================================
// SOLANA TRANSACTIONS
// =============================================================================

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

// Associated Token Program ID
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/**
 * Get the associated token address for a wallet and mint
 */
function getAssociatedTokenAddress(
  walletAddress: PublicKey,
  mintAddress: PublicKey,
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

/**
 * Create instruction to create associated token account if it doesn't exist
 */
function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

/**
 * Create SPL token transfer instruction
 */
function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  // Transfer instruction = 3
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

/**
 * Build a Solana native SOL transfer transaction
 */
async function buildSolanaTransfer(
  fromAddress: string,
  toAddress: string,
  amountLamports: bigint,
): Promise<string> {
  const rpcUrl = getRpcUrl(RELAY_CHAIN_IDS.SOLANA);
  const connection = new Connection(rpcUrl, "finalized");

  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(toAddress);

  // Create transfer instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: amountLamports,
  });

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  // Build versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions: [transferInstruction],
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  const serializedTx = Buffer.from(versionedTx.serialize()).toString("hex");

  console.log("[SendService] Built Solana SOL transfer:", {
    from: fromAddress,
    to: toAddress,
    amountLamports: amountLamports.toString(),
    txLength: serializedTx.length,
  });

  return serializedTx;
}

/**
 * Build a Solana SPL token transfer transaction
 */
async function buildSplTokenTransfer(
  fromAddress: string,
  toAddress: string,
  tokenMint: string,
  amount: bigint,
): Promise<string> {
  const rpcUrl = getRpcUrl(RELAY_CHAIN_IDS.SOLANA);
  const connection = new Connection(rpcUrl, "finalized");

  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(toAddress);
  const mintPubkey = new PublicKey(tokenMint);

  // Get associated token accounts
  const sourceATA = getAssociatedTokenAddress(fromPubkey, mintPubkey);
  const destinationATA = getAssociatedTokenAddress(toPubkey, mintPubkey);

  const instructions: TransactionInstruction[] = [];

  // Check if destination ATA exists
  const destinationAccount = await connection.getAccountInfo(destinationATA);
  if (!destinationAccount) {
    // Create destination ATA
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        destinationATA,
        toPubkey,
        mintPubkey,
      ),
    );
    console.log(
      "[SendService] Will create destination ATA:",
      destinationATA.toString(),
    );
  }

  // Add transfer instruction
  instructions.push(
    createTransferInstruction(sourceATA, destinationATA, fromPubkey, amount),
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  // Build versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  const serializedTx = Buffer.from(versionedTx.serialize()).toString("hex");

  console.log("[SendService] Built SPL token transfer:", {
    from: fromAddress,
    to: toAddress,
    mint: tokenMint,
    amount: amount.toString(),
    instructionCount: instructions.length,
    txLength: serializedTx.length,
  });

  return serializedTx;
}

// =============================================================================
// EVM TRANSACTIONS
// =============================================================================

/**
 * RLP encode a value (simplified implementation for transaction building)
 */
function rlpEncode(input: any): Uint8Array {
  if (Array.isArray(input)) {
    const encoded = input.map((item) => rlpEncode(item));
    const totalLength = encoded.reduce((sum, item) => sum + item.length, 0);
    return encodeLength(totalLength, 192, encoded);
  }

  const bytes = toBytes(input);
  if (bytes.length === 1 && bytes[0] < 128) {
    return bytes;
  }
  return encodeLength(bytes.length, 128, [bytes]);
}

function encodeLength(
  len: number,
  offset: number,
  data: Uint8Array[],
): Uint8Array {
  if (len < 56) {
    const result = new Uint8Array(1 + data.reduce((s, d) => s + d.length, 0));
    result[0] = len + offset;
    let pos = 1;
    for (const d of data) {
      result.set(d, pos);
      pos += d.length;
    }
    return result;
  }

  const lenBytes = toBytes(len);
  const result = new Uint8Array(
    1 + lenBytes.length + data.reduce((s, d) => s + d.length, 0),
  );
  result[0] = lenBytes.length + offset + 55;
  result.set(lenBytes, 1);
  let pos = 1 + lenBytes.length;
  for (const d of data) {
    result.set(d, pos);
    pos += d.length;
  }
  return result;
}

function toBytes(value: any): Uint8Array {
  if (value === 0 || value === "0x" || value === "") {
    return new Uint8Array(0);
  }

  if (typeof value === "number") {
    const hex = value.toString(16);
    return hexToBytes(hex.length % 2 ? "0" + hex : hex);
  }

  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      const hex = value.slice(2);
      if (hex === "") return new Uint8Array(0);
      return hexToBytes(hex.length % 2 ? "0" + hex : hex);
    }
    return new TextEncoder().encode(value);
  }

  return value;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a value to hex format
 */
function toHexValue(value: string | number | bigint | undefined): string {
  if (!value) return "0x0";
  if (typeof value === "bigint") {
    const hex = value.toString(16);
    return "0x" + (hex || "0");
  }
  if (typeof value === "string" && value.startsWith("0x")) {
    return value;
  }
  if (typeof value === "number") {
    return "0x" + value.toString(16);
  }
  const parsed = parseInt(value as string, 10);
  if (!isNaN(parsed)) {
    return "0x" + parsed.toString(16);
  }
  return "0x0";
}

/**
 * Estimate gas for an EVM transaction
 */
async function estimateGas(
  rpcUrl: string,
  from: string,
  to: string,
  data: string,
  value: string,
): Promise<number> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_estimateGas",
        params: [{ from, to, data, value }],
      }),
    });

    const result = await response.json();
    if (result.error) {
      console.warn("[SendService] Gas estimation failed:", result.error);
      return data === "0x" ? 21000 : 100000; // Fallback
    }

    const estimatedGas = parseInt(result.result, 16);
    return Math.ceil(estimatedGas * 1.2); // Add 20% buffer
  } catch (error) {
    console.warn("[SendService] Gas estimation error:", error);
    return data === "0x" ? 21000 : 100000; // Fallback
  }
}

/**
 * Get current gas prices (EIP-1559)
 */
async function getGasPrices(
  rpcUrl: string,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    // Get base fee from latest block
    const blockResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBlockByNumber",
        params: ["latest", false],
      }),
    });

    const blockResult = await blockResponse.json();
    const baseFee = blockResult.result?.baseFeePerGas
      ? BigInt(blockResult.result.baseFeePerGas)
      : BigInt(20_000_000_000); // 20 gwei fallback

    // Priority fee (tip)
    const priorityFee = BigInt(1_500_000_000); // 1.5 gwei

    // Max fee = 2x base fee + priority fee (accounts for fee fluctuation)
    const maxFeePerGas = baseFee * BigInt(2) + priorityFee;

    return {
      maxFeePerGas,
      maxPriorityFeePerGas: priorityFee,
    };
  } catch (error) {
    console.warn("[SendService] Failed to get gas prices:", error);
    // Fallback values
    return {
      maxFeePerGas: BigInt(50_000_000_000), // 50 gwei
      maxPriorityFeePerGas: BigInt(1_500_000_000), // 1.5 gwei
    };
  }
}

/**
 * Get nonce for address
 */
async function getNonce(rpcUrl: string, address: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionCount",
      params: [address, "pending"],
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Failed to get nonce: ${result.error.message}`);
  }

  return parseInt(result.result, 16);
}

/**
 * Build ERC20 transfer data
 * transfer(address,uint256) = 0xa9059cbb
 */
function buildErc20TransferData(toAddress: string, amount: bigint): string {
  // Function selector for transfer(address,uint256)
  const selector = "a9059cbb";

  // Pad address to 32 bytes (remove 0x prefix, pad to 64 chars)
  const paddedAddress = toAddress.slice(2).toLowerCase().padStart(64, "0");

  // Pad amount to 32 bytes
  const paddedAmount = amount.toString(16).padStart(64, "0");

  return "0x" + selector + paddedAddress + paddedAmount;
}

/**
 * Build an EVM native token transfer transaction (EIP-1559)
 */
async function buildEvmTransfer(
  fromAddress: string,
  toAddress: string,
  amountWei: bigint,
  chainId: number,
): Promise<string> {
  const rpcUrl = getRpcUrl(chainId);

  // Get nonce and gas prices in parallel
  const [nonce, gasPrices, gasLimit] = await Promise.all([
    getNonce(rpcUrl, fromAddress),
    getGasPrices(rpcUrl),
    estimateGas(rpcUrl, fromAddress, toAddress, "0x", toHexValue(amountWei)),
  ]);

  console.log("[SendService] Building EVM transfer:", {
    chainId,
    nonce,
    gasLimit,
    maxFeePerGas: gasPrices.maxFeePerGas.toString(),
    maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas.toString(),
  });

  // Build EIP-1559 transaction
  // [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList]
  const txFields = [
    chainId,
    toHexValue(nonce),
    toHexValue(gasPrices.maxPriorityFeePerGas),
    toHexValue(gasPrices.maxFeePerGas),
    toHexValue(gasLimit),
    toAddress,
    toHexValue(amountWei),
    "0x", // Empty data for native transfer
    [], // Empty access list
  ];

  const rlpEncoded = rlpEncode(txFields);

  // Prepend type byte 0x02 for EIP-1559
  const typePrefix = new Uint8Array([0x02]);
  const fullTx = new Uint8Array(typePrefix.length + rlpEncoded.length);
  fullTx.set(typePrefix);
  fullTx.set(rlpEncoded, typePrefix.length);

  const hexString = bytesToHex(fullTx);

  console.log("[SendService] Built EVM transfer tx, length:", hexString.length);

  return hexString;
}

/**
 * Build an ERC20 token transfer transaction (EIP-1559)
 */
async function buildErc20Transfer(
  fromAddress: string,
  toAddress: string,
  tokenAddress: string,
  amount: bigint,
  chainId: number,
): Promise<string> {
  const rpcUrl = getRpcUrl(chainId);

  // Build transfer data
  const transferData = buildErc20TransferData(toAddress, amount);

  // Get nonce and gas prices in parallel
  const [nonce, gasPrices, gasLimit] = await Promise.all([
    getNonce(rpcUrl, fromAddress),
    getGasPrices(rpcUrl),
    estimateGas(rpcUrl, fromAddress, tokenAddress, transferData, "0x0"),
  ]);

  console.log("[SendService] Building ERC20 transfer:", {
    chainId,
    tokenAddress,
    nonce,
    gasLimit,
  });

  // Build EIP-1559 transaction
  const txFields = [
    chainId,
    toHexValue(nonce),
    toHexValue(gasPrices.maxPriorityFeePerGas),
    toHexValue(gasPrices.maxFeePerGas),
    toHexValue(gasLimit),
    tokenAddress, // To the token contract
    "0x0", // No native value
    transferData, // Transfer function data
    [], // Empty access list
  ];

  const rlpEncoded = rlpEncode(txFields);

  // Prepend type byte 0x02 for EIP-1559
  const typePrefix = new Uint8Array([0x02]);
  const fullTx = new Uint8Array(typePrefix.length + rlpEncoded.length);
  fullTx.set(typePrefix);
  fullTx.set(rlpEncoded, typePrefix.length);

  const hexString = bytesToHex(fullTx);

  console.log(
    "[SendService] Built ERC20 transfer tx, length:",
    hexString.length,
  );

  return hexString;
}

// =============================================================================
// SIGNING & BROADCASTING
// =============================================================================

/**
 * Sign and broadcast a Solana transaction
 */
async function signAndBroadcastSolana(
  unsignedTx: string,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<SendTransactionResult> {
  const rpcUrl = getRpcUrl(RELAY_CHAIN_IDS.SOLANA);

  console.log("[SendService] Signing Solana transaction...");

  // Sign the transaction
  const signedTx = await turnkeyHooks.signTransaction({
    walletAccount,
    unsignedTransaction: unsignedTx,
    transactionType: "TRANSACTION_TYPE_SOLANA",
  });

  if (!signedTx || signedTx.length === 0) {
    throw new Error("Turnkey returned empty signed transaction");
  }

  console.log("[SendService] Broadcasting Solana transaction...");

  // Convert hex to base64 for Solana RPC
  const signedTxBase64 = Buffer.from(signedTx, "hex").toString("base64");

  // Broadcast
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
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        },
      ],
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.message || "Failed to broadcast transaction");
  }

  const txHash = result.result;
  console.log("[SendService] Solana transaction sent:", txHash);

  return {
    txHash,
    success: true,
    explorerUrl: `${SUPPORTED_CHAINS.solana.explorerUrl}/tx/${txHash}`,
  };
}

/**
 * Sign and broadcast an EVM transaction
 */
async function signAndBroadcastEvm(
  unsignedTx: string,
  walletAccount: any,
  chainId: number,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<SendTransactionResult> {
  const rpcUrl = getRpcUrl(chainId);

  console.log("[SendService] Signing EVM transaction...");

  // Use signAndSendTransaction for EVM (handles signature formatting)
  const txHash = await turnkeyHooks.signAndSendTransaction({
    walletAccount,
    unsignedTransaction: unsignedTx,
    transactionType: "TRANSACTION_TYPE_ETHEREUM",
    rpcUrl,
  });

  if (!txHash) {
    throw new Error("Failed to send transaction");
  }

  console.log("[SendService] EVM transaction sent:", txHash);

  // Find chain config for explorer URL
  const chainConfig = Object.values(SUPPORTED_CHAINS).find(
    (c) => c.relayChainId === chainId,
  );

  return {
    txHash,
    success: true,
    explorerUrl: chainConfig
      ? `${chainConfig.explorerUrl}/tx/${txHash}`
      : undefined,
  };
}

// =============================================================================
// MAIN SEND FUNCTION
// =============================================================================

/**
 * Execute a send transaction
 *
 * @param params - Send parameters
 * @param walletAccount - Turnkey wallet account (from useTurnkey)
 * @param turnkeyHooks - Turnkey signing hooks
 */
export async function executeSend(
  params: SendTransactionParams,
  walletAccount: any,
  turnkeyHooks: TurnkeySigningHooks,
): Promise<SendTransactionResult> {
  const {
    fromAddress,
    toAddress,
    amount,
    network,
    tokenSymbol,
    tokenAddress,
    tokenDecimals,
  } = params;

  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const chainConfig = SUPPORTED_CHAINS[network];
  if (!chainConfig) {
    throw new Error(`Chain config not found for network: ${network}`);
  }

  // Common native token placeholder addresses used by various APIs
  const NATIVE_TOKEN_PLACEHOLDERS = [
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Common EVM native token placeholder
    "0x0000000000000000000000000000000000000000", // EVM zero address
    "11111111111111111111111111111111", // Solana System Program
    "So11111111111111111111111111111111111111112", // Wrapped SOL (often used for native SOL)
  ];

  // Check if this is a native token transfer
  const isNativeToken =
    !tokenAddress ||
    tokenAddress === chainConfig.nativeTokenAddress ||
    NATIVE_TOKEN_PLACEHOLDERS.includes(tokenAddress.toLowerCase()) ||
    // Also check if the token symbol matches the native token
    (tokenSymbol &&
      tokenSymbol.toUpperCase() === chainConfig.symbol.toUpperCase());

  const isSolana = network === "solana";
  const chainId = chainConfig.relayChainId;

  console.log("[SendService] Executing send:", {
    network,
    chainId,
    isNativeToken,
    isSolana,
    tokenSymbol,
    tokenAddress,
    amount,
  });

  // Parse amount to smallest unit
  const decimals = tokenDecimals ?? (isSolana ? 9 : 18);
  const amountFloat = parseFloat(amount);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error("Invalid amount");
  }

  // Convert to smallest unit (lamports for Solana, wei for EVM)
  const amountBigInt = BigInt(Math.floor(amountFloat * Math.pow(10, decimals)));

  let unsignedTx: string;

  if (isSolana) {
    // Solana transaction
    if (isNativeToken) {
      unsignedTx = await buildSolanaTransfer(
        fromAddress,
        toAddress,
        amountBigInt,
      );
    } else {
      unsignedTx = await buildSplTokenTransfer(
        fromAddress,
        toAddress,
        tokenAddress!,
        amountBigInt,
      );
    }

    return await signAndBroadcastSolana(
      unsignedTx,
      walletAccount,
      turnkeyHooks,
    );
  } else {
    // EVM transaction
    if (isNativeToken) {
      unsignedTx = await buildEvmTransfer(
        fromAddress,
        toAddress,
        amountBigInt,
        chainId,
      );
    } else {
      unsignedTx = await buildErc20Transfer(
        fromAddress,
        toAddress,
        tokenAddress!,
        amountBigInt,
        chainId,
      );
    }

    return await signAndBroadcastEvm(
      unsignedTx,
      walletAccount,
      chainId,
      turnkeyHooks,
    );
  }
}

/**
 * Validate a send transaction before execution
 * Returns null if valid, or an error message if invalid
 */
export function validateSendParams(
  params: SendTransactionParams,
): string | null {
  const { fromAddress, toAddress, amount, network, tokenAddress } = params;

  if (!fromAddress) {
    return "From address is required";
  }

  if (!toAddress) {
    return "Recipient address is required";
  }

  if (!amount || parseFloat(amount) <= 0) {
    return "Please enter a valid amount";
  }

  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    return `Unsupported network: ${network}`;
  }

  // Validate address format
  if (network === "solana") {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(toAddress)) {
      return "Invalid Solana address format";
    }
  } else {
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return "Invalid EVM address format";
    }
  }

  return null;
}
