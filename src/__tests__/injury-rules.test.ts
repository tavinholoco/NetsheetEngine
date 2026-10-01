/**
 * Fase 9 (T9.2) — UNIT TESTS DE REGRAS DE FERIMENTO
 * (src/utils/injuryRules.ts)
 * =================================================
 * Bio-Monitor CP2020: níveis de ferimento 0..10 e o último nível. (O clamp do
 * woundLevel saiu na Fase D — o grampo agora é dos pontos, em rules-damage.) O efeito de cada nível nos atributos é testado em
 * rules-character.test.ts, derivado da tabela do livro (Fase C).
 */
import { describe, it, expect } from 'vitest';
import {
  WOUND_MAX,
  WOUND_LEVEL_NAMES,
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

  // A cor saiu daqui na F.2.7: cada nível pinta com o token wound-N, e o tom e
  // o contraste da escala são conferidos no theme-contrast.test.
  it('cada nível usa o seu token da escala de dano (wound-N)', () => {
    for (let i = 0; i <= WOUND_MAX; i++) {
      expect(WOUND_LEVEL_NAMES[i].color).toBe(`text-wound-${i}`);
    }
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
