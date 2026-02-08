/**
 * Wallet Settings Component
 * Provides wallet management including switching, creating, and exporting wallets
 */

import { Button, Card } from "@/components";
import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CHAINS,
  DEFAULT_WALLET_CONFIG,
  NETWORKS,
  NetworkKey,
} from "@/constants/turnkey";
import { useWallet } from "@/contexts/WalletContext";
import { getUserIdFromWallet, linkWalletToUser } from "@/lib/kol/kolTradeService";
import { useSettingsStore } from "@/store";
import { usePortfolioStore } from "@/store/portfolioStore";
import { Ionicons } from "@expo/vector-icons";
import { bs58, uint8ArrayFromHexString } from "@turnkey/encoding";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Convert a hex private key to Solana-compatible base58 format
 * Phantom/Solflare expect: 32 bytes private key + 32 bytes public key = 64 bytes, base58 encoded
 * @param hexPrivateKey - The 32-byte private key in hex format (with or without 0x prefix)
 * @param solanaAddress - The Solana address (base58 encoded public key)
 * @returns The private key in Solana-compatible format for import into Phantom/Solflare
 */
function convertToSolanaPrivateKey(
  hexPrivateKey: string,
  solanaAddress: string,
): string {
  try {
    // Remove 0x prefix if present
    const cleanHex = hexPrivateKey.startsWith("0x")
      ? hexPrivateKey.slice(2)
      : hexPrivateKey;

    // Convert hex private key to Uint8Array (32 bytes)
    const privateKeyBytes = uint8ArrayFromHexString(cleanHex);

    // Decode the Solana address (which is the base58-encoded public key) to get public key bytes (32 bytes)
    const publicKeyBytes = bs58.decode(solanaAddress);

    // Concatenate private key + public key (64 bytes total)
    const fullKeypair = new Uint8Array(64);
    fullKeypair.set(privateKeyBytes, 0);
    fullKeypair.set(publicKeyBytes, 32);

    // Base58 encode the full keypair
    return bs58.encode(fullKeypair);
  } catch (error) {
    console.error("Error converting to Solana private key format:", error);
    throw new Error("Failed to convert private key to Solana format");
  }
}

interface WalletSettingsProps {
  onWalletChange?: () => void;
}

type ExportType = "private_key" | "recovery_phrase";

interface ExportTarget {
  type: ExportType;
  address?: string;
  chainName?: string;
  addressFormat?: string;
}

export function WalletSettings({ onWalletChange }: WalletSettingsProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const {
    wallets: contextWallets,
    accounts,
    consolidatedWallets,
    setWallets,
    setAccounts,
    formatAddress,
    selectedWallet,
    setSelectedWallet,
  } = useWallet();

  // Persist wallet selection
  const setSelectedWalletId = useSettingsStore((s) => s.setSelectedWalletId);

  // Clear portfolio when switching wallets
  const clearPortfolio = usePortfolioStore((s) => s.clearPortfolio);

  const {
    wallets: turnkeyWallets,
    createWallet,
    createWalletAccounts,
    fetchWallets,
    fetchWalletAccounts,
    exportWallet,
    exportWalletAccount,
    refreshWallets,
  } = useTurnkey();

  // Use turnkey wallets if available, otherwise use context wallets
  const wallets = turnkeyWallets?.length > 0 ? turnkeyWallets : contextWallets;

  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null);
  const [exportStep, setExportStep] = useState<"select" | "confirm" | "result">(
    "select",
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [exportedSecret, setExportedSecret] = useState("");

  // Add chains modal state
  const [showAddChainsModal, setShowAddChainsModal] = useState(false);
  const [addChainsLoading, setAddChainsLoading] = useState(false);

  // Handle wallet selection/switch
  const handleSelectWallet = useCallback(
    async (wallet: any, index: number) => {
      if (loading) return;

      setLoading(true);
      try {
        // Clear old portfolio data first to prevent stale data display
        clearPortfolio();

        // Fetch accounts for the selected wallet BEFORE updating state
        // This ensures we have new accounts ready when we update
        const walletAccounts = await fetchWalletAccounts?.({
          wallet,
        });

        // Now update all state together - wallet selection and accounts
        setSelectedWallet(wallet);
        setSelectedWalletId(wallet.walletId);

        if (walletAccounts) {
          const mappedAccounts = walletAccounts.map((acc: any) => ({
            addressFormat: acc.addressFormat,
            address: acc.address,
            path: acc.path,
            curve: acc.curve,
            pathFormat: acc.pathFormat,
          }));
          setAccounts(mappedAccounts);
        }

        onWalletChange?.();
      } catch (err) {
        console.error("Error switching wallet:", err);
        Alert.alert("Error", "Failed to switch wallet. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [
      fetchWalletAccounts,
      setAccounts,
      setSelectedWallet,
      setSelectedWalletId,
      clearPortfolio,
      onWalletChange,
      loading,
    ],
  );

  // Handle creating a new wallet
  const handleCreateWallet = useCallback(async () => {
    if (!newWalletName.trim()) {
      Alert.alert("Error", "Please enter a wallet name");
      return;
    }

    setLoading(true);
    try {
      const result = await createWallet?.({
        walletName: newWalletName.trim(),
        accounts: DEFAULT_WALLET_CONFIG.walletAccounts,
      });

      if (result) {
        // Refresh wallets list
        await refreshWallets?.();
        const updatedWallets = await fetchWallets?.();
        if (updatedWallets) {
          setWallets(updatedWallets);

          // Select the newly created wallet (usually the last one)
          const newWallet = updatedWallets[updatedWallets.length - 1];
          if (newWallet) {
            await handleSelectWallet(newWallet, updatedWallets.length - 1);
          }
        }

        setShowCreateModal(false);
        setNewWalletName("");
        Alert.alert("Success", "Wallet created successfully!");
      }
    } catch (err: any) {
      console.error("Error creating wallet:", err);
      Alert.alert(
        "Error",
        err?.message || "Failed to create wallet. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    newWalletName,
    createWallet,
    refreshWallets,
    fetchWallets,
    setWallets,
    handleSelectWallet,
  ]);

  // Open export modal
  const openExportModal = useCallback(() => {
    setShowExportModal(true);
    setExportStep("select");
    setExportTarget(null);
    setExportedSecret("");
  }, []);

  // Close export modal
  const closeExportModal = useCallback(() => {
    setShowExportModal(false);
    setExportStep("select");
    setExportTarget(null);
    setExportedSecret("");
  }, []);

  // Select export type and show confirmation
  const handleSelectExportType = useCallback(
    (
      type: ExportType,
      address?: string,
      chainName?: string,
      addressFormat?: string,
    ) => {
      setExportTarget({ type, address, chainName, addressFormat });
      setExportStep("confirm");
    },
    [],
  );

  // Perform the export after confirmation
  const handleConfirmExport = useCallback(async () => {
    if (!exportTarget) return;

    setExportLoading(true);

    try {
      let secret = "";
      if (exportTarget.type === "recovery_phrase") {
        const walletId = selectedWallet?.walletId;
        if (!walletId) throw new Error("No wallet selected");
        secret = (await exportWallet?.({ walletId })) || "";
      } else if (exportTarget.type === "private_key" && exportTarget.address) {
        // Export the private key (returns hex format by default)
        const hexPrivateKey =
          (await exportWalletAccount?.({ address: exportTarget.address })) ||
          "";

        // Check if this is a Solana account - if so, convert to Solana-compatible format
        if (
          exportTarget.addressFormat === "ADDRESS_FORMAT_SOLANA" &&
          hexPrivateKey
        ) {
          // Convert hex to Solana format (base58 encoded 64-byte keypair)
          secret = convertToSolanaPrivateKey(
            hexPrivateKey,
            exportTarget.address,
          );
        } else {
          // For other chains (ETH, etc.), use hex format directly
          secret = hexPrivateKey;
        }
      }

      if (secret) {
        setExportedSecret(secret);
        setExportStep("result");
      } else {
        throw new Error("Export returned empty result");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      Alert.alert(
        "Export Failed",
        err?.message || "Failed to export. Please try again.",
      );
    } finally {
      setExportLoading(false);
    }
  }, [exportTarget, selectedWallet, exportWallet, exportWalletAccount]);

  // Copy secret to clipboard
  const handleCopySecret = useCallback(async () => {
    await Clipboard.setStringAsync(exportedSecret);
    Alert.alert("Copied", "Copied to clipboard securely");
  }, [exportedSecret]);

  // Copy address to clipboard
  const handleCopyAddress = async (address: string, chainName: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied", `${chainName} address copied to clipboard`);
  };

  // Check which chains are missing from the current wallet
  const getMissingChains = useCallback(() => {
    const existingFormats = accounts.map((acc) => acc.addressFormat);
    const missingChains: {
      key: string;
      chain: (typeof CHAINS)[keyof typeof CHAINS];
    }[] = [];

    // Check for each supported chain
    for (const [key, chain] of Object.entries(CHAINS)) {
      if (!existingFormats.includes(chain.addressFormat)) {
        // Avoid duplicates for EVM chains (they all use ADDRESS_FORMAT_ETHEREUM)
        const alreadyAdded = missingChains.some(
          (m) => m.chain.addressFormat === chain.addressFormat,
        );
        if (!alreadyAdded) {
          missingChains.push({ key, chain });
        }
      }
    }

    return missingChains;
  }, [accounts]);

  const missingChains = getMissingChains();
  const hasMissingChains = missingChains.length > 0;

  // Handle adding missing chains to the wallet
  const handleAddMissingChains = useCallback(async () => {
    if (!selectedWallet?.walletId || missingChains.length === 0) return;

    setAddChainsLoading(true);
    try {
      // Get unique address formats to add
      const addressFormatsToAdd = [
        ...new Set(missingChains.map((m) => m.chain.addressFormat)),
      ];

      // Use the createWalletAccounts function to add new accounts
      // The accounts parameter expects v1AddressFormat[] - use type assertion
      const result = await createWalletAccounts?.({
        walletId: selectedWallet.walletId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accounts: addressFormatsToAdd as any,
      });

      if (result && result.length > 0) {
        // Register new wallet addresses in Supabase
        // First, get the user ID from an existing wallet address
        const existingAddress = accounts[0]?.address;
        if (existingAddress) {
          const userId = await getUserIdFromWallet(existingAddress);
          if (userId) {
            // Link each new address to the user
            for (const newAddress of result) {
              // Determine chain type based on address format
              const isEvm = newAddress.startsWith("0x");
              const chainType = isEvm ? "evm" : "solana";
              await linkWalletToUser(userId, newAddress, chainType, false);
              console.log(
                `[handleAddMissingChains] Linked ${chainType} wallet: ${newAddress.slice(0, 10)}...`,
              );
            }
          } else {
            console.warn(
              "[handleAddMissingChains] Could not find user ID to link new wallets",
            );
          }
        }

        // Refresh wallet accounts
        const updatedAccounts = await fetchWalletAccounts?.({
          wallet: selectedWallet,
        });

        if (updatedAccounts) {
          const mappedAccounts = updatedAccounts.map((acc: any) => ({
            addressFormat: acc.addressFormat,
            address: acc.address,
            path: acc.path,
            curve: acc.curve,
            pathFormat: acc.pathFormat,
          }));
          setAccounts(mappedAccounts);
        }

        setShowAddChainsModal(false);
        Alert.alert(
          "Success",
          `Added ${result.length} new chain account(s) to your wallet!`,
        );
      }
    } catch (err: any) {
      console.error("Error adding chains:", err);
      Alert.alert(
        "Error",
        err?.message || "Failed to add chains. Please try again.",
      );
    } finally {
      setAddChainsLoading(false);
    }
  }, [
    selectedWallet,
    missingChains,
    createWalletAccounts,
    fetchWalletAccounts,
    setAccounts,
    accounts,
  ]);

  // Render export modal content based on step
  const renderExportModalContent = () => {
    if (exportStep === "select") {
      return (
        <>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "700",
                color: theme.text.primary,
              }}
            >
              Export Wallet
            </Text>
            <TouchableOpacity onPress={closeExportModal}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Security Warning */}
          <View
            style={{
              flexDirection: "row",
              gap: sp[3],
              padding: sp[3],
              backgroundColor: theme.warning + "15",
              borderRadius: br.lg,
              borderWidth: 1,
              borderColor: theme.warning + "30",
            }}
          >
            <Ionicons name="warning" size={20} color={theme.warning} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fs.sm,
                  fontWeight: "600",
                  color: theme.warning,
                  marginBottom: sp[1],
                }}
              >
                Security Warning
              </Text>
              <Text
                style={{
                  fontSize: fs.xs,
                  color: theme.text.muted,
                  lineHeight: fs.xs * 1.5,
                }}
              >
                Never share your private keys or recovery phrase. Anyone with
                access can control your wallet.
              </Text>
            </View>
          </View>

          {/* Export Options */}
          <View style={{ gap: sp[2] }}>
            <Text
              style={{
                fontSize: fs.sm,
                fontWeight: "600",
                color: theme.text.secondary,
                marginBottom: sp[1],
              }}
            >
              Select wallet to export private key
            </Text>

            {/* Private Key Options - Using Consolidated Wallets */}
            {consolidatedWallets.map((wallet) => {
              const primaryNetwork =
                wallet.walletType === "solana"
                  ? NETWORKS.solana
                  : NETWORKS.ethereum;
              // Find the corresponding raw account for export
              const rawAccount = accounts.find(
                (a) => a.address === wallet.address,
              );

              return (
                <TouchableOpacity
                  key={`${wallet.walletType}-${wallet.address}`}
                  onPress={() =>
                    handleSelectExportType(
                      "private_key",
                      wallet.address,
                      wallet.walletTypeName,
                      rawAccount?.addressFormat,
                    )
                  }
                  disabled={exportLoading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp[3],
                    padding: sp[4],
                    backgroundColor: theme.surface,
                    borderRadius: br.lg,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: br.full,
                      backgroundColor:
                        (primaryNetwork.color || "#808080") + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChainIcon
                      chainName={wallet.walletTypeName}
                      logoUrl={primaryNetwork.logo}
                      fallbackIcon={primaryNetwork.icon}
                      size={26}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fs.base,
                        fontWeight: "600",
                        color: theme.text.primary,
                      }}
                    >
                      {wallet.walletTypeName} Private Key
                    </Text>
                    <Text
                      style={{
                        fontSize: fs.xs,
                        color: theme.text.muted,
                        fontFamily: "monospace",
                      }}
                    >
                      {formatAddress(wallet.address)}
                    </Text>
                    {wallet.walletType === "evm" && (
                      <Text
                        style={{
                          fontSize: fs.xs - 1,
                          color: theme.text.muted,
                          marginTop: 2,
                        }}
                      >
                        Works for all EVM networks
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.text.muted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {exportLoading && (
            <View style={{ alignItems: "center", paddingVertical: sp[2] }}>
              <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
            </View>
          )}
        </>
      );
    }

    if (exportStep === "confirm") {
      const isRecoveryPhrase = exportTarget?.type === "recovery_phrase";
      return (
        <>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity
              onPress={() => setExportStep("select")}
              style={{ flexDirection: "row", alignItems: "center", gap: sp[1] }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={theme.text.secondary}
              />
              <Text style={{ fontSize: fs.sm, color: theme.text.secondary }}>
                Back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeExportModal}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Confirmation Content */}
          <View style={{ alignItems: "center", gap: sp[3] }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: br.full,
                backgroundColor: theme.primary.DEFAULT + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="warning"
                size={36}
                color={theme.primary.DEFAULT}
              />
            </View>
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "700",
                color: theme.text.primary,
                textAlign: "center",
              }}
            >
              Export {isRecoveryPhrase ? "Recovery Phrase" : "Private Key"}?
            </Text>
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.muted,
                textAlign: "center",
                lineHeight: fs.sm * 1.6,
              }}
            >
              {isRecoveryPhrase
                ? "Your recovery phrase gives full access to your wallet. Anyone with this phrase can control all your funds."
                : `Your ${exportTarget?.chainName} private key gives full access to this account. Anyone with this key can steal your funds.`}
            </Text>
          </View>

          {/* Warning Box */}
          <View
            style={{
              flexDirection: "row",
              gap: sp[3],
              padding: sp[3],
              backgroundColor: theme.warning + "15",
              borderRadius: br.lg,
              borderWidth: 1,
              borderColor: theme.warning + "30",
            }}
          >
            <Ionicons name="eye-off" size={20} color={theme.warning} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fs.xs,
                  color: theme.text.secondary,
                  lineHeight: fs.xs * 1.5,
                }}
              >
                • Never share your secret with anyone{"\n"}• Store it securely
                offline{"\n"}• Turnkey cannot recover lost secrets
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={{ gap: sp[3] }}>
            <TouchableOpacity
              onPress={handleConfirmExport}
              disabled={exportLoading}
              style={{
                paddingVertical: sp[4],
                alignItems: "center",
                backgroundColor: exportLoading
                  ? theme.border
                  : theme.primary.DEFAULT,
                borderRadius: br.lg,
              }}
            >
              {exportLoading ? (
                <ActivityIndicator size="small" color={theme.secondary.dark} />
              ) : (
                <Text
                  style={{
                    fontSize: fs.base,
                    fontWeight: "600",
                    color: theme.secondary.dark,
                  }}
                >
                  I Understand, Export
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={closeExportModal}
              disabled={exportLoading}
              style={{
                paddingVertical: sp[3],
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: fs.sm,
                  color: theme.text.secondary,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (exportStep === "result") {
      const isRecoveryPhrase = exportTarget?.type === "recovery_phrase";
      return (
        <>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "700",
                color: theme.text.primary,
              }}
            >
              {isRecoveryPhrase
                ? "Recovery Phrase"
                : `${exportTarget?.chainName} Private Key`}
            </Text>
            <TouchableOpacity onPress={closeExportModal}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Security Warning */}
          <View
            style={{
              flexDirection: "row",
              gap: sp[3],
              padding: sp[3],
              backgroundColor: theme.warning + "15",
              borderRadius: br.lg,
              borderWidth: 1,
              borderColor: theme.warning + "30",
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color={theme.warning} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fs.sm,
                  fontWeight: "600",
                  color: theme.warning,
                }}
              >
                Keep this secret safe!
              </Text>
              <Text
                style={{
                  fontSize: fs.xs,
                  color: theme.text.muted,
                }}
              >
                Store offline and never share with anyone.
              </Text>
            </View>
          </View>

          {/* Secret Display */}
          <View
            style={{
              padding: sp[4],
              backgroundColor: theme.surface,
              borderRadius: br.lg,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: isRecoveryPhrase ? fs.base : fs.sm,
                color: theme.text.primary,
                fontFamily: "monospace",
                lineHeight: isRecoveryPhrase ? fs.base * 2 : fs.sm * 1.8,
                textAlign: isRecoveryPhrase ? "center" : "left",
              }}
              selectable
            >
              {exportedSecret}
            </Text>
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            onPress={handleCopySecret}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: sp[2],
              paddingVertical: sp[4],
              backgroundColor: theme.primary.DEFAULT,
              borderRadius: br.lg,
            }}
          >
            <Ionicons
              name="copy-outline"
              size={20}
              color={theme.secondary.dark}
            />
            <Text
              style={{
                fontSize: fs.base,
                fontWeight: "600",
                color: theme.secondary.dark,
              }}
            >
              Copy to Clipboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={closeExportModal}
            style={{
              paddingVertical: sp[3],
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.secondary,
              }}
            >
              Done
            </Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  return (
    <View style={{ gap: sp[4] }}>
      {/* Wallets List */}
      <Card>
        <View style={{ gap: sp[3] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: fs.base,
                fontWeight: "600",
                color: theme.text.primary,
              }}
            >
              My Wallets
            </Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              disabled={loading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: sp[1],
                paddingVertical: sp[1],
                paddingHorizontal: sp[2],
                backgroundColor: theme.primary.DEFAULT + "20",
                borderRadius: br.md,
              }}
            >
              <Ionicons name="add" size={16} color={theme.primary.DEFAULT} />
              <Text
                style={{
                  fontSize: fs.sm,
                  fontWeight: "500",
                  color: theme.primary.DEFAULT,
                }}
              >
                Add Wallet
              </Text>
            </TouchableOpacity>
          </View>

          {/* Wallet List */}
          {wallets.length === 0 ? (
            <View
              style={{
                paddingVertical: sp[6],
                alignItems: "center",
                gap: sp[2],
              }}
            >
              <Ionicons
                name="wallet-outline"
                size={48}
                color={theme.text.muted}
              />
              <Text
                style={{
                  fontSize: fs.sm,
                  color: theme.text.muted,
                  textAlign: "center",
                }}
              >
                No wallets found.{"\n"}Create your first wallet to get started.
              </Text>
              <Button
                title="Create Wallet"
                onPress={() => setShowCreateModal(true)}
                disabled={loading}
              />
            </View>
          ) : (
            wallets.map((wallet: any, index: number) => {
              const isSelected = selectedWallet?.walletId === wallet.walletId;
              return (
                <TouchableOpacity
                  key={wallet.walletId || index}
                  onPress={() => handleSelectWallet(wallet, index)}
                  disabled={loading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp[3],
                    paddingVertical: sp[3],
                    paddingHorizontal: sp[3],
                    backgroundColor: isSelected
                      ? theme.primary.DEFAULT + "15"
                      : theme.surface,
                    borderRadius: br.lg,
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected
                      ? theme.primary.DEFAULT
                      : theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: br.full,
                      backgroundColor: isSelected
                        ? theme.primary.DEFAULT + "30"
                        : theme.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="wallet"
                      size={22}
                      color={
                        isSelected
                          ? theme.primary.DEFAULT
                          : theme.text.secondary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fs.base,
                        fontWeight: "600",
                        color: theme.text.primary,
                      }}
                    >
                      {wallet.walletName || `Wallet ${index + 1}`}
                    </Text>
                    <Text
                      style={{
                        fontSize: fs.xs,
                        color: theme.text.muted,
                      }}
                    >
                      {wallet.accounts?.length || 0} account(s)
                    </Text>
                  </View>
                  {isSelected && (
                    <View
                      style={{
                        backgroundColor: theme.primary.DEFAULT,
                        paddingHorizontal: sp[2],
                        paddingVertical: sp[1],
                        borderRadius: br.md,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fs.xs,
                          fontWeight: "600",
                          color: theme.secondary.dark,
                        }}
                      >
                        Active
                      </Text>
                    </View>
                  )}
                  {loading && (
                    <ActivityIndicator
                      size="small"
                      color={theme.primary.DEFAULT}
                    />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Card>

      {/* Account Addresses */}
      {consolidatedWallets.length > 0 && (
        <Card>
          <View style={{ gap: sp[3] }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "600",
                  color: theme.text.primary,
                }}
              >
                Accounts
              </Text>
              <View style={{ flexDirection: "row", gap: sp[2] }}>
                {hasMissingChains && (
                  <TouchableOpacity
                    onPress={() => setShowAddChainsModal(true)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp[1],
                      paddingVertical: sp[1],
                      paddingHorizontal: sp[2],
                      backgroundColor: theme.primary.DEFAULT + "15",
                      borderRadius: br.md,
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={14}
                      color={theme.primary.DEFAULT}
                    />
                    <Text
                      style={{
                        fontSize: fs.sm,
                        fontWeight: "500",
                        color: theme.primary.DEFAULT,
                      }}
                    >
                      Add Chains
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={openExportModal}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp[1],
                    paddingVertical: sp[1],
                    paddingHorizontal: sp[2],
                    backgroundColor: theme.border,
                    borderRadius: br.md,
                  }}
                >
                  <Ionicons
                    name="key-outline"
                    size={14}
                    color={theme.text.secondary}
                  />
                  <Text
                    style={{
                      fontSize: fs.sm,
                      fontWeight: "500",
                      color: theme.text.secondary,
                    }}
                  >
                    Export
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {consolidatedWallets.map((wallet) => {
              const primaryNetwork =
                wallet.walletType === "solana"
                  ? NETWORKS.solana
                  : NETWORKS.ethereum;

              return (
                <View
                  key={`${wallet.walletType}-${wallet.address}`}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: br.lg,
                    padding: sp[3],
                    borderWidth: 1,
                    borderColor: theme.border,
                    gap: sp[2],
                  }}
                >
                  {/* Wallet Header Row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp[3],
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: br.full,
                        backgroundColor:
                          (primaryNetwork.color || "#808080") + "20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChainIcon
                        chainName={wallet.walletTypeName}
                        logoUrl={primaryNetwork.logo}
                        fallbackIcon={primaryNetwork.icon}
                        size={24}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fs.sm,
                          fontWeight: "600",
                          color: theme.text.primary,
                        }}
                      >
                        {wallet.walletTypeName}
                      </Text>
                      <Text
                        style={{
                          fontSize: fs.xs,
                          color: theme.text.muted,
                          fontFamily: "monospace",
                        }}
                      >
                        {formatAddress(wallet.address)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        handleCopyAddress(wallet.address, wallet.walletTypeName)
                      }
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: br.full,
                        backgroundColor: theme.background,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: theme.border,
                      }}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={16}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Network Badges for EVM */}
                  {wallet.walletType === "evm" &&
                    wallet.availableNetworks.length > 1 && (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: sp[1],
                          marginTop: sp[1],
                        }}
                      >
                        {wallet.availableNetworks.map((networkKey) => {
                          const network = NETWORKS[networkKey as NetworkKey];
                          return (
                            <View
                              key={networkKey}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                paddingHorizontal: sp[2],
                                paddingVertical: 2,
                                borderRadius: br.sm,
                                backgroundColor:
                                  (network.color || "#627EEA") + "15",
                              }}
                            >
                              <ChainIcon
                                chainName={network.name}
                                logoUrl={network.logo}
                                fallbackIcon={network.icon}
                                size={12}
                              />
                              <Text
                                style={{
                                  fontSize: fs.xs - 1,
                                  color: theme.text.secondary,
                                }}
                              >
                                {network.symbol}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Create Wallet Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: sp[4],
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: theme.background,
              borderRadius: br.xl,
              padding: sp[4],
              gap: sp[4],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: fs.lg,
                  fontWeight: "700",
                  color: theme.text.primary,
                }}
              >
                Create New Wallet
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: sp[2] }}>
              <Text
                style={{
                  fontSize: fs.sm,
                  color: theme.text.secondary,
                }}
              >
                Wallet Name
              </Text>
              <TextInput
                value={newWalletName}
                onChangeText={setNewWalletName}
                placeholder="My New Wallet"
                placeholderTextColor={theme.text.muted}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: br.lg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  paddingVertical: sp[3],
                  paddingHorizontal: sp[4],
                  fontSize: fs.base,
                  color: theme.text.primary,
                }}
                editable={!loading}
              />
            </View>

            <Text
              style={{
                fontSize: fs.xs,
                color: theme.text.muted,
              }}
            >
              This will create a new multichain wallet. You can add more
              accounts later.
            </Text>

            <View style={{ flexDirection: "row", gap: sp[3] }}>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: sp[3],
                  alignItems: "center",
                  backgroundColor: theme.surface,
                  borderRadius: br.lg,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: fs.base,
                    fontWeight: "600",
                    color: theme.text.secondary,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateWallet}
                disabled={loading || !newWalletName.trim()}
                style={{
                  flex: 1,
                  paddingVertical: sp[3],
                  alignItems: "center",
                  backgroundColor:
                    loading || !newWalletName.trim()
                      ? theme.border
                      : theme.primary.DEFAULT,
                  borderRadius: br.lg,
                }}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.secondary.dark}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: fs.base,
                      fontWeight: "600",
                      color: theme.secondary.dark,
                    }}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={closeExportModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: sp[4],
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: theme.background,
              borderRadius: br.xl,
              padding: sp[4],
              gap: sp[4],
              maxHeight: "80%",
            }}
          >
            {renderExportModalContent()}
          </View>
        </View>
      </Modal>

      {/* Add Chains Modal */}
      <Modal
        visible={showAddChainsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddChainsModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: sp[4],
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: theme.background,
              borderRadius: br.xl,
              padding: sp[4],
              gap: sp[4],
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: fs.lg,
                  fontWeight: "700",
                  color: theme.text.primary,
                }}
              >
                Add Blockchain Accounts
              </Text>
              <TouchableOpacity onPress={() => setShowAddChainsModal(false)}>
                <Ionicons name="close" size={24} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.muted,
                lineHeight: fs.sm * 1.5,
              }}
            >
              Add support for additional blockchains to your wallet. Your
              existing accounts will not be affected.
            </Text>

            {/* Missing Chains List */}
            <View style={{ gap: sp[2] }}>
              <Text
                style={{
                  fontSize: fs.sm,
                  fontWeight: "600",
                  color: theme.text.secondary,
                }}
              >
                Available to add:
              </Text>
              {missingChains.map(({ key, chain }) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp[3],
                    padding: sp[3],
                    backgroundColor: theme.surface,
                    borderRadius: br.lg,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: br.full,
                      backgroundColor: chain.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: fs.lg }}>{chain.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fs.base,
                        fontWeight: "600",
                        color: theme.text.primary,
                      }}
                    >
                      {chain.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: fs.xs,
                        color: theme.text.muted,
                      }}
                    >
                      {chain.symbol} •{" "}
                      {chain.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
                        ? "EVM Compatible"
                        : "Native"}
                    </Text>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.success}
                  />
                </View>
              ))}
            </View>

            {/* Info Box */}
            <View
              style={{
                flexDirection: "row",
                gap: sp[3],
                padding: sp[3],
                backgroundColor: theme.primary.DEFAULT + "10",
                borderRadius: br.lg,
                borderWidth: 1,
                borderColor: theme.primary.DEFAULT + "30",
              }}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={theme.primary.DEFAULT}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: fs.xs,
                    color: theme.text.secondary,
                    lineHeight: fs.xs * 1.5,
                  }}
                >
                  EVM chains (Ethereum, Base, BNB) share the same address, so
                  only one account is needed for all EVM networks.
                </Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: sp[3] }}>
              <TouchableOpacity
                onPress={() => setShowAddChainsModal(false)}
                disabled={addChainsLoading}
                style={{
                  flex: 1,
                  paddingVertical: sp[3],
                  alignItems: "center",
                  backgroundColor: theme.surface,
                  borderRadius: br.lg,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: fs.base,
                    fontWeight: "600",
                    color: theme.text.secondary,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddMissingChains}
                disabled={addChainsLoading}
                style={{
                  flex: 1,
                  paddingVertical: sp[3],
                  alignItems: "center",
                  backgroundColor: addChainsLoading
                    ? theme.border
                    : theme.primary.DEFAULT,
                  borderRadius: br.lg,
                }}
              >
                {addChainsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.secondary.dark}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: fs.base,
                      fontWeight: "600",
                      color: theme.secondary.dark,
                    }}
                  >
                    Add Chains
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
