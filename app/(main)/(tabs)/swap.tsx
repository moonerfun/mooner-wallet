/**
 * Swap Screen - Dedicated swap tab page
 *
 * This is a full-screen swap interface that replaces the modal version
 * for easier access via the main tab navigation.
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Native token address constant
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
const SOLANA_CHAIN_ID = 792703809;

function isNativeToken(token: { address: string; chainId: number }): boolean {
  if (token.address === NATIVE_TOKEN_ADDRESS) return true;
  if (
    token.chainId === SOLANA_CHAIN_ID &&
    (token.address === SOLANA_NATIVE_ADDRESS ||
      token.address === SOLANA_WRAPPED_SOL_ADDRESS ||
      token.address === "11111111111111111111111111111111")
  )
    return true;
  return false;
}

// Minimum swap amounts
const MIN_SOL_SWAP_AMOUNT = 0.005;
const MIN_EVM_SWAP_AMOUNT = 0.0001;

// Swap module imports
import {
  QuoteDetails,
  SlippageSettings,
  SwapPreviewInline,
  TokenInput,
  UnifiedTokenSelector,
} from "@/components/wallet/swap/components";
import { POPULAR_TOKENS } from "@/components/wallet/swap/constants/popularTokens";
import {
  useLiveTokenBalance,
  useOneBalanceBalance,
  useUnifiedSwap,
} from "@/components/wallet/swap/hooks";
import {
  selectIsCrossChainSwap,
  selectIsSwapReady,
  selectSwapButtonText,
  useSwapStore,
} from "@/components/wallet/swap/store";
import { SwapToken, SwapWalletAccount } from "@/components/wallet/swap/types";

import { usePositionsStream, useSwapStream } from "@/hooks";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ChainId } from "@/types/positionStream";

const EVM_CHAIN_IDS: ChainId[] = Object.values(SUPPORTED_CHAINS)
  .filter((c) => c.isEvm)
  .map((c) => c.mobulaChainId as ChainId);

export default function SwapScreen() {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const insets = useSafeAreaInsets();
  const { consolidatedWallets, selectedWallet } = useWallet();
  const { currentUser } = useKolStore();

  // Calculate bottom padding for tab bar
  const tabBarHeight =
    56 +
    Platform.select({
      android: Math.max(insets.bottom, 16),
      ios: insets.bottom,
      default: insets.bottom,
    });
  const contentPaddingBottom = tabBarHeight + 16;

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
    setSelectedFromChain,
    setSelectedToChain,
  } = useSwapStore();

  const isCrossChainSwap = selectIsCrossChainSwap(useSwapStore.getState());

  const triggerPortfolioRefresh = usePortfolioStore(
    (state) => state.triggerPortfolioRefresh,
  );

  const { getTokenBalance, refreshBalances, isStreamConnected } =
    useLiveTokenBalance();

  const {
    getAggregatedBalance,
    refreshBalances: refreshOneBalanceBalances,
    hasFetched: hasOneBalanceData,
  } = useOneBalanceBalance();

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

  const getUnifiedBalance = useCallback(
    (token: SwapToken) => {
      const oneBalanceData = getAggregatedBalance(token);
      if (oneBalanceData) {
        return {
          balance: oneBalanceData.balance,
          balanceUsd: oneBalanceData.balanceUsd,
          isAggregated: true,
          chainCount: oneBalanceData.chainCount,
        };
      }

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

  const { isConnected: positionsConnected } = usePositionsStream(
    selectedFromChain?.address,
    {
      enabled: !!selectedFromChain?.address,
      chainIds:
        selectedFromChain?.chainName === "Solana"
          ? ["solana:solana"]
          : EVM_CHAIN_IDS,
    },
  );

  const { lastSwap } = useSwapStream(selectedFromChain?.address, {
    enabled: isSwapping,
    chainId:
      selectedFromChain?.chainName === "Solana" ? "solana:solana" : "evm:1",
    onSwap: (swap) => {
      if (selectedFromChain?.address) {
        refreshBalances([selectedFromChain.address]);
        triggerPortfolioRefresh([selectedFromChain.address]);
      }
    },
  });

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

  useEffect(() => {
    setQuote(fetchedQuote);
    setIsLoadingQuote(isQuoteLoading);
  }, [fetchedQuote, isQuoteLoading, setQuote, setIsLoadingQuote]);

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

  // Initialize on mount
  useEffect(() => {
    if (swapAccounts.length > 0 && !selectedFromChain) {
      const ethAccount = swapAccounts.find((a) => a.chainName === "Ethereum");
      const defaultAccount = ethAccount || swapAccounts[0];
      setSelectedFromChain(defaultAccount);
      setSelectedToChain(defaultAccount);

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
                    : 1;

        const defaultUsdc = POPULAR_TOKENS.find(
          (t) => t.symbol === "USDC" && t.chainId === chainId,
        );

        if (defaultUsdc) {
          selectFromTokenWithChain(defaultUsdc, defaultAccount);
        }
      }
    }
  }, [
    swapAccounts,
    selectedFromChain,
    fromToken,
    setSelectedFromChain,
    setSelectedToChain,
    selectFromTokenWithChain,
  ]);

  // Fetch balances
  useEffect(() => {
    if (consolidatedWallets.length > 0) {
      const addresses = consolidatedWallets.map((w) => w.address);
      refreshBalances(addresses);
      refreshOneBalanceBalances(evmAddress, solanaAddress);
    }
  }, [
    consolidatedWallets,
    refreshBalances,
    refreshOneBalanceBalances,
    evmAddress,
    solanaAddress,
  ]);

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

  const handleMaxPress = useCallback(() => {
    if (!fromToken) return;

    const unifiedBalance = getUnifiedBalance(fromToken);
    const rawBalance = unifiedBalance?.balance || fromToken.balance;

    if (!rawBalance) {
      toast.error(
        "No Balance",
        "Unable to get token balance. Please try again.",
      );
      return;
    }

    const balanceNum = parseFloat(rawBalance);
    if (isNaN(balanceNum) || balanceNum <= 0) {
      toast.error("No Balance", "You don't have any balance to swap.");
      return;
    }

    if (isNativeToken(fromToken)) {
      const isSolana = fromToken.chainId === SOLANA_CHAIN_ID;

      let buffer: number;
      if (isSolana) {
        const minBuffer = 0.005;
        const percentBuffer = balanceNum * 0.03;
        const standardBuffer = 0.008;
        buffer = Math.max(minBuffer, Math.min(percentBuffer, standardBuffer));
      } else {
        const minBuffer = 0.0001;
        const percentBuffer = balanceNum * 0.01;
        const standardBuffer = 0.001;
        buffer = Math.max(minBuffer, Math.min(percentBuffer, standardBuffer));
      }

      const finalAmount = balanceNum - buffer;

      if (finalAmount <= 0) {
        toast.error(
          "Insufficient Balance",
          `Balance too low. You need at least ${buffer.toFixed(6)} ${fromToken.symbol} for gas.`,
        );
        return;
      }

      const currentAmount = parseFloat(fromAmount || "0");
      if (Math.abs(currentAmount - finalAmount) < 0.0000001) {
        return;
      }

      setFromAmount(finalAmount.toString());
    } else {
      if (fromAmount === rawBalance) {
        return;
      }
      setFromAmount(rawBalance);
    }
  }, [fromToken, fromAmount, getUnifiedBalance, setFromAmount]);

  const handleConfirmSwap = useCallback(async () => {
    if (!fromToken || !toToken || !quote || !selectedFromChain) return;

    const allAddresses = consolidatedWallets.map((w) => w.address);

    setIsSwapping(true);
    try {
      const result = await executeSwap();

      if (result.success) {
        triggerPortfolioRefresh(allAddresses);
        triggerKolSyncDelayed(currentUser?.id, 10000);
        reset();
        toast.success(
          "Swap Successful! 🎉",
          `Swapped ${fromAmount} ${fromToken.symbol} for ${quote.outputAmountFormatted} ${toToken.symbol}`,
        );
      } else {
        toast.error("Swap Failed", result.error || "Please try again.");
      }
    } catch (error) {
      console.error("[SwapScreen] Unexpected swap error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error("Swap Failed", errorMessage);
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
    executeSwap,
    reset,
    setIsSwapping,
    currentUser,
  ]);

  const buttonText = selectSwapButtonText(useSwapStore.getState());
  const isReady = selectIsSwapReady(useSwapStore.getState());

  const otherToken = tokenSelectorMode === "from" ? toToken : fromToken;

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
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft} />
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
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
        <View style={styles.headerRight} />
      </View>

      {/* Token Selector Overlay */}
      {tokenSelectorMode ? (
        <UnifiedTokenSelector
          mode={tokenSelectorMode}
          accounts={swapAccounts}
          onSelectToken={handleSelectToken}
          onClose={() => setTokenSelectorMode(null)}
          getTokenBalance={(token) => {
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: contentPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            {/* From Token Input */}
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

            {/* To Token Input */}
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

            {/* Route Info */}
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
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 40,
  },
  headerRight: {
    width: 40,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
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
