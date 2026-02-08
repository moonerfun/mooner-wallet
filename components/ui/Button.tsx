import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const { theme, borderRadius: br, fontSize: fs } = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: fs.sm },
    md: { paddingVertical: 12, paddingHorizontal: 24, fontSize: fs.base },
    lg: { paddingVertical: 16, paddingHorizontal: 32, fontSize: fs.lg },
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.primary.DEFAULT,
      textColor: "#0D0D0A", // Dark text on gold/yellow
    },
    secondary: {
      backgroundColor: theme.secondary.DEFAULT,
      textColor: "#FFFFFF",
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.primary.DEFAULT,
      textColor: theme.primary.DEFAULT,
    },
    ghost: {
      backgroundColor: "transparent",
      textColor: theme.text.primary,
    },
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...props}
      disabled={isDisabled}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: br.lg,
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          backgroundColor: currentVariant.backgroundColor,
          borderWidth: (currentVariant as any).borderWidth || 0,
          borderColor: (currentVariant as any).borderColor,
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? "100%" : undefined,
          gap: 8,
        },
        props.style,
      ]}
      className={`active:opacity-80 ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={currentVariant.textColor} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text
            style={{
              color: currentVariant.textColor,
              fontSize: currentSize.fontSize,
              fontWeight: "600",
            }}
          >
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}
