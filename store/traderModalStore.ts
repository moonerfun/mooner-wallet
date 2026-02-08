/**
 * Trader Modal Store - State management for trader popup modal
 */

import { create } from "zustand";

export interface TraderModalState {
  isOpen: boolean;
  walletAddress: string | null;
  blockchain: string | null;

  // Actions
  openModal: (walletAddress: string, blockchain: string) => void;
  closeModal: () => void;
}

export const useTraderModalStore = create<TraderModalState>((set) => ({
  isOpen: false,
  walletAddress: null,
  blockchain: null,

  openModal: (walletAddress: string, blockchain: string) =>
    set({ isOpen: true, walletAddress, blockchain }),

  closeModal: () =>
    set({ isOpen: false, walletAddress: null, blockchain: null }),
}));
