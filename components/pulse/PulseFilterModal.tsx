/**
 * PulseFilterModal - Filter modal for Pulse sections (MTT-style)
 * Allows filtering by chain, protocols, audits, metrics, and socials
 */

import { XIcon } from "@/components/ui/XIcon";
import {
  PULSE_CHAINS,
  formatChainName,
  getProtocolsForChains,
} from "@/constants/pulseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import {
  AuditsFilterState,
  MetricsFilterState,
  RangeValue,
  RangeValueWithUnit,
  SocialsFilterState,
  TIME_UNITS,
  TimeUnit,
  ViewName,
  usePulseStore,
} from "@/store/pulseStore";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PulseFilterModalProps {
  visible: boolean;
  onClose: () => void;
  viewName: ViewName;
  onApply?: () => void;
}

type TabName = "audits" | "metrics" | "socials";

// ============================================================================
// RANGE INPUT COMPONENT
// ============================================================================

interface RangeInputProps {
  label: string;
  value: RangeValue | RangeValueWithUnit;
  onChange: (value: RangeValue | RangeValueWithUnit) => void;
  showUnit?: boolean;
  unit?: TimeUnit;
  onUnitChange?: (unit: TimeUnit) => void;
}

const RangeInput = memo(
  ({
    label,
    value,
    onChange,
    showUnit,
    unit,
    onUnitChange,
  }: RangeInputProps) => {
    const { theme } = useTheme();

    const handleMinChange = useCallback(
      (text: string) => {
        const num = text === "" ? undefined : parseFloat(text);
        const newValue = isNaN(num as number) && text !== "" ? value.min : num;
        onChange({ ...value, min: newValue });
      },
      [value, onChange],
    );

    const handleMaxChange = useCallback(
      (text: string) => {
        const num = text === "" ? undefined : parseFloat(text);
        const newValue = isNaN(num as number) && text !== "" ? value.max : num;
        onChange({ ...value, max: newValue });
      },
      [value, onChange],
    );

    return (
      <View style={styles.rangeContainer}>
        <View style={styles.rangeLabelRow}>
          <Text style={[styles.rangeLabel, { color: theme.text.secondary }]}>
            {label}
          </Text>
          {showUnit && onUnitChange && (
            <View style={styles.unitSelector}>
              {TIME_UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.unitButton,
                    {
                      backgroundColor:
                        unit === u ? theme.primary.DEFAULT : theme.surface,
                      borderColor:
                        unit === u ? theme.primary.DEFAULT : theme.border,
                    },
                  ]}
                  onPress={() => onUnitChange(u)}
                >
                  <Text
                    style={[
                      styles.unitText,
                      {
                        color:
                          unit === u
                            ? theme.secondary.dark
                            : theme.text.secondary,
                      },
                    ]}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.rangeInputs}>
          <TextInput
            style={[
              styles.rangeInput,
              { backgroundColor: theme.surface, color: theme.text.primary },
            ]}
            placeholder="Min"
            placeholderTextColor={theme.text.muted}
            keyboardType="numeric"
            value={value.min?.toString() ?? ""}
            onChangeText={handleMinChange}
          />
          <Text style={[styles.rangeSeparator, { color: theme.text.muted }]}>
            to
          </Text>
          <TextInput
            style={[
              styles.rangeInput,
              { backgroundColor: theme.surface, color: theme.text.primary },
            ]}
            placeholder="Max"
            placeholderTextColor={theme.text.muted}
            keyboardType="numeric"
            value={value.max?.toString() ?? ""}
            onChangeText={handleMaxChange}
          />
        </View>
      </View>
    );
  },
);
RangeInput.displayName = "RangeInput";

// ============================================================================
// TOGGLE ROW COMPONENT
// ============================================================================

const ToggleRow = memo(
  ({
    label,
    value,
    onToggle,
    icon,
  }: {
    label: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    icon?: string;
  }) => {
    const { theme } = useTheme();

    // Use XIcon for X/Twitter
    const isXIcon = icon === "logo-x";

    return (
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          {icon &&
            (isXIcon ? (
              <XIcon size={16} color={theme.text.secondary} />
            ) : (
              <Ionicons
                name={icon as any}
                size={16}
                color={theme.text.secondary}
              />
            ))}
          <Text style={[styles.toggleText, { color: theme.text.primary }]}>
            {label}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{
            false: theme.border,
            true: `${theme.primary.DEFAULT}50`,
          }}
          thumbColor={value ? theme.primary.DEFAULT : theme.text.muted}
        />
      </View>
    );
  },
);
ToggleRow.displayName = "ToggleRow";

// ============================================================================
// CHAIN SELECTOR COMPONENT
// ============================================================================

const ChainSelector = memo(
  ({
    selectedChainIds,
    onSelect,
  }: {
    selectedChainIds: string[];
    onSelect: (chainIds: string[]) => void;
  }) => {
    const { theme } = useTheme();
    const [expanded, setExpanded] = useState(false);

    const toggleChain = useCallback(
      (chainId: string) => {
        if (selectedChainIds.includes(chainId)) {
          onSelect(selectedChainIds.filter((id) => id !== chainId));
        } else {
          onSelect([...selectedChainIds, chainId]);
        }
      },
      [selectedChainIds, onSelect],
    );

    return (
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          style={[
            styles.selectorButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={[styles.selectorText, { color: theme.text.primary }]}>
            {formatChainName(selectedChainIds)}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
        {expanded && (
          <View
            style={[
              styles.dropdown,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {PULSE_CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.dropdownItem,
                  selectedChainIds.includes(chain.id) && {
                    backgroundColor: `${theme.primary.DEFAULT}20`,
                  },
                ]}
                onPress={() => toggleChain(chain.id)}
              >
                {chain.icon && (
                  <Image
                    source={{ uri: chain.icon }}
                    style={styles.chainIcon}
                  />
                )}
                <Text
                  style={[styles.dropdownText, { color: theme.text.primary }]}
                >
                  {chain.name}
                </Text>
                {selectedChainIds.includes(chain.id) && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={theme.primary.DEFAULT}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  },
);
ChainSelector.displayName = "ChainSelector";

// ============================================================================
// PROTOCOL CHIPS COMPONENT
// ============================================================================

const ProtocolChips = memo(
  ({
    chainIds,
    selectedProtocols,
    onSelect,
  }: {
    chainIds: string[];
    selectedProtocols: string[];
    onSelect: (protocols: string[]) => void;
  }) => {
    const { theme } = useTheme();
    const [showAll, setShowAll] = useState(false);

    const availableProtocols = useMemo(
      () => getProtocolsForChains(chainIds),
      [chainIds],
    );

    const mainProtocols = availableProtocols.slice(0, 5);
    const additionalProtocols = availableProtocols.slice(5);

    const toggleProtocol = useCallback(
      (protocolName: string) => {
        if (selectedProtocols.includes(protocolName)) {
          onSelect(selectedProtocols.filter((p) => p !== protocolName));
        } else {
          onSelect([...selectedProtocols, protocolName]);
        }
      },
      [selectedProtocols, onSelect],
    );

    return (
      <View style={styles.protocolContainer}>
        <View style={styles.protocolRow}>
          {mainProtocols.map((protocol) => (
            <TouchableOpacity
              key={protocol.id}
              style={[
                styles.protocolChip,
                {
                  backgroundColor: selectedProtocols.includes(protocol.name)
                    ? `${theme.success}20`
                    : theme.surface,
                  borderColor: selectedProtocols.includes(protocol.name)
                    ? theme.success
                    : theme.border,
                },
              ]}
              onPress={() => toggleProtocol(protocol.name)}
            >
              {protocol.icon && (
                <Image
                  source={{ uri: protocol.icon }}
                  style={styles.protocolIcon}
                />
              )}
              <Text
                style={[
                  styles.protocolText,
                  {
                    color: selectedProtocols.includes(protocol.name)
                      ? theme.success
                      : theme.text.secondary,
                  },
                ]}
              >
                {protocol.name}
              </Text>
            </TouchableOpacity>
          ))}
          {additionalProtocols.length > 0 && (
            <TouchableOpacity
              style={[
                styles.protocolChip,
                styles.expandChip,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => setShowAll(!showAll)}
            >
              <Ionicons
                name={showAll ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
        {showAll && additionalProtocols.length > 0 && (
          <View style={styles.protocolRow}>
            {additionalProtocols.map((protocol) => (
              <TouchableOpacity
                key={protocol.id}
                style={[
                  styles.protocolChip,
                  {
                    backgroundColor: selectedProtocols.includes(protocol.name)
                      ? `${theme.success}20`
                      : theme.surface,
                    borderColor: selectedProtocols.includes(protocol.name)
                      ? theme.success
                      : theme.border,
                  },
                ]}
                onPress={() => toggleProtocol(protocol.name)}
              >
                {protocol.icon && (
                  <Image
                    source={{ uri: protocol.icon }}
                    style={styles.protocolIcon}
                  />
                )}
                <Text
                  style={[
                    styles.protocolText,
                    {
                      color: selectedProtocols.includes(protocol.name)
                        ? theme.success
                        : theme.text.secondary,
                    },
                  ]}
                >
                  {protocol.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  },
);
ProtocolChips.displayName = "ProtocolChips";

// ============================================================================
// AUDITS TAB
// ============================================================================

const AuditsTab = memo(
  ({
    audits,
    onUpdate,
  }: {
    audits: AuditsFilterState;
    onUpdate: <K extends keyof AuditsFilterState>(
      key: K,
      value: AuditsFilterState[K],
    ) => void;
  }) => {
    return (
      <View style={styles.tabContent}>
        <View style={styles.checkboxRow}>
          <ToggleRow
            label="DEX Paid"
            value={audits.dexPaid}
            onToggle={(v) => onUpdate("dexPaid", v)}
          />
          <ToggleRow
            label="CA ends in 'pump'"
            value={audits.caEndsInPump}
            onToggle={(v) => onUpdate("caEndsInPump", v)}
          />
        </View>

        <RangeInput
          label="Age"
          value={audits.age}
          onChange={(v) => onUpdate("age", { ...audits.age, ...v })}
          showUnit
          unit={audits.age.unit}
          onUnitChange={(u) => onUpdate("age", { ...audits.age, unit: u })}
        />
        <RangeInput
          label="Top 10 Holders %"
          value={audits.top10HoldersPercent}
          onChange={(v) => onUpdate("top10HoldersPercent", v)}
        />
        <RangeInput
          label="Dev Holding %"
          value={audits.devHoldingPercent}
          onChange={(v) => onUpdate("devHoldingPercent", v)}
        />
        <RangeInput
          label="Snipers %"
          value={audits.snipersPercent}
          onChange={(v) => onUpdate("snipersPercent", v)}
        />
        <RangeInput
          label="Insiders %"
          value={audits.insidersPercent}
          onChange={(v) => onUpdate("insidersPercent", v)}
        />
        <RangeInput
          label="Bundle %"
          value={audits.bundlePercent}
          onChange={(v) => onUpdate("bundlePercent", v)}
        />
        <RangeInput
          label="Holders"
          value={audits.holders}
          onChange={(v) => onUpdate("holders", v)}
        />
        <RangeInput
          label="Pro Traders"
          value={audits.proTraders}
          onChange={(v) => onUpdate("proTraders", v)}
        />
        <RangeInput
          label="Dev Migration"
          value={audits.devMigration}
          onChange={(v) => onUpdate("devMigration", v)}
        />
        <RangeInput
          label="Dev Pairs Created"
          value={audits.devPairsCreated}
          onChange={(v) => onUpdate("devPairsCreated", v)}
        />
      </View>
    );
  },
);
AuditsTab.displayName = "AuditsTab";

// ============================================================================
// METRICS TAB
// ============================================================================

const MetricsTab = memo(
  ({
    metrics,
    onUpdate,
  }: {
    metrics: MetricsFilterState;
    onUpdate: <K extends keyof MetricsFilterState>(
      key: K,
      value: MetricsFilterState[K],
    ) => void;
  }) => {
    return (
      <View style={styles.tabContent}>
        <RangeInput
          label="Liquidity ($)"
          value={metrics.liquidity}
          onChange={(v) => onUpdate("liquidity", v)}
        />
        <RangeInput
          label="Volume ($)"
          value={metrics.volume}
          onChange={(v) => onUpdate("volume", v)}
        />
        <RangeInput
          label="Market Cap ($)"
          value={metrics.marketCap}
          onChange={(v) => onUpdate("marketCap", v)}
        />
        <RangeInput
          label="B Curve %"
          value={metrics.bCurvePercent}
          onChange={(v) => onUpdate("bCurvePercent", v)}
        />
        <RangeInput
          label="Global Fees Paid"
          value={metrics.globalFeesPaid}
          onChange={(v) => onUpdate("globalFeesPaid", v)}
        />
        <RangeInput
          label="TXNs"
          value={metrics.txns}
          onChange={(v) => onUpdate("txns", v)}
        />
        <RangeInput
          label="Num Buys"
          value={metrics.numBuys}
          onChange={(v) => onUpdate("numBuys", v)}
        />
        <RangeInput
          label="Num Sells"
          value={metrics.numSells}
          onChange={(v) => onUpdate("numSells", v)}
        />
      </View>
    );
  },
);
MetricsTab.displayName = "MetricsTab";

// ============================================================================
// SOCIALS TAB
// ============================================================================

const SocialsTab = memo(
  ({
    socials,
    onUpdate,
    includeKeywords,
    excludeKeywords,
    onKeywordsChange,
  }: {
    socials: SocialsFilterState;
    onUpdate: <K extends keyof SocialsFilterState>(
      key: K,
      value: SocialsFilterState[K],
    ) => void;
    includeKeywords: string;
    excludeKeywords: string;
    onKeywordsChange: (type: "include" | "exclude", value: string) => void;
  }) => {
    const { theme } = useTheme();

    return (
      <View style={styles.tabContent}>
        <RangeInput
          label="Twitter Reuses"
          value={socials.twitterReuses}
          onChange={(v) => onUpdate("twitterReuses", v)}
        />

        <View style={styles.toggleGrid}>
          <ToggleRow
            label="X"
            icon="logo-x"
            value={socials.twitter}
            onToggle={(v) => onUpdate("twitter", v)}
          />
          <ToggleRow
            label="Website"
            icon="globe"
            value={socials.website}
            onToggle={(v) => onUpdate("website", v)}
          />
          <ToggleRow
            label="Telegram"
            icon="paper-plane"
            value={socials.telegram}
            onToggle={(v) => onUpdate("telegram", v)}
          />
          <ToggleRow
            label="At Least One Social"
            icon="share-social"
            value={socials.atLeastOneSocial}
            onToggle={(v) => onUpdate("atLeastOneSocial", v)}
          />
          <ToggleRow
            label="Only Pump Live"
            icon="rocket"
            value={socials.onlyPumpLive}
            onToggle={(v) => onUpdate("onlyPumpLive", v)}
          />
        </View>

        <View style={styles.keywordsSection}>
          <Text style={[styles.keywordsLabel, { color: theme.text.secondary }]}>
            Include keywords (comma separated)
          </Text>
          <TextInput
            style={[
              styles.keywordsInput,
              { backgroundColor: theme.surface, color: theme.text.primary },
            ]}
            placeholder="ai, meme, doge..."
            placeholderTextColor={theme.text.muted}
            value={includeKeywords}
            onChangeText={(text) => onKeywordsChange("include", text)}
          />
        </View>

        <View style={styles.keywordsSection}>
          <Text style={[styles.keywordsLabel, { color: theme.text.secondary }]}>
            Exclude keywords (comma separated)
          </Text>
          <TextInput
            style={[
              styles.keywordsInput,
              { backgroundColor: theme.surface, color: theme.text.primary },
            ]}
            placeholder="scam, rug..."
            placeholderTextColor={theme.text.muted}
            value={excludeKeywords}
            onChangeText={(text) => onKeywordsChange("exclude", text)}
          />
        </View>
      </View>
    );
  },
);
SocialsTab.displayName = "SocialsTab";

// ============================================================================
// MAIN FILTER MODAL
// ============================================================================

export const PulseFilterModal = memo(
  ({ visible, onClose, viewName, onApply }: PulseFilterModalProps) => {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<TabName>("audits");

    // Get filter state and actions from store
    const viewFilters = usePulseStore((state) => state.filters[viewName]);
    const setFilter = usePulseStore((state) => state.setFilter);
    const resetFilters = usePulseStore((state) => state.resetFilters);

    const handleApply = useCallback(() => {
      onApply?.();
      onClose();
    }, [onApply, onClose]);

    const handleReset = useCallback(() => {
      resetFilters(viewName);
    }, [resetFilters, viewName]);

    // Update handlers for nested filter objects - use getState() for fresh values
    const updateAudits = useCallback(
      <K extends keyof AuditsFilterState>(
        key: K,
        value: AuditsFilterState[K],
      ) => {
        const currentAudits = usePulseStore.getState().filters[viewName].audits;
        setFilter(viewName, "audits", { ...currentAudits, [key]: value });
      },
      [setFilter, viewName],
    );

    const updateMetrics = useCallback(
      <K extends keyof MetricsFilterState>(
        key: K,
        value: MetricsFilterState[K],
      ) => {
        const currentMetrics =
          usePulseStore.getState().filters[viewName].metrics;
        setFilter(viewName, "metrics", { ...currentMetrics, [key]: value });
      },
      [setFilter, viewName],
    );

    const updateSocials = useCallback(
      <K extends keyof SocialsFilterState>(
        key: K,
        value: SocialsFilterState[K],
      ) => {
        const currentSocials =
          usePulseStore.getState().filters[viewName].socials;
        setFilter(viewName, "socials", { ...currentSocials, [key]: value });
      },
      [setFilter, viewName],
    );

    const handleKeywordsChange = useCallback(
      (type: "include" | "exclude", value: string) => {
        if (type === "include") {
          setFilter(viewName, "includeKeywords", value);
        } else {
          setFilter(viewName, "excludeKeywords", value);
        }
      },
      [setFilter, viewName],
    );

    const tabs: { key: TabName; label: string; icon: string }[] = [
      { key: "audits", label: "Audits", icon: "shield-checkmark" },
      { key: "metrics", label: "Metrics", icon: "stats-chart" },
      { key: "socials", label: "Socials", icon: "share-social" },
    ];

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.background }}
          edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
        >
          <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Filters
              </Text>
              <TouchableOpacity
                onPress={handleReset}
                style={styles.headerButton}
              >
                <Text
                  style={[styles.resetText, { color: theme.primary.DEFAULT }]}
                >
                  Reset
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chain & Protocol Selectors */}
            <View
              style={[styles.selectorsRow, { borderBottomColor: theme.border }]}
            >
              <View style={styles.selectorWrapper}>
                <Text
                  style={[
                    styles.selectorLabel,
                    { color: theme.text.secondary },
                  ]}
                >
                  Chain
                </Text>
                <ChainSelector
                  selectedChainIds={viewFilters.chainIds}
                  onSelect={(chainIds) =>
                    setFilter(viewName, "chainIds", chainIds)
                  }
                />
              </View>
            </View>

            <View
              style={[styles.protocolsRow, { borderBottomColor: theme.border }]}
            >
              <Text
                style={[styles.selectorLabel, { color: theme.text.secondary }]}
              >
                Protocols
              </Text>
              <ProtocolChips
                chainIds={viewFilters.chainIds}
                selectedProtocols={viewFilters.protocols}
                onSelect={(protocols) =>
                  setFilter(viewName, "protocols", protocols)
                }
              />
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && {
                      borderBottomColor: theme.primary.DEFAULT,
                      borderBottomWidth: 2,
                    },
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={
                      activeTab === tab.key
                        ? theme.primary.DEFAULT
                        : theme.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeTab === tab.key
                            ? theme.primary.DEFAULT
                            : theme.text.secondary,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === "audits" && (
                <AuditsTab
                  audits={viewFilters.audits}
                  onUpdate={updateAudits}
                />
              )}
              {activeTab === "metrics" && (
                <MetricsTab
                  metrics={viewFilters.metrics}
                  onUpdate={updateMetrics}
                />
              )}
              {activeTab === "socials" && (
                <SocialsTab
                  socials={viewFilters.socials}
                  onUpdate={updateSocials}
                  includeKeywords={viewFilters.includeKeywords}
                  excludeKeywords={viewFilters.excludeKeywords}
                  onKeywordsChange={handleKeywordsChange}
                />
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[
                  styles.applyButton,
                  { backgroundColor: theme.primary.DEFAULT },
                ]}
                onPress={handleApply}
              >
                <Text
                  style={[
                    styles.applyButtonText,
                    { color: theme.secondary.dark },
                  ]}
                >
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  },
);
PulseFilterModal.displayName = "PulseFilterModal";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  resetText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "right",
  },
  selectorsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectorWrapper: {
    gap: 8,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  protocolsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  selectorContainer: {
    position: "relative",
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
  },
  chainIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  protocolContainer: {
    gap: 8,
  },
  protocolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  protocolChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    gap: 6,
  },
  expandChip: {
    paddingHorizontal: 8,
  },
  protocolIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  protocolText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  tabContent: {
    gap: 16,
  },
  checkboxRow: {
    gap: 8,
  },
  toggleGrid: {
    gap: 8,
  },
  rangeContainer: {
    gap: 8,
  },
  rangeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  rangeInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rangeInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  rangeSeparator: {
    fontSize: 13,
  },
  unitSelector: {
    flexDirection: "row",
    gap: 4,
  },
  unitButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  unitText: {
    fontSize: 11,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "500",
  },
  keywordsSection: {
    marginTop: 8,
    gap: 8,
  },
  keywordsLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  keywordsInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  applyButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
