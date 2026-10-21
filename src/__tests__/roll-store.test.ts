/**
 * L.5 — o G.18 do ledger da G: o "broadcast multiplayer" das rolagens da ficha.
 * Toda rolagem disparava o `cyberpunk_broadcast_roll` no `window`, e o
 * comentário dizia que era o que levava a rolagem à mesa — ninguém escutava
 * desde a T5.4, quando a mesa passou a aceitar só a rolagem do servidor.
 * Código morto com comentário falso: saiu. A rolagem da ficha fica na ficha.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRollStore } from '../stores/useRollStore';
import type { RollResult } from '../types/cyberpunk';

const rolagem = { id: 'roll_1', total: 12 } as unknown as RollResult;

afterEach(() => {
  vi.useRealTimers();
  useRollStore.getState().clearHistory();
});

describe('L.5 — G.18: a rolagem da ficha não finge ir à mesa', () => {
  it('o addRoll guarda e mostra a rolagem, e não dispara evento nenhum no window', () => {
    vi.useFakeTimers();
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    useRollStore.getState().addRoll(rolagem);
    expect(useRollStore.getState().rollHistory[0]).toBe(rolagem);
    expect(useRollStore.getState().lastRollBanner).toBe(rolagem);
    expect(dispatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(useRollStore.getState().lastRollBanner).toBeNull();
  });
});
