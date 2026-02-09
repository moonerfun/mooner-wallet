/**
 * Quick Buy Settings Component
 * Configure quick buy preset amounts and enable/disable the feature
 */

import { useTheme } from "@/contexts/ThemeContext";
import { useSettingsStore } from "@/store/settingsStore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface SettingRowProps {
  title: string;
  description?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

function SettingRow({
  title,
  description,
  value,
  onToggle,
  disabled,
}: SettingRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.settingRow, { borderColor: theme.border }]}>
      <View style={styles.settingRowContent}>
        <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
          {title}
        </Text>
        {description && (
          <Text
            style={[styles.settingDescription, { color: theme.text.secondary }]}
          >
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{
          false: theme.border,
          true: theme.primary.DEFAULT,
        }}
        thumbColor={value ? theme.secondary.dark : theme.text.muted}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();

  return (
    <Text style={[styles.sectionHeader, { color: theme.primary.DEFAULT }]}>
      {title}
    </Text>
  );
}

export function QuickBuySettings() {
  const { theme } = useTheme();

  // Settings store
  const quickBuyEnabled = useSettingsStore((s) => s.quickBuyEnabled);
  const quickBuyAmounts = useSettingsStore((s) => s.quickBuyAmounts);
  const quickBuyDefaultAmount = useSettingsStore(
    (s) => s.quickBuyDefaultAmount,
  );
  const setQuickBuyEnabled = useSettingsStore((s) => s.setQuickBuyEnabled);
  const setQuickBuyAmounts = useSettingsStore((s) => s.setQuickBuyAmounts);
  const setQuickBuyDefaultAmount = useSettingsStore(
    (s) => s.setQuickBuyDefaultAmount,
  );

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editingAmounts, setEditingAmounts] =
    useState<number[]>(quickBuyAmounts);
  const [newAmount, setNewAmount] = useState("");

  const handleToggleEnabled = (enabled: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setQuickBuyEnabled(enabled);
  };

  const handleSetDefault = (amount: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setQuickBuyDefaultAmount(amount);
  };

  const handleRemoveAmount = (amount: number) => {
    if (editingAmounts.length <= 1) {
      Alert.alert("Cannot Remove", "You need at least one quick buy amount.");
      return;
    }

    const newAmounts = editingAmounts.filter((a) => a !== amount);
    setEditingAmounts(newAmounts);

    // If we removed the default, set a new default
    if (amount === quickBuyDefaultAmount && newAmounts.length > 0) {
      setQuickBuyDefaultAmount(newAmounts[0]);
    }
  };

  const handleAddAmount = () => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid positive number.");
      return;
    }

    if (editingAmounts.includes(amount)) {
      Alert.alert("Duplicate Amount", "This amount already exists.");
      return;
    }

    if (editingAmounts.length >= 6) {
      Alert.alert("Maximum Reached", "You can have up to 6 quick buy amounts.");
      return;
    }

    const newAmounts = [...editingAmounts, amount].sort((a, b) => a - b);
    setEditingAmounts(newAmounts);
    setNewAmount("");
  };

  const handleSaveAmounts = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setQuickBuyAmounts(editingAmounts);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditingAmounts(quickBuyAmounts);
    setIsEditing(false);
    setNewAmount("");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          Quick Buy
        </Text>
        <Text
          style={[styles.headerDescription, { color: theme.text.secondary }]}
        >
          Buy tokens instantly with preset USD amounts.
        </Text>
      </View>

      {/* Enable/Disable Toggle */}
      <SettingRow
        title="Enable Quick Buy"
        description="Show quick buy buttons on token pages"
        value={quickBuyEnabled}
        onToggle={handleToggleEnabled}
      />

      {quickBuyEnabled && (
        <>
          <SectionHeader title="Preset Amounts" />

          {/* Amount Chips */}
          <View
            style={[styles.amountsCard, { backgroundColor: theme.surface }]}
          >
            <View style={styles.amountsHeader}>
              <Text
                style={[styles.amountsLabel, { color: theme.text.secondary }]}
              >
                Tap to set default • Long press in edit mode to remove
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isEditing) {
                    handleCancelEdit();
                  } else {
                    setIsEditing(true);
                    setEditingAmounts(quickBuyAmounts);
                  }
                }}
              >
                <Text
                  style={[styles.editButton, { color: theme.primary.DEFAULT }]}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountsGrid}>
              {(isEditing ? editingAmounts : quickBuyAmounts).map((amount) => {
                const isDefault = amount === quickBuyDefaultAmount;

                return (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.amountChip,
                      {
                        backgroundColor: isDefault
                          ? theme.success
                          : theme.background,
                        borderColor: isDefault ? theme.success : theme.border,
                      },
                    ]}
                    onPress={() => handleSetDefault(amount)}
                    onLongPress={() => {
                      if (isEditing) {
                        handleRemoveAmount(amount);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.amountText,
                        { color: isDefault ? "#fff" : theme.text.primary },
                      ]}
                    >
                      ${amount}
                    </Text>
                    {isDefault && (
                      <View style={styles.defaultBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#fff"
                        />
                      </View>
                    )}
                    {isEditing && (
                      <View
                        style={[
                          styles.removeBadge,
                          { backgroundColor: theme.error },
                        ]}
                      >
                        <Ionicons name="close" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Add New Amount (in edit mode) */}
            {isEditing && (
              <View style={styles.addAmountRow}>
                <View
                  style={[
                    styles.addAmountInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: theme.text.secondary }}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: theme.text.primary }]}
                    value={newAmount}
                    onChangeText={setNewAmount}
                    placeholder="New amount"
                    placeholderTextColor={theme.text.muted}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    { backgroundColor: theme.primary.DEFAULT },
                  ]}
                  onPress={handleAddAmount}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Save Button (in edit mode) */}
            {isEditing && (
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.success }]}
                onPress={handleSaveAmounts}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingRowContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
  amountsCard: {
    borderRadius: 16,
    padding: 16,
  },
  amountsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  amountsLabel: {
    fontSize: 12,
    flex: 1,
  },
  editButton: {
    fontSize: 14,
    fontWeight: "600",
  },
  amountsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  amountChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    position: "relative",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "600",
  },
  defaultBadge: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  removeBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addAmountRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  addAmountInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    fontSize: 16,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
