/**
 * SendModal - Modal for sending crypto
 *
 * New architecture:
 * 1. Select Wallet Type (Solana or EVM)
 * 2. For EVM: Select Network (determines gas token and explorer)
 * 3. Select Token from available tokens on that network
 * 4. Enter recipient and amount
 */

import { Button } from "@/components/ui/Button";
import { ChainIcon } from "@/components/ui/ChainIcon";
import { SwipeToConfirm } from "@/components/ui/SwipeToConfirm";
import { toast } from "@/components/ui/Toast";
import { findCrossChainBalanceKey, SUPPORTED_CHAINS } from "@/constants/chains";
import { useTheme } from "@/contexts/ThemeContext";
import { NetworkKey, NETWORKS } from "@/constants/turnkey";
import { ConsolidatedWallet, useWallet } from "@/contexts/WalletContext";
import { useMultiWalletPortfolio } from "@/hooks";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { executeSend, validateSendParams } from "@/lib/services/sendService";
import { PortfolioAsset, usePortfolioStore } from "@/store/portfolioStore";
import { Ionicons } from "@expo/vector-icons";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Fallback logos for common tokens (when Mobula API doesn't return them)
// Native token logos are derived from centralized chain config
const FALLBACK_TOKEN_LOGOS: Record<string, string> = {
  SOL: SUPPORTED_CHAINS.solana.logo,
  ETH: SUPPORTED_CHAINS.ethereum.logo,
  BNB: SUPPORTED_CHAINS.bnb.logo,
  // Stablecoins use their own logos (not chain-specific)
  USDC: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
};

// Helper to get token logo with fallback
// Prioritize fallback for known tokens since Mobula's URLs can be broken
const getTokenLogo = (token: PortfolioAsset): string | undefined => {
  // First check if we have a reliable fallback for this token
  const fallback = FALLBACK_TOKEN_LOGOS[token.symbol.toUpperCase()];
  if (fallback) return fallback;
  // Otherwise use the API-provided logo
  return token.logo;
};

interface SendModalProps {
  visible: boolean;
  onClose: () => void;
  onSend?: (params: SendParams) => Promise<void>;
}

export interface SendParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  network: NetworkKey;
  networkName: string;
  tokenSymbol?: string;
  tokenAddress?: string;
}

export function SendModal({ visible, onClose, onSend }: SendModalProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const {
    consolidatedWallets,
    formatAddress,
    selectedWallet: turnkeySelectedWallet,
  } = useWallet();

  // Turnkey hooks for signing transactions
  const { signTransaction, signAndSendTransaction } = useTurnkey();

  // Portfolio store for triggering refresh after send
  const triggerPortfolioRefresh = usePortfolioStore(
    (state) => state.triggerPortfolioRefresh,
  );

  // Fetch portfolio for all wallet addresses
  const walletAddresses = React.useMemo(
    () => consolidatedWallets.map((w) => w.address).filter(Boolean),
    [consolidatedWallets],
  );
  const { portfolios, isLoading: isLoadingPortfolio } =
    useMultiWalletPortfolio(walletAddresses);

  // Get tokens available on a specific network
  const getNetworkTokens = useCallback(
    (network: NetworkKey): PortfolioAsset[] => {
      if (!portfolios || portfolios.length === 0) return [];

      const networkConfig = NETWORKS[network];
      const tokens: PortfolioAsset[] = [];

      for (const portfolio of portfolios) {
        for (const asset of portfolio.assets) {
          // Check if asset exists on this network using alias matching
          // Handles Mobula chain names like "BNB Smart Chain (BEP20)"
          const crossChainKey = findCrossChainBalanceKey(
            asset.crossChainBalances,
            network,
          );
          const chainBalance = crossChainKey
            ? asset.crossChainBalances?.[crossChainKey]
            : undefined;

          if (chainBalance && chainBalance.balance > 0) {
            // Add with network-specific balance
            tokens.push({
              ...asset,
              balance: chainBalance.balance,
              valueUsd: asset.price * chainBalance.balance,
            });
          } else if (
            asset.blockchains?.some(
              (b: string) =>
                b.toLowerCase() === networkConfig.name.toLowerCase(),
            ) &&
            asset.balance > 0
          ) {
            tokens.push(asset);
          }
        }
      }

      // Remove duplicates by symbol
      const seen = new Set<string>();
      return tokens.filter((t) => {
        if (seen.has(t.symbol)) return false;
        seen.add(t.symbol);
        return true;
      });
    },
    [portfolios],
  );

  // Get native token balance for a network
  const getNetworkNativeBalance = useCallback(
    (network: NetworkKey) => {
      if (!portfolios || portfolios.length === 0) return null;

      const networkConfig = NETWORKS[network];
      const nativeSymbol = networkConfig.symbol;

      for (const portfolio of portfolios) {
        for (const asset of portfolio.assets) {
          // Use alias matching to find the balance for this network
          const crossChainKey = findCrossChainBalanceKey(
            asset.crossChainBalances,
            network,
          );
          const chainBalance = crossChainKey
            ? asset.crossChainBalances?.[crossChainKey]
            : undefined;

          if (chainBalance && asset.symbol === nativeSymbol) {
            return {
              balance: chainBalance.balance,
              valueUsd: asset.price * chainBalance.balance,
              symbol: asset.symbol,
            };
          }
        }
      }
      return null;
    },
    [portfolios],
  );

  // Form state
  const [selectedWallet, setSelectedWallet] =
    useState<ConsolidatedWallet | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey | null>(
    null,
  );
  const [selectedToken, setSelectedToken] = useState<PortfolioAsset | null>(
    null,
  );
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Validation state
  const [addressError, setAddressError] = useState("");
  const [amountError, setAmountError] = useState("");

  // Select first wallet by default when modal opens
  React.useEffect(() => {
    if (visible && consolidatedWallets.length > 0 && !selectedWallet) {
      const firstWallet = consolidatedWallets[0];
      setSelectedWallet(firstWallet);
      if (firstWallet.availableNetworks.length > 0) {
        setSelectedNetwork(firstWallet.availableNetworks[0]);
      }
    }
  }, [visible, consolidatedWallets]);

  // Validate address based on wallet type
  const validateAddress = useCallback(
    (address: string, wallet?: ConsolidatedWallet) => {
      if (!address.trim()) {
        return "Recipient address is required";
      }

      if (!wallet) return "";

      // Basic validation patterns
      if (wallet.walletType === "evm") {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          return "Invalid EVM address format";
        }
      } else if (wallet.walletType === "solana") {
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
          return "Invalid Solana address format";
        }
      }

      return "";
    },
    [],
  );

  // Validate amount
  const validateAmount = useCallback((value: string) => {
    if (!value.trim()) {
      return "Amount is required";
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      return "Please enter a valid amount";
    }

    return "";
  }, []);

  // Handle wallet selection
  const handleSelectWallet = useCallback((wallet: ConsolidatedWallet) => {
    setSelectedWallet(wallet);
    setSelectedToken(null); // Reset token when wallet changes
    setAddressError("");
    setRecipientAddress("");
    // Auto-select first network
    if (wallet.availableNetworks.length > 0) {
      setSelectedNetwork(wallet.availableNetworks[0]);
    } else {
      setSelectedNetwork(null);
    }
  }, []);

  // Handle network selection
  const handleSelectNetwork = useCallback((network: NetworkKey) => {
    setSelectedNetwork(network);
    setSelectedToken(null); // Reset token when network changes
  }, []);

  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    const clipboardContent = await Clipboard.getStringAsync();
    if (clipboardContent) {
      setRecipientAddress(clipboardContent);
      if (selectedWallet) {
        const error = validateAddress(clipboardContent, selectedWallet);
        setAddressError(error);
      }
    }
  }, [selectedWallet, validateAddress]);

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
      const str = value.toFixed(18);
      const match = str.match(/^0\.0*/);
      if (match) {
        const leadingZeros = match[0].length - 2;
        return value.toFixed(Math.min(leadingZeros + 6, 18));
      }
      return value.toFixed(8);
    }
  }, []);

  // Handle max amount - set to full balance of selected token
  const handleMax = useCallback(() => {
    if (!selectedNetwork) {
      toast.error("Error", "Please select a network first");
      return;
    }

    console.log("[SendModal] handleMax:", {
      selectedNetwork,
      selectedToken: selectedToken?.symbol,
      selectedTokenBalance: selectedToken?.balance,
    });

    // Helper to close modal and show error toast
    const showErrorAndClose = (title: string, message: string) => {
      onClose();
      setTimeout(() => {
        toast.error(title, message);
      }, 300);
    };

    // If a token is selected, use its balance
    if (selectedToken) {
      const balance = selectedToken.balance;
      if (balance === undefined || balance === null || balance <= 0) {
        showErrorAndClose("No Balance", "You don't have any balance to send.");
        return;
      }

      // For native tokens, leave dynamic gas buffer
      const isNative = ["ETH", "SOL", "BNB", "AVAX", "POL", "MATIC"].includes(
        selectedToken.symbol,
      );

      if (isNative) {
        // Dynamic gas buffer: use 1% of balance or 0.001, whichever is smaller
        const minBuffer = 0.0001;
        const percentBuffer = balance * 0.01;
        const standardBuffer = 0.001;
        const gasBuffer = Math.max(
          minBuffer,
          Math.min(percentBuffer, standardBuffer),
        );
        const maxAmount = balance - gasBuffer;

        if (maxAmount <= 0) {
          showErrorAndClose(
            "Insufficient Balance",
            `Balance too low. You need at least ${gasBuffer.toFixed(6)} ${selectedToken.symbol} for gas.`,
          );
          return;
        }

        setAmount(formatSmallAmount(maxAmount));
      } else {
        // Non-native tokens: use full balance
        setAmount(formatSmallAmount(balance));
      }
      setAmountError("");
      return;
    }

    // Fallback to native token balance
    const balance = getNetworkNativeBalance(selectedNetwork);
    if (balance && balance.balance > 0) {
      // Dynamic gas buffer for native token
      const minBuffer = 0.0001;
      const percentBuffer = balance.balance * 0.01;
      const standardBuffer = 0.001;
      const gasBuffer = Math.max(
        minBuffer,
        Math.min(percentBuffer, standardBuffer),
      );
      const maxAmount = balance.balance - gasBuffer;

      if (maxAmount <= 0) {
        showErrorAndClose(
          "Insufficient Balance",
          `Balance too low. You need at least ${gasBuffer.toFixed(6)} for gas.`,
        );
        return;
      }

      setAmount(formatSmallAmount(maxAmount));
      setAmountError("");
    } else {
      showErrorAndClose("No Balance", "No balance found for this wallet.");
    }
  }, [
    selectedNetwork,
    selectedToken,
    getNetworkNativeBalance,
    formatSmallAmount,
    onClose,
  ]);

  // Handle address change
  const handleAddressChange = useCallback(
    (text: string) => {
      setRecipientAddress(text);
      if (text.length > 10 && selectedWallet) {
        const error = validateAddress(text, selectedWallet);
        setAddressError(error);
      } else {
        setAddressError("");
      }
    },
    [selectedWallet, validateAddress],
  );

  // Handle amount change
  const handleAmountChange = useCallback(
    (text: string) => {
      // Only allow valid number input
      const filtered = text.replace(/[^0-9.]/g, "");
      // Prevent multiple decimal points
      const parts = filtered.split(".");
      const formatted =
        parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
      setAmount(formatted);

      if (formatted) {
        const error = validateAmount(formatted);
        setAmountError(error);
      } else {
        setAmountError("");
      }
    },
    [validateAmount],
  );

  // Handle review transaction
  const handleReview = useCallback(() => {
    // Validate all fields
    const addrError = validateAddress(recipientAddress, selectedWallet!);
    const amtError = validateAmount(amount);

    setAddressError(addrError);
    setAmountError(amtError);

    if (!addrError && !amtError && selectedWallet && selectedNetwork) {
      setShowConfirmation(true);
    }
  }, [
    recipientAddress,
    amount,
    selectedWallet,
    selectedNetwork,
    validateAddress,
    validateAmount,
  ]);

  // Get current network config (must be before handleConfirmSend)
  const currentNetworkConfig = selectedNetwork
    ? NETWORKS[selectedNetwork]
    : null;

  // Handle send confirmation
  const handleConfirmSend = useCallback(async () => {
    if (!selectedWallet || !selectedNetwork) {
      toast.error("Error", "Please select a wallet and network");
      setShowConfirmation(false);
      return;
    }

    // Get the Turnkey wallet account for signing
    const walletAccount = turnkeySelectedWallet?.accounts?.find(
      (acc: any) => acc.address === selectedWallet.address,
    );

    if (!walletAccount) {
      toast.error(
        "Error",
        "Unable to find wallet account for signing. Please try again.",
      );
      setShowConfirmation(false);
      return;
    }

    try {
      setIsSending(true);

      const networkConfig = NETWORKS[selectedNetwork];

      // Validate send params
      const validationError = validateSendParams({
        fromAddress: selectedWallet.address,
        toAddress: recipientAddress,
        amount,
        network: selectedNetwork,
        tokenSymbol: selectedToken?.symbol,
        tokenAddress: selectedToken?.address,
        tokenDecimals: selectedToken?.decimals,
      });

      if (validationError) {
        toast.error("Validation Error", validationError);
        setIsSending(false);
        return;
      }

      // Create turnkey hooks adapter
      const turnkeyHooks = {
        signTransaction,
        signAndSendTransaction,
      };

      // Execute the send transaction
      const result = await executeSend(
        {
          fromAddress: selectedWallet.address,
          toAddress: recipientAddress,
          amount,
          network: selectedNetwork,
          tokenSymbol: selectedToken?.symbol,
          tokenAddress: selectedToken?.address,
          tokenDecimals: selectedToken?.decimals,
        },
        walletAccount,
        turnkeyHooks,
      );

      if (result.success) {
        // Trigger portfolio refresh for wallet page
        if (selectedWallet?.address) {
          triggerPortfolioRefresh([selectedWallet.address]);
        }

        // Reset form on success
        setRecipientAddress("");
        setAmount("");
        setSelectedToken(null);
        setShowConfirmation(false);
        onClose();

        // Show success toast
        const tokenSymbolDisplay =
          selectedToken?.symbol || currentNetworkConfig?.symbol || "";
        toast.success(
          "Transaction Sent! 🎉",
          `${amount} ${tokenSymbolDisplay} sent successfully`,
        );

        // Also call onSend callback if provided (for external handling)
        if (onSend) {
          await onSend({
            fromAddress: selectedWallet.address,
            toAddress: recipientAddress,
            amount,
            network: selectedNetwork,
            networkName: networkConfig.name,
            tokenSymbol: selectedToken?.symbol,
            tokenAddress: selectedToken?.address,
          });
        }
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("[SendModal] Send error:", error);
      toast.error(
        "Transaction Failed",
        error instanceof Error
          ? error.message
          : "Failed to send transaction. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }, [
    selectedWallet,
    selectedNetwork,
    recipientAddress,
    amount,
    selectedToken,
    currentNetworkConfig,
    turnkeySelectedWallet,
    signTransaction,
    signAndSendTransaction,
    onSend,
    onClose,
  ]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSending) {
      setRecipientAddress("");
      setAmount("");
      setAddressError("");
      setAmountError("");
      setShowConfirmation(false);
      setSelectedWallet(null);
      setSelectedNetwork(null);
      setSelectedToken(null);
      setShowTokenSelector(false);
      onClose();
    }
  }, [isSending, onClose]);

  // Render confirmation view
  const renderConfirmation = () => (
    <View style={styles.confirmationContainer}>
      <View
        style={[
          styles.confirmationCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.confirmationHeader}>
          <View
            style={[
              styles.confirmationIcon,
              { backgroundColor: `${theme.primary.DEFAULT}20` },
            ]}
          >
            <Ionicons name="arrow-up" size={32} color={theme.primary.DEFAULT} />
          </View>
          <Text
            style={[styles.confirmationTitle, { color: theme.text.primary }]}
          >
            Confirm Transaction
          </Text>
        </View>

        <View
          style={[styles.confirmationRow, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[styles.confirmationLabel, { color: theme.text.secondary }]}
          >
            From
          </Text>
          <Text
            style={[styles.confirmationValue, { color: theme.text.primary }]}
          >
            {formatAddress(selectedWallet?.address || "", 8, 6)}
          </Text>
        </View>

        <View
          style={[styles.confirmationRow, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[styles.confirmationLabel, { color: theme.text.secondary }]}
          >
            To
          </Text>
          <Text
            style={[styles.confirmationValue, { color: theme.text.primary }]}
          >
            {formatAddress(recipientAddress, 8, 6)}
          </Text>
        </View>

        <View
          style={[styles.confirmationRow, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[styles.confirmationLabel, { color: theme.text.secondary }]}
          >
            Amount
          </Text>
          <Text
            style={[styles.confirmationAmount, { color: theme.text.primary }]}
          >
            {amount} {selectedToken?.symbol || currentNetworkConfig?.symbol}
          </Text>
        </View>

        <View style={[styles.confirmationRow, { borderBottomWidth: 0 }]}>
          <Text
            style={[styles.confirmationLabel, { color: theme.text.secondary }]}
          >
            Network
          </Text>
          <View style={styles.networkBadge}>
            <ChainIcon
              chainName={currentNetworkConfig?.name || ""}
              logoUrl={currentNetworkConfig?.logo}
              fallbackIcon={currentNetworkConfig?.icon}
              size={18}
            />
            <Text
              style={[styles.networkBadgeName, { color: theme.text.primary }]}
            >
              {currentNetworkConfig?.name}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.gasEstimate,
            { backgroundColor: `${theme.text.muted}10` },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.text.muted}
          />
          <Text style={[styles.gasText, { color: theme.text.secondary }]}>
            Network fee will be calculated before broadcast
          </Text>
        </View>

        {/* Cancel button */}
        <TouchableOpacity
          onPress={() => setShowConfirmation(false)}
          style={[styles.cancelButton, { borderColor: theme.border }]}
          disabled={isSending}
        >
          <Text
            style={[styles.cancelButtonText, { color: theme.text.secondary }]}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        {/* Swipe to Confirm */}
        <View style={styles.swipeContainer}>
          <SwipeToConfirm
            onConfirm={handleConfirmSend}
            label={`Swipe to send ${amount} ${selectedToken?.symbol || currentNetworkConfig?.symbol || ""}`}
            confirmLabel="Release to send"
            loading={isSending}
            loadingLabel="Sending..."
            disabled={isSending}
            theme={theme}
          />
        </View>
      </View>
    </View>
  );

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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              style={[styles.container, { backgroundColor: theme.background }]}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              {/* Header */}
              <View
                style={[styles.header, { borderBottomColor: theme.border }]}
              >
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  disabled={isSending}
                >
                  <Ionicons name="close" size={24} color={theme.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text.primary }]}>
                  Send
                </Text>
                <View style={styles.placeholder} />
              </View>

              {showConfirmation ? (
                renderConfirmation()
              ) : (
                <ScrollView
                  contentContainerStyle={styles.content}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Wallet Type Selector */}
                  <View style={styles.section}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: theme.text.secondary },
                      ]}
                    >
                      From Wallet
                    </Text>
                    <View style={styles.walletTypeList}>
                      {consolidatedWallets.map((wallet) => (
                        <TouchableOpacity
                          key={wallet.walletType}
                          onPress={() => handleSelectWallet(wallet)}
                          style={[
                            styles.walletTypeButton,
                            {
                              backgroundColor:
                                selectedWallet?.walletType === wallet.walletType
                                  ? `${wallet.color}20`
                                  : theme.surface,
                              borderColor:
                                selectedWallet?.walletType === wallet.walletType
                                  ? wallet.color
                                  : theme.border,
                            },
                          ]}
                        >
                          <ChainIcon
                            chainName={wallet.walletTypeName}
                            logoUrl={wallet.logo}
                            fallbackIcon={wallet.icon}
                            size={24}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.walletTypeName,
                                {
                                  color:
                                    selectedWallet?.walletType ===
                                    wallet.walletType
                                      ? wallet.color
                                      : theme.text.primary,
                                },
                              ]}
                            >
                              {wallet.walletTypeName}
                            </Text>
                            <Text
                              style={[
                                styles.walletAddress,
                                { color: theme.text.secondary },
                              ]}
                            >
                              {formatAddress(wallet.address)}
                            </Text>
                          </View>
                          {selectedWallet?.walletType === wallet.walletType && (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={wallet.color}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Network Selector (for EVM wallets) */}
                  {selectedWallet?.walletType === "evm" && (
                    <View style={styles.section}>
                      <Text
                        style={[
                          styles.sectionLabel,
                          { color: theme.text.secondary },
                        ]}
                      >
                        Network
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.networkList}
                      >
                        {selectedWallet.availableNetworks.map((networkKey) => {
                          const network = NETWORKS[networkKey];
                          const isSelected = selectedNetwork === networkKey;
                          const balance = getNetworkNativeBalance(networkKey);
                          return (
                            <TouchableOpacity
                              key={networkKey}
                              onPress={() => handleSelectNetwork(networkKey)}
                              style={[
                                styles.networkButton,
                                {
                                  backgroundColor: isSelected
                                    ? `${network.color}20`
                                    : theme.surface,
                                  borderColor: isSelected
                                    ? network.color
                                    : theme.border,
                                },
                              ]}
                            >
                              <ChainIcon
                                chainName={network.name}
                                logoUrl={network.logo}
                                fallbackIcon={network.icon}
                                size={18}
                              />
                              <View>
                                <Text
                                  style={[
                                    styles.networkName,
                                    {
                                      color: isSelected
                                        ? network.color
                                        : theme.text.primary,
                                    },
                                  ]}
                                >
                                  {network.name}
                                </Text>
                                {balance && (
                                  <Text
                                    style={[
                                      styles.networkBalance,
                                      { color: theme.text.secondary },
                                    ]}
                                  >
                                    {balance.balance.toFixed(4)}{" "}
                                    {balance.symbol}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Recipient Address */}
                  <View style={styles.section}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Recipient Address
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: theme.surface,
                          borderColor: addressError
                            ? theme.error
                            : theme.border,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: theme.text.primary }]}
                        placeholder={`Enter ${selectedWallet?.walletTypeName || ""} address`}
                        placeholderTextColor={theme.text.muted}
                        value={recipientAddress}
                        onChangeText={handleAddressChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
                        numberOfLines={2}
                      />
                      <TouchableOpacity
                        onPress={handlePaste}
                        style={[
                          styles.actionButton,
                          { backgroundColor: theme.primary.DEFAULT },
                        ]}
                      >
                        <Ionicons
                          name="clipboard-outline"
                          size={18}
                          color="#FFF"
                        />
                      </TouchableOpacity>
                    </View>
                    {addressError ? (
                      <Text style={[styles.errorText, { color: theme.error }]}>
                        {addressError}
                      </Text>
                    ) : null}
                  </View>

                  {/* Amount & Token Selection */}
                  <View style={styles.section}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Token & Amount
                    </Text>

                    {/* Token Selector */}
                    <TouchableOpacity
                      onPress={() =>
                        selectedNetwork && setShowTokenSelector(true)
                      }
                      style={[
                        styles.tokenSelectorButton,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                      disabled={!selectedNetwork}
                    >
                      {selectedToken ? (
                        (() => {
                          const selectedLogoUrl = getTokenLogo(selectedToken);
                          return (
                            <View style={styles.selectedTokenInfo}>
                              {selectedLogoUrl ? (
                                <Image
                                  source={{ uri: selectedLogoUrl }}
                                  style={styles.tokenLogo}
                                  contentFit="cover"
                                  transition={200}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.tokenLogoPlaceholder,
                                    { backgroundColor: theme.border },
                                  ]}
                                >
                                  <Text style={{ color: theme.text.muted }}>
                                    {selectedToken.symbol.charAt(0)}
                                  </Text>
                                </View>
                              )}
                              <View>
                                <Text
                                  style={[
                                    styles.tokenSymbolText,
                                    { color: theme.text.primary },
                                  ]}
                                >
                                  {selectedToken.symbol}
                                </Text>
                                <Text
                                  style={[
                                    styles.tokenBalanceSmall,
                                    { color: theme.text.secondary },
                                  ]}
                                >
                                  {selectedToken.balance.toFixed(6)} available
                                </Text>
                              </View>
                            </View>
                          );
                        })()
                      ) : (
                        <Text
                          style={[
                            styles.selectTokenPlaceholder,
                            { color: theme.text.muted },
                          ]}
                        >
                          {selectedNetwork
                            ? "Select token to send"
                            : "Select wallet first"}
                        </Text>
                      )}
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>

                    {/* Amount Input */}
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: theme.surface,
                          borderColor: amountError ? theme.error : theme.border,
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.input,
                          styles.amountInput,
                          { color: theme.text.primary },
                        ]}
                        placeholder="0.00"
                        placeholderTextColor={theme.text.muted}
                        value={amount}
                        onChangeText={handleAmountChange}
                        keyboardType="decimal-pad"
                      />
                      <View style={styles.amountSuffix}>
                        <Text
                          style={[
                            styles.symbolText,
                            { color: theme.text.primary },
                          ]}
                        >
                          {selectedToken?.symbol ||
                            currentNetworkConfig?.symbol ||
                            ""}
                        </Text>
                        <TouchableOpacity
                          onPress={handleMax}
                          style={[
                            styles.maxButton,
                            { backgroundColor: `${theme.primary.DEFAULT}20` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.maxButtonText,
                              { color: theme.primary.DEFAULT },
                            ]}
                          >
                            MAX
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {amountError ? (
                      <Text style={[styles.errorText, { color: theme.error }]}>
                        {amountError}
                      </Text>
                    ) : null}

                    {/* Balance Display */}
                    <Text
                      style={[styles.balanceText, { color: theme.text.muted }]}
                    >
                      Available:{" "}
                      {selectedToken
                        ? `${selectedToken.balance.toFixed(6)} ${selectedToken.symbol} (${formatUSD(selectedToken.valueUsd)})`
                        : selectedNetwork
                          ? (() => {
                              const balance =
                                getNetworkNativeBalance(selectedNetwork);
                              if (balance) {
                                return `${balance.balance.toFixed(6)} ${balance.symbol} (${formatUSD(balance.valueUsd)})`;
                              }
                              return `0.00 ${currentNetworkConfig?.symbol || ""}`;
                            })()
                          : "--"}
                    </Text>
                  </View>

                  {/* Token Selector Modal */}
                  <Modal
                    visible={showTokenSelector}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowTokenSelector(false)}
                  >
                    <View
                      style={[
                        styles.tokenSelectorModal,
                        { backgroundColor: theme.background },
                      ]}
                    >
                      <View
                        style={[
                          styles.tokenSelectorHeader,
                          { borderBottomColor: theme.border },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => setShowTokenSelector(false)}
                        >
                          <Ionicons
                            name="close"
                            size={24}
                            color={theme.text.primary}
                          />
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.tokenSelectorTitle,
                            { color: theme.text.primary },
                          ]}
                        >
                          Select Token
                        </Text>
                        <View style={{ width: 24 }} />
                      </View>
                      <ScrollView style={styles.tokenList}>
                        {selectedNetwork &&
                          getNetworkTokens(selectedNetwork).map(
                            (token, index) => {
                              const logoUrl = getTokenLogo(token);
                              return (
                                <TouchableOpacity
                                  key={`${token.symbol}-${index}`}
                                  style={[
                                    styles.tokenRow,
                                    { borderBottomColor: theme.border },
                                  ]}
                                  onPress={() => {
                                    setSelectedToken(token);
                                    setShowTokenSelector(false);
                                  }}
                                >
                                  {logoUrl ? (
                                    <Image
                                      source={{ uri: logoUrl }}
                                      style={styles.tokenLogo}
                                      contentFit="cover"
                                      transition={200}
                                    />
                                  ) : (
                                    <View
                                      style={[
                                        styles.tokenLogoPlaceholder,
                                        { backgroundColor: theme.border },
                                      ]}
                                    >
                                      <Text style={{ color: theme.text.muted }}>
                                        {token.symbol.charAt(0)}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={styles.tokenInfo}>
                                    <Text
                                      style={[
                                        styles.tokenSymbolText,
                                        { color: theme.text.primary },
                                      ]}
                                    >
                                      {token.symbol}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.tokenNameText,
                                        { color: theme.text.secondary },
                                      ]}
                                    >
                                      {token.name}
                                    </Text>
                                  </View>
                                  <View style={styles.tokenBalanceInfo}>
                                    <Text
                                      style={[
                                        styles.tokenBalanceAmount,
                                        { color: theme.text.primary },
                                      ]}
                                    >
                                      {token.balance.toFixed(6)}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.tokenBalanceUsd,
                                        { color: theme.text.secondary },
                                      ]}
                                    >
                                      {formatUSD(token.valueUsd)}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            },
                          )}
                        {selectedNetwork &&
                          getNetworkTokens(selectedNetwork).length === 0 && (
                            <View style={styles.emptyTokens}>
                              <Ionicons
                                name="wallet-outline"
                                size={48}
                                color={theme.text.muted}
                              />
                              <Text
                                style={[
                                  styles.emptyTokensText,
                                  { color: theme.text.secondary },
                                ]}
                              >
                                No tokens found on{" "}
                                {currentNetworkConfig?.name || "this network"}
                              </Text>
                            </View>
                          )}
                      </ScrollView>
                    </View>
                  </Modal>

                  {/* Review Button */}
                  <View style={styles.buttonContainer}>
                    <Button
                      title="Review Transaction"
                      variant="primary"
                      onPress={handleReview}
                      fullWidth
                      disabled={
                        !recipientAddress ||
                        !amount ||
                        !!addressError ||
                        !!amountError
                      }
                    />
                  </View>

                  {/* Warning */}
                  <View
                    style={[
                      styles.warningContainer,
                      { backgroundColor: `${theme.warning}15` },
                    ]}
                  >
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={theme.warning}
                    />
                    <Text
                      style={[styles.warningText, { color: theme.warning }]}
                    >
                      Always double-check the recipient address. Transactions
                      cannot be reversed once confirmed.
                    </Text>
                  </View>
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
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
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
  },
  // Wallet type selector styles
  walletTypeList: {
    gap: 12,
  },
  walletTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  walletTypeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  walletAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  // Network selector styles
  networkList: {
    gap: 10,
  },
  networkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    minWidth: 100,
  },
  networkName: {
    fontSize: 13,
    fontWeight: "500",
  },
  networkBalance: {
    fontSize: 10,
    marginTop: 2,
  },
  // Legacy chain styles (kept for compatibility)
  chainList: {
    gap: 12,
  },
  chainButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  chainButtonWithBalance: {
    paddingVertical: 8,
    minWidth: 100,
  },
  chainInfo: {
    flexDirection: "column",
  },
  chainIcon: {
    fontSize: 18,
  },
  chainName: {
    fontSize: 14,
    fontWeight: "600",
  },
  chainBalance: {
    fontSize: 11,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 24,
  },
  amountInput: {
    fontSize: 24,
    fontWeight: "600",
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  amountSuffix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: "600",
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  balanceText: {
    fontSize: 13,
    marginTop: 10,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  // Confirmation styles
  confirmationContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  confirmationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  confirmationHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  confirmationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  confirmationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  confirmationLabel: {
    fontSize: 14,
  },
  confirmationValue: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  confirmationAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkBadgeIcon: {
    fontSize: 16,
  },
  networkBadgeName: {
    fontSize: 14,
    fontWeight: "500",
  },
  gasEstimate: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  gasText: {
    flex: 1,
    fontSize: 12,
  },
  confirmationButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  swipeContainer: {
    marginTop: 16,
  },
  // Token selector styles
  tokenSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectedTokenInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tokenLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenSymbolText: {
    fontSize: 16,
    fontWeight: "600",
  },
  tokenBalanceSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  selectTokenPlaceholder: {
    fontSize: 15,
  },
  tokenSelectorModal: {
    flex: 1,
  },
  tokenSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  tokenSelectorTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  tokenList: {
    flex: 1,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenNameText: {
    fontSize: 13,
    marginTop: 2,
  },
  tokenBalanceInfo: {
    alignItems: "flex-end",
  },
  tokenBalanceAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  tokenBalanceUsd: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyTokens: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTokensText: {
    fontSize: 14,
    textAlign: "center",
  },
});
