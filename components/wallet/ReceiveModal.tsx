/**
 * ReceiveModal - Modal for receiving crypto
 *
 * New architecture:
 * 1. Select Wallet Type (Solana or EVM)
 * 2. For EVM: Select Network (Ethereum, Base, BNB, etc.) - same address, different warning
 * 3. Shows QR code and address
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { NetworkKey, NETWORKS } from "@/constants/turnkey";
import { ConsolidatedWallet, useWallet } from "@/contexts/WalletContext";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ReceiveModal({ visible, onClose }: ReceiveModalProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const { consolidatedWallets, formatAddress } = useWallet();

  // Selected wallet type (Solana or EVM)
  const [selectedWallet, setSelectedWallet] =
    useState<ConsolidatedWallet | null>(null);
  // Selected network (for EVM wallets)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // Select first wallet by default when modal opens
  React.useEffect(() => {
    if (visible && consolidatedWallets.length > 0 && !selectedWallet) {
      const firstWallet = consolidatedWallets[0];
      setSelectedWallet(firstWallet);
      // Auto-select first network for the wallet
      if (firstWallet.availableNetworks.length > 0) {
        setSelectedNetwork(firstWallet.availableNetworks[0]);
      }
    }
  }, [visible, consolidatedWallets]);

  const handleCopyAddress = useCallback(async () => {
    if (selectedWallet?.address) {
      await Clipboard.setStringAsync(selectedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedWallet]);

  const handleSelectWallet = useCallback((wallet: ConsolidatedWallet) => {
    setSelectedWallet(wallet);
    setCopied(false);
    // Auto-select first network for this wallet type
    if (wallet.availableNetworks.length > 0) {
      setSelectedNetwork(wallet.availableNetworks[0]);
    } else {
      setSelectedNetwork(null);
    }
  }, []);

  const handleSelectNetwork = useCallback((network: NetworkKey) => {
    setSelectedNetwork(network);
    setCopied(false);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedWallet(null);
    setSelectedNetwork(null);
    setCopied(false);
    onClose();
  }, [onClose]);

  // Get display info for selected network
  const selectedNetworkConfig = selectedNetwork
    ? NETWORKS[selectedNetwork]
    : null;
  const isEvmWallet = selectedWallet?.walletType === "evm";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Receive
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet Type Selector */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: theme.text.secondary }]}
            >
              Select Wallet
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
                            selectedWallet?.walletType === wallet.walletType
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
          {isEvmWallet && selectedWallet && (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: theme.text.secondary }]}
              >
                Select Network
              </Text>
              <Text style={[styles.sectionHint, { color: theme.text.muted }]}>
                Same address works on all EVM networks
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.networkList}
              >
                {selectedWallet.availableNetworks.map((networkKey) => {
                  const network = NETWORKS[networkKey];
                  const isSelected = selectedNetwork === networkKey;
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
                        size={20}
                      />
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
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* QR Code */}
          {selectedWallet && (
            <View style={styles.qrSection}>
              <View
                style={[
                  styles.qrContainer,
                  {
                    backgroundColor: "#FFFFFF",
                    borderRadius: br.xl,
                  },
                ]}
              >
                <QRCode
                  value={selectedWallet.address}
                  size={SCREEN_WIDTH * 0.55}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>

              {/* Network/Wallet Badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: `${
                      selectedNetworkConfig?.color || selectedWallet.color
                    }20`,
                  },
                ]}
              >
                <ChainIcon
                  chainName={
                    selectedNetworkConfig?.name || selectedWallet.walletTypeName
                  }
                  logoUrl={selectedNetworkConfig?.logo || selectedWallet.logo}
                  fallbackIcon={
                    selectedNetworkConfig?.icon || selectedWallet.icon
                  }
                  size={20}
                />
                <Text
                  style={[
                    styles.badgeName,
                    {
                      color:
                        selectedNetworkConfig?.color || selectedWallet.color,
                    },
                  ]}
                >
                  {selectedNetworkConfig?.name || selectedWallet.walletTypeName}
                </Text>
              </View>
            </View>
          )}

          {/* Address Display */}
          {selectedWallet && (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: theme.text.secondary }]}
              >
                Your {selectedWallet.walletTypeName} Address
              </Text>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={[
                  styles.addressContainer,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.addressText, { color: theme.text.primary }]}
                  numberOfLines={2}
                >
                  {selectedWallet.address}
                </Text>
                <View
                  style={[
                    styles.copyButton,
                    {
                      backgroundColor: copied
                        ? theme.success
                        : theme.primary.DEFAULT,
                    },
                  ]}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={18}
                    color={theme.text.primary}
                  />
                </View>
              </TouchableOpacity>

              {copied && (
                <Text style={[styles.copiedText, { color: theme.success }]}>
                  Address copied to clipboard!
                </Text>
              )}
            </View>
          )}

          {/* Warning */}
          <View
            style={[
              styles.warningContainer,
              { backgroundColor: `${theme.warning}15` },
            ]}
          >
            <Ionicons name="warning-outline" size={20} color={theme.warning} />
            <Text style={[styles.warningText, { color: theme.warning }]}>
              {isEvmWallet && selectedNetworkConfig
                ? `Only send ${selectedNetworkConfig.name} assets to this address. Sending assets from other networks may result in permanent loss.`
                : `Only send ${selectedWallet?.walletTypeName || "compatible"} assets to this address.`}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 12,
  },
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
  },
  networkName: {
    fontSize: 13,
    fontWeight: "500",
  },
  qrSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "monospace",
    lineHeight: 22,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  copiedText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
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
});
