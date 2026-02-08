import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  TextInput as RNTextInput,
  Text,
  type TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function TextInput({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  ...props
}: InputProps) {
  const { theme, borderRadius: br, fontSize: fs } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(!secureTextEntry);

  const borderColor = error
    ? theme.error
    : isFocused
      ? theme.primary.DEFAULT
      : theme.border;

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text
          style={{
            fontSize: fs.sm,
            fontWeight: "500",
            color: theme.text.primary,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.surface,
          borderRadius: br.lg,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={theme.text.muted} />
        )}
        <RNTextInput
          {...props}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={theme.text.muted}
          style={[
            {
              flex: 1,
              fontSize: fs.base,
              color: theme.text.primary,
              paddingVertical: 14,
            },
            props.style,
          ]}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecureVisible(!isSecureVisible)}
          >
            <Ionicons
              name={isSecureVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.text.muted}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>
      {(error || helper) && (
        <Text
          style={{
            fontSize: fs.xs,
            color: error ? theme.error : theme.text.muted,
          }}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
}
