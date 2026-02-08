/**
 * WalletCard - Consolidated wallet display component
 *
 * Shows a unified wallet view:
 * - Wallet type icon and name (Solana / EVM)
 * - Single address
 * - Total balance across all networks
 * - For EVM: expandable row of network badges with per-network balances
 */

import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { NetworkKey, NETWORKS } from "@/constants/turnkey";
import { ConsolidatedWallet } from "@/contexts/WalletContext";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NetworkBalance {
  network: NetworkKey;
  balanceUsd: number;
}

interface WalletCardProps {
  wallet: ConsolidatedWallet;
  /** Total balance in USD across all networks */
  totalBalanceUsd?: number;
  /** Per-network balances (for EVM wallets) */
  networkBalances?: NetworkBalance[];
  /** Whether balance is currently loading */
  isLoadingBalance?: boolean;
  /** Callback when wallet is pressed */
  onPress?: () => void;
  /** Callback when copy button is pressed */
  onCopy?: () => void;
  /** Callback when a network badge is pressed (for EVM) */
  onNetworkPress?: (network: NetworkKey) => void;
}

export function WalletCard({
  wallet,
  totalBalanceUsd,
  networkBalances = [],
  isLoadingBalance,
  onPress,
  onCopy,
  onNetworkPress,
}: WalletCardProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const isEvm = wallet.walletType === "evm";
  const hasNetworkBalances = networkBalances.length > 0;

  const formatAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const handleToggleExpand = () => {
    if (isEvm && hasNetworkBalances) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: br.lg, // Reduced from xl
        borderWidth: 0.5, // Lighter border like PulseTokenCard
        borderColor: theme.border,
        overflow: "hidden",
      }}
    >
      {/* Main Wallet Row */}
      <TouchableOpacity
        onPress={onPress || handleToggleExpand}
        activeOpacity={0.8}
        style={{
          padding: sp[2.5], // 10px - aligned with PulseTokenCard
          flexDirection: "row",
          alignItems: "center",
          gap: sp[2], // Tighter gap
        }}
      >
        {/* Wallet Type Icon */}
        <View
          style={{
            width: 40, // Reduced from 48 to match PulseTokenCard
            height: 40,
            borderRadius: br.full,
            backgroundColor: `${wallet.color}20`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChainIcon
            chainName={wallet.walletTypeName}
            logoUrl={wallet.logo}
            fallbackIcon={wallet.icon}
            size={24} // Reduced from 28
          />
        </View>

        {/* Wallet Info */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: sp[2] }}
            >
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "600",
                  color: theme.text.primary,
                }}
              >
                {wallet.walletTypeName}
              </Text>
              {isEvm && (
                <View
                  style={{
                    backgroundColor: theme.primary.DEFAULT + "20",
                    paddingHorizontal: sp[2],
                    paddingVertical: 2,
                    borderRadius: br.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fs.xs,
                      fontWeight: "500",
                      color: theme.primary.DEFAULT,
                    }}
                  >
                    Multi-chain
                  </Text>
                </View>
              )}
            </View>

            {/* Balance Display - aligned for both Solana and EVM */}
            {isLoadingBalance ? (
              <ActivityIndicator size="small" color={theme.text.muted} />
            ) : totalBalanceUsd !== undefined ? (
              <Text
                style={{
                  fontSize: fs.base,
                  fontWeight: "600",
                  color: theme.text.primary,
                }}
              >
                {formatUSD(totalBalanceUsd)}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sp[2],
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.secondary,
              }}
            >
              {formatAddress(wallet.address)}
            </Text>

            {/* Copy Button - Inline */}
            <TouchableOpacity
              onPress={onCopy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="copy-outline"
                size={14}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Network Badges Row (always visible for EVM) */}
      {isEvm && (
        <View
          style={{
            paddingHorizontal: sp[4],
            paddingBottom: sp[3],
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: sp[2],
              flex: 1,
            }}
            style={{ flex: 1 }}
          >
            {wallet.availableNetworks.map((networkKey) => {
              const network = NETWORKS[networkKey];
              const balance = networkBalances.find(
                (b) => b.network === networkKey,
              );
              const hasBalance = balance && balance.balanceUsd > 0;

              return (
                <TouchableOpacity
                  key={networkKey}
                  onPress={() => onNetworkPress?.(networkKey)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp[1],
                    paddingHorizontal: sp[2],
                    paddingVertical: sp[1],
                    borderRadius: br.md,
                    backgroundColor: hasBalance
                      ? `${network.color}15`
                      : theme.background,
                    borderWidth: 1,
                    borderColor: hasBalance
                      ? `${network.color}30`
                      : theme.border,
                  }}
                >
                  <ChainIcon
                    chainName={network.name}
                    logoUrl={network.logo}
                    fallbackIcon={network.icon}
                    size={16}
                  />
                  <Text
                    style={{
                      fontSize: fs.xs,
                      fontWeight: "500",
                      color: hasBalance ? network.color : theme.text.muted,
                    }}
                  >
                    {network.name.length > 8
                      ? network.key.toUpperCase()
                      : network.name}
                  </Text>
                  {hasBalance && !isExpanded && (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: theme.success,
                        marginLeft: 2,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Expand/Collapse Indicator */}
          {hasNetworkBalances && (
            <TouchableOpacity
              onPress={handleToggleExpand}
              style={{
                paddingLeft: sp[2],
                paddingVertical: sp[1],
              }}
            >
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Expanded Network Details (for EVM) */}
      {isEvm && isExpanded && hasNetworkBalances && (
        <View
          style={{
            marginTop: sp[1],
            marginHorizontal: sp[3],
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingTop: sp[3],
            paddingHorizontal: sp[1],
            paddingBottom: sp[3],
          }}
        >
          <Text
            style={{
              fontSize: fs.xs,
              fontWeight: "500",
              color: theme.text.muted,
              marginBottom: sp[2],
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Network Balances
          </Text>
          {networkBalances
            .filter((b) => b.balanceUsd > 0)
            .sort((a, b) => b.balanceUsd - a.balanceUsd)
            .map((balance) => {
              const network = NETWORKS[balance.network];
              return (
                <TouchableOpacity
                  key={balance.network}
                  onPress={() => onNetworkPress?.(balance.network)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: sp[2],
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp[2],
                    }}
                  >
                    <ChainIcon
                      chainName={network.name}
                      logoUrl={network.logo}
                      fallbackIcon={network.icon}
                      size={20}
                    />
                    <Text
                      style={{
                        fontSize: fs.sm,
                        fontWeight: "500",
                        color: theme.text.primary,
                      }}
                    >
                      {network.name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: fs.sm,
                      fontWeight: "600",
                      color: theme.text.primary,
                    }}
                  >
                    {formatUSD(balance.balanceUsd)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          {networkBalances.filter((b) => b.balanceUsd > 0).length === 0 && (
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.muted,
                textAlign: "center",
                paddingVertical: sp[2],
              }}
            >
              No balances on any network
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
