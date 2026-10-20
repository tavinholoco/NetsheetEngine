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
  WOUND_LEVEL_COLORS,
  isLastWoundBox,
  woundLevelColor
} from '../utils/injuryRules';
import { WOUND_TRACK } from '../rules/tables';

// K.3a — o nome de cada nível é o da trilha (WOUND_TRACK), e a ficha e o grid o
// leem pelo woundRow: o wound-names.test confere as duas telas. Aqui fica a cor.
describe('WOUND_LEVEL_COLORS — um tom por nível da trilha (0..10)', () => {
  it('tem um tom para cada nível da trilha do livro', () => {
    expect(WOUND_LEVEL_COLORS).toHaveLength(WOUND_TRACK.length);
    expect(WOUND_TRACK.length - 1).toBe(WOUND_MAX);
  });

  // A cor saiu daqui na F.2.7: cada nível pinta com o token wound-N, e o tom e
  // o contraste da escala são conferidos no theme-contrast.test.
  it('cada nível usa o seu token da escala de dano (wound-N)', () => {
    for (let i = 0; i <= WOUND_MAX; i++) {
      expect(woundLevelColor(i)).toBe(`text-wound-${i}`);
    }
  });

  it('nível fora da trilha fica na ponta, como o nome', () => {
    expect(woundLevelColor(-3)).toBe('text-wound-0');
    expect(woundLevelColor(14)).toBe('text-wound-10');
    expect(woundLevelColor(Number.NaN)).toBe('text-wound-0');
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
