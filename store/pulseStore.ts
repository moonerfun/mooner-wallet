/**
 * Pulse Store - State management for Pulse streaming data
 * Based on MTT's usePulseDataStore pattern
 *
 * Key features:
 * - Separate sections for new/bonding/bonded tokens
 * - Filter state with server-side and client-side filtering
 * - Token limit enforcement (max 50 per view)
 * - Optimized mergeToken with binary search for insertion
 */

import type { PulseToken, ViewName } from "@/lib/api/mobula/mobulaTypes";
import { getTokenKey } from "@/lib/api/mobula/mobulaTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Re-export types from mobulaTypes for backward compatibility
export type { PulseToken, RawPulseToken, ViewName } from "@/lib/api/mobula/mobulaTypes";
export { normalizeToken, normalizeTokens } from "@/lib/services/normalizeToken";

// Re-export getTokenKey for backward compatibility
export { getTokenKey };

/**
 * Section state for each view (new/bonding/bonded)
 */
export interface SectionState {
  tokens: PulseToken[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  searchQuery: string;
}

// Range value for min/max filters
export interface RangeValue {
  min?: number;
  max?: number;
}

// Range value with time unit (for age filters)
export interface RangeValueWithUnit extends RangeValue {
  unit: TimeUnit;
}

export type TimeUnit = "S" | "Min" | "H" | "D" | "W" | "M" | "Y";

export const TIME_UNITS: TimeUnit[] = ["S", "Min", "H", "D", "W", "M", "Y"];

// Audits filter state (matching MTT)
export interface AuditsFilterState {
  dexPaid: boolean;
  caEndsInPump: boolean;
  age: RangeValueWithUnit;
  top10HoldersPercent: RangeValue;
  devHoldingPercent: RangeValue;
  snipersPercent: RangeValue;
  insidersPercent: RangeValue;
  bundlePercent: RangeValue;
  holders: RangeValue;
  proTraders: RangeValue;
  devMigration: RangeValue;
  devPairsCreated: RangeValue;
}

// Metrics filter state (matching MTT)
export interface MetricsFilterState {
  liquidity: RangeValue;
  volume: RangeValue;
  marketCap: RangeValue;
  bCurvePercent: RangeValue;
  globalFeesPaid: RangeValue;
  txns: RangeValue;
  numBuys: RangeValue;
  numSells: RangeValue;
}

// Socials filter state (matching MTT)
export interface SocialsFilterState {
  twitterReuses: RangeValue;
  tweetAge: RangeValueWithUnit;
  twitter: boolean;
  website: boolean;
  telegram: boolean;
  atLeastOneSocial: boolean;
  onlyPumpLive: boolean;
}

export interface PulseFilterState {
  chainIds: string[];
  protocols: string[];
  includeKeywords: string;
  excludeKeywords: string;
  audits: AuditsFilterState;
  metrics: MetricsFilterState;
  socials: SocialsFilterState;
}

const DEFAULT_RANGE: RangeValue = { min: undefined, max: undefined };
const DEFAULT_RANGE_WITH_UNIT: RangeValueWithUnit = {
  min: undefined,
  max: undefined,
  unit: "H",
};

const DEFAULT_AUDITS: AuditsFilterState = {
  dexPaid: false,
  caEndsInPump: false,
  age: { ...DEFAULT_RANGE_WITH_UNIT },
  top10HoldersPercent: { ...DEFAULT_RANGE },
  devHoldingPercent: { ...DEFAULT_RANGE },
  snipersPercent: { ...DEFAULT_RANGE },
  insidersPercent: { ...DEFAULT_RANGE },
  bundlePercent: { ...DEFAULT_RANGE },
  holders: { ...DEFAULT_RANGE },
  proTraders: { ...DEFAULT_RANGE },
  devMigration: { ...DEFAULT_RANGE },
  devPairsCreated: { ...DEFAULT_RANGE },
};

const DEFAULT_METRICS: MetricsFilterState = {
  liquidity: { ...DEFAULT_RANGE },
  volume: { ...DEFAULT_RANGE },
  marketCap: { ...DEFAULT_RANGE },
  bCurvePercent: { ...DEFAULT_RANGE },
  globalFeesPaid: { ...DEFAULT_RANGE },
  txns: { ...DEFAULT_RANGE },
  numBuys: { ...DEFAULT_RANGE },
  numSells: { ...DEFAULT_RANGE },
};

const DEFAULT_SOCIALS: SocialsFilterState = {
  twitterReuses: { ...DEFAULT_RANGE },
  tweetAge: { ...DEFAULT_RANGE_WITH_UNIT },
  twitter: false,
  website: false,
  telegram: false,
  atLeastOneSocial: false,
  onlyPumpLive: false,
};

const DEFAULT_FILTER: PulseFilterState = {
  chainIds: ["solana:solana"],
  protocols: [],
  includeKeywords: "",
  excludeKeywords: "",
  audits: { ...DEFAULT_AUDITS },
  metrics: { ...DEFAULT_METRICS },
  socials: { ...DEFAULT_SOCIALS },
};

// Helper to create a deep copy of the default filter
function createDefaultFilter(): PulseFilterState {
  return {
    chainIds: [...DEFAULT_FILTER.chainIds],
    protocols: [...DEFAULT_FILTER.protocols],
    includeKeywords: "",
    excludeKeywords: "",
    audits: {
      dexPaid: false,
      caEndsInPump: false,
      age: { min: undefined, max: undefined, unit: "H" },
      top10HoldersPercent: { min: undefined, max: undefined },
      devHoldingPercent: { min: undefined, max: undefined },
      snipersPercent: { min: undefined, max: undefined },
      insidersPercent: { min: undefined, max: undefined },
      bundlePercent: { min: undefined, max: undefined },
      holders: { min: undefined, max: undefined },
      proTraders: { min: undefined, max: undefined },
      devMigration: { min: undefined, max: undefined },
      devPairsCreated: { min: undefined, max: undefined },
    },
    metrics: {
      liquidity: { min: undefined, max: undefined },
      volume: { min: undefined, max: undefined },
      marketCap: { min: undefined, max: undefined },
      bCurvePercent: { min: undefined, max: undefined },
      globalFeesPaid: { min: undefined, max: undefined },
      txns: { min: undefined, max: undefined },
      numBuys: { min: undefined, max: undefined },
      numSells: { min: undefined, max: undefined },
    },
    socials: {
      twitterReuses: { min: undefined, max: undefined },
      tweetAge: { min: undefined, max: undefined, unit: "H" },
      twitter: false,
      website: false,
      telegram: false,
      atLeastOneSocial: false,
      onlyPumpLive: false,
    },
  };
}

export interface PulseState {
  // Section data
  sections: Record<ViewName, SectionState>;

  // Filters per section
  filters: Record<ViewName, PulseFilterState>;

  // Applied filters (copied when user clicks Apply) - triggers WebSocket resubscription
  appliedFilters: Record<ViewName, PulseFilterState>;

  // Version counter to trigger resubscription
  filtersVersion: number;

  // Connection state
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;

  // Actions
  setTokens: (view: ViewName, tokens: PulseToken[]) => void;
  addToken: (view: ViewName, token: PulseToken) => void;
  mergeToken: (view: ViewName, token: PulseToken) => void;
  clearView: (view: ViewName) => void;
  setLoading: (view: ViewName, loading: boolean) => void;
  setError: (view: ViewName, error: string | null) => void;
  setSearchQuery: (view: ViewName, query: string) => void;

  // Filter actions
  setFilter: <K extends keyof PulseFilterState>(
    view: ViewName,
    key: K,
    value: PulseFilterState[K],
  ) => void;
  resetFilters: (view: ViewName) => void;
  applyFilters: (view: ViewName) => void;

  // Connection actions
  setConnected: (connected: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setPaused: (paused: boolean) => void;

  // Helpers
  getFilteredTokens: (view: ViewName) => PulseToken[];
  buildWebSocketFilters: (view: ViewName) => Record<string, unknown>;
}

const TOKEN_LIMIT = 50;

const createDefaultSection = (): SectionState => ({
  tokens: [],
  loading: true,
  error: null,
  lastUpdate: 0,
  searchQuery: "",
});

export const usePulseStore = create<PulseState>()(
  persist(
    (set, get) => ({
      sections: {
        new: createDefaultSection(),
        bonding: createDefaultSection(),
        bonded: createDefaultSection(),
      },

      filters: {
        new: createDefaultFilter(),
        bonding: createDefaultFilter(),
        bonded: createDefaultFilter(),
      },

      appliedFilters: {
        new: createDefaultFilter(),
        bonding: createDefaultFilter(),
        bonded: createDefaultFilter(),
      },

      filtersVersion: 0,

      isConnected: false,
      isStreaming: false,
      isPaused: false,

      setTokens: (view, tokens) =>
        set((state) => {
          // Deduplicate tokens by chainId-address before setting
          const seen = new Set<string>();
          const uniqueTokens = tokens.filter((token) => {
            const key = `${token.chainId}-${token.address}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });

          return {
            sections: {
              ...state.sections,
              [view]: {
                ...state.sections[view],
                tokens: uniqueTokens.slice(0, TOKEN_LIMIT),
                loading: false,
                lastUpdate: Date.now(),
              },
            },
          };
        }),

      addToken: (view, token) =>
        set((state) => {
          const existingTokens = state.sections[view].tokens;
          // Check for duplicates
          const exists = existingTokens.some(
            (t) => t.address === token.address && t.chainId === token.chainId,
          );
          if (exists) return state;

          // Add to beginning, limit total
          const newTokens = [token, ...existingTokens].slice(0, TOKEN_LIMIT);

          return {
            sections: {
              ...state.sections,
              [view]: {
                ...state.sections[view],
                tokens: newTokens,
                lastUpdate: Date.now(),
              },
            },
          };
        }),

      mergeToken: (view, token) =>
        set((state) => {
          const tokens = state.sections[view].tokens;
          const index = tokens.findIndex(
            (t) => t.address === token.address && t.chainId === token.chainId,
          );

          if (index === -1) {
            // Token doesn't exist, add it to the beginning
            return {
              sections: {
                ...state.sections,
                [view]: {
                  ...state.sections[view],
                  tokens: [token, ...tokens].slice(0, TOKEN_LIMIT),
                  lastUpdate: Date.now(),
                },
              },
            };
          }

          // Merge with existing token
          const updatedTokens = [...tokens];
          updatedTokens[index] = { ...updatedTokens[index], ...token };

          return {
            sections: {
              ...state.sections,
              [view]: {
                ...state.sections[view],
                tokens: updatedTokens,
                lastUpdate: Date.now(),
              },
            },
          };
        }),

      clearView: (view) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [view]: {
              ...state.sections[view],
              tokens: [],
              loading: true,
              error: null,
            },
          },
        })),

      setLoading: (view, loading) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [view]: {
              ...state.sections[view],
              loading,
            },
          },
        })),

      setError: (view, error) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [view]: {
              ...state.sections[view],
              error,
              loading: false,
            },
          },
        })),

      setSearchQuery: (view, query) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [view]: {
              ...state.sections[view],
              searchQuery: query,
            },
          },
        })),

      setFilter: (view, key, value) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [view]: {
              ...state.filters[view],
              [key]: value,
            },
          },
        })),

      resetFilters: (view) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [view]: createDefaultFilter(),
          },
        })),

      applyFilters: (view) =>
        set((state) => {
          // Deep copy current filters to appliedFilters
          const currentFilter = state.filters[view];
          const appliedFilter: PulseFilterState = {
            chainIds: [...currentFilter.chainIds],
            protocols: [...currentFilter.protocols],
            includeKeywords: currentFilter.includeKeywords,
            excludeKeywords: currentFilter.excludeKeywords,
            audits: {
              ...currentFilter.audits,
              age: { ...currentFilter.audits.age },
              top10HoldersPercent: {
                ...currentFilter.audits.top10HoldersPercent,
              },
              devHoldingPercent: { ...currentFilter.audits.devHoldingPercent },
              snipersPercent: { ...currentFilter.audits.snipersPercent },
              insidersPercent: { ...currentFilter.audits.insidersPercent },
              bundlePercent: { ...currentFilter.audits.bundlePercent },
              holders: { ...currentFilter.audits.holders },
              proTraders: { ...currentFilter.audits.proTraders },
              devMigration: { ...currentFilter.audits.devMigration },
              devPairsCreated: { ...currentFilter.audits.devPairsCreated },
            },
            metrics: {
              ...currentFilter.metrics,
              liquidity: { ...currentFilter.metrics.liquidity },
              volume: { ...currentFilter.metrics.volume },
              marketCap: { ...currentFilter.metrics.marketCap },
              bCurvePercent: { ...currentFilter.metrics.bCurvePercent },
              globalFeesPaid: { ...currentFilter.metrics.globalFeesPaid },
              txns: { ...currentFilter.metrics.txns },
              numBuys: { ...currentFilter.metrics.numBuys },
              numSells: { ...currentFilter.metrics.numSells },
            },
            socials: {
              ...currentFilter.socials,
              twitterReuses: { ...currentFilter.socials.twitterReuses },
              tweetAge: { ...currentFilter.socials.tweetAge },
            },
          };

          return {
            appliedFilters: {
              ...state.appliedFilters,
              [view]: appliedFilter,
            },
            filtersVersion: state.filtersVersion + 1,
            // Clear the section to prepare for new data
            sections: {
              ...state.sections,
              [view]: {
                ...state.sections[view],
                tokens: [],
                loading: true,
              },
            },
          };
        }),

      setConnected: (connected) => set({ isConnected: connected }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setPaused: (paused) => set({ isPaused: paused }),

      // Build filters object for WebSocket subscription (matches MTT format)
      buildWebSocketFilters: (view) => {
        const { appliedFilters } = get();
        const filter = appliedFilters[view];
        const wsFilters: Record<string, unknown> = {};

        // Protocol filter (preBondingFactory)
        if (filter.protocols.length > 0) {
          // Normalize protocol names for server
          const normalizedProtocols = filter.protocols.map((p) =>
            p.toLowerCase().replace(/[.\s-_]/g, ""),
          );
          wsFilters.preBondingFactory = { in: normalizedProtocols };
        }

        // Metrics filters
        const { metrics } = filter;
        if (
          metrics.volume.min !== undefined ||
          metrics.volume.max !== undefined
        ) {
          wsFilters.volume_24h = {};
          if (metrics.volume.min !== undefined)
            (wsFilters.volume_24h as any).gte = metrics.volume.min;
          if (metrics.volume.max !== undefined)
            (wsFilters.volume_24h as any).lte = metrics.volume.max;
        }
        if (
          metrics.marketCap.min !== undefined ||
          metrics.marketCap.max !== undefined
        ) {
          wsFilters.market_cap = {};
          if (metrics.marketCap.min !== undefined)
            (wsFilters.market_cap as any).gte = metrics.marketCap.min;
          if (metrics.marketCap.max !== undefined)
            (wsFilters.market_cap as any).lte = metrics.marketCap.max;
        }
        if (
          metrics.liquidity.min !== undefined ||
          metrics.liquidity.max !== undefined
        ) {
          wsFilters.liquidity = {};
          if (metrics.liquidity.min !== undefined)
            (wsFilters.liquidity as any).gte = metrics.liquidity.min;
          if (metrics.liquidity.max !== undefined)
            (wsFilters.liquidity as any).lte = metrics.liquidity.max;
        }
        if (
          metrics.bCurvePercent.min !== undefined ||
          metrics.bCurvePercent.max !== undefined
        ) {
          wsFilters.bonding_percentage = {};
          if (metrics.bCurvePercent.min !== undefined)
            (wsFilters.bonding_percentage as any).gte =
              metrics.bCurvePercent.min;
          if (metrics.bCurvePercent.max !== undefined)
            (wsFilters.bonding_percentage as any).lte =
              metrics.bCurvePercent.max;
        }
        if (metrics.txns.min !== undefined || metrics.txns.max !== undefined) {
          wsFilters.trades_24h = {};
          if (metrics.txns.min !== undefined)
            (wsFilters.trades_24h as any).gte = metrics.txns.min;
          if (metrics.txns.max !== undefined)
            (wsFilters.trades_24h as any).lte = metrics.txns.max;
        }
        if (
          metrics.numBuys.min !== undefined ||
          metrics.numBuys.max !== undefined
        ) {
          wsFilters.buys_24h = {};
          if (metrics.numBuys.min !== undefined)
            (wsFilters.buys_24h as any).gte = metrics.numBuys.min;
          if (metrics.numBuys.max !== undefined)
            (wsFilters.buys_24h as any).lte = metrics.numBuys.max;
        }
        if (
          metrics.numSells.min !== undefined ||
          metrics.numSells.max !== undefined
        ) {
          wsFilters.sells_24h = {};
          if (metrics.numSells.min !== undefined)
            (wsFilters.sells_24h as any).gte = metrics.numSells.min;
          if (metrics.numSells.max !== undefined)
            (wsFilters.sells_24h as any).lte = metrics.numSells.max;
        }
        // Fees paid filter (API uses fees_paid_24h)
        if (
          metrics.globalFeesPaid.min !== undefined ||
          metrics.globalFeesPaid.max !== undefined
        ) {
          wsFilters.fees_paid_24h = {};
          if (metrics.globalFeesPaid.min !== undefined)
            (wsFilters.fees_paid_24h as any).gte = metrics.globalFeesPaid.min;
          if (metrics.globalFeesPaid.max !== undefined)
            (wsFilters.fees_paid_24h as any).lte = metrics.globalFeesPaid.max;
        }

        // Audits filters
        const { audits } = filter;
        if (
          audits.holders.min !== undefined ||
          audits.holders.max !== undefined
        ) {
          wsFilters.holders_count = {};
          if (audits.holders.min !== undefined)
            (wsFilters.holders_count as any).gte = audits.holders.min;
          if (audits.holders.max !== undefined)
            (wsFilters.holders_count as any).lte = audits.holders.max;
        }
        if (
          audits.top10HoldersPercent.min !== undefined ||
          audits.top10HoldersPercent.max !== undefined
        ) {
          wsFilters.top_10_holdings_percentage = {};
          if (audits.top10HoldersPercent.min !== undefined)
            (wsFilters.top_10_holdings_percentage as any).gte =
              audits.top10HoldersPercent.min;
          if (audits.top10HoldersPercent.max !== undefined)
            (wsFilters.top_10_holdings_percentage as any).lte =
              audits.top10HoldersPercent.max;
        }
        if (
          audits.devHoldingPercent.min !== undefined ||
          audits.devHoldingPercent.max !== undefined
        ) {
          wsFilters.dev_holdings_percentage = {};
          if (audits.devHoldingPercent.min !== undefined)
            (wsFilters.dev_holdings_percentage as any).gte =
              audits.devHoldingPercent.min;
          if (audits.devHoldingPercent.max !== undefined)
            (wsFilters.dev_holdings_percentage as any).lte =
              audits.devHoldingPercent.max;
        }
        if (
          audits.snipersPercent.min !== undefined ||
          audits.snipersPercent.max !== undefined
        ) {
          wsFilters.snipers_holdings_percentage = {};
          if (audits.snipersPercent.min !== undefined)
            (wsFilters.snipers_holdings_percentage as any).gte =
              audits.snipersPercent.min;
          if (audits.snipersPercent.max !== undefined)
            (wsFilters.snipers_holdings_percentage as any).lte =
              audits.snipersPercent.max;
        }
        if (
          audits.insidersPercent.min !== undefined ||
          audits.insidersPercent.max !== undefined
        ) {
          wsFilters.insiders_holdings_percentage = {};
          if (audits.insidersPercent.min !== undefined)
            (wsFilters.insiders_holdings_percentage as any).gte =
              audits.insidersPercent.min;
          if (audits.insidersPercent.max !== undefined)
            (wsFilters.insiders_holdings_percentage as any).lte =
              audits.insidersPercent.max;
        }
        if (
          audits.bundlePercent.min !== undefined ||
          audits.bundlePercent.max !== undefined
        ) {
          wsFilters.bundlers_holdings_percentage = {};
          if (audits.bundlePercent.min !== undefined)
            (wsFilters.bundlers_holdings_percentage as any).gte =
              audits.bundlePercent.min;
          if (audits.bundlePercent.max !== undefined)
            (wsFilters.bundlers_holdings_percentage as any).lte =
              audits.bundlePercent.max;
        }
        if (
          audits.proTraders.min !== undefined ||
          audits.proTraders.max !== undefined
        ) {
          wsFilters.pro_traders_count = {};
          if (audits.proTraders.min !== undefined)
            (wsFilters.pro_traders_count as any).gte = audits.proTraders.min;
          if (audits.proTraders.max !== undefined)
            (wsFilters.pro_traders_count as any).lte = audits.proTraders.max;
        }
        if (
          audits.devMigration.min !== undefined ||
          audits.devMigration.max !== undefined
        ) {
          wsFilters.deployer_migrations_count = {};
          if (audits.devMigration.min !== undefined)
            (wsFilters.deployer_migrations_count as any).gte =
              audits.devMigration.min;
          if (audits.devMigration.max !== undefined)
            (wsFilters.deployer_migrations_count as any).lte =
              audits.devMigration.max;
        }
        if (audits.dexPaid) {
          wsFilters.dexscreener_ad_paid = { equals: true };
        }
        // Age filter (convert to seconds based on unit, use created_at_offset)
        if (audits.age.min !== undefined || audits.age.max !== undefined) {
          const ageMultiplier =
            audits.age.unit === "S"
              ? 1
              : audits.age.unit === "Min"
                ? 60
                : audits.age.unit === "H"
                  ? 3600
                  : audits.age.unit === "D"
                    ? 86400
                    : audits.age.unit === "W"
                      ? 604800
                      : audits.age.unit === "M"
                        ? 2592000
                        : audits.age.unit === "Y"
                          ? 31536000
                          : 3600; // default to hours
          wsFilters.created_at_offset = {};
          if (audits.age.min !== undefined)
            (wsFilters.created_at_offset as any).gte =
              audits.age.min * ageMultiplier;
          if (audits.age.max !== undefined)
            (wsFilters.created_at_offset as any).lte =
              audits.age.max * ageMultiplier;
        }

        // Socials filters
        const { socials } = filter;
        if (socials.twitter) {
          wsFilters.twitter = { not: null };
        }
        if (socials.website) {
          wsFilters.website = { not: null };
        }
        if (socials.telegram) {
          wsFilters.telegram = { not: null };
        }
        if (socials.atLeastOneSocial) {
          wsFilters.min_socials = 1;
        }
        if (socials.onlyPumpLive) {
          wsFilters.live_status = { equals: "pump_live" };
        }
        if (
          socials.twitterReuses.min !== undefined ||
          socials.twitterReuses.max !== undefined
        ) {
          wsFilters.twitter_reuses_count = {};
          if (socials.twitterReuses.min !== undefined)
            (wsFilters.twitter_reuses_count as any).gte =
              socials.twitterReuses.min;
          if (socials.twitterReuses.max !== undefined)
            (wsFilters.twitter_reuses_count as any).lte =
              socials.twitterReuses.max;
        }

        // Keywords (API uses includeKeywords and excludeKeywords)
        if (filter.includeKeywords.trim()) {
          wsFilters.includeKeywords = filter.includeKeywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k);
        }
        if (filter.excludeKeywords.trim()) {
          wsFilters.excludeKeywords = filter.excludeKeywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k);
        }

        return wsFilters;
      },

      getFilteredTokens: (view) => {
        const { sections } = get();
        const { tokens, searchQuery } = sections[view];

        let filtered = tokens;

        // NOTE: Main filtering is now handled server-side via WebSocket subscription.
        // The buildWebSocketFilters() function sends filter params to the server.
        // Here we only apply real-time search filtering for instant results.

        // Apply search filter (local, instant)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter((token) => {
            const name = (token.name || "").toLowerCase();
            const symbol = (token.symbol || "").toLowerCase();
            const address = (token.address || "").toLowerCase();
            return (
              name.includes(query) ||
              symbol.includes(query) ||
              address.includes(query)
            );
          });
        }

        return filtered;
      },
    }),
    {
      name: "pulse-filters-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist filter-related state, not tokens or connection state
      partialize: (state) => ({
        filters: state.filters,
        appliedFilters: state.appliedFilters,
      }),
      // Merge persisted state with default state on rehydration
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PulseState> | undefined;
        return {
          ...currentState,
          filters: persisted?.filters ?? currentState.filters,
          appliedFilters:
            persisted?.appliedFilters ?? currentState.appliedFilters,
        };
      },
    },
  ),
);
