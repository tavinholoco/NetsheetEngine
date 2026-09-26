/**
 * Fase 9 (T9.2) — UNIT TESTS DE REGRAS DE FERIMENTO
 * (src/utils/injuryRules.ts)
 * =================================================
 * Bio-Monitor CP2020: níveis de ferimento 0..10, clamp do woundLevel e o
 * último nível. O efeito de cada nível nos atributos é testado em
 * rules-character.test.ts, derivado da tabela do livro (Fase C).
 */
import { describe, it, expect } from 'vitest';
import {
  WOUND_MAX,
  WOUND_LEVEL_NAMES,
  clampWoundLevel,
  isLastWoundBox
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

describe('isLastWoundBox — a última caixa (Mortal 6), ainda vivo', () => {
  it('níveis 0..9 não são a última caixa', () => {
    expect(isLastWoundBox(0)).toBe(false);
    expect(isLastWoundBox(9)).toBe(false);
  });

  it('nível 10 (e acima) é a última caixa — morrer é falhar o death save, não estar nela', () => {
    expect(isLastWoundBox(10)).toBe(true);
    expect(isLastWoundBox(12)).toBe(true);
  });
});
