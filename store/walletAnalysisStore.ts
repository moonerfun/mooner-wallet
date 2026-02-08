/**
 * Wallet Analysis Store - State management for wallet portfolio analysis
 */

import { create } from "zustand";

export type AnalysisTimeframe = "24h" | "7d" | "30d" | "90d";

export interface WalletPosition {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo?: string;
  blockchain: string;
  amount: number;
  amountUsd: number;
  price: number;
  priceChange24h?: number;
  marketCap?: number;
  createdAt?: string;
  realizedPnl: number;
  unrealizedPnl: number;
  athPrice?: number;
  atlPrice?: number;
  socials?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}

export interface WalletActivity {
  id: string;
  type: "swap" | "transfer" | "mint" | "burn";
  timestamp: string;
  tokenIn?: {
    symbol: string;
    amount: number;
    amountUsd: number;
  };
  tokenOut?: {
    symbol: string;
    amount: number;
    amountUsd: number;
  };
  hash: string;
  blockchain: string;
}

export interface WalletAnalysis {
  address: string;
  blockchain: string;

  // Portfolio value
  totalBalanceUsd: number;

  // PNL metrics
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;

  // Trading metrics
  totalBought: number;
  totalSold: number;
  winCount: number;
  lossCount: number;
  winRate: number;

  // Transaction counts
  txnCount: number;
  buyCount: number;
  sellCount: number;

  // Active tokens
  activeTokenCount: number;

  // Positions
  positions: WalletPosition[];

  // Activity
  activities: WalletActivity[];

  // PNL history for chart
  pnlHistory: {
    timestamp: string;
    pnl: number;
  }[];
}

export interface WalletNickname {
  address: string;
  nickname: string;
  emoji: string;
}

interface WalletAnalysisState {
  // Current analysis
  analysis: WalletAnalysis | null;
  isLoading: boolean;
  error: string | null;

  // Selected timeframe
  timeframe: AnalysisTimeframe;

  // Active tab in modal
  activeTab: "positions" | "history" | "activity";

  // Saved nicknames (in-memory, could persist with AsyncStorage)
  nicknames: Record<string, WalletNickname>;

  // Actions
  setAnalysis: (analysis: WalletAnalysis | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTimeframe: (timeframe: AnalysisTimeframe) => void;
  setActiveTab: (tab: "positions" | "history" | "activity") => void;
  setNickname: (address: string, nickname: string, emoji: string) => void;
  getNickname: (address: string) => WalletNickname | undefined;
  clearAnalysis: () => void;
}

export const useWalletAnalysisStore = create<WalletAnalysisState>(
  (set, get) => ({
    analysis: null,
    isLoading: false,
    error: null,
    timeframe: "24h",
    activeTab: "positions",
    nicknames: {},

    setAnalysis: (analysis) => set({ analysis, error: null }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error, isLoading: false }),
    setTimeframe: (timeframe) => set({ timeframe }),
    setActiveTab: (activeTab) => set({ activeTab }),

    setNickname: (address, nickname, emoji) =>
      set((state) => ({
        nicknames: {
          ...state.nicknames,
          [address.toLowerCase()]: { address, nickname, emoji },
        },
      })),

    getNickname: (address) => get().nicknames[address.toLowerCase()],

    clearAnalysis: () =>
      set({
        analysis: null,
        isLoading: false,
        error: null,
        activeTab: "positions",
      }),
  }),
);
