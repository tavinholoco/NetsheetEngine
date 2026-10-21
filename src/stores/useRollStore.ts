/**
 * ============================================================
 * NETSHEET ENGINE — useRollStore (Fase 4 · T4.1)
 * Estado global de rolagens: histórico + banner flutuante do
 * último resultado. A rolagem da ficha fica na ficha: na mesa, só vale a
 * que o servidor rola (T5.4). O "broadcast multiplayer" que vivia aqui não
 * tinha ouvinte e saiu na L.5 (o G.18).
 * ============================================================
 */
import { create } from 'zustand';
import type { RollResult } from '../types/cyberpunk';

interface RollState {
  rollHistory: RollResult[];
  lastRollBanner: RollResult | null;
  /** Adiciona uma rolagem ao histórico e exibe o banner. */
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
