/**
 * Trader Modal Component
 * Full-screen modal showing wallet portfolio analysis
 * Similar to MTT web version's WalletPortfolioModal
 */

import { useTheme } from "@/contexts/ThemeContext";
import { getExplorerAddressUrl } from "@/constants/chains";
import { useWalletAnalysis } from "@/hooks";
import { useTraderModalStore } from "@/store/traderModalStore";
import {
  AnalysisTimeframe,
  useWalletAnalysisStore,
  WalletActivity,
  WalletPosition,
} from "@/store/walletAnalysisStore";
import {
  formatCompactNumber,
  formatPercent as formatPercentUtil,
  truncateAddress,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const EMOJI_OPTIONS = [
  "😎",
  "🐋",
  "🎯",
  "🤖",
  "💎",
  "🚀",
  "🔥",
  "👑",
  "🦈",
  "🐂",
];

const TIMEFRAMES: { label: string; value: AnalysisTimeframe }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

export const TraderModal = () => {
  const { theme } = useTheme();
  const { isOpen, walletAddress, blockchain, closeModal } =
    useTraderModalStore();
  const {
    analysis,
    isLoading,
    error,
    timeframe,
    activeTab,
    nicknames,
    setTimeframe,
    setActiveTab,
    setNickname,
    clearAnalysis,
  } = useWalletAnalysisStore();

  // Use the wallet analysis hook for data fetching
  useWalletAnalysis({
    walletAddress,
    blockchain,
    enabled: isOpen,
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [nickname, setNicknameText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("😎");
  const [showRealized, setShowRealized] = useState(false); // Toggle for PNL view

  // Get saved nickname if exists
  useEffect(() => {
    if (walletAddress) {
      const saved = nicknames[walletAddress.toLowerCase()];
      if (saved) {
        setNicknameText(saved.nickname);
        setSelectedEmoji(saved.emoji);
      } else {
        setNicknameText("");
        setSelectedEmoji("😎");
      }
    }
  }, [walletAddress, nicknames]);

  const handleClose = useCallback(() => {
    closeModal();
    clearAnalysis();
  }, [closeModal, clearAnalysis]);

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
    }
  };

  const handleOpenExplorer = () => {
    if (!walletAddress || !blockchain) return;

    const explorerUrl = getExplorerAddressUrl(blockchain, walletAddress);
    if (explorerUrl) {
      Linking.openURL(explorerUrl);
    }
  };

  const handleSaveNickname = () => {
    if (walletAddress && nickname.trim()) {
      setNickname(walletAddress, nickname.trim(), selectedEmoji);
    }
  };

  // Use unified formatters
  const shortenAddress = (address: string) => truncateAddress(address, 6, 4);

  const formatUsd = (value: number, showSign = false) => {
    const prefix = showSign && value > 0 ? "+" : "";
    return prefix + formatCompactNumber(value, { prefix: "$", decimals: 2 });
  };

  const formatPercent = (value: number) =>
    formatPercentUtil(value, { decimals: 1, showSign: true });

  const renderPosition = ({ item }: { item: WalletPosition }) => {
    const pnlValue = showRealized ? item.realizedPnl : item.unrealizedPnl;
    const pnlColor = pnlValue >= 0 ? theme.success : theme.error;

    return (
      <View style={[styles.positionRow, { borderBottomColor: theme.border }]}>
        <View style={styles.positionToken}>
          {item.tokenLogo ? (
            <Image source={{ uri: item.tokenLogo }} style={styles.tokenLogo} />
          ) : (
            <View
              style={[
                styles.tokenLogoPlaceholder,
                { backgroundColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text.muted, fontSize: 10 }}>
                {item.tokenSymbol.charAt(0)}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.tokenSymbol, { color: theme.text.primary }]}>
              {item.tokenSymbol}
            </Text>
            <Text style={[styles.tokenAmount, { color: theme.text.secondary }]}>
              {Number(item.amount || 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.positionValue}>
          <Text style={[styles.positionUsd, { color: theme.text.primary }]}>
            {formatUsd(item.amountUsd)}
          </Text>
          <Text style={[styles.positionPnl, { color: pnlColor }]}>
            {formatUsd(pnlValue, true)}
          </Text>
        </View>
      </View>
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderActivity = ({ item }: { item: WalletActivity }) => {
    const isSwap = item.type === "swap";
    const isTransfer = item.type === "transfer";
    const iconName = isSwap
      ? "swap-horizontal"
      : isTransfer
        ? "arrow-forward"
        : "ellipse";
    const iconColor = isSwap ? theme.primary.DEFAULT : theme.text.secondary;

    // Get USD value for display
    const usdValue = item.tokenIn?.amountUsd || item.tokenOut?.amountUsd || 0;

    return (
      <View style={[styles.activityRow, { borderBottomColor: theme.border }]}>
        <View
          style={[styles.activityIcon, { backgroundColor: iconColor + "20" }]}
        >
          <Ionicons name={iconName} size={16} color={iconColor} />
        </View>
        <View style={styles.activityDetails}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityType, { color: theme.text.primary }]}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
            {usdValue > 0 && (
              <Text style={[styles.activityUsd, { color: theme.text.primary }]}>
                {formatUsd(usdValue)}
              </Text>
            )}
          </View>
          {isSwap && item.tokenIn && item.tokenOut && (
            <Text
              style={[styles.activitySwap, { color: theme.text.secondary }]}
              numberOfLines={1}
            >
              {Number(item.tokenIn.amount || 0).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {item.tokenIn.symbol} →{" "}
              {Number(item.tokenOut.amount || 0).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {item.tokenOut.symbol}
            </Text>
          )}
          {isTransfer && item.tokenIn && (
            <Text
              style={[styles.activitySwap, { color: theme.text.secondary }]}
              numberOfLines={1}
            >
              {Number(item.tokenIn.amount || 0).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {item.tokenIn.symbol}
            </Text>
          )}
        </View>
        <Text style={[styles.activityTime, { color: theme.text.muted }]}>
          {formatTimeAgo(item.timestamp)}
        </Text>
      </View>
    );
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Wallet Analysis
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Wallet Identity */}
          <View
            style={[styles.identitySection, { backgroundColor: theme.surface }]}
          >
            <View style={styles.identityRow}>
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Text style={styles.emoji}>{selectedEmoji}</Text>
              </TouchableOpacity>

              <View style={styles.nicknameContainer}>
                <TextInput
                  style={[
                    styles.nicknameInput,
                    { color: theme.text.primary, borderColor: theme.border },
                  ]}
                  placeholder="Rename to track..."
                  placeholderTextColor={theme.text.muted}
                  value={nickname}
                  onChangeText={setNicknameText}
                  onBlur={handleSaveNickname}
                />
              </View>
            </View>

            {showEmojiPicker && (
              <View
                style={[
                  styles.emojiPicker,
                  { backgroundColor: theme.background },
                ]}
              >
                {EMOJI_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      selectedEmoji === emoji && {
                        backgroundColor: theme.primary.DEFAULT + "30",
                      },
                    ]}
                    onPress={() => {
                      setSelectedEmoji(emoji);
                      setShowEmojiPicker(false);
                      if (walletAddress) {
                        setNickname(walletAddress, nickname, emoji);
                      }
                    }}
                  >
                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.addressRow}>
              <Text style={[styles.address, { color: theme.text.secondary }]}>
                {walletAddress ? shortenAddress(walletAddress) : ""}
              </Text>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={styles.addressAction}
              >
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={theme.text.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleOpenExplorer}
                style={styles.addressAction}
              >
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.text.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Timeframe Selector */}
          <View
            style={[
              styles.timeframeContainer,
              { backgroundColor: theme.surface },
            ]}
          >
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.value}
                style={[
                  styles.timeframeButton,
                  timeframe === tf.value && {
                    backgroundColor: theme.primary.DEFAULT,
                  },
                ]}
                onPress={() => setTimeframe(tf.value)}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    {
                      color:
                        timeframe === tf.value ? "#fff" : theme.text.secondary,
                    },
                  ]}
                >
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary.DEFAULT} />
              <Text
                style={[styles.loadingText, { color: theme.text.secondary }]}
              >
                Loading wallet data...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={40} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.text.secondary }]}>
                {error}
              </Text>
            </View>
          ) : analysis ? (
            <>
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Wallet Balance
                  </Text>
                  <Text
                    style={[styles.statValue, { color: theme.text.primary }]}
                  >
                    {formatUsd(analysis.totalBalanceUsd)}
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Realized PNL
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          analysis.realizedPnl >= 0
                            ? theme.success
                            : theme.error,
                      },
                    ]}
                  >
                    {formatUsd(analysis.realizedPnl, true)}
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Unrealized PNL
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          analysis.unrealizedPnl >= 0
                            ? theme.success
                            : theme.error,
                      },
                    ]}
                  >
                    {formatUsd(analysis.unrealizedPnl, true)}
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Win Rate
                  </Text>
                  <Text
                    style={[styles.statValue, { color: theme.primary.DEFAULT }]}
                  >
                    {(analysis.winRate * 100).toFixed(1)}%
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Total Bought
                  </Text>
                  <Text style={[styles.statValue, { color: theme.success }]}>
                    {formatUsd(analysis.totalBought)}
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Total Sold
                  </Text>
                  <Text style={[styles.statValue, { color: theme.error }]}>
                    {formatUsd(analysis.totalSold)}
                  </Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Txns (Buy/Sell)
                  </Text>
                  <View style={styles.txnRow}>
                    <Text style={[styles.txnBuy, { color: theme.success }]}>
                      {analysis.buyCount}
                    </Text>
                    <Text
                      style={[styles.txnSeparator, { color: theme.text.muted }]}
                    >
                      /
                    </Text>
                    <Text style={[styles.txnSell, { color: theme.error }]}>
                      {analysis.sellCount}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: theme.surface }]}
                >
                  <Text
                    style={[styles.statLabel, { color: theme.text.secondary }]}
                  >
                    Active Tokens
                  </Text>
                  <Text
                    style={[styles.statValue, { color: theme.text.primary }]}
                  >
                    {analysis.activeTokenCount}
                  </Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
                {(["positions", "history", "activity"] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tab,
                      activeTab === tab && {
                        borderBottomColor: theme.primary.DEFAULT,
                        borderBottomWidth: 2,
                      },
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color:
                            activeTab === tab
                              ? theme.primary.DEFAULT
                              : theme.text.secondary,
                        },
                      ]}
                    >
                      {tab === "positions"
                        ? "Active Positions"
                        : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab Content */}
              <View style={styles.tabContent}>
                {activeTab === "positions" && (
                  <>
                    {/* Position list header with PNL toggle */}
                    <View
                      style={[
                        styles.positionListHeader,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.positionListHeaderText,
                          { color: theme.text.secondary },
                        ]}
                      >
                        Token / Amount
                      </Text>
                      <TouchableOpacity
                        style={styles.pnlToggle}
                        onPress={() => setShowRealized(!showRealized)}
                      >
                        <Text
                          style={[
                            styles.positionListHeaderText,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {showRealized ? "Realized PNL" : "Unrealized PNL"}
                        </Text>
                        <Ionicons
                          name="swap-vertical"
                          size={12}
                          color={theme.primary.DEFAULT}
                        />
                      </TouchableOpacity>
                    </View>
                    <FlashList
                      data={analysis.positions}
                      keyExtractor={(item, index) =>
                        `${item.tokenAddress || "pos"}-${index}`
                      }
                      renderItem={renderPosition}
                      scrollEnabled={false}
                      ListEmptyComponent={
                        <View style={styles.emptyTab}>
                          <Ionicons
                            name="wallet-outline"
                            size={32}
                            color={theme.text.muted}
                          />
                          <Text
                            style={[
                              styles.emptyTabText,
                              { color: theme.text.secondary },
                            ]}
                          >
                            No active positions
                          </Text>
                        </View>
                      }
                    />
                  </>
                )}

                {activeTab === "history" && (
                  <View style={styles.emptyTab}>
                    <Ionicons
                      name="time-outline"
                      size={32}
                      color={theme.text.muted}
                    />
                    <Text
                      style={[
                        styles.emptyTabText,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Trade history coming soon
                    </Text>
                  </View>
                )}

                {activeTab === "activity" && (
                  <FlashList
                    data={analysis.activities}
                    keyExtractor={(item, index) =>
                      `${item.id || "act"}-${index}`
                    }
                    renderItem={renderActivity}
                    scrollEnabled={false}
                    ListEmptyComponent={
                      <View style={styles.emptyTab}>
                        <Ionicons
                          name="pulse-outline"
                          size={32}
                          color={theme.text.muted}
                        />
                        <Text
                          style={[
                            styles.emptyTabText,
                            { color: theme.text.secondary },
                          ]}
                        >
                          No recent activity
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};

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
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  identitySection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
  },
  nicknameContainer: {
    flex: 1,
  },
  nicknameInput: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  emojiPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOptionText: {
    fontSize: 20,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  address: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  addressAction: {
    padding: 4,
  },
  timeframeContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  timeframeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    padding: 12,
    borderRadius: 10,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  txnBuy: {
    fontSize: 16,
    fontWeight: "700",
  },
  txnSeparator: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  txnSell: {
    fontSize: 16,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabContent: {
    minHeight: 200,
  },
  positionListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  positionListHeaderText: {
    fontSize: 12,
    fontWeight: "500",
  },
  pnlToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  positionToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tokenLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: "600",
  },
  tokenAmount: {
    fontSize: 12,
  },
  positionValue: {
    alignItems: "flex-end",
  },
  positionUsd: {
    fontSize: 14,
    fontWeight: "600",
  },
  positionPnl: {
    fontSize: 12,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDetails: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityType: {
    fontSize: 14,
    fontWeight: "600",
  },
  activityUsd: {
    fontSize: 13,
    fontWeight: "600",
  },
  activitySwap: {
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
  },
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTabText: {
    fontSize: 14,
  },
});

export default TraderModal;
