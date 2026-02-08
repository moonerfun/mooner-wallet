/**
 * UnifiedBalanceCard - Shows OneBalance aggregated balance
 *
 * Displays:
 * - Total unified balance in USD
 * - Primary aggregated assets (USDC, ETH, SOL)
 * - Expandable chain breakdown for each asset
 *
 * Uses OneBalance V3 API for multi-account balance aggregation
 */

import { useTheme } from "@/contexts/ThemeContext";
import {
  AggregatedAsset,
  ChainBalance,
  useOneBalancePortfolio,
} from "@/hooks";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
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

// ============================================================================
// Asset Icon Component
// ============================================================================

const ASSET_ICONS: Record<string, { icon: string; color: string }> = {
  "ob:usdc": { icon: "💵", color: "#2775CA" },
  "ob:usdt": { icon: "💵", color: "#26A17B" },
  "ob:eth": { icon: "⟠", color: "#627EEA" },
  "ob:sol": { icon: "◎", color: "#9945FF" },
  "ob:wbtc": { icon: "₿", color: "#F7931A" },
};

function AssetIcon({ assetId, size = 32 }: { assetId: string; size?: number }) {
  const { theme } = useTheme();
  const assetInfo = ASSET_ICONS[assetId] || {
    icon: "💰",
    color: theme.text.muted,
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: assetInfo.color + "20",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{assetInfo.icon}</Text>
    </View>
  );
}

// ============================================================================
// Chain Balance Row
// ============================================================================

function ChainBalanceRow({ chain }: { chain: ChainBalance }) {
  const { theme, fontSize: fs } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: theme.surface + "40",
        borderRadius: 8,
        marginBottom: 4,
      }}
    >
      <Text style={{ color: theme.text.secondary, fontSize: fs.sm }}>
        {chain.chainName}
      </Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            color: theme.text.primary,
            fontSize: fs.sm,
            fontWeight: "500",
          }}
        >
          {chain.formattedBalance}
        </Text>
        <Text style={{ color: theme.text.muted, fontSize: fs.xs }}>
          {formatUSD(chain.fiatValue)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Aggregated Asset Row
// ============================================================================

interface AssetRowProps {
  asset: AggregatedAsset;
  showChainBreakdown?: boolean;
}

function AggregatedAssetRow({
  asset,
  showChainBreakdown = true,
}: AssetRowProps) {
  const { theme, fontSize: fs, borderRadius: br, spacing: sp } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    if (showChainBreakdown && asset.chainBalances.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(!isExpanded);
    }
  };

  const hasMultipleChains = asset.chainBalances.length > 1;

  return (
    <View style={{ marginBottom: sp[3] }}>
      <TouchableOpacity
        onPress={handleToggle}
        disabled={!hasMultipleChains}
        activeOpacity={hasMultipleChains ? 0.7 : 1}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: sp[3],
          paddingHorizontal: sp[4],
          backgroundColor: theme.surface,
          borderRadius: br.md,
        }}
      >
        {/* Asset Icon */}
        <AssetIcon assetId={asset.assetId} size={40} />

        {/* Asset Info */}
        <View style={{ flex: 1, marginLeft: sp[4] }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: theme.text.primary,
                fontSize: fs.base,
                fontWeight: "600",
              }}
            >
              {asset.symbol}
            </Text>
            {hasMultipleChains && (
              <View
                style={{
                  marginLeft: sp[2],
                  backgroundColor: theme.primary.DEFAULT + "20",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: theme.primary.DEFAULT, fontSize: fs.xs }}>
                  {asset.chainBalances.length} chains
                </Text>
              </View>
            )}
          </View>
          <Text style={{ color: theme.text.secondary, fontSize: fs.sm }}>
            {asset.name}
          </Text>
        </View>

        {/* Balance */}
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              color: theme.text.primary,
              fontSize: fs.base,
              fontWeight: "600",
            }}
          >
            {asset.formattedBalance}
          </Text>
          <Text style={{ color: theme.text.muted, fontSize: fs.sm }}>
            {formatUSD(asset.fiatValue)}
          </Text>
        </View>

        {/* Expand Icon */}
        {hasMultipleChains && (
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.text.muted}
            style={{ marginLeft: sp[3] }}
          />
        )}
      </TouchableOpacity>

      {/* Chain Breakdown */}
      {isExpanded && asset.chainBalances.length > 0 && (
        <View
          style={{
            paddingHorizontal: sp[4],
            paddingTop: sp[4] + br.md,
            paddingBottom: sp[2],
            marginTop: -br.md,
            backgroundColor: theme.surface + "80",
            borderBottomLeftRadius: br.md,
            borderBottomRightRadius: br.md,
          }}
        >
          {asset.chainBalances.map((chain, index) => (
            <ChainBalanceRow key={`${chain.chainId}-${index}`} chain={chain} />
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface UnifiedBalanceCardProps {
  evmAddress?: string;
  solanaAddress?: string;
  /** Show only primary assets (USDC, ETH, SOL) */
  primaryOnly?: boolean;
  /** Title override */
  title?: string;
  /** Hide the total balance header */
  hideTotal?: boolean;
  /** Callback when USDC is tapped (for swap) */
  onUsdcPress?: () => void;
}

export function UnifiedBalanceCard({
  evmAddress,
  solanaAddress,
  primaryOnly = false,
  title = "Unified Balance",
  hideTotal = false,
  onUsdcPress,
}: UnifiedBalanceCardProps) {
  const { theme, fontSize: fs, borderRadius: br, spacing: sp } = useTheme();

  const {
    usdc,
    eth,
    sol,
    aggregatedAssets,
    totalFiatValue,
    isLoading,
    error,
    refetch,
  } = useOneBalancePortfolio(evmAddress, solanaAddress);

  // Primary assets for simplified view
  const primaryAssets = [usdc, eth, sol].filter(Boolean) as AggregatedAsset[];
  const displayAssets = primaryOnly ? primaryAssets : aggregatedAssets;

  if (!evmAddress && !solanaAddress) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderRadius: br.lg,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      {!hideTotal && (
        <View
          style={{
            padding: sp[4],
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text
                style={{
                  color: theme.text.secondary,
                  fontSize: fs.sm,
                  marginBottom: 4,
                }}
              >
                {title}
              </Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
              ) : (
                <Text
                  style={{
                    color: theme.text.primary,
                    fontSize: fs["2xl"],
                    fontWeight: "700",
                  }}
                >
                  {formatUSD(totalFiatValue)}
                </Text>
              )}
            </View>

            {/* Refresh Button */}
            <TouchableOpacity
              onPress={refetch}
              disabled={isLoading}
              style={{
                padding: sp[3],
                backgroundColor: theme.surface,
                borderRadius: br.md,
              }}
            >
              <Ionicons
                name="refresh"
                size={20}
                color={isLoading ? theme.text.muted : theme.primary.DEFAULT}
              />
            </TouchableOpacity>
          </View>

          {/* OneBalance Badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: sp[3],
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: theme.primary.DEFAULT + "10",
              borderRadius: 12,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                color: theme.primary.DEFAULT,
                fontSize: fs.xs,
                fontWeight: "500",
              }}
            >
              ⚡ Aggregated across all chains
            </Text>
          </View>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={{ padding: sp[4], backgroundColor: theme.surface }}>
          <Text style={{ color: "#EF4444", fontSize: fs.sm }}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={{ marginTop: sp[3] }}>
            <Text style={{ color: theme.primary.DEFAULT, fontSize: fs.sm }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Asset List */}
      {!error && (
        <View style={{ padding: sp[3] }}>
          {displayAssets.length === 0 && !isLoading ? (
            <View style={{ padding: sp[4], alignItems: "center" }}>
              <Text style={{ color: theme.text.muted, fontSize: fs.sm }}>
                No balances found
              </Text>
            </View>
          ) : (
            displayAssets.map((asset) => (
              <AggregatedAssetRow key={asset.assetId} asset={asset} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Compact USDC balance display for swap screens
 */
export function UsdcBalancePill({
  evmAddress,
  solanaAddress,
  onPress,
}: {
  evmAddress?: string;
  solanaAddress?: string;
  onPress?: () => void;
}) {
  const { theme, fontSize: fs, spacing: sp, borderRadius: br } = useTheme();
  const { usdc, isLoading } = useOneBalancePortfolio(
    evmAddress,
    solanaAddress,
    {
      assetIds: ["ob:usdc"],
    },
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: sp[4],
        paddingVertical: sp[3],
        backgroundColor: theme.surface,
        borderRadius: br.full,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text
        style={{
          color: theme.text.secondary,
          fontSize: fs.sm,
          marginRight: sp[2],
        }}
      >
        USDC:
      </Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
      ) : (
        <>
          <Text
            style={{
              color: theme.text.primary,
              fontSize: fs.sm,
              fontWeight: "600",
            }}
          >
            {usdc?.formattedBalance || "0"}
          </Text>
          {usdc && usdc.chainBalances.length > 1 && (
            <View
              style={{
                marginLeft: sp[2],
                backgroundColor: theme.primary.DEFAULT + "20",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: theme.primary.DEFAULT, fontSize: 10 }}>
                {usdc.chainBalances.length} chains
              </Text>
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}
