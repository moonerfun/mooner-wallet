/**
 * SwapModalV2 - Modernized swap modal inspired by Bitget Wallet
 *
 * Key improvements over SwapModal:
 * - Unified token selector with chain tabs (no separate network selection)
 * - Auto-detects cross-chain vs same-chain swaps based on token selection
 * - Removed manual cross-chain toggle
 * - Cleaner, more intuitive UX
 *
 * Uses OneBalance API for unified cross-chain abstraction
 * Supports cross-chain and same-chain swaps across multiple networks
 * Integrates with Turnkey for secure transaction signing
 */

import { toast } from "@/components/ui/Toast";
import {
  SOLANA_NATIVE_ADDRESS,
  SOLANA_WRAPPED_SOL_ADDRESS,
  SUPPORTED_CHAINS,
} from "@/constants/chains";
import { NETWORKS, NetworkKey } from "@/constants/turnkey";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { triggerKolSyncDelayed } from "@/lib/kol/kolSyncService";
import { useKolStore } from "@/store/kolStore";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

// Native token address constant (0x0...0 for native gas tokens)
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

// Solana chain ID
const SOLANA_CHAIN_ID = 792703809;

/**
 * Check if a token is a native gas token (ETH, SOL, etc.)
 * Handles both EVM (0x000...0) and Solana (system program) native addresses
 */
function isNativeToken(token: { address: string; chainId: number }): boolean {
  // EVM native token (ETH, MATIC, BNB, etc.)
  if (token.address === NATIVE_TOKEN_ADDRESS) return true;
  // Solana native SOL
  if (
    token.chainId === SOLANA_CHAIN_ID &&
    (token.address === SOLANA_NATIVE_ADDRESS ||
      token.address === SOLANA_WRAPPED_SOL_ADDRESS ||
      token.address === "11111111111111111111111111111111")
  )
    return true;
  return false;
}

// Minimum swap amounts by chain type
// SOL swaps need to cover wSOL account rent (~0.00204 SOL) on top of the swap amount
// OneBalance also takes a fee, so very small amounts will always fail on-chain
const MIN_SOL_SWAP_AMOUNT = 0.005; // ~$0.75 at $150/SOL
const MIN_EVM_SWAP_AMOUNT = 0.0001; // Very low minimum for EVM

// Swap module imports
import {
  QuoteDetails,
  SlippageSettings,
  SwapPreviewInline,
  TokenInput,
  UnifiedTokenSelector,
} from "./components";
import { POPULAR_TOKENS } from "./constants/popularTokens";
import {
  useLiveTokenBalance,
  useOneBalanceBalance,
  useUnifiedSwap,
} from "./hooks";
import {
  selectIsCrossChainSwap,
  selectIsSwapReady,
  selectSwapButtonText,
  useSwapStore,
} from "./store";
import { SwapParams, SwapToken, SwapWalletAccount } from "./types";

// Real-time position streaming
import { usePositionsStream, useSwapStream } from "@/hooks";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ChainId } from "@/types/positionStream";

// Derive supported chain IDs from centralized config
const EVM_CHAIN_IDS: ChainId[] = Object.values(SUPPORTED_CHAINS)
  .filter((c) => c.isEvm)
  .map((c) => c.mobulaChainId as ChainId);

interface SwapModalV2Props {
  visible: boolean;
  onClose: () => void;
  onSwap?: (params: SwapParams) => Promise<void>;
}

export function SwapModalV2({ visible, onClose, onSwap }: SwapModalV2Props) {
  const { theme } = useTheme();
  const { consolidatedWallets, selectedWallet } = useWallet();
  const { currentUser } = useKolStore();

  // Zustand store
  const {
    fromToken,
    toToken,
    fromAmount,
    selectedFromChain,
    selectedToChain,
    quote,
    isLoadingQuote,
    slippage,
    tokenSelectorMode,
    isSwapping,
    setFromAmount,
    setQuote,
    setIsLoadingQuote,
    setSlippage,
    setTokenSelectorMode,
    setIsSwapping,
    swapTokens,
    selectFromTokenWithChain,
    selectToTokenWithChain,
    reset,
    getChainId: getChainIdFromStore,
    setSelectedFromChain,
    setSelectedToChain,
  } = useSwapStore();

  // Auto-detect cross-chain mode from store
  const isCrossChainSwap = selectIsCrossChainSwap(useSwapStore.getState());

  // Portfolio store for triggering refresh after swap
  const triggerPortfolioRefresh = usePortfolioStore(
    (state) => state.triggerPortfolioRefresh,
  );

  // Token balance hook with live updates (chain-specific, used as fallback)
  const { getTokenBalance, refreshBalances, isStreamConnected } =
    useLiveTokenBalance();

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

  // Real-time position streaming for wallet
  const { isConnected: positionsConnected } = usePositionsStream(
    selectedFromChain?.address,
    {
      enabled: visible && !!selectedFromChain?.address,
      chainIds:
        selectedFromChain?.chainName === "Solana"
          ? ["solana:solana"]
          : EVM_CHAIN_IDS,
    },
  );

  // Real-time swap confirmation tracking
  const { lastSwap } = useSwapStream(selectedFromChain?.address, {
    enabled: visible && isSwapping,
    chainId:
      selectedFromChain?.chainName === "Solana" ? "solana:solana" : "evm:1",
    onSwap: (swap) => {
      if (selectedFromChain?.address) {
        refreshBalances([selectedFromChain.address]);
        // Also trigger portfolio refresh for wallet page
        triggerPortfolioRefresh([selectedFromChain.address]);
      }
    },
  });

  // Unified swap hook (OneBalance)
  const {
    quote: fetchedQuote,
    isLoadingQuote: isQuoteLoading,
    quoteError,
    executionState,
    isExecuting,
    isProvisioningSOL,
    rentCheckResult,
    executeSwap,
    resetExecution,
    clearQuote,
    provider: quoteProvider,
  } = useUnifiedSwap({
    fromToken,
    toToken,
    fromAmount,
    slippage,
    selectedFromChain,
    selectedToChain,
  });

  // Sync quote state
  useEffect(() => {
    setQuote(fetchedQuote);
    setIsLoadingQuote(isQuoteLoading);
  }, [fetchedQuote, isQuoteLoading, setQuote, setIsLoadingQuote]);

  // Convert consolidated wallets to SwapWalletAccount array
  const swapAccounts: SwapWalletAccount[] = useMemo(() => {
    const accounts: SwapWalletAccount[] = [];

    consolidatedWallets.forEach((wallet) => {
      if (wallet.walletType === "solana") {
        const network = NETWORKS.solana;
        accounts.push({
          address: wallet.address,
          chainName: network.name,
          chainSymbol: network.symbol,
          chainColor: network.color || "#9945FF",
          chainLogo: network.logo,
          chainIcon: network.icon,
        });
      } else {
        wallet.availableNetworks.forEach((networkKey) => {
          const network = NETWORKS[networkKey as NetworkKey];
          if (network && network.isEvm) {
            accounts.push({
              address: wallet.address,
              chainName: network.name,
              chainSymbol: network.symbol,
              chainColor: network.color || "#627EEA",
              chainLogo: network.logo,
              chainIcon: network.icon,
            });
          }
        });
      }
    });

    return accounts;
  }, [consolidatedWallets]);

  // Initialize selected chains and default USDC from token when modal opens
  useEffect(() => {
    if (visible && swapAccounts.length > 0 && !selectedFromChain) {
      const ethAccount = swapAccounts.find((a) => a.chainName === "Ethereum");
      const defaultAccount = ethAccount || swapAccounts[0];
      setSelectedFromChain(defaultAccount);
      setSelectedToChain(defaultAccount);

      // Set USDC as default from token (primary input for OneBalance)
      if (!fromToken) {
        const chainId =
          defaultAccount.chainName === "Ethereum"
            ? 1
            : defaultAccount.chainName === "Base"
              ? 8453
              : defaultAccount.chainName === "Arbitrum"
                ? 42161
                : defaultAccount.chainName === "Polygon"
                  ? 137
                  : defaultAccount.chainName === "Optimism"
                    ? 10
                    : 1; // Default to Ethereum

        const defaultUsdc = POPULAR_TOKENS.find(
          (t) => t.symbol === "USDC" && t.chainId === chainId,
        );

        if (defaultUsdc) {
          selectFromTokenWithChain(defaultUsdc, defaultAccount);
        }
      }
    }
  }, [
    visible,
    swapAccounts,
    selectedFromChain,
    fromToken,
    setSelectedFromChain,
    setSelectedToChain,
    selectFromTokenWithChain,
  ]);

  // Fetch portfolio when modal opens
  useEffect(() => {
    if (visible && consolidatedWallets.length > 0) {
      const addresses = consolidatedWallets.map((w) => w.address);
      refreshBalances(addresses);

      // Also fetch OneBalance aggregated balances
      refreshOneBalanceBalances(evmAddress, solanaAddress);
    }
  }, [
    visible,
    consolidatedWallets,
    refreshBalances,
    refreshOneBalanceBalances,
    evmAddress,
    solanaAddress,
  ]);

  // Reset on close
  const handleClose = useCallback(() => {
    if (!isSwapping && !isExecuting) {
      reset();
      resetExecution();
      onClose();
    }
  }, [isSwapping, isExecuting, reset, resetExecution, onClose]);

  // Handle unified token + chain selection
  const handleSelectToken = useCallback(
    (token: SwapToken, chain: SwapWalletAccount) => {
      if (tokenSelectorMode === "from") {
        selectFromTokenWithChain(token, chain);
      } else {
        selectToTokenWithChain(token, chain);
      }
      setTokenSelectorMode(null);
    },
    [
      tokenSelectorMode,
      selectFromTokenWithChain,
      selectToTokenWithChain,
      setTokenSelectorMode,
    ],
  );

  // Handle max amount
  const handleMaxPress = useCallback(() => {
    if (!fromToken) {
      console.log("[SwapModalV2] handleMaxPress: No fromToken selected");
      return;
    }

    // Use aggregated balance first, then fall back to chain-specific
    const unifiedBalance = getUnifiedBalance(fromToken);
    const rawBalance = unifiedBalance?.balance || fromToken.balance;

    console.log("[SwapModalV2] handleMaxPress:", {
      token: fromToken.symbol,
      unifiedBalance: unifiedBalance?.balance,
      isAggregated: unifiedBalance?.isAggregated,
      chainCount: unifiedBalance?.chainCount,
      tokenBalance: fromToken.balance,
      rawBalance,
    });

    if (!rawBalance) {
      console.log("[SwapModalV2] handleMaxPress: No balance available");
      // Close modal first so toast is visible
      reset();
      onClose();
      setTimeout(() => {
        toast.error(
          "No Balance",
          "Unable to get token balance. Please try again.",
        );
      }, 300);
      return;
    }

    const balanceNum = parseFloat(rawBalance);
    if (isNaN(balanceNum) || balanceNum <= 0) {
      console.log(
        "[SwapModalV2] handleMaxPress: Balance is zero or invalid",
        balanceNum,
      );
      // Close modal first so toast is visible
      reset();
      onClose();
      setTimeout(() => {
        toast.error("No Balance", "You don't have any balance to swap.");
      }, 300);
      return;
    }

    if (isNativeToken(fromToken)) {
      // Dynamic gas buffer based on chain type
      // Solana: OneBalance charges fees in SOL (~0.000127 SOL) + rent reserves
      // EVM: small gas buffer for transaction fees
      const isSolana = fromToken.chainId === SOLANA_CHAIN_ID;

      let buffer: number;
      if (isSolana) {
        // Solana needs a larger buffer:
        // - Rent for temporary wSOL account (~0.00204 SOL)
        // - OneBalance fee (~0.00015 SOL)
        // - Safety margin for compute budget
        const minBuffer = 0.005; // Minimum to cover rent + fees
        const percentBuffer = balanceNum * 0.03; // 3% of balance
        const standardBuffer = 0.008; // Standard buffer for larger balances
        buffer = Math.max(minBuffer, Math.min(percentBuffer, standardBuffer));
      } else {
        // EVM: Dynamic gas buffer
        const minBuffer = 0.0001; // Absolute minimum to keep for gas
        const percentBuffer = balanceNum * 0.01; // 1% of balance
        const standardBuffer = 0.001; // Standard buffer for larger balances
        buffer = Math.max(minBuffer, Math.min(percentBuffer, standardBuffer));
      }

      const finalAmount = balanceNum - buffer;

      console.log("[SwapModalV2] handleMaxPress native token:", {
        balance: balanceNum,
        buffer,
        finalAmount,
      });

      if (finalAmount <= 0) {
        // Close modal first so toast is visible
        reset();
        onClose();
        setTimeout(() => {
          toast.error(
            "Insufficient Balance",
            `Balance too low. You need at least ${buffer.toFixed(6)} ${fromToken.symbol} for gas.`,
          );
        }, 300);
        return;
      }

      // Check if already at max (within small tolerance) - silent, no toast
      const currentAmount = parseFloat(fromAmount || "0");
      if (Math.abs(currentAmount - finalAmount) < 0.0000001) {
        console.log("[SwapModalV2] handleMaxPress: Already at max");
        return; // Already at max, no need to update or show error
      }

      setFromAmount(finalAmount.toString());
    } else {
      // For non-native tokens, check if already at max - silent, no toast
      if (fromAmount === rawBalance) {
        console.log(
          "[SwapModalV2] handleMaxPress: Already at max (non-native)",
        );
        return;
      }
      // Use raw balance string to preserve full precision and avoid dust
      setFromAmount(rawBalance);
    }
  }, [fromToken, fromAmount, getUnifiedBalance, setFromAmount, reset, onClose]);

  // Handle swap execution
  const handleConfirmSwap = useCallback(async () => {
    if (!fromToken || !toToken || !quote || !selectedFromChain) return;

    // Get all wallet addresses for portfolio refresh
    const allAddresses = consolidatedWallets.map((w) => w.address);

    if (onSwap) {
      try {
        setIsSwapping(true);
        await onSwap({
          fromToken,
          toToken,
          amount: fromAmount,
          quote,
          walletAddress: selectedFromChain.address,
        });
        // Trigger portfolio refresh for wallet page
        triggerPortfolioRefresh(allAddresses);
        reset();
        handleClose();
        toast.success("Swap Successful! 🎉", "Your swap has been completed.");
      } catch (error) {
        console.error("Swap error:", error);
      } finally {
        setIsSwapping(false);
      }
      return;
    }

    setIsSwapping(true);
    try {
      // Use unified OneBalance execution
      const result = await executeSwap();

      console.log("[SwapModalV2] executeSwap result:", result);

      if (result.success) {
        // Trigger portfolio refresh for wallet page
        triggerPortfolioRefresh(allAddresses);

        // Trigger KOL stats sync after delay (allow indexing time)
        triggerKolSyncDelayed(currentUser?.id, 10000);

        reset();
        handleClose();
        // Show toast after modal closes
        setTimeout(() => {
          toast.success(
            "Swap Successful! 🎉",
            `Swapped ${fromAmount} ${fromToken.symbol} for ${quote.outputAmountFormatted} ${toToken.symbol}`,
          );
        }, 300);
      } else {
        // Close modal first, then show error toast
        console.log("[SwapModalV2] Showing error toast:", result.error);
        handleClose();
        setTimeout(() => {
          toast.error("Swap Failed", result.error || "Please try again.");
        }, 300);
      }
    } catch (error) {
      // Handle any unexpected errors that weren't caught by executeSwap
      console.error("[SwapModalV2] Unexpected swap error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      handleClose();
      setTimeout(() => {
        toast.error("Swap Failed", errorMessage);
      }, 300);
    } finally {
      setIsSwapping(false);
    }
  }, [
    fromToken,
    toToken,
    quote,
    fromAmount,
    selectedFromChain,
    consolidatedWallets,
    triggerPortfolioRefresh,
    onSwap,
    executeSwap,
    reset,
    handleClose,
    setIsSwapping,
  ]);

  // Button text and ready state
  const buttonText = selectSwapButtonText(useSwapStore.getState());
  const isReady = selectIsSwapReady(useSwapStore.getState());

  // Get the "other" token for cross-chain indicator in selector
  const otherToken = tokenSelectorMode === "from" ? toToken : fromToken;

  // Enrich tokens with aggregated balance data from OneBalance
  const enrichedFromToken = useMemo(() => {
    if (!fromToken) return null;
    const unifiedBalance = getUnifiedBalance(fromToken);
    if (unifiedBalance) {
      return {
        ...fromToken,
        balance: unifiedBalance.balance,
        balanceUsd: unifiedBalance.balanceUsd,
      };
    }
    return fromToken;
  }, [fromToken, getUnifiedBalance]);

  const enrichedToToken = useMemo(() => {
    if (!toToken) return null;
    const unifiedBalance = getUnifiedBalance(toToken);
    if (unifiedBalance) {
      return {
        ...toToken,
        balance: unifiedBalance.balance,
        balanceUsd: unifiedBalance.balanceUsd,
      };
    }
    return toToken;
  }, [toToken, getUnifiedBalance]);

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
            {/* Unified Token Selector View */}
            {tokenSelectorMode ? (
              <UnifiedTokenSelector
                mode={tokenSelectorMode}
                accounts={swapAccounts}
                onSelectToken={handleSelectToken}
                onClose={() => setTokenSelectorMode(null)}
                getTokenBalance={(token) => {
                  // Use aggregated balance for selector display
                  const unified = getUnifiedBalance(token);
                  if (unified) {
                    return {
                      balance: unified.balance,
                      balanceUsd: unified.balanceUsd,
                    };
                  }
                  return getTokenBalance(token);
                }}
                theme={theme}
                otherToken={otherToken}
              />
            ) : (
              /* Main Swap View */
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
                    <View style={styles.titleContainer}>
                      <Text
                        style={[styles.title, { color: theme.text.primary }]}
                      >
                        Swap
                      </Text>
                      {isCrossChainSwap && (
                        <View
                          style={[
                            styles.crossChainBadge,
                            { backgroundColor: `${theme.primary.DEFAULT}20` },
                          ]}
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={12}
                            color={theme.primary.DEFAULT}
                          />
                          <Text
                            style={[
                              styles.crossChainBadgeText,
                              { color: theme.primary.DEFAULT },
                            ]}
                          >
                            Cross-Chain
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.headerPlaceholder} />
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
                  {/* From Token Input - Uses OneBalance aggregated balance */}
                  <TokenInput
                    label="You Pay"
                    token={enrichedFromToken}
                    amount={fromAmount}
                    isEditable={true}
                    onAmountChange={setFromAmount}
                    onSelectToken={() => setTokenSelectorMode("from")}
                    onMaxPress={handleMaxPress}
                    theme={theme}
                  />

                  {/* Swap Button */}
                  <View style={styles.swapButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.swapIconButton,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={swapTokens}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={24}
                        color={theme.primary.DEFAULT}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* To Token Input - Uses OneBalance aggregated balance */}
                  <TokenInput
                    label="You Receive"
                    token={enrichedToToken}
                    outputAmount={quote?.outputAmountFormatted}
                    outputAmountUsd={quote?.outputAmountUsd}
                    isLoading={isLoadingQuote}
                    isEditable={false}
                    onSelectToken={() => setTokenSelectorMode("to")}
                    theme={theme}
                  />

                  {/* Route Info - Shows cross-chain indicator automatically */}
                  {isCrossChainSwap && fromToken && toToken && (
                    <View
                      style={[
                        styles.routeInfo,
                        {
                          backgroundColor: `${theme.primary.DEFAULT}10`,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="git-branch-outline"
                        size={16}
                        color={theme.primary.DEFAULT}
                      />
                      <Text
                        style={[
                          styles.routeInfoText,
                          { color: theme.text.secondary },
                        ]}
                      >
                        Bridge from {selectedFromChain?.chainName} to{" "}
                        {selectedToChain?.chainName}
                      </Text>
                    </View>
                  )}

                  {/* Quote Details */}
                  {quote && <QuoteDetails quote={quote} theme={theme} />}

                  {/* Slippage Settings */}
                  <SlippageSettings
                    value={slippage}
                    onChange={setSlippage}
                    theme={theme}
                  />

                  {/* Swap Preview with Swipe-to-Confirm */}
                  {quote && fromToken && toToken && isReady ? (
                    <SwapPreviewInline
                      executionState={executionState}
                      isExecuting={isExecuting || isSwapping}
                      isProvisioningSOL={isProvisioningSOL}
                      onConfirm={handleConfirmSwap}
                      theme={theme}
                    />
                  ) : (
                    <View style={styles.actionContainer}>
                      <View
                        style={[
                          styles.disabledButton,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.disabledButtonText,
                            { color: theme.text.muted },
                          ]}
                        >
                          {buttonText}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
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
  scrollView: {
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
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  crossChainBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  crossChainBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  headerPlaceholder: {
    width: 32,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    flexGrow: 1,
  },
  swapButtonContainer: {
    alignItems: "center",
    marginVertical: 4,
    zIndex: 1,
  },
  swapIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  routeInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  routeInfoText: {
    fontSize: 13,
    flex: 1,
  },
  actionContainer: {
    marginTop: 24,
  },
  disabledButton: {
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export type { SwapParams } from "./types";
