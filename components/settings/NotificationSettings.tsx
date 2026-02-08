/**
 * Notification Settings Component
 * UI for managing notification preferences
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import type { NotificationPreferences } from "@/types/notifications";

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
    <View
      className="flex-row items-center justify-between py-4 border-b"
      style={{ borderColor: theme.border }}
    >
      <View className="flex-1 mr-4">
        <Text
          className="text-base font-medium"
          style={{ color: theme.text.primary }}
        >
          {title}
        </Text>
        {description && (
          <Text
            className="text-sm mt-1"
            style={{ color: theme.text.secondary }}
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
    <Text
      className="text-sm font-semibold uppercase mt-6 mb-2"
      style={{ color: theme.primary.DEFAULT }}
    >
      {title}
    </Text>
  );
}

interface ThresholdInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  suffix?: string;
}

function ThresholdInput({
  value,
  onChange,
  label,
  suffix = "USD",
}: ThresholdInputProps) {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(value.toString());

  const handleBlur = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue > 0) {
      onChange(numValue);
    } else {
      setInputValue(value.toString());
    }
  };

  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-base" style={{ color: theme.text.primary }}>
        {label}
      </Text>
      <View className="flex-row items-center">
        <TextInput
          className="px-3 py-2 rounded-lg text-right min-w-[80px]"
          style={{
            backgroundColor: theme.surface,
            color: theme.text.primary,
            borderWidth: 0.5,
            borderColor: theme.border,
          }}
          value={inputValue}
          onChangeText={setInputValue}
          onBlur={handleBlur}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Text className="ml-2" style={{ color: theme.text.secondary }}>
          {suffix}
        </Text>
      </View>
    </View>
  );
}

export function NotificationSettings() {
  const { theme } = useTheme();
  const {
    preferences,
    isLoadingPreferences,
    updatePreferences,
    permissionStatus,
    requestPermissionWithPrompt,
    isRegistered,
  } = useNotificationContext();

  const [isSaving, setIsSaving] = useState(false);
  // Local state for optimistic updates
  const [localPrefs, setLocalPrefs] = useState<
    Partial<NotificationPreferences>
  >({});

  // Sync local prefs when server prefs load
  React.useEffect(() => {
    if (preferences) {
      setLocalPrefs({});
    }
  }, [preferences]);

  const handleUpdate = async (updates: Partial<NotificationPreferences>) => {
    // Optimistic update
    setLocalPrefs((prev) => ({ ...prev, ...updates }));
    setIsSaving(true);
    try {
      const success = await updatePreferences(updates);
      if (!success) {
        // Revert on failure
        setLocalPrefs((prev) => {
          const newPrefs = { ...prev };
          Object.keys(updates).forEach((key) => {
            delete newPrefs[key as keyof NotificationPreferences];
          });
          return newPrefs;
        });
        console.warn("NotificationSettings: Failed to update preferences");
      }
    } catch (error) {
      console.error("NotificationSettings: Error updating preferences", error);
      // Revert on error
      setLocalPrefs((prev) => {
        const newPrefs = { ...prev };
        Object.keys(updates).forEach((key) => {
          delete newPrefs[key as keyof NotificationPreferences];
        });
        return newPrefs;
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle toggling the master push notifications switch
  const handlePushNotificationsToggle = async (value: boolean) => {
    // If user is trying to enable notifications, check system permission first
    if (value && permissionStatus !== "granted") {
      const granted = await requestPermissionWithPrompt();
      if (!granted) {
        // User didn't grant permission, don't toggle the switch
        return;
      }
    }
    // Permission granted or user is disabling, proceed with update
    handleUpdate({ notifications_enabled: value });
  };

  if (isLoadingPreferences) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
      </View>
    );
  }

  // Merge server prefs with local optimistic updates
  const prefs = {
    ...preferences,
    ...localPrefs,
  } as NotificationPreferences | null;
  const isEnabled = prefs?.notifications_enabled ?? true;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Database Connection Status */}
      {!preferences && !isLoadingPreferences && (
        <View
          className="p-4 rounded-xl mb-4"
          style={{ backgroundColor: theme.error + "20" }}
        >
          <Text className="font-semibold" style={{ color: theme.error }}>
            ⚠️ Unable to Load Settings
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: theme.text.secondary }}
          >
            Please check your connection or try again later. Changes may not be
            saved.
          </Text>
        </View>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <View
          className="p-3 rounded-xl mb-4 flex-row items-center"
          style={{ backgroundColor: theme.primary.DEFAULT + "20" }}
        >
          <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
          <Text className="ml-2" style={{ color: theme.primary.DEFAULT }}>
            Saving...
          </Text>
        </View>
      )}

      {/* Permission Status - only show if explicitly denied/undetermined, not while loading */}
      {permissionStatus !== null && permissionStatus !== "granted" && (
        <TouchableOpacity
          className="p-4 rounded-xl mb-4"
          style={{ backgroundColor: theme.warning + "20" }}
          onPress={requestPermissionWithPrompt}
        >
          <Text className="font-semibold" style={{ color: theme.warning }}>
            ⚠️ Notifications Disabled
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: theme.text.secondary }}
          >
            Tap to enable push notifications in system settings
          </Text>
        </TouchableOpacity>
      )}

      {/* Registration Status */}
      {!isRegistered && permissionStatus === "granted" && (
        <View
          className="p-4 rounded-xl mb-4"
          style={{ backgroundColor: theme.surface }}
        >
          <Text style={{ color: theme.text.secondary }}>
            Registering for notifications...
          </Text>
        </View>
      )}

      {/* Master Toggle */}
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="Push Notifications"
          description="Enable all push notifications"
          value={isEnabled}
          onToggle={handlePushNotificationsToggle}
        />
      </View>

      {/* Whale Alerts */}
      <SectionHeader title="Whale Alerts 🐋" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="Large Trade Alerts"
          description="Get notified when users make big trades"
          value={prefs?.whale_alerts_enabled ?? true}
          onToggle={(value) => handleUpdate({ whale_alerts_enabled: value })}
          disabled={!isEnabled}
        />
        <ThresholdInput
          label="Minimum amount"
          value={prefs?.whale_alert_threshold ?? 1000}
          onChange={(value) => handleUpdate({ whale_alert_threshold: value })}
        />
      </View>

      {/* KOL Activity */}
      <SectionHeader title="KOL Activity 🔥" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="KOL Trade Notifications"
          description="When KOLs you follow make trades"
          value={prefs?.kol_trade_notifications ?? true}
          onToggle={(value) => handleUpdate({ kol_trade_notifications: value })}
          disabled={!isEnabled}
        />
        <SettingRow
          title="New Position Alerts"
          description="When KOLs enter new token positions"
          value={prefs?.kol_new_position_notifications ?? true}
          onToggle={(value) =>
            handleUpdate({ kol_new_position_notifications: value })
          }
          disabled={!isEnabled}
        />
        <SettingRow
          title="Tier Changes"
          description="When KOLs reach new tiers"
          value={prefs?.kol_tier_change_notifications ?? true}
          onToggle={(value) =>
            handleUpdate({ kol_tier_change_notifications: value })
          }
          disabled={!isEnabled}
        />
      </View>

      {/* Portfolio Alerts */}
      <SectionHeader title="Portfolio 📊" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="Price Alerts"
          description="Significant price movements in your holdings"
          value={prefs?.portfolio_alerts_enabled ?? true}
          onToggle={(value) =>
            handleUpdate({ portfolio_alerts_enabled: value })
          }
          disabled={!isEnabled}
        />
        <ThresholdInput
          label="Price change threshold"
          value={prefs?.price_change_threshold ?? 10}
          onChange={(value) => handleUpdate({ price_change_threshold: value })}
          suffix="%"
        />
        <SettingRow
          title="PnL Alerts"
          description="Profit and loss notifications"
          value={prefs?.pnl_alerts_enabled ?? true}
          onToggle={(value) => handleUpdate({ pnl_alerts_enabled: value })}
          disabled={!isEnabled}
        />
      </View>

      {/* Copy Trading */}
      <SectionHeader title="Copy Trading 📋" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="Trade Executed"
          description="When a copy trade is executed"
          value={prefs?.copy_trade_executed ?? true}
          onToggle={(value) => handleUpdate({ copy_trade_executed: value })}
          disabled={!isEnabled}
        />
        <SettingRow
          title="Trade Failed"
          description="When a copy trade fails"
          value={prefs?.copy_trade_failed ?? true}
          onToggle={(value) => handleUpdate({ copy_trade_failed: value })}
          disabled={!isEnabled}
        />
      </View>

      {/* Social */}
      <SectionHeader title="Social 👥" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="New Followers"
          description="When someone starts following you"
          value={prefs?.new_follower_notifications ?? true}
          onToggle={(value) =>
            handleUpdate({ new_follower_notifications: value })
          }
          disabled={!isEnabled}
        />
        <SettingRow
          title="New Copy Traders"
          description="When someone starts copying your trades"
          value={prefs?.new_copy_trader_notifications ?? true}
          onToggle={(value) =>
            handleUpdate({ new_copy_trader_notifications: value })
          }
          disabled={!isEnabled}
        />
        <SettingRow
          title="Leaderboard Updates"
          description="When you enter the leaderboard"
          value={prefs?.leaderboard_notifications ?? true}
          onToggle={(value) =>
            handleUpdate({ leaderboard_notifications: value })
          }
          disabled={!isEnabled}
        />
      </View>

      {/* Quiet Hours */}
      <SectionHeader title="Quiet Hours 🌙" />
      <View
        className="p-4 rounded-xl"
        style={{ backgroundColor: theme.surface }}
      >
        <SettingRow
          title="Enable Quiet Hours"
          description="Pause notifications during set hours"
          value={prefs?.quiet_hours_enabled ?? false}
          onToggle={(value) => handleUpdate({ quiet_hours_enabled: value })}
          disabled={!isEnabled}
        />
        {prefs?.quiet_hours_enabled && (
          <View className="mt-2">
            <Text style={{ color: theme.text.secondary }}>
              {prefs.quiet_hours_start} - {prefs.quiet_hours_end}
            </Text>
          </View>
        )}
      </View>

      {/* Saving indicator */}
      {isSaving && (
        <View className="absolute top-4 right-4">
          <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
        </View>
      )}

      {/* Bottom padding */}
      <View className="h-20" />
    </ScrollView>
  );
}

export default NotificationSettings;
