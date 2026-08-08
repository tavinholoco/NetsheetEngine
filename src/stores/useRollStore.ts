/**
 * ============================================================
 * NETSHEET ENGINE — useRollStore (Fase 4 · T4.1)
 * Estado global de rolagens: histórico + banner flutuante do
 * último resultado. Centraliza o addRoll (que também faz o
 * broadcast multiplayer via CustomEvent).
 * ============================================================
 */
import { create } from 'zustand';
import type { RollResult } from '../types/cyberpunk';

interface RollState {
  rollHistory: RollResult[];
  lastRollBanner: RollResult | null;
  /** Adiciona uma rolagem ao histórico, exibe o banner e faz o broadcast multiplayer. */
  addRoll: (roll: RollResult) => void;
  clearHistory: () => void;
}

export const useRollStore = create<RollState>((set) => ({
  rollHistory: [],
  lastRollBanner: null,

  addRoll: (roll) => {
    set((s) => ({
      rollHistory: [roll, ...s.rollHistory],
      lastRollBanner: roll
    }));
    // Broadcast roll to active multiplayer room if open (mesmo do App.tsx)
    window.dispatchEvent(new CustomEvent('cyberpunk_broadcast_roll', { detail: roll }));
    // Auto-hide banner after 4 seconds (mesmo do App.tsx)
    setTimeout(() => {
      const cur = useRollStore.getState();
      if (cur.lastRollBanner?.id === roll.id) {
        set({ lastRollBanner: null });
      }
    }, 4000);
  },

  clearHistory: () => set({ rollHistory: [], lastRollBanner: null })
}));
