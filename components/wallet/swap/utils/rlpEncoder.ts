/**
 * RLP Encoder Utility
 * Recursive Length Prefix encoding for Ethereum transactions
 * Used for building EIP-1559 (Type 2) unsigned transactions
 */

/**
 * Convert number to minimal big-endian bytes
 */
export function toBeBytes(num: number): Uint8Array {
  if (num === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  while (num > 0) {
    bytes.unshift(num & 0xff);
    num = Math.floor(num / 256);
  }
  return new Uint8Array(bytes);
}

/**
 * RLP encode a single item (byte, hex string, or array)
 * @param input - The value to encode (string, number, bigint, or array)
 * @returns Uint8Array of RLP encoded data
 */
export function rlpEncode(input: unknown): Uint8Array {
  if (typeof input === "string") {
    // Ensure hex string starts with 0x
    const hex = input.startsWith("0x") ? input.slice(2) : input;

    // Handle empty string or "0x" or "0x0" or "0x00"
    if (hex === "" || hex === "0" || hex === "00") {
      return new Uint8Array([0x80]); // Empty string encoding
    }

    // Remove leading zeros for numeric values (except single zero)
    const trimmed = hex.replace(/^0+/, "") || "0";

    // Pad to even length
    const padded = trimmed.length % 2 === 0 ? trimmed : "0" + trimmed;
    const bytes = new Uint8Array(
      padded.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    if (bytes.length === 1 && bytes[0] < 0x80) {
      return bytes; // Single byte < 0x80
    }

    if (bytes.length < 56) {
      return new Uint8Array([0x80 + bytes.length, ...bytes]);
    }

    const lenBytes = toBeBytes(bytes.length);
    return new Uint8Array([0xb7 + lenBytes.length, ...lenBytes, ...bytes]);
  }

  if (Array.isArray(input)) {
    const encoded = input.map((item) => rlpEncode(item));
    const totalLength = encoded.reduce((sum, arr) => sum + arr.length, 0);
    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of encoded) {
      concatenated.set(arr, offset);
      offset += arr.length;
    }

    if (totalLength < 56) {
      return new Uint8Array([0xc0 + totalLength, ...concatenated]);
    }

    const lenBytes = toBeBytes(totalLength);
    return new Uint8Array([
      0xf7 + lenBytes.length,
      ...lenBytes,
      ...concatenated,
    ]);
  }

  if (typeof input === "number" || typeof input === "bigint") {
    if (input === 0 || input === 0n) {
      return new Uint8Array([0x80]); // Zero encoding
    }
    const hex =
      typeof input === "bigint" ? input.toString(16) : input.toString(16);
    return rlpEncode("0x" + hex);
  }

  return new Uint8Array([0x80]); // Fallback for empty/undefined
}

/**
 * Convert Uint8Array to hex string (without 0x prefix)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = cleanHex.length % 2 === 0 ? cleanHex : "0" + cleanHex;
  return new Uint8Array(
    padded.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}
