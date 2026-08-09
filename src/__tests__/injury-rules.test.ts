/**
 * Fase 9 (T9.2) — UNIT TESTS DE REGRAS DE FERIMENTO
 * (src/utils/injuryRules.ts)
 * =================================================
 * Bio-Monitor CP2020: níveis de ferimento 0..10, penalidades de REF/MA por
 * nível, clamp do woundLevel e morte iminente (nível 10).
 */
import { describe, it, expect } from 'vitest';
import {
  WOUND_MAX,
  WOUND_LEVEL_NAMES,
  clampWoundLevel,
  isDead,
  woundPenalties,
  woundPenaltyText
} from '../utils/injuryRules';

describe('WOUND_LEVEL_NAMES — 11 níveis (0..10)', () => {
  it('tem exatamente 11 níveis', () => {
    expect(WOUND_LEVEL_NAMES).toHaveLength(11);
  });

  it('começa em Saudável e termina em Morte Iminente', () => {
    expect(WOUND_LEVEL_NAMES[0].name).toBe('Saudável (OK)');
    expect(WOUND_LEVEL_NAMES[WOUND_MAX].name).toBe('Mortal 6 (Morte Iminente)');
  });

  it('níveis mortais (4+) têm cor vermelha/rose (estado crítico)', () => {
    for (let i = 4; i <= WOUND_MAX; i++) {
      expect(WOUND_LEVEL_NAMES[i].color).toMatch(/red|rose/);
    }
  });
});

describe('clampWoundLevel — intervalo válido 0..10', () => {
  it('mantém valores dentro do intervalo', () => {
    expect(clampWoundLevel(0)).toBe(0);
    expect(clampWoundLevel(5)).toBe(5);
    expect(clampWoundLevel(10)).toBe(10);
  });

  it('clampa valores negativos em 0', () => {
    expect(clampWoundLevel(-1)).toBe(0);
    expect(clampWoundLevel(-42)).toBe(0);
  });

  it('clampa valores acima de 10 em 10', () => {
    expect(clampWoundLevel(11)).toBe(10);
    expect(clampWoundLevel(99)).toBe(10);
  });
});

describe('isDead — morte iminente no nível 10', () => {
  it('níveis 0..9 não são morte', () => {
    expect(isDead(0)).toBe(false);
    expect(isDead(9)).toBe(false);
  });

  it('nível 10 (e acima) é morte', () => {
    expect(isDead(10)).toBe(true);
    expect(isDead(12)).toBe(true);
  });
});

describe('woundPenalties — tabela estruturada por nível', () => {
  it('níveis 0 e 1 sem penalidade', () => {
    expect(woundPenalties(0)).toEqual({ ref: 0, ma: 0 });
    expect(woundPenalties(1)).toEqual({ ref: 0, ma: 0 });
  });

  it('nível 2 → REF −2, MA −2', () => {
    expect(woundPenalties(2)).toEqual({ ref: -2, ma: -2 });
  });

  it('nível 4 → REF −4, MA −4 com consciência 50%', () => {
    expect(woundPenalties(4)).toEqual({ ref: -4, ma: -4, note: 'consciência 50%' });
  });

  it('nível 8 → REF −6, MA −6 com morte provável', () => {
    expect(woundPenalties(8)).toEqual({ ref: -6, ma: -6, note: 'morte provável' });
  });

  it('penalidades crescem com o nível (monotônicas em valor absoluto)', () => {
    for (let i = 1; i <= WOUND_MAX; i++) {
      const prev = woundPenalties(i - 1);
      const curr = woundPenalties(i);
      expect(Math.abs(curr.ref)).toBeGreaterThanOrEqual(Math.abs(prev.ref));
      expect(Math.abs(curr.ma)).toBeGreaterThanOrEqual(Math.abs(prev.ma));
    }
  });

  it('nível fora do intervalo clampa sem quebrar', () => {
    expect(woundPenalties(-3)).toEqual({ ref: 0, ma: 0 });
    expect(woundPenalties(99)).toEqual({ ref: -6, ma: -6, note: 'Morte iminente' });
  });
});

describe('woundPenaltyText — mesma saída da tabela legada do HealthTracker', () => {
  const expected: Record<number, string> = {
    0: '—',
    1: '—',
    2: 'REF −2, MA −2',
    3: 'REF −2, MA −2',
    4: 'REF −4, MA −4, consciência 50%',
    5: 'REF −4, MA −4',
    6: 'REF −5, MA −5',
    7: 'REF −5, MA −5',
    8: 'REF −6, MA −6, morte provável',
    9: 'REF −6, MA −6',
    10: 'Morte iminente'
  };

  it.each(Object.entries(expected).map(([level, text]) => [Number(level), text] as [number, string]))(
    'nível %i → "%s"',
    (level, text) => {
      expect(woundPenaltyText(level)).toBe(text);
    }
  );

  it('nível acima de 10 também exibe "Morte iminente"', () => {
    expect(woundPenaltyText(11)).toBe('Morte iminente');
    expect(woundPenaltyText(99)).toBe('Morte iminente');
  });

  it('nível negativo (clampado) exibe "—"', () => {
    expect(woundPenaltyText(-1)).toBe('—');
  });
});
