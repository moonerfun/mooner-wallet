/**
 * RecipientInput Component
 * Address input with paste button for send modal
 */

import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RecipientInputProps } from "./types";

export function RecipientInput({
  value,
  onChange,
  onPaste,
  error,
  placeholder,
}: RecipientInputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        Recipient Address
      </Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.text.primary }]}
          placeholder={placeholder}
          placeholderTextColor={theme.text.muted}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={2}
        />
        <TouchableOpacity
          onPress={onPaste}
          style={[
            styles.pasteButton,
            { backgroundColor: theme.primary.DEFAULT },
          ]}
        >
          <Ionicons name="clipboard-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 24,
  },
  pasteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
});
