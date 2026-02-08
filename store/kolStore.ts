/**
 * KOL Store - State management for KOL leaderboard and trades
 * Updated to work with Mobula-powered data fetching
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  KolLeaderboardEntry,
  KolRecentTrade,
  User,
} from "@/lib/api/supabase/supabaseTypes";

// Timeframe filter options
export type LeaderboardTimeframe = "7d" | "30d" | "all";
export type LeaderboardSortBy = "pnl" | "volume" | "trades" | "winRate";

export interface KolState {
  // Current user's KOL profile
  currentUser: User | null;
  isTwitterLinked: boolean;

  // Leaderboard data
  leaderboard: KolLeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;

  // Recent trades feed
  recentTrades: KolRecentTrade[];
  tradesLoading: boolean;
  tradesError: string | null;

  // Selected KOL for detail view
  selectedKol: KolLeaderboardEntry | null;
  selectedKolTrades: KolRecentTrade[];

  // Filters
  timeframe: LeaderboardTimeframe;
  sortBy: LeaderboardSortBy;
  tierFilter: string | null;

  // Following
  followingIds: string[];
  showFollowingOnly: boolean;

  // Actions
  setCurrentUser: (user: User | null) => void;
  setIsTwitterLinked: (linked: boolean) => void;
  setTierFilter: (tier: string | null) => void;

  setLeaderboard: (leaderboard: KolLeaderboardEntry[]) => void;
  setLeaderboardLoading: (loading: boolean) => void;
  setLeaderboardError: (error: string | null) => void;

  setRecentTrades: (trades: KolRecentTrade[]) => void;
  appendRecentTrades: (trades: KolRecentTrade[]) => void;
  setTradesLoading: (loading: boolean) => void;
  setTradesError: (error: string | null) => void;

  setSelectedKol: (kol: KolLeaderboardEntry | null) => void;
  setSelectedKolTrades: (trades: KolRecentTrade[]) => void;

  setTimeframe: (timeframe: LeaderboardTimeframe) => void;
  setSortBy: (sortBy: LeaderboardSortBy) => void;

  toggleFollow: (kolId: string) => void;
  setFollowingIds: (ids: string[]) => void;
  setShowFollowingOnly: (show: boolean) => void;

  // Computed getters
  getFilteredLeaderboard: () => KolLeaderboardEntry[];
  getCurrentUserRank: () => number | null;

  reset: () => void;
}

const initialState = {
  currentUser: null,
  isTwitterLinked: false,
  leaderboard: [],
  leaderboardLoading: false,
  leaderboardError: null,
  recentTrades: [],
  tradesLoading: false,
  tradesError: null,
  selectedKol: null,
  selectedKolTrades: [],
  timeframe: "7d" as LeaderboardTimeframe,
  sortBy: "pnl" as LeaderboardSortBy,
  tierFilter: null as string | null,
  followingIds: [],
  showFollowingOnly: false,
};

export const useKolStore = create<KolState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentUser: (user) => set({ currentUser: user }),
      setIsTwitterLinked: (linked) => set({ isTwitterLinked: linked }),

      setLeaderboard: (leaderboard) => set({ leaderboard }),
      setLeaderboardLoading: (loading) => set({ leaderboardLoading: loading }),
      setLeaderboardError: (error) => set({ leaderboardError: error }),

      setRecentTrades: (trades) => set({ recentTrades: trades }),
      appendRecentTrades: (trades) =>
        set((state) => ({
          recentTrades: [...state.recentTrades, ...trades],
        })),
      setTradesLoading: (loading) => set({ tradesLoading: loading }),
      setTradesError: (error) => set({ tradesError: error }),

      setSelectedKol: (kol) => set({ selectedKol: kol }),
      setSelectedKolTrades: (trades) => set({ selectedKolTrades: trades }),

      setTimeframe: (timeframe) => set({ timeframe }),
      setSortBy: (sortBy) => set({ sortBy }),
      setTierFilter: (tier) => set({ tierFilter: tier }),

      toggleFollow: (kolId) =>
        set((state) => ({
          followingIds: state.followingIds.includes(kolId)
            ? state.followingIds.filter((id) => id !== kolId)
            : [...state.followingIds, kolId],
        })),
      setFollowingIds: (ids) => set({ followingIds: ids }),
      setShowFollowingOnly: (show) => set({ showFollowingOnly: show }),

      getFilteredLeaderboard: () => {
        const state = get();
        let filtered = [...state.leaderboard];

        // Filter by following
        if (state.showFollowingOnly) {
          filtered = filtered.filter((kol) =>
            state.followingIds.includes(kol.id),
          );
        }

        // Sort based on criteria and timeframe
        filtered.sort((a, b) => {
          switch (state.sortBy) {
            case "pnl":
              if (state.timeframe === "7d") {
                return (b.pnl_7d_usd ?? 0) - (a.pnl_7d_usd ?? 0);
              } else if (state.timeframe === "30d") {
                return (b.pnl_30d_usd ?? 0) - (a.pnl_30d_usd ?? 0);
              }
              return (
                (b.total_realized_pnl_usd ?? 0) -
                (a.total_realized_pnl_usd ?? 0)
              );
            case "volume":
              if (state.timeframe === "7d") {
                return (b.volume_7d_usd ?? 0) - (a.volume_7d_usd ?? 0);
              } else if (state.timeframe === "30d") {
                return (b.volume_30d_usd ?? 0) - (a.volume_30d_usd ?? 0);
              }
              return (b.total_volume_usd ?? 0) - (a.total_volume_usd ?? 0);
            case "trades":
              if (state.timeframe === "7d") {
                return (b.trades_7d ?? 0) - (a.trades_7d ?? 0);
              } else if (state.timeframe === "30d") {
                return (b.trades_30d ?? 0) - (a.trades_30d ?? 0);
              }
              return (b.total_trades ?? 0) - (a.total_trades ?? 0);
            case "winRate":
              return (b.win_rate ?? 0) - (a.win_rate ?? 0);
            default:
              return 0;
          }
        });

        return filtered;
      },

      getCurrentUserRank: () => {
        const state = get();
        if (!state.currentUser) return null;

        const index = state.leaderboard.findIndex(
          (kol) => kol.id === state.currentUser?.id,
        );
        return index >= 0 ? index + 1 : null;
      },

      reset: () => set(initialState),
    }),
    {
      name: "kol-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist user auth state
        currentUser: state.currentUser,
        isTwitterLinked: state.isTwitterLinked,
        // Persist preferences
        followingIds: state.followingIds,
        timeframe: state.timeframe,
        sortBy: state.sortBy,
        showFollowingOnly: state.showFollowingOnly,
      }),
    },
  ),
);
