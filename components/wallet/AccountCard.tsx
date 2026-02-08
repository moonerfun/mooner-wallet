import { ChainIcon } from "@/components/ui/ChainIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { formatUSD } from "@/lib/api/mobula/mobulaClient";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

interface AccountCardProps {
  chainName: string;
  chainSymbol: string;
  chainIcon: string;
  chainLogo?: string;
  chainColor: string;
  address: string;
  /** Total balance in USD for this chain */
  balanceUsd?: number;
  /** Whether balance is currently loading */
  isLoadingBalance?: boolean;
  onPress?: () => void;
  onCopy?: () => void;
}

export function AccountCard({
  chainName,
  chainSymbol,
  chainIcon,
  chainLogo,
  chainColor,
  address,
  balanceUsd,
  isLoadingBalance,
  onPress,
  onCopy,
}: AccountCardProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();

  const formatAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: theme.surface,
        borderRadius: br.xl,
        borderWidth: 0.5,
        borderColor: theme.border,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: sp[3],
      }}
    >
      {/* Chain Icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: br.full,
          backgroundColor: `${chainColor}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChainIcon
          chainName={chainName}
          logoUrl={chainLogo}
          fallbackIcon={chainIcon}
          size={24}
        />
      </View>

      {/* Chain Info */}
      <View style={{ flex: 1 }}>
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
            {chainName}
          </Text>
          {/* Balance Display */}
          {isLoadingBalance ? (
            <ActivityIndicator size="small" color={theme.text.muted} />
          ) : balanceUsd !== undefined ? (
            <Text
              style={{
                fontSize: fs.base,
                fontWeight: "600",
                color: theme.text.primary,
              }}
            >
              {formatUSD(balanceUsd)}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontSize: fs.sm,
            color: theme.text.secondary,
            marginTop: 2,
          }}
        >
          {formatAddress(address)}
        </Text>
      </View>

      {/* Copy Button */}
      <TouchableOpacity
        onPress={onCopy}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          padding: sp[2],
          backgroundColor: theme.background,
          borderRadius: br.md,
        }}
      >
        <Ionicons name="copy-outline" size={18} color={theme.text.secondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
