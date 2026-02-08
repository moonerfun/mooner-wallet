import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Text, View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  title,
  subtitle,
  children,
  padding = "md",
  style,
  ...props
}: CardProps) {
  const { theme, borderRadius: br, spacing: sp, fontSize: fs } = useTheme();

  const paddingValues = {
    none: 0,
    sm: sp[2], // 8px - reduced from 12px
    md: sp[2.5], // 10px - aligned with PulseTokenCard
    lg: sp[4], // 16px - reduced from 24px
  };

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: br.lg, // Reduced from xl
          borderWidth: 0.5, // Lighter border like PulseTokenCard
          borderColor: theme.border,
          padding: paddingValues[padding],
        },
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={{ marginBottom: sp[3] }}>
          {title && (
            <Text
              style={{
                fontSize: fs.lg,
                fontWeight: "600",
                color: theme.text.primary,
              }}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.text.secondary,
                marginTop: sp[1],
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
    </View>
  );
}
