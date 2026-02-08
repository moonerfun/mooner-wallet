import {
  AnimatedPressable,
  AnimatedPressablePresets,
} from "@/components/ui/AnimatedPressable";
import { FlashList } from "@shopify/flash-list";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { TokenMarketData } from "../../store/marketStore";
import { PercentageBadge, PriceDisplay, TokenLogo } from "./PriceDisplay";

interface TokenListItemProps {
  token: TokenMarketData;
  onPress?: (token: TokenMarketData) => void;
  showRank?: boolean;
  compact?: boolean;
}

export function TokenListItem({
  token,
  onPress,
  showRank = false,
  compact = false,
}: TokenListItemProps) {
  const { theme } = useTheme();

  if (compact) {
    return (
      <AnimatedPressable
        onPress={() => onPress?.(token)}
        {...AnimatedPressablePresets.card}
        className="flex-row items-center py-3 px-4"
        style={{ backgroundColor: theme.background }}
      >
        <View className="flex-row items-center flex-1 gap-3">
          {showRank && token.rank && (
            <Text
              className="text-xs font-medium w-6"
              style={{ color: theme.text.muted }}
            >
              {token.rank}
            </Text>
          )}
          <TokenLogo logo={token.logo} symbol={token.symbol} size="sm" />
          <View className="flex-1">
            <Text
              className="text-sm font-semibold"
              style={{ color: theme.text.primary }}
              numberOfLines={1}
            >
              {token.symbol}
            </Text>
          </View>
        </View>
        <PriceDisplay
          price={token.price}
          change={token.priceChange24h}
          size="sm"
          compact
        />
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={() => onPress?.(token)}
      {...AnimatedPressablePresets.card}
      className="flex-row items-center py-4 px-4"
      style={{
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View className="flex-row items-center flex-1 gap-3">
        {showRank && token.rank && (
          <Text
            className="text-sm font-medium w-8 text-center"
            style={{ color: theme.text.muted }}
          >
            #{token.rank}
          </Text>
        )}
        <TokenLogo logo={token.logo} symbol={token.symbol} size="md" />
        <View className="flex-1">
          <Text
            className="text-base font-semibold"
            style={{ color: theme.text.primary }}
            numberOfLines={1}
          >
            {token.name}
          </Text>
          <Text className="text-sm" style={{ color: theme.text.muted }}>
            {token.symbol.toUpperCase()}
          </Text>
        </View>
      </View>
      <View className="items-end gap-1">
        <PriceDisplay price={token.price} showChange={false} size="md" />
        <PercentageBadge value={token.priceChange24h} size="sm" />
      </View>
    </AnimatedPressable>
  );
}

interface TokenListProps {
  tokens: TokenMarketData[];
  onTokenPress?: (token: TokenMarketData) => void;
  isLoading?: boolean;
  showRank?: boolean;
  compact?: boolean;
  emptyMessage?: string;
  ListHeaderComponent?: React.ReactElement;
}

export function TokenList({
  tokens,
  onTokenPress,
  isLoading = false,
  showRank = false,
  compact = false,
  emptyMessage = "No tokens found",
  ListHeaderComponent,
}: TokenListProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
        <Text className="text-sm mt-4" style={{ color: theme.text.muted }}>
          Loading tokens...
        </Text>
      </View>
    );
  }

  if (tokens.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-base" style={{ color: theme.text.muted }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={tokens}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TokenListItem
          token={item}
          onPress={onTokenPress}
          showRank={showRank}
          compact={compact}
        />
      )}
      drawDistance={250}
      ListHeaderComponent={ListHeaderComponent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
    />
  );
}

interface TokenGridItemProps {
  token: TokenMarketData;
  onPress?: (token: TokenMarketData) => void;
}

export function TokenGridItem({ token, onPress }: TokenGridItemProps) {
  const { theme } = useTheme();

  return (
    <AnimatedPressable
      onPress={() => onPress?.(token)}
      {...AnimatedPressablePresets.card}
      className="p-3 rounded-xl m-1"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 0.5,
        borderColor: theme.border,
        width: "47%",
      }}
    >
      <View className="items-center gap-2">
        <TokenLogo logo={token.logo} symbol={token.symbol} size="lg" />
        <Text
          className="text-base font-semibold text-center"
          style={{ color: theme.text.primary }}
          numberOfLines={1}
        >
          {token.symbol}
        </Text>
        <PriceDisplay
          price={token.price}
          change={token.priceChange24h}
          size="sm"
        />
      </View>
    </AnimatedPressable>
  );
}

interface TokenGridProps {
  tokens: TokenMarketData[];
  onTokenPress?: (token: TokenMarketData) => void;
  isLoading?: boolean;
}

export function TokenGrid({
  tokens,
  onTokenPress,
  isLoading = false,
}: TokenGridProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <FlashList
      data={tokens}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TokenGridItem token={item} onPress={onTokenPress} />
      )}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
    />
  );
}

interface TrendingTokensProps {
  tokens: TokenMarketData[];
  onTokenPress?: (token: TokenMarketData) => void;
  isLoading?: boolean;
}

export function TrendingTokens({
  tokens,
  onTokenPress,
  isLoading = false,
}: TrendingTokensProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View className="h-32 items-center justify-center">
        <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <FlashList
      data={tokens.slice(0, 10)}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      renderItem={({ item }) => (
        <AnimatedPressable
          onPress={() => onTokenPress?.(item)}
          {...AnimatedPressablePresets.card}
          className="p-3 rounded-xl items-center"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 0.5,
            borderColor: theme.border,
            width: 100,
          }}
        >
          <TokenLogo logo={item.logo} symbol={item.symbol} size="md" />
          <Text
            className="text-sm font-semibold mt-2"
            style={{ color: theme.text.primary }}
            numberOfLines={1}
          >
            {item.symbol}
          </Text>
          <Text
            className="text-xs font-medium mt-1"
            style={{
              color: item.priceChange24h >= 0 ? theme.success : theme.error,
            }}
          >
            {item.priceChange24h >= 0 ? "+" : ""}
            {item.priceChange24h.toFixed(2)}%
          </Text>
        </AnimatedPressable>
      )}
    />
  );
}
