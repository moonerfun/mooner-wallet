import { useTheme } from "@/contexts/ThemeContext";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  onResend?: () => void;
  loading?: boolean;
  error?: string;
}

export function OTPInput({
  length = 6,
  onComplete,
  onResend,
  loading = false,
  error,
}: OTPInputProps) {
  const { theme, borderRadius: br, fontSize: fs, spacing: sp } = useTheme();
  const [code, setCode] = useState<string[]>(Array(length).fill(""));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(RNTextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];

    // Handle paste
    if (text.length > 1) {
      const pastedCode = text.slice(0, length).split("");
      for (let i = 0; i < pastedCode.length; i++) {
        newCode[i] = pastedCode[i];
      }
      setCode(newCode);

      // Focus the next empty input or last input
      const nextIndex = Math.min(pastedCode.length, length - 1);
      inputRefs.current[nextIndex]?.focus();

      // Check if complete
      if (pastedCode.length === length) {
        onComplete(newCode.join(""));
      }
      return;
    }

    newCode[index] = text;
    setCode(newCode);

    // Move to next input
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete - verify all digits are filled
    const allFilled = newCode.every((digit) => digit !== "");
    if (allFilled) {
      const fullCode = newCode.join("");
      onComplete(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ width: "100%" }}
    >
      <View style={{ alignItems: "center", gap: sp[6] }}>
        {/* OTP Input Boxes */}
        <View
          style={{
            flexDirection: "row",
            gap: sp[2],
            justifyContent: "center",
          }}
        >
          {code.map((digit, index) => (
            <RNTextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? length : 1}
              selectTextOnFocus
              style={{
                width: 48,
                height: 56,
                borderRadius: br.lg,
                borderWidth: 2,
                borderColor:
                  focusedIndex === index ? theme.primary.DEFAULT : theme.border,
                backgroundColor: theme.surface,
                fontSize: fs["2xl"],
                fontWeight: "600",
                color: theme.text.primary,
                textAlign: "center",
              }}
            />
          ))}
        </View>

        {/* Error message */}
        {error && (
          <Text
            style={{
              fontSize: fs.sm,
              color: theme.error,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
        )}

        {/* Resend button */}
        {onResend && (
          <TouchableOpacity onPress={onResend} disabled={loading}>
            <Text
              style={{
                fontSize: fs.sm,
                color: theme.primary.DEFAULT,
                fontWeight: "500",
              }}
            >
              Didn&apos;t receive a code? Resend
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
