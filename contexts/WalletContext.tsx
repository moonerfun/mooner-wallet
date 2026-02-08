import {
  CHAINS,
  DEFAULT_WALLET_CONFIG,
  NetworkKey,
  NETWORKS,
  WALLET_TYPES,
  WalletTypeKey,
} from "@/constants/turnkey";
import {
  usePortfolioStore,
  type WalletPortfolio,
} from "@/store/portfolioStore";
import type { Wallet } from "@turnkey/react-native-wallet-kit";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// =============================================================================
// TYPES
// =============================================================================

// Raw account from Turnkey API
export interface WalletAccount {
  addressFormat: string;
  address: string;
  path: string;
  curve: string;
  pathFormat: string;
}

export interface Session {
  publicKey: string;
  privateKey: string;
  expirationTime: number;
}

export interface User {
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhoneNumber?: string;
}

// Session state
export type SessionState = "loading" | "authenticated" | "unauthenticated";

// =============================================================================
// NEW CONSOLIDATED WALLET ACCOUNT TYPES
// =============================================================================

/**
 * ConsolidatedWallet - A unified view of a wallet (Solana or EVM)
 * For EVM, one address works across all EVM networks.
 * This prevents the confusion of showing the same address multiple times.
 */
export interface ConsolidatedWallet {
  // Wallet type (solana or evm)
  walletType: WalletTypeKey;
  walletTypeName: string; // "Solana" or "EVM"

  // The address (same for all networks within this wallet type)
  address: string;

  // Turnkey account details
  addressFormat: string;
  path: string;
  curve: string;
  pathFormat: string;

  // Display properties
  icon: string;
  logo: string;
  color: string;

  // Available networks for this wallet type
  availableNetworks: NetworkKey[];
}

// =============================================================================
// LEGACY TYPE (kept for backward compatibility during migration)
// =============================================================================

// Wallet account with chain info (LEGACY - being phased out)
export interface WalletAccountWithChain {
  addressFormat: string;
  address: string;
  path: string;
  curve: string;
  pathFormat: string;
  chainName: string;
  chainSymbol: string;
  chainIcon: string;
  chainLogo: string;
  chainColor: string;
}

// =============================================================================
// CONTEXT TYPE
// =============================================================================

interface WalletContextType {
  // Wallet state
  wallets: Wallet[];
  selectedWallet: Wallet | null;

  // NEW: Consolidated wallets (1 per wallet type: Solana, EVM)
  consolidatedWallets: ConsolidatedWallet[];

  // LEGACY: accounts array (kept for backward compatibility)
  accounts: WalletAccountWithChain[];

  // Session state
  session: Session | undefined;
  sessionState: SessionState;
  user: User | undefined;

  // Portfolio state (shared across all components)
  portfolio: WalletPortfolio | null;
  portfolioBalance: number;
  portfolioChange24h: number;
  portfolioChangePercentage24h: number;
  isLoadingPortfolio: boolean;
  refetchPortfolio: () => void;

  // Actions
  setWallets: (wallets: Wallet[]) => void;
  setSelectedWallet: (wallet: Wallet | null) => void;
  setAccounts: (accounts: WalletAccount[]) => void;
  setSession: (session: Session | undefined) => void;
  setSessionState: (state: SessionState) => void;
  setUser: (user: User | undefined) => void;

  // Consolidated wallet helpers
  getSolanaWallet: () => ConsolidatedWallet | undefined;
  getEvmWallet: () => ConsolidatedWallet | undefined;
  getWalletByType: (type: WalletTypeKey) => ConsolidatedWallet | undefined;
  getAddressForNetwork: (network: NetworkKey) => string | undefined;

  // Utility
  formatAddress: (
    address: string,
    startChars?: number,
    endChars?: number,
  ) => string;
  clearState: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [consolidatedWallets, setConsolidatedWallets] = useState<
    ConsolidatedWallet[]
  >([]);
  const [legacyAccounts, setLegacyAccounts] = useState<
    WalletAccountWithChain[]
  >([]);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [user, setUser] = useState<User | undefined>(undefined);

  // Portfolio from Zustand store (single source of truth)
  const { multiPortfolio, isLoadingMulti, fetchMultiPortfolio } =
    usePortfolioStore();

  // Derive portfolio data from store
  const portfolio = multiPortfolio[0] ?? null;
  const portfolioBalance = portfolio?.totalBalanceUsd ?? 0;
  const portfolioChange24h = portfolio?.totalChange24h ?? 0;
  const portfolioChangePercentage24h = portfolio?.totalChangePercentage24h ?? 0;

  // Get all wallet addresses for portfolio fetch
  const allWalletAddresses = useMemo(() => {
    return consolidatedWallets.map((w) => w.address).filter(Boolean);
  }, [consolidatedWallets]);

  // Fetch portfolio ONCE when wallet addresses change
  useEffect(() => {
    if (allWalletAddresses.length > 0 && sessionState === "authenticated") {
      console.log(
        "[WalletContext] Fetching portfolio for wallets:",
        allWalletAddresses,
      );
      fetchMultiPortfolio(allWalletAddresses);
    }
  }, [allWalletAddresses.join(","), sessionState]);

  // Refetch function for pull-to-refresh
  const refetchPortfolio = useCallback(() => {
    if (allWalletAddresses.length > 0) {
      fetchMultiPortfolio(allWalletAddresses, true); // force = true bypasses cache
    }
  }, [allWalletAddresses, fetchMultiPortfolio]);

  /**
   * Process raw accounts from Turnkey and create:
   * 1. Consolidated wallets (new structure - 1 per wallet type)
   * 2. Legacy accounts (for backward compatibility - multiple per EVM chain)
   */
  const setAccounts = useCallback((rawAccounts: WalletAccount[]) => {
    const consolidated: ConsolidatedWallet[] = [];
    const legacy: WalletAccountWithChain[] = [];
    // Track seen wallets to prevent duplicates (key = walletType-address)
    const seenConsolidated = new Set<string>();
    const seenLegacy = new Set<string>();

    for (const account of rawAccounts) {
      // Determine wallet type based on address format
      if (account.addressFormat === "ADDRESS_FORMAT_SOLANA") {
        // Solana wallet
        const walletTypeConfig = WALLET_TYPES.solana;
        const consolidatedKey = `solana-${account.address}`;

        // Only add if not already seen (prevent duplicate keys)
        if (!seenConsolidated.has(consolidatedKey)) {
          seenConsolidated.add(consolidatedKey);
          consolidated.push({
            walletType: "solana",
            walletTypeName: walletTypeConfig.name,
            address: account.address,
            addressFormat: account.addressFormat,
            path: account.path,
            curve: account.curve,
            pathFormat: account.pathFormat,
            icon: walletTypeConfig.icon,
            logo: walletTypeConfig.logo,
            color: walletTypeConfig.color,
            availableNetworks: [...walletTypeConfig.networks],
          });
        }

        // Legacy entry for Solana
        const legacyKey = `solana-${account.address}`;
        if (!seenLegacy.has(legacyKey)) {
          seenLegacy.add(legacyKey);
          legacy.push({
            ...account,
            chainName: "Solana",
            chainSymbol: "SOL",
            chainIcon: "◎",
            chainLogo: walletTypeConfig.logo,
            chainColor: walletTypeConfig.color,
          });
        }
      } else if (account.addressFormat === "ADDRESS_FORMAT_ETHEREUM") {
        // EVM wallet - ONE consolidated entry
        const walletTypeConfig = WALLET_TYPES.evm;
        const consolidatedKey = `evm-${account.address}`;

        // Only add if not already seen (prevent duplicate keys)
        if (!seenConsolidated.has(consolidatedKey)) {
          seenConsolidated.add(consolidatedKey);
          consolidated.push({
            walletType: "evm",
            walletTypeName: walletTypeConfig.name,
            address: account.address,
            addressFormat: account.addressFormat,
            path: account.path,
            curve: account.curve,
            pathFormat: account.pathFormat,
            icon: walletTypeConfig.icon,
            logo: walletTypeConfig.logo,
            color: walletTypeConfig.color,
            availableNetworks: [...walletTypeConfig.networks],
          });
        }

        // LEGACY: Create entries for each EVM chain (for backward compatibility)
        // This maintains the old behavior where each chain is a separate entry
        const evmChains = Object.entries(CHAINS).filter(
          ([_, chain]) => chain.addressFormat === "ADDRESS_FORMAT_ETHEREUM",
        );

        for (const [key, chain] of evmChains) {
          const legacyKey = `${chain.name}-${account.address}`;
          if (!seenLegacy.has(legacyKey)) {
            seenLegacy.add(legacyKey);
            legacy.push({
              ...account,
              chainName: chain.name,
              chainSymbol: chain.symbol,
              chainIcon: chain.icon,
              chainLogo: chain.logo,
              chainColor: chain.color,
            });
          }
        }
      }
    }

    setConsolidatedWallets(consolidated);
    setLegacyAccounts(legacy);
  }, []);

  // =============================================================================
  // NEW HELPERS
  // =============================================================================

  const getSolanaWallet = useCallback(() => {
    return consolidatedWallets.find((w) => w.walletType === "solana");
  }, [consolidatedWallets]);

  const getEvmWallet = useCallback(() => {
    return consolidatedWallets.find((w) => w.walletType === "evm");
  }, [consolidatedWallets]);

  const getWalletByType = useCallback(
    (type: WalletTypeKey) => {
      return consolidatedWallets.find((w) => w.walletType === type);
    },
    [consolidatedWallets],
  );

  const getAddressForNetwork = useCallback(
    (network: NetworkKey): string | undefined => {
      const networkConfig = NETWORKS[network];
      const wallet = consolidatedWallets.find(
        (w) => w.walletType === networkConfig.walletType,
      );
      return wallet?.address;
    },
    [consolidatedWallets],
  );

  // =============================================================================
  // UTILITY
  // =============================================================================

  const formatAddress = useCallback(
    (address: string, startChars: number = 6, endChars: number = 4) => {
      if (!address || address.length < startChars + endChars) return address;
      return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    },
    [],
  );

  const clearState = useCallback(() => {
    setWallets([]);
    setSelectedWallet(null);
    setConsolidatedWallets([]);
    setLegacyAccounts([]);
    setSession(undefined);
    setUser(undefined);
    setSessionState("unauthenticated");
  }, []);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const value = useMemo(
    () => ({
      wallets,
      selectedWallet,
      consolidatedWallets,
      accounts: legacyAccounts, // Legacy alias
      session,
      sessionState,
      user,
      // Portfolio data (shared across all components)
      portfolio,
      portfolioBalance,
      portfolioChange24h,
      portfolioChangePercentage24h,
      isLoadingPortfolio: isLoadingMulti,
      refetchPortfolio,
      setWallets,
      setSelectedWallet,
      setAccounts,
      setSession,
      setSessionState,
      setUser,
      // Wallet helpers
      getSolanaWallet,
      getEvmWallet,
      getWalletByType,
      getAddressForNetwork,
      formatAddress,
      clearState,
    }),
    [
      wallets,
      selectedWallet,
      consolidatedWallets,
      legacyAccounts,
      session,
      sessionState,
      user,
      portfolio,
      portfolioBalance,
      portfolioChange24h,
      portfolioChangePercentage24h,
      isLoadingMulti,
      refetchPortfolio,
      setAccounts,
      getSolanaWallet,
      getEvmWallet,
      getWalletByType,
      getAddressForNetwork,
      formatAddress,
      clearState,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

// Hook for getting the default wallet config
export function useDefaultWalletConfig() {
  return DEFAULT_WALLET_CONFIG;
}
