import {
  formatCompactNumber,
  formatPriceChange,
  formatPrice as formatPriceUtil,
} from "@/utils/formatters";
import React from "react";
import { Image, Text, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface PriceDisplayProps {
  price: number;
  change?: number;
  showChange?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  compact?: boolean;
}

// Use unified formatters
const formatPrice = (price: number): string => formatPriceUtil(price);
const formatChange = (change: number): string => formatPriceChange(change);

export function PriceDisplay({
  price,
  change = 0,
  showChange = true,
  size = "md",
  compact = false,
}: PriceDisplayProps) {
  const { theme } = useTheme();

  const sizeStyles = {
    sm: {
      priceClass: "text-sm",
      changeClass: "text-xs",
    },
    md: {
      priceClass: "text-base",
      changeClass: "text-sm",
    },
    lg: {
      priceClass: "text-lg",
      changeClass: "text-sm",
    },
    xl: {
      priceClass: "text-2xl",
      changeClass: "text-base",
    },
  };

  const styles = sizeStyles[size];
  const isPositive = change >= 0;

  return (
    <View
      className={compact ? "flex-row items-center gap-2" : "flex-col items-end"}
    >
      <Text
        className={`${styles.priceClass} font-semibold`}
        style={{ color: theme.text.primary }}
      >
        {formatPrice(price)}
      </Text>
      {showChange && (
        <Text
          className={`${styles.changeClass} font-medium`}
          style={{ color: isPositive ? theme.success : theme.error }}
        >
          {formatChange(change)}
        </Text>
      )}
    </View>
  );
}

interface TokenLogoProps {
  logo?: string;
  symbol: string;
  size?: "sm" | "md" | "lg";
}

export function TokenLogo({ logo, symbol, size = "md" }: TokenLogoProps) {
  const { theme } = useTheme();

  const sizeMap = {
    sm: 24,
    md: 40,
    lg: 56,
  };

  const dimension = sizeMap[size];
  const textSize =
    size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-lg";

  if (logo) {
    return (
      <Image
        source={{ uri: logo }}
        style={{
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: theme.surface,
        }}
      />
    );
  }

  // Fallback to symbol initials
  const initials = symbol.slice(0, 2).toUpperCase();

  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: theme.primary.DEFAULT,
      }}
      className="items-center justify-center"
    >
      <Text className={`${textSize} font-bold text-white`}>{initials}</Text>
    </View>
  );
}

interface PercentageBadgeProps {
  value: number;
  size?: "sm" | "md";
}

export function PercentageBadge({ value, size = "md" }: PercentageBadgeProps) {
  const { theme } = useTheme();
  const isPositive = value >= 0;

  const sizeClass = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <View
      className={`${sizeClass} rounded-md`}
      style={{
        backgroundColor: isPositive ? `${theme.success}20` : `${theme.error}20`,
      }}
    >
      <Text
        className={`${textClass} font-semibold`}
        style={{ color: isPositive ? theme.success : theme.error }}
      >
        {formatChange(value)}
      </Text>
    </View>
  );
}

interface MarketCapDisplayProps {
  value: number;
  label?: string;
}

export function MarketCapDisplay({
  value,
  label = "Market Cap",
}: MarketCapDisplayProps) {
  const { theme } = useTheme();

  return (
    <View className="flex-col">
      <Text className="text-xs" style={{ color: theme.text.muted }}>
        {label}
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: theme.text.primary }}
      >
        {formatCompactNumber(value, { prefix: "$", decimals: 2 })}
      </Text>
    </View>
  );
}

interface VolumeDisplayProps {
  value: number;
  label?: string;
}

export function VolumeDisplay({
  value,
  label = "24h Volume",
}: VolumeDisplayProps) {
  const { theme } = useTheme();

  return (
    <View className="flex-col">
      <Text className="text-xs" style={{ color: theme.text.muted }}>
        {label}
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: theme.text.primary }}
      >
        {formatCompactNumber(value, { prefix: "$", decimals: 2 })}
      </Text>
    </View>
  );
}
