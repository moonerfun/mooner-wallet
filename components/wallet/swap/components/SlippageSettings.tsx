/**
 * SlippageSettings Component
 * Slippage tolerance configuration
 */

import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface SlippageSettingsProps {
  value: string;
  onChange: (value: string) => void;
  theme: {
    surface: string;
    border: string;
    primary: { DEFAULT: string };
    secondary: { dark: string };
    text: { primary: string; secondary: string; muted: string };
  };
}

const PRESET_VALUES = ["0.1", "0.5", "1.0"];

export function SlippageSettings({
  value,
  onChange,
  theme,
}: SlippageSettingsProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.text.secondary }]}>
        Slippage Tolerance
      </Text>
      <View style={styles.options}>
        {PRESET_VALUES.map((preset) => {
          const isSelected = value === preset;
          return (
            <TouchableOpacity
              key={preset}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected
                    ? theme.primary.DEFAULT
                    : theme.surface,
                  borderColor: isSelected
                    ? theme.primary.DEFAULT
                    : theme.border,
                },
              ]}
              onPress={() => onChange(preset)}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color: isSelected
                      ? theme.secondary.dark
                      : theme.text.primary,
                  },
                ]}
              >
                {preset}%
              </Text>
            </TouchableOpacity>
          );
        })}
        <View
          style={[
            styles.customInput,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text.primary }]}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            placeholder="Custom"
            placeholderTextColor={theme.text.muted}
          />
          <Text style={[styles.percent, { color: theme.text.secondary }]}>
            %
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 10,
  },
  options: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  customInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
  percent: {
    fontSize: 13,
    marginLeft: 4,
  },
});
