/**
 * Token Stats Component
 * Displays key metrics: market cap, volume, liquidity, holders, etc.
 */

import { useTheme } from "@/contexts/ThemeContext";
import { TokenDetails } from "@/store/tokenStore";
import {
  formatCompactNumber,
  formatCount,
  formatPercent,
  formatPrice,
} from "@/utils/formatters";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface TokenStatsProps {
  token: TokenDetails;
}

type TimeFrame = "5m" | "1h" | "6h" | "24h";

export const TokenStats = memo(({ token }: TokenStatsProps) => {
  const { theme } = useTheme();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("24h");

  // Use unified formatters with $ prefix
  const formatNumber = (num?: number, decimals = 2) =>
    formatCompactNumber(num, { prefix: "$", decimals, showDash: true });

  const getPriceChange = () => {
    switch (timeFrame) {
      case "5m":
        return token.priceChange5m;
      case "1h":
        return token.priceChange1h;
      case "6h":
        return token.priceChange6h;
      case "24h":
        return token.priceChange24h;
    }
  };

  const getVolume = () => {
    switch (timeFrame) {
      case "5m":
        return token.volume5m;
      case "1h":
        return token.volume1h;
      case "6h":
        return token.volume6h;
      case "24h":
        return token.volume24h;
    }
  };

  const priceChange = getPriceChange();
  const volume = getVolume();
  const isPositive = (priceChange ?? 0) >= 0;

  // Calculate buy/sell ratio for progress bar
  const totalTxns = (token.buys24h || 0) + (token.sells24h || 0);
  const buyRatio = totalTxns > 0 ? (token.buys24h || 0) / totalTxns : 0.5;

  // Calculate holder distribution total for "others"
  const knownHoldings =
    (token.top10HoldingsPercentage || 0) +
    (token.devHoldingsPercentage || 0) +
    (token.insidersHoldingsPercentage || 0) +
    (token.snipersHoldingsPercentage || 0) +
    (token.bundlersHoldingsPercentage || 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Timeframe Tabs */}
      <View style={[styles.timeframeTabs, { borderBottomColor: theme.border }]}>
        {(["5m", "1h", "6h", "24h"] as TimeFrame[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[
              styles.timeframeTab,
              timeFrame === tf && {
                backgroundColor: theme.primary.DEFAULT + "20",
              },
            ]}
            onPress={() => setTimeFrame(tf)}
          >
            <Text
              style={[
                styles.timeframeText,
                {
                  color:
                    timeFrame === tf
                      ? theme.primary.DEFAULT
                      : theme.text.secondary,
                },
              ]}
            >
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.statsScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Price Change */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            Price Change ({timeFrame})
          </Text>
          <Text
            style={[
              styles.priceChangeValue,
              { color: isPositive ? theme.success : theme.error },
            ]}
          >
            {priceChange !== undefined
              ? `${isPositive ? "+" : ""}${priceChange.toFixed(2)}%`
              : "-"}
          </Text>
        </View>

        {/* Volume by Timeframe */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            Volume ({timeFrame})
          </Text>
          <Text style={[styles.valueText, { color: theme.text.primary }]}>
            {formatNumber(volume)}
          </Text>
          {timeFrame === "24h" && (
            <View style={styles.subRow}>
              <Text style={[styles.subLabel, { color: theme.success }]}>
                Buy: {formatNumber(token.volumeBuy24h)}
              </Text>
              <Text style={[styles.subLabel, { color: theme.error }]}>
                Sell: {formatNumber(token.volumeSell24h)}
              </Text>
            </View>
          )}
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            Transactions (24h)
          </Text>
          <View style={styles.txnRow}>
            <View style={styles.txnItem}>
              <Text style={[styles.txnLabel, { color: theme.success }]}>
                Buys
              </Text>
              <Text style={[styles.txnValue, { color: theme.text.primary }]}>
                {formatCount(token.buys24h)}
              </Text>
            </View>
            <View style={styles.txnItem}>
              <Text style={[styles.txnLabel, { color: theme.error }]}>
                Sells
              </Text>
              <Text style={[styles.txnValue, { color: theme.text.primary }]}>
                {formatCount(token.sells24h)}
              </Text>
            </View>
            <View style={styles.txnItem}>
              <Text style={[styles.txnLabel, { color: theme.text.secondary }]}>
                Total
              </Text>
              <Text style={[styles.txnValue, { color: theme.text.primary }]}>
                {formatCount(token.txns24h)}
              </Text>
            </View>
          </View>
          {/* Buy/Sell Progress Bar */}
          <View
            style={[
              styles.progressBar,
              { backgroundColor: theme.error + "40" },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.success, width: `${buyRatio * 100}%` },
              ]}
            />
          </View>
          {/* Unique traders */}
          {(token.buyers24h || token.sellers24h || token.traders24h) && (
            <View style={[styles.tradersRow, { marginTop: 8 }]}>
              {typeof token.buyers24h === "number" && (
                <Text style={[styles.subLabel, { color: theme.success }]}>
                  {formatCount(token.buyers24h)} buyers
                </Text>
              )}
              {typeof token.sellers24h === "number" && (
                <Text style={[styles.subLabel, { color: theme.error }]}>
                  {formatCount(token.sellers24h)} sellers
                </Text>
              )}
              {typeof token.traders24h === "number" && (
                <Text style={[styles.subLabel, { color: theme.text.muted }]}>
                  {formatCount(token.traders24h)} unique
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Market Stats Grid */}
        <View style={styles.statsGrid}>
          <StatItem
            label="Market Cap"
            value={formatNumber(token.marketCap)}
            theme={theme}
          />
          <StatItem
            label="Liquidity"
            value={formatNumber(token.liquidity)}
            theme={theme}
          />
          <StatItem
            label="FDV"
            value={formatNumber(token.fullyDilutedValuation)}
            theme={theme}
          />
          <StatItem
            label="Holders"
            value={formatCount(token.holdersCount)}
            theme={theme}
          />
        </View>

        {/* All-Time High/Low */}
        {(token.athUSD || token.atlUSD) && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: theme.text.secondary }]}
            >
              Price History
            </Text>
            <View style={styles.statsGrid}>
              <StatItem
                label="All-Time High"
                value={formatPrice(token.athUSD)}
                theme={theme}
              />
              <StatItem
                label="All-Time Low"
                value={formatPrice(token.atlUSD)}
                theme={theme}
              />
            </View>
          </View>
        )}

        {/* Holder Distribution */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            Holder Distribution
          </Text>
          <View style={styles.statsGrid}>
            <StatItem
              label="Top 10"
              value={formatPercent(token.top10HoldingsPercentage)}
              theme={theme}
            />
            <StatItem
              label="Top 50"
              value={formatPercent(token.top50HoldingsPercentage)}
              theme={theme}
            />
            <StatItem
              label="Top 100"
              value={formatPercent(token.top100HoldingsPercentage)}
              theme={theme}
            />
            <StatItem
              label="Top 200"
              value={formatPercent(token.top200HoldingsPercentage)}
              theme={theme}
            />
          </View>
        </View>

        {/* Risk Holders Distribution */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            Holder Types
          </Text>
          <View style={styles.statsGrid}>
            <StatItem
              label="Dev Holdings"
              value={formatPercent(token.devHoldingsPercentage)}
              theme={theme}
              warning={(token.devHoldingsPercentage ?? 0) > 10}
            />
            <StatItem
              label="Insiders"
              value={formatPercent(token.insidersHoldingsPercentage)}
              theme={theme}
              warning={(token.insidersHoldingsPercentage ?? 0) > 15}
            />
            <StatItem
              label="Snipers"
              value={formatPercent(token.snipersHoldingsPercentage)}
              theme={theme}
              warning={(token.snipersHoldingsPercentage ?? 0) > 10}
            />
            <StatItem
              label="Bundlers"
              value={formatPercent(token.bundlersHoldingsPercentage)}
              theme={theme}
              warning={(token.bundlersHoldingsPercentage ?? 0) > 5}
            />
            <StatItem
              label="Pro Traders"
              value={formatPercent(token.proTradersHoldingsPercentage)}
              theme={theme}
            />
          </View>
        </View>

        {/* Security Flags (if available) */}
        {token.security && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: theme.text.secondary }]}
            >
              Security
            </Text>
            <View style={styles.securityRow}>
              <SecurityBadge
                label="Verified"
                isPositive={token.security.verified}
                theme={theme}
              />
              <SecurityBadge
                label="Honeypot"
                isPositive={!token.security.honeypot}
                theme={theme}
              />
              <SecurityBadge
                label="Rug Pull"
                isPositive={!token.security.rugPull}
                theme={theme}
              />
              <SecurityBadge
                label="Scam"
                isPositive={!token.security.scam}
                theme={theme}
              />
            </View>
          </View>
        )}

        {/* Organic Trading Metrics */}
        {(token.organicTrades24h ||
          token.organicTraders24h ||
          token.organicVolume24h) && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: theme.text.secondary }]}
            >
              Organic Activity (24h)
            </Text>
            <View style={styles.statsGrid}>
              <StatItem
                label="Organic Trades"
                value={formatCount(token.organicTrades24h)}
                theme={theme}
              />
              <StatItem
                label="Organic Traders"
                value={formatCount(token.organicTraders24h)}
                theme={theme}
              />
              <StatItem
                label="Organic Volume"
                value={formatNumber(token.organicVolume24h)}
                theme={theme}
                fullWidth
              />
            </View>
          </View>
        )}

        {/* Fees Paid */}
        {(token.feesPaid24h || token.totalFeesPaid) && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: theme.text.secondary }]}
            >
              Fees Paid
            </Text>
            <View style={styles.statsGrid}>
              <StatItem
                label="24h Fees"
                value={formatNumber(token.feesPaid24h)}
                theme={theme}
              />
              <StatItem
                label="Total Fees"
                value={formatNumber(token.totalFeesPaid)}
                theme={theme}
              />
            </View>
          </View>
        )}

        {/* Bonding Progress (if applicable) */}
        {token.bondingPercentage !== undefined && !token.isBonded && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: theme.text.secondary }]}
            >
              Bonding Progress
            </Text>
            <View
              style={[styles.bondingBar, { backgroundColor: theme.border }]}
            >
              <View
                style={[
                  styles.bondingFill,
                  {
                    backgroundColor: theme.primary.DEFAULT,
                    width: `${Math.min(token.bondingPercentage, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.bondingText, { color: theme.text.secondary }]}>
              {token.bondingPercentage.toFixed(1)}% Complete
            </Text>
          </View>
        )}

        {/* Makers */}
        <View style={styles.section}>
          <StatItem
            label="Unique Makers (24h)"
            value={formatCount(token.makers24h)}
            theme={theme}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
});

interface StatItemProps {
  label: string;
  value: string;
  theme: any;
  fullWidth?: boolean;
  warning?: boolean;
}

const StatItem = memo(
  ({ label, value, theme, fullWidth, warning }: StatItemProps) => (
    <View style={[styles.statItem, fullWidth && styles.statItemFull]}>
      <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.statValue,
          { color: warning ? theme.warning : theme.text.primary },
        ]}
      >
        {value}
        {warning && " ⚠️"}
      </Text>
    </View>
  ),
);

interface SecurityBadgeProps {
  label: string;
  isPositive?: boolean;
  theme: any;
}

const SecurityBadge = memo(
  ({ label, isPositive, theme }: SecurityBadgeProps) => (
    <View
      style={[
        styles.securityBadge,
        {
          backgroundColor: isPositive
            ? theme.success + "20"
            : theme.error + "20",
        },
      ]}
    >
      <Ionicons
        name={isPositive ? "checkmark-circle" : "close-circle"}
        size={14}
        color={isPositive ? theme.success : theme.error}
      />
      <Text
        style={[
          styles.securityBadgeText,
          { color: isPositive ? theme.success : theme.error },
        ]}
      >
        {label}
      </Text>
    </View>
  ),
);

StatItem.displayName = "StatItem";
SecurityBadge.displayName = "SecurityBadge";
TokenStats.displayName = "TokenStats";

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  timeframeTabs: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  timeframeTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsScroll: {
    padding: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  priceChangeValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  txnItem: {
    alignItems: "center",
  },
  txnLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  txnValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  tradersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  valueText: {
    fontSize: 18,
    fontWeight: "700",
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  subLabel: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 8,
  },
  statItem: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  statItemFull: {
    width: "100%",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  securityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  securityBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bondingBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  bondingFill: {
    height: "100%",
    borderRadius: 4,
  },
  bondingText: {
    fontSize: 12,
    textAlign: "center",
  },
});
