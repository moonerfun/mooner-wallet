/**
 * Types for Send Modal Components
 */

import { NetworkKey } from "@/constants/turnkey";
import { ConsolidatedWallet } from "@/contexts/WalletContext";
import { PortfolioAsset } from "@/store/portfolioStore";

/**
 * Send transaction parameters
 */
export interface SendParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  network: NetworkKey;
  networkName: string;
  tokenSymbol?: string;
  tokenAddress?: string;
}

/**
 * Props for WalletSelector component
 */
export interface WalletSelectorProps {
  wallets: ConsolidatedWallet[];
  selectedWallet: ConsolidatedWallet | null;
  onSelect: (wallet: ConsolidatedWallet) => void;
  formatAddress: (address: string, start?: number, end?: number) => string;
}

/**
 * Props for NetworkSelector component
 */
export interface NetworkSelectorProps {
  networks: NetworkKey[];
  selectedNetwork: NetworkKey | null;
  onSelect: (network: NetworkKey) => void;
  getNetworkBalance: (network: NetworkKey) => {
    balance: number;
    valueUsd: number;
    symbol: string;
  } | null;
}

/**
 * Props for RecipientInput component
 */
export interface RecipientInputProps {
  value: string;
  onChange: (text: string) => void;
  onPaste: () => void;
  error: string;
  placeholder: string;
}

/**
 * Props for AmountInput component
 */
export interface AmountInputProps {
  amount: string;
  onAmountChange: (text: string) => void;
  onMax: () => void;
  selectedToken: PortfolioAsset | null;
  onTokenPress: () => void;
  tokenSelectorDisabled: boolean;
  symbol: string;
  error: string;
  availableBalance: string;
}

/**
 * Props for TokenSelectorModal
 */
export interface TokenSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  tokens: PortfolioAsset[];
  onSelect: (token: PortfolioAsset) => void;
  networkName?: string;
}

/**
 * Props for SendConfirmation component
 */
export interface SendConfirmationProps {
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenSymbol: string;
  networkName: string;
  networkLogo?: string;
  networkIcon?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  formatAddress: (address: string, start?: number, end?: number) => string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  addressError: string;
  amountError: string;
}

/**
 * Token logo fallbacks for common tokens
 */
export const FALLBACK_TOKEN_LOGOS: Record<string, string> = {
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
};

/**
 * Get token logo with fallback
 */
export function getTokenLogo(token: PortfolioAsset): string | undefined {
  const fallback = FALLBACK_TOKEN_LOGOS[token.symbol.toUpperCase()];
  if (fallback) return fallback;
  return token.logo;
}
