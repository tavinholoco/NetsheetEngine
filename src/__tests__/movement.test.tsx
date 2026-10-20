/**
 * K.7c — O MOVIMENTO DO LIVRO: RUN E LEAP, SEM O WALK (RUL-11)
 * ===========================================================
 * Run = MA × 3 m; Leap = Run ÷ 4, para baixo (S1, S8 — o S8 arredonda para
 * baixo). O Walk não existe em nenhuma fonte: era invenção, e sai. A ficha
 * mostra os dois com o MA corrente — o cromo que soma MA (K.2e) conta, como já
 * contava no Run.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatBlock } from '../features/sheet/CharacterSheet/StatBlock';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { leapFromMa, runFromMa } from '../utils/derivedStats';
import { LEAP_RUN_DIVISOR, RUN_METERS_PER_MA } from '../rules/tables';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(cleanup);

describe('K.7c — Run e Leap pela tabela', () => {
  it.each([1, 2, 3, 5, 7, 8, 10, 12])('MA %i: Run = MA × 3, Leap = Run ÷ 4 para baixo', (ma) => {
    const run = ma * RUN_METERS_PER_MA;
    expect(runFromMa(ma)).toBe(run);
    expect(leapFromMa(ma)).toBe(Math.floor(run / LEAP_RUN_DIVISOR));
  });

  it('o Walk saiu do módulo', async () => {
    const mod = (await import('../utils/derivedStats')) as Record<string, unknown>;
    expect(mod.walkFromMa).toBeUndefined();
  });
});

describe('K.7c — a ficha mostra Run e Leap, com o MA corrente', () => {
  const ficha = (patch: Partial<CharacterSheet> = {}) => ({ ...createBlankCharacterSheet(), ...patch });

  it('MA 7: Run 21, Leap 5; nenhum Walk', () => {
    const base = ficha();
    render(<StatBlock sheet={{ ...base, stats: { ...base.stats, MA: 7 } }} onChange={() => {}} />);
    expect(screen.getByTestId('derived-run')).toHaveTextContent(String(runFromMa(7)));
    expect(screen.getByTestId('derived-leap')).toHaveTextContent(String(leapFromMa(7)));
    expect(screen.queryByText(/walk/i)).toBeNull();
  });

  it('o cromo que soma MA entra no Leap, como no Run', () => {
    const base = ficha();
    const sheet = ficha({
      stats: { ...base.stats, MA: 6 },
      cyberware: [
        { id: 'c1', name: 'Pernas turbinadas', category: 'Cyberlimb', costEb: 0, humanityLoss: '0', actualHL: 0, installed: true, statBonus: { stat: 'MA', amount: 2 } }
      ]
    });
    render(<StatBlock sheet={sheet} onChange={() => {}} />);
    expect(screen.getByTestId('derived-leap')).toHaveTextContent(String(leapFromMa(8)));
  });
});
