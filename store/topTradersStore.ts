/**
 * Top Traders Store - State management for top traders data
 */

import { create } from "zustand";

export type TraderLabel =
  | "whale"
  | "sniper"
  | "fresh"
  | "bot"
  | "dev"
  | "insider"
  | "pro"
  | "bundler";

export interface TopTrader {
  address: string;
  label?: TraderLabel;
  labels?: TraderLabel[];

  // Trading metrics
  bought: number;
  sold: number;
  remaining: number;
  remainingPercentage: number;

  // PNL
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;

  // Transaction counts
  buyCount: number;
  sellCount: number;

  // First/last trade timestamps
  firstTradeAt?: string;
  lastTradeAt?: string;

  // Average prices
  avgBuyPrice?: number;
  avgSellPrice?: number;
}

interface TopTradersState {
  traders: TopTrader[];
  isLoading: boolean;
  error: string | null;

  // Filters
  selectedLabel: TraderLabel | null;
  showRealizedPnl: boolean; // toggle between realized/unrealized

  // Actions
  setTraders: (traders: TopTrader[]) => void;
  addTrader: (trader: TopTrader) => void;
  updateTrader: (address: string, updates: Partial<TopTrader>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedLabel: (label: TraderLabel | null) => void;
  togglePnlDisplay: () => void;
  clearTraders: () => void;

  // Computed
  getFilteredTraders: () => TopTrader[];
}

export const useTopTradersStore = create<TopTradersState>((set, get) => ({
  traders: [],
  isLoading: false,
  error: null,
  selectedLabel: null,
  showRealizedPnl: true,

  setTraders: (traders) => set({ traders, error: null }),

  addTrader: (trader) =>
    set((state) => ({
      traders: [
        ...state.traders.filter((t) => t.address !== trader.address),
        trader,
      ],
    })),

  updateTrader: (address, updates) =>
    set((state) => ({
      traders: state.traders.map((t) =>
        t.address === address ? { ...t, ...updates } : t,
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSelectedLabel: (selectedLabel) => set({ selectedLabel }),
  togglePnlDisplay: () =>
    set((state) => ({ showRealizedPnl: !state.showRealizedPnl })),

  clearTraders: () =>
    set({
      traders: [],
      isLoading: false,
      error: null,
      selectedLabel: null,
    }),

  getFilteredTraders: () => {
    const { traders, selectedLabel } = get();
    if (!selectedLabel) return traders;
    return traders.filter(
      (t) => t.label === selectedLabel || t.labels?.includes(selectedLabel),
    );
  },
}));

// Label display configuration
export const TRADER_LABELS: Record<
  TraderLabel,
  { icon: string; color: string; name: string }
> = {
  whale: { icon: "🐋", color: "#3B82F6", name: "Whale" },
  sniper: { icon: "🎯", color: "#EF4444", name: "Sniper" },
  fresh: { icon: "🆕", color: "#10B981", name: "Fresh" },
  bot: { icon: "🤖", color: "#8B5CF6", name: "Bot" },
  dev: { icon: "👨‍💻", color: "#F59E0B", name: "Dev" },
  insider: { icon: "🔒", color: "#EC4899", name: "Insider" },
  pro: { icon: "⭐", color: "#14B8A6", name: "Pro" },
  bundler: { icon: "📦", color: "#6366F1", name: "Bundler" },
};
