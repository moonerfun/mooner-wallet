/**
 * TradeModal - Buy/Sell modal for token detail page
 * Uses OneBalance API for swaps with pre-configured token
 * Integrates with Turnkey wallet for secure transaction signing
 */

import { toast } from "@/components/ui/Toast";
import {
  SwapPreviewInline,
  useLiveTokenBalance,
  useOneBalanceBalance,
  useUnifiedSwap,
} from "@/components/wallet/swap";
import { SwapToken, SwapWalletAccount } from "@/components/wallet/swap/types";
import {
  isSolanaChain,
  NATIVE_TOKEN_ADDRESS,
  RELAY_CHAIN_IDS,
  SOLANA_NATIVE_ADDRESS,
  SOLANA_WRAPPED_SOL_ADDRESS,
  SUPPORTED_CHAINS,
} from "@/constants/chains";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { triggerKolSyncDelayed } from "@/lib/kol/kolSyncService";
import { useKolStore } from "@/store/kolStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import { TokenDetails } from "@/store/tokenStore";
import {
  formatBalance,
  formatTokenAmount,
  formatUsd,
  parseAmountInput,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

type TradeMode = "buy" | "sell";

interface TradeModalProps {
  visible: boolean;
  onClose: () => void;
  token: TokenDetails | null;
  initialMode?: TradeMode;
}

// Map blockchain name to chain ID (include all aliases)
const BLOCKCHAIN_TO_CHAIN_ID: Record<string, number> = {
  // Solana
  solana: RELAY_CHAIN_IDS.SOLANA,
  // Ethereum
  ethereum: RELAY_CHAIN_IDS.ETHEREUM,
  eth: RELAY_CHAIN_IDS.ETHEREUM,
  // Base
  base: RELAY_CHAIN_IDS.BASE,
  // BSC / BNB Chain (include all aliases)
  bsc: RELAY_CHAIN_IDS.BSC,
  bnb: RELAY_CHAIN_IDS.BSC,
  "bnb chain": RELAY_CHAIN_IDS.BSC,
  "binance smart chain": RELAY_CHAIN_IDS.BSC,
  "bnb smart chain": RELAY_CHAIN_IDS.BSC,
  "bnb smart chain (bep20)": RELAY_CHAIN_IDS.BSC,
};

// Map chain ID to wallet chain name (for finding the correct wallet account)
const CHAIN_ID_TO_WALLET_CHAIN_NAME: Record<number, string> = {
  [RELAY_CHAIN_IDS.SOLANA]: "Solana",
  [RELAY_CHAIN_IDS.ETHEREUM]: "Ethereum",
  [RELAY_CHAIN_IDS.BASE]: "Base",
  [RELAY_CHAIN_IDS.BSC]: "BNB Chain",
};

// Chain ID to native token info - derived from centralized chain config
const NATIVE_TOKENS: Record<
  number,
  {
    symbol: string;
    name: string;
    logo: string;
    decimals: number;
    address: string;
  }
> = {
  [RELAY_CHAIN_IDS.ETHEREUM]: {
    symbol: SUPPORTED_CHAINS.ethereum.symbol,
    name: SUPPORTED_CHAINS.ethereum.name,
    logo: SUPPORTED_CHAINS.ethereum.logo,
    decimals: 18,
    address: NATIVE_TOKEN_ADDRESS,
  },
  [RELAY_CHAIN_IDS.SOLANA]: {
    symbol: SUPPORTED_CHAINS.solana.symbol,
    name: SUPPORTED_CHAINS.solana.name,
    logo: SUPPORTED_CHAINS.solana.logo,
    decimals: 9,
    address: SUPPORTED_CHAINS.solana.nativeTokenAddress,
  },
  [RELAY_CHAIN_IDS.BASE]: {
    symbol: SUPPORTED_CHAINS.base.symbol,
    name: "Ethereum",
    logo: SUPPORTED_CHAINS.ethereum.logo, // Base uses ETH logo
    decimals: 18,
    address: NATIVE_TOKEN_ADDRESS,
  },
  [RELAY_CHAIN_IDS.BSC]: {
    symbol: SUPPORTED_CHAINS.bnb.symbol,
    name: SUPPORTED_CHAINS.bnb.name,
    logo: SUPPORTED_CHAINS.bnb.logo,
    decimals: 18,
    address: NATIVE_TOKEN_ADDRESS,
  },
};

// Quick amount buttons
const QUICK_AMOUNTS = ["25%", "50%", "75%", "MAX"];

// Solana rent-exempt minimum balance
// Solana accounts require a minimum balance to remain rent-exempt (~0.00089 SOL)
// Plus additional buffer for wSOL temporary account rent (~0.00204 SOL)
// OneBalance docs: INSUFFICIENT_FUNDS_FOR_RENT error occurs without this
const SOLANA_RENT_EXEMPT_MINIMUM = 0.005; // ~0.005 SOL to cover rent + fees

// Check if a token is native SOL (not wSOL)
function isNativeSol(token: SwapToken | null): boolean {
  if (!token) return false;
  const isSolanaChainId = isSolanaChain(token.chainId);
  const isNativeAddress =
    token.address === SOLANA_NATIVE_ADDRESS ||
    token.address === SOLANA_WRAPPED_SOL_ADDRESS ||
    token.address === "11111111111111111111111111111111";
  return isSolanaChainId && isNativeAddress;
}

// Aggregated USDC token definition for OneBalance
// Using ob:usdc allows receiving USDC on any supported chain
const AGGREGATED_USDC: SwapToken = {
  symbol: "USDC",
  name: "USD Coin (Aggregated)",
  logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  address: "ob:usdc", // OneBalance aggregated asset ID
  chainId: 0, // 0 indicates aggregated (cross-chain)
  decimals: 6,
};

export function TradeModal({
  visible,
  onClose,
  token,
  initialMode = "buy",
}: TradeModalProps) {
  const { theme } = useTheme();
  const { consolidatedWallets, selectedWallet } = useWallet();

  // Memoize only the token fields we care about to prevent excessive re-renders
  // when the parent updates other token fields (like price from WebSocket)
  const stableToken = useMemo(() => {
    if (!token) return null;
    return {
      address: token.address,
      blockchain: token.blockchain,
      name: token.name,
      symbol: token.symbol,
      logo: token.logo,
      decimals: token.decimals,
    };
  }, [
    token?.address,
    token?.blockchain,
    token?.name,
    token?.symbol,
    token?.logo,
    token?.decimals,
  ]);

  // State
  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1.0");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [nativeBalance, setNativeBalance] = useState<string>("0");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  // Output token preference for sell mode: 'usdc' (default) or 'native'
  const [sellOutputToken, setSellOutputToken] = useState<"usdc" | "native">(
    "usdc",
  );

  // Token balance hook with live WebSocket updates (chain-specific fallback)
  const { getTokenBalance, refreshBalances } = useLiveTokenBalance();

  // OneBalance aggregated balance hook (unified balances across chains)
  const {
    getAggregatedBalance,
    refreshBalances: refreshOneBalanceBalances,
    hasFetched: hasOneBalanceData,
  } = useOneBalanceBalance();

  // Get EVM and Solana addresses for OneBalance
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

  // Unified balance getter that prefers OneBalance aggregated data
  const getUnifiedBalance = useCallback(
    (token: SwapToken) => {
      // First, try OneBalance aggregated balance
      const oneBalanceData = getAggregatedBalance(token);
      if (oneBalanceData) {
        return {
          balance: oneBalanceData.balance,
          balanceUsd: oneBalanceData.balanceUsd,
          isAggregated: true,
          chainCount: oneBalanceData.chainCount,
        };
      }

      // Fallback to chain-specific balance
      const liveData = getTokenBalance(token);
      if (liveData) {
        return {
          balance: liveData.balance,
          balanceUsd: liveData.balanceUsd,
          isAggregated: false,
          chainCount: 1,
        };
      }

      return null;
    },
    [getAggregatedBalance, getTokenBalance],
  );

  // Portfolio store for triggering refresh after trade
  const triggerPortfolioRefresh = usePortfolioStore(
    (state) => state.triggerPortfolioRefresh,
  );

  // KOL store for user context
  const { currentUser } = useKolStore();

  // Determine chain ID from token blockchain
  const chainId = useMemo(() => {
    if (!stableToken?.blockchain) return RELAY_CHAIN_IDS.SOLANA;
    const blockchain = stableToken.blockchain.toLowerCase().split(":")[0];
    const resolvedChainId =
      BLOCKCHAIN_TO_CHAIN_ID[blockchain] || RELAY_CHAIN_IDS.SOLANA;
    console.log("[TradeModal] Chain detection:", {
      rawBlockchain: stableToken.blockchain,
      normalizedBlockchain: blockchain,
      chainId: resolvedChainId,
    });
    return resolvedChainId;
  }, [stableToken?.blockchain]);

  // Check if this is a Solana token (limit orders only available on Solana)
  const isSolana = useMemo(() => isSolanaChain(chainId), [chainId]);

  // Get the appropriate wallet account for the chain
  const walletAccount = useMemo((): SwapWalletAccount | null => {
    if (!consolidatedWallets.length) return null;

    // Determine wallet type based on chain
    const isSolanaToken = isSolanaChain(chainId);
    const targetWalletType = isSolanaToken ? "solana" : "evm";

    // Find the matching consolidated wallet
    const wallet = consolidatedWallets.find(
      (w) => w.walletType === targetWalletType,
    );
    if (!wallet) return null;

    // Get chain display info from centralized config
    const chainName = CHAIN_ID_TO_WALLET_CHAIN_NAME[chainId] || "Ethereum";
    const chainConfig = Object.values(SUPPORTED_CHAINS).find(
      (c) => c.name === chainName,
    );

    return {
      address: wallet.address,
      chainName: chainName,
      chainSymbol: chainConfig?.symbol || wallet.walletTypeName,
      chainColor: chainConfig?.color || wallet.color,
      chainLogo: chainConfig?.logo || wallet.logo,
      chainIcon: chainConfig?.icon || wallet.icon,
    };
  }, [consolidatedWallets, chainId]);

  // Native token for this chain (without balance to avoid re-renders)
  const nativeToken = useMemo((): SwapToken | null => {
    const native = NATIVE_TOKENS[chainId];
    if (!native) return null;

    return {
      symbol: native.symbol,
      name: native.name,
      logo: native.logo,
      address: native.address, // Use chain-specific native address
      chainId,
      decimals: native.decimals,
    };
  }, [chainId]);

  // Token to trade (without balance to avoid re-renders)
  const tradeToken = useMemo((): SwapToken | null => {
    if (!stableToken) return null;

    // Determine default decimals based on chain
    // Solana SPL tokens typically use 6 decimals (pump.fun), native SOL uses 9
    // EVM tokens typically use 18 decimals
    const isSolana = isSolanaChain(chainId);
    const defaultDecimals = isSolana ? 6 : 18;
    const tokenDecimals = stableToken.decimals ?? defaultDecimals;

    return {
      symbol: stableToken.symbol,
      name: stableToken.name,
      logo: stableToken.logo,
      address: stableToken.address,
      chainId,
      decimals: tokenDecimals,
    };
  }, [stableToken, chainId]);

  // Determine from/to tokens based on mode
  // Buy mode: Pay with aggregated USDC (ob:usdc), receive the token
  // Sell mode: Pay with the token, receive USDC (default) or native token
  const fromToken = useMemo(() => {
    if (mode === "buy") {
      // Buy with aggregated USDC - OneBalance will route from any chain
      return AGGREGATED_USDC;
    }
    // Sell the trade token
    return tradeToken;
  }, [mode, tradeToken]);

  const toToken = useMemo(() => {
    if (mode === "buy") {
      // Receive the trade token
      return tradeToken;
    }
    // Sell mode: receive USDC (default) or native token based on user preference
    return sellOutputToken === "usdc" ? AGGREGATED_USDC : nativeToken;
  }, [mode, tradeToken, sellOutputToken, nativeToken]);

  // Create SwapWalletAccount for unified swap
  const selectedFromChain = useMemo((): SwapWalletAccount | null => {
    if (!walletAccount) return null;
    return {
      address: walletAccount.address,
      chainName: walletAccount.chainName,
      chainSymbol: walletAccount.chainSymbol,
      chainColor: walletAccount.chainColor,
      chainLogo: walletAccount.chainLogo,
      chainIcon: walletAccount.chainIcon,
    };
  }, [walletAccount]);

  // Use unified swap hook (OneBalance)
  const {
    quote,
    isLoadingQuote: isQuoteLoading,
    quoteError,
    executionState,
    isExecuting,
    isProvisioningSOL,
    executeSwap,
    resetExecution,
  } = useUnifiedSwap({
    fromToken,
    toToken,
    fromAmount: amount,
    slippage,
    selectedFromChain,
    selectedToChain: selectedFromChain, // Same chain for trade modal
  });

  // Update initial mode when prop changes
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  // Track if we've fetched balances for this modal session
  const hasFetchedRef = React.useRef(false);

  // Reset fetch flag when modal closes
  useEffect(() => {
    if (!visible) {
      hasFetchedRef.current = false;
      // Reset balances when modal closes
      setNativeBalance("0");
      setTokenBalance("0");
      setUsdcBalance("0");
    }
  }, [visible]);

  // Fetch balances when modal opens - only run once when modal becomes visible
  useEffect(() => {
    if (!visible || !walletAccount?.address || hasFetchedRef.current) return;

    hasFetchedRef.current = true;

    // Fetch portfolio data once
    refreshBalances([walletAccount.address]);

    // Also fetch OneBalance aggregated balances
    refreshOneBalanceBalances(evmAddress, solanaAddress);
  }, [
    visible,
    walletAccount?.address,
    refreshBalances,
    refreshOneBalanceBalances,
    evmAddress,
    solanaAddress,
  ]);

  // Update balances whenever the tokens or getUnifiedBalance function changes
  // Uses OneBalance aggregated balances when available
  useEffect(() => {
    if (!visible) return;

    if (nativeToken) {
      const balanceData = getUnifiedBalance(nativeToken);
      if (balanceData?.balance) {
        setNativeBalance(balanceData.balance);
        console.log(
          `[TradeModal] ${nativeToken.symbol} balance:`,
          balanceData.balance,
          balanceData.isAggregated
            ? `(aggregated from ${balanceData.chainCount} chains)`
            : "(chain-specific)",
        );
      }
    }

    if (tradeToken) {
      const balanceData = getUnifiedBalance(tradeToken);
      if (balanceData?.balance) {
        setTokenBalance(balanceData.balance);
      }
    }

    // Also fetch aggregated USDC balance for buy mode and sell output
    const usdcBalanceData = getUnifiedBalance(AGGREGATED_USDC);
    if (usdcBalanceData?.balance) {
      setUsdcBalance(usdcBalanceData.balance);
      console.log(
        `[TradeModal] USDC aggregated balance:`,
        usdcBalanceData.balance,
        usdcBalanceData.isAggregated
          ? `(aggregated from ${usdcBalanceData.chainCount} chains)`
          : "(chain-specific)",
      );
    }
  }, [visible, nativeToken, tradeToken, getUnifiedBalance, hasOneBalanceData]);

  // Reset on close
  const handleClose = useCallback(() => {
    if (!isSwapping && !isExecuting) {
      setAmount("");
      setShowConfirmation(false);
      resetExecution();
      onClose();
    }
  }, [isSwapping, isExecuting, resetExecution, onClose]);

  // Handle amount input
  const handleAmountChange = useCallback((text: string) => {
    setAmount(parseAmountInput(text));
  }, []);

  // Helper to format amount with appropriate precision for small values
  const formatSmallAmount = useCallback((value: number): string => {
    if (value === 0) return "0";
    if (value >= 1000) {
      return value.toFixed(2);
    } else if (value >= 1) {
      return value.toFixed(4);
    } else if (value >= 0.0001) {
      return value.toFixed(6);
    } else {
      // For very small values, preserve significant digits
      // Find the first significant digit and keep 6 digits after it
      const str = value.toFixed(18);
      const match = str.match(/^0\.0*/);
      if (match) {
        const leadingZeros = match[0].length - 2; // subtract "0."
        return value.toFixed(Math.min(leadingZeros + 6, 18));
      }
      return value.toFixed(8);
    }
  }, []);

  // Handle quick amount selection
  const handleQuickAmount = useCallback(
    (pct: string) => {
      // For buy mode, use USDC balance (aggregated across chains)
      // For sell mode, use the token balance being sold
      const rawBalance = mode === "buy" ? usdcBalance : tokenBalance;
      const balance = parseFloat(rawBalance);

      console.log("[TradeModal] handleQuickAmount:", {
        pct,
        mode,
        rawBalance,
        parsedBalance: balance,
        usingUsdcForBuy: mode === "buy",
      });

      // Helper to close modal and show error toast
      const showErrorAndClose = (title: string, message: string) => {
        onClose();
        setTimeout(() => {
          toast.error(title, message);
        }, 300);
      };

      if (isNaN(balance) || balance <= 0) {
        console.log("[TradeModal] handleQuickAmount: No valid balance");
        showErrorAndClose(
          "No Balance",
          mode === "buy"
            ? "You don't have any USDC balance. Deposit USDC to buy tokens."
            : "You don't have any tokens to sell.",
        );
        return;
      }

      // For MAX sell, handle special cases
      if (pct === "MAX" && mode === "sell") {
        // Check if we're selling native SOL - need to reserve rent-exempt minimum
        // OneBalance error: INSUFFICIENT_FUNDS_FOR_RENT if we try to sell all SOL
        if (isNativeSol(tradeToken)) {
          const solBalance = balance;
          const rentBuffer = SOLANA_RENT_EXEMPT_MINIMUM;
          const maxSellAmount = solBalance - rentBuffer;

          console.log("[TradeModal] MAX sell SOL with rent reserve:", {
            balance: solBalance,
            rentBuffer,
            maxSellAmount,
          });

          if (maxSellAmount <= 0) {
            showErrorAndClose(
              "Insufficient Balance",
              `Need at least ${rentBuffer} SOL to cover Solana account rent. Your balance: ${solBalance.toFixed(4)} SOL`,
            );
            return;
          }

          // Format with appropriate precision
          const formattedAmount = formatSmallAmount(maxSellAmount);
          setAmount(formattedAmount);
          return;
        }

        // For non-SOL tokens, use raw balance string to preserve precision
        setAmount(rawBalance);
        return;
      }

      let multiplier = 1;
      if (pct === "25%") multiplier = 0.25;
      else if (pct === "50%") multiplier = 0.5;
      else if (pct === "75%") multiplier = 0.75;
      else if (pct === "MAX") {
        // Dynamic gas buffer for native token (buy mode)
        // Use 1% of balance or 0.01 (1%), whichever is smaller, with min 0.001
        const minBuffer = 0.001; // 0.1%
        const percentBuffer = 0.01; // 1% of balance
        const standardBuffer = 0.01; // 1% for larger balances
        const bufferPercent = Math.max(
          minBuffer,
          Math.min(percentBuffer, standardBuffer),
        );
        multiplier = 1 - bufferPercent;
      }

      const calculatedAmount = balance * multiplier;

      if (calculatedAmount <= 0) {
        showErrorAndClose(
          "Insufficient Balance",
          "Balance too low to cover gas fees.",
        );
        return;
      }

      // Format with appropriate precision for small values
      const formattedAmount = formatSmallAmount(calculatedAmount);
      console.log("[TradeModal] handleQuickAmount: Setting amount", {
        calculatedAmount,
        formattedAmount,
      });
      setAmount(formattedAmount);
    },
    [mode, usdcBalance, tokenBalance, formatSmallAmount, onClose],
  );

  // Handle swap execution
  const handleConfirmSwap = useCallback(async () => {
    if (!fromToken || !toToken || !quote || !walletAccount) return;

    setIsSwapping(true);

    try {
      // Use unified OneBalance swap
      const result = await executeSwap();

      if (result.success) {
        // Trigger portfolio refresh for wallet page
        if (walletAccount?.address) {
          triggerPortfolioRefresh([walletAccount.address]);
        }

        // Trigger KOL stats sync after delay (allow indexing time)
        triggerKolSyncDelayed(currentUser?.id, 10000);

        const action = mode === "buy" ? "Bought" : "Sold";
        setAmount("");
        setShowConfirmation(false);
        handleClose();
        // Show toast after modal closes
        setTimeout(() => {
          toast.success(
            `${action} Successfully! 🎉`,
            `${action} ${quote.outputAmountFormatted} ${toToken.symbol}`,
          );
        }, 300);
      } else {
        // Close modal first, then show error toast
        handleClose();
        setTimeout(() => {
          toast.error("Trade Failed", result.error || "Please try again.");
        }, 300);
      }
    } catch (error) {
      console.error("Trade error:", error);
      handleClose();
      setTimeout(() => {
        toast.error(
          "Trade Failed",
          error instanceof Error ? error.message : "Unknown error",
        );
      }, 300);
    } finally {
      setIsSwapping(false);
    }
  }, [
    fromToken,
    toToken,
    quote,
    walletAccount,
    mode,
    executeSwap,
    handleClose,
    triggerPortfolioRefresh,
    currentUser?.id,
  ]);

  // Check if ready to trade
  const isReady = useMemo(() => {
    return (
      fromToken !== null &&
      toToken !== null &&
      amount !== "" &&
      parseFloat(amount) > 0 &&
      quote !== null &&
      !quoteError &&
      walletAccount !== null
    );
  }, [fromToken, toToken, amount, quote, quoteError, walletAccount]);

  // formatUsd, formatTokenAmount, formatBalance imported from @/utils/formatters

  if (!token) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.background }}
          edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
        >
          <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <>
              {/* Header */}
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View
                  style={[styles.header, { borderBottomColor: theme.border }]}
                >
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                    disabled={isSwapping}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.text.primary}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.title, { color: theme.text.primary }]}>
                    {mode === "buy" ? "Buy" : "Sell"} {token.symbol}
                  </Text>
                  <View style={styles.placeholder} />
                </View>
              </TouchableWithoutFeedback>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={true}
                onScrollBeginDrag={Keyboard.dismiss}
              >
                {/* Mode Toggle */}
                <View
                  style={[
                    styles.modeToggle,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      mode === "buy" && { backgroundColor: theme.success },
                    ]}
                    onPress={() => {
                      setMode("buy");
                      setAmount("");
                    }}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        {
                          color: mode === "buy" ? "#fff" : theme.text.secondary,
                        },
                      ]}
                    >
                      Buy
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      mode === "sell" && { backgroundColor: theme.error },
                    ]}
                    onPress={() => {
                      setMode("sell");
                      setAmount("");
                    }}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        {
                          color:
                            mode === "sell" ? "#fff" : theme.text.secondary,
                        },
                      ]}
                    >
                      Sell
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Token Info */}
                <View
                  style={[styles.tokenInfo, { backgroundColor: theme.surface }]}
                >
                  <View style={styles.tokenRow}>
                    {token.logo ? (
                      <Image
                        source={{ uri: token.logo }}
                        style={styles.tokenLogo}
                      />
                    ) : (
                      <View
                        style={[
                          styles.tokenLogoPlaceholder,
                          { backgroundColor: theme.primary.DEFAULT },
                        ]}
                      >
                        <Text style={styles.tokenLogoText}>
                          {token.symbol[0]}
                        </Text>
                      </View>
                    )}
                    <View style={styles.tokenDetails}>
                      <Text
                        style={[
                          styles.tokenName,
                          { color: theme.text.primary },
                        ]}
                      >
                        {token.name}
                      </Text>
                      <Text
                        style={[
                          styles.tokenSymbol,
                          { color: theme.text.secondary },
                        ]}
                      >
                        {token.symbol}
                      </Text>
                    </View>
                    <View style={styles.tokenPrice}>
                      <Text
                        style={[
                          styles.priceValue,
                          { color: theme.text.primary },
                        ]}
                      >
                        {formatUsd(token.price)}
                      </Text>
                      {token.priceChange24h !== undefined && (
                        <Text
                          style={[
                            styles.priceChange,
                            {
                              color:
                                token.priceChange24h >= 0
                                  ? theme.success
                                  : theme.error,
                            },
                          ]}
                        >
                          {token.priceChange24h >= 0 ? "+" : ""}
                          {token.priceChange24h.toFixed(2)}%
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Amount Input */}
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.inputHeader}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {mode === "buy" ? "You Pay" : "You Sell"}
                    </Text>
                    <TouchableOpacity onPress={() => handleQuickAmount("MAX")}>
                      <Text
                        style={[
                          styles.balanceText,
                          { color: theme.text.secondary },
                        ]}
                      >
                        Balance:{" "}
                        {formatBalance(
                          mode === "buy" ? usdcBalance : tokenBalance,
                        )}{" "}
                        {mode === "buy" ? "USDC" : token.symbol}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.tokenBadge}>
                      {mode === "buy" ? (
                        <Image
                          source={{ uri: AGGREGATED_USDC.logo }}
                          style={styles.inputTokenLogo}
                        />
                      ) : token.logo ? (
                        <Image
                          source={{ uri: token.logo }}
                          style={styles.inputTokenLogo}
                        />
                      ) : (
                        <View
                          style={[
                            styles.inputTokenPlaceholder,
                            { backgroundColor: theme.primary.DEFAULT },
                          ]}
                        >
                          <Text style={styles.inputTokenText}>
                            {token.symbol[0]}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.inputTokenSymbol,
                          { color: theme.text.primary },
                        ]}
                      >
                        {mode === "buy" ? "USDC" : token.symbol}
                      </Text>
                    </View>

                    <TextInput
                      style={[
                        styles.amountInput,
                        { color: theme.text.primary },
                      ]}
                      value={amount}
                      onChangeText={handleAmountChange}
                      placeholder="0.00"
                      placeholderTextColor={theme.text.muted}
                      keyboardType="decimal-pad"
                      inputAccessoryViewID="none"
                    />
                  </View>

                  {amount && quote?.inputAmountUsd ? (
                    <Text
                      style={[styles.usdValue, { color: theme.text.secondary }]}
                    >
                      ≈ {formatUsd(quote.inputAmountUsd)}
                    </Text>
                  ) : amount && mode === "sell" && token.price ? (
                    <Text
                      style={[styles.usdValue, { color: theme.text.secondary }]}
                    >
                      ≈ {formatUsd(parseFloat(amount) * token.price)}
                    </Text>
                  ) : null}
                </View>

                {/* Quick Amount Buttons */}
                <View style={styles.quickAmounts}>
                  {QUICK_AMOUNTS.map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.quickAmountButton,
                        { backgroundColor: theme.surface },
                      ]}
                      onPress={() => handleQuickAmount(pct)}
                    >
                      <Text
                        style={[
                          styles.quickAmountText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {pct}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Output Preview */}
                <View
                  style={[
                    styles.outputContainer,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.outputHeader}>
                    <Text
                      style={[
                        styles.outputLabel,
                        { color: theme.text.secondary },
                      ]}
                    >
                      You Receive (estimated)
                    </Text>
                    {/* Output token toggle for sell mode */}
                    {mode === "sell" && (
                      <View style={styles.outputTokenToggle}>
                        <TouchableOpacity
                          style={[
                            styles.outputToggleButton,
                            sellOutputToken === "usdc" && {
                              backgroundColor: theme.primary.DEFAULT,
                            },
                          ]}
                          onPress={() => setSellOutputToken("usdc")}
                        >
                          <Text
                            style={[
                              styles.outputToggleText,
                              {
                                color:
                                  sellOutputToken === "usdc"
                                    ? "#fff"
                                    : theme.text.secondary,
                              },
                            ]}
                          >
                            USDC
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.outputToggleButton,
                            sellOutputToken === "native" && {
                              backgroundColor: theme.primary.DEFAULT,
                            },
                          ]}
                          onPress={() => setSellOutputToken("native")}
                        >
                          <Text
                            style={[
                              styles.outputToggleText,
                              {
                                color:
                                  sellOutputToken === "native"
                                    ? "#fff"
                                    : theme.text.secondary,
                              },
                            ]}
                          >
                            {nativeToken?.symbol || "Native"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={styles.outputRow}>
                    <View style={styles.tokenBadge}>
                      {mode === "sell" ? (
                        <Image
                          source={{
                            uri:
                              sellOutputToken === "usdc"
                                ? AGGREGATED_USDC.logo
                                : nativeToken?.logo,
                          }}
                          style={styles.inputTokenLogo}
                        />
                      ) : token.logo ? (
                        <Image
                          source={{ uri: token.logo }}
                          style={styles.inputTokenLogo}
                        />
                      ) : (
                        <View
                          style={[
                            styles.inputTokenPlaceholder,
                            { backgroundColor: theme.primary.DEFAULT },
                          ]}
                        >
                          <Text style={styles.inputTokenText}>
                            {token.symbol[0]}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.inputTokenSymbol,
                          { color: theme.text.primary },
                        ]}
                      >
                        {mode === "sell"
                          ? sellOutputToken === "usdc"
                            ? "USDC"
                            : nativeToken?.symbol
                          : token.symbol}
                      </Text>
                    </View>

                    {isQuoteLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.primary.DEFAULT}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.outputAmount,
                          { color: theme.text.primary },
                        ]}
                      >
                        {formatTokenAmount(quote?.outputAmountFormatted)}
                      </Text>
                    )}
                  </View>

                  {quote && (
                    <Text
                      style={[styles.usdValue, { color: theme.text.secondary }]}
                    >
                      ≈ {formatUsd(quote.outputAmountUsd)}
                    </Text>
                  )}
                </View>

                {/* Error Message */}
                {quoteError && (
                  <View
                    style={[
                      styles.errorContainer,
                      { backgroundColor: `${theme.error}20` },
                    ]}
                  >
                    <Ionicons name="warning" size={20} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      {quoteError}
                    </Text>
                  </View>
                )}

                {/* No Wallet Warning */}
                {!walletAccount && (
                  <View
                    style={[
                      styles.warningContainer,
                      { backgroundColor: `${theme.warning}20` },
                    ]}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={20}
                      color={theme.warning}
                    />
                    <Text
                      style={[styles.warningText, { color: theme.warning }]}
                    >
                      No wallet connected. Please connect a wallet to trade.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer with Swipe-to-Confirm or Status */}
              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                {quote && fromToken && toToken && isReady ? (
                  <SwapPreviewInline
                    executionState={executionState}
                    isExecuting={isExecuting || isSwapping}
                    isProvisioningSOL={isProvisioningSOL}
                    onConfirm={handleConfirmSwap}
                    theme={theme}
                  />
                ) : (
                  <View
                    style={[
                      styles.tradeButton,
                      {
                        backgroundColor: theme.text.muted,
                      },
                    ]}
                  >
                    <Text style={styles.tradeButtonText}>
                      {isQuoteLoading
                        ? "Getting Quote..."
                        : !amount || parseFloat(amount) <= 0
                          ? "Enter Amount"
                          : !isReady
                            ? "Unable to Trade"
                            : `${mode === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
                    </Text>
                  </View>
                )}
              </View>
            </>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  tokenInfo: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tokenLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenLogoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F1E33",
  },
  tokenDetails: {
    flex: 1,
    marginLeft: 12,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: "700",
  },
  tokenSymbol: {
    fontSize: 14,
    marginTop: 2,
  },
  tokenPrice: {
    alignItems: "flex-end",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  priceChange: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  inputContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  balanceText: {
    fontSize: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputTokenLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  inputTokenPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inputTokenText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F1E33",
  },
  inputTokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "right",
    padding: 0,
  },
  usdValue: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "right",
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: "600",
  },
  outputContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  outputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  outputLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  outputTokenToggle: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
  },
  outputToggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  outputToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  outputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outputAmount: {
    fontSize: 24,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  tradeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tradeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
