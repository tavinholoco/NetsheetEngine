/**
 * Fase C — ATRIBUTOS DERIVADOS (src/rules/character.ts)
 * =====================================================
 * C.5 (efeito de ferimento), C.6 (atributos correntes) e C.7 (alvos de save).
 * As expectativas saem de WOUND_TRACK (o livro como dado). A tabela antiga
 * (−2 a −6 em REF e MA) falhava em 9 dos 11 níveis contra ela — a prova está
 * no PLANO_MESTRE, C.0.
 */
import { describe, it, expect } from 'vitest';
import {
  applyWoundEffect,
  deathSaveTarget,
  deriveCurrentStats,
  empAfterHumanityLoss,
  mortalLevel,
  stunSaveTarget,
  woundEffectText,
  woundRow
} from '../rules/character';
import { WOUND_TRACK } from '../rules/tables';
import type { CharacterStats } from '../types/cyberpunk';

const BASE: CharacterStats = { INT: 8, REF: 9, TECH: 6, COOL: 7, ATTR: 5, LUCK: 4, MA: 6, BODY: 8, EMP: 7 };

/** O que o livro diz para um nível, calculado direto da linha da tabela. */
function expectedFor(level: number): CharacterStats {
  const out = { ...BASE };
  const e = WOUND_TRACK[level].effect;
  if (e.kind === 'subtract') for (const s of e.stats) out[s] = BASE[s] - e.amount;
  if (e.kind === 'divide') for (const s of e.stats) out[s] = Math.ceil(BASE[s] / e.divisor);
  return out;
}

describe('C.5 — efeito de ferimento, nível a nível, da tabela do livro', () => {
  it.each(WOUND_TRACK.map((r) => [r.level, r.name] as const))('nível %i (%s)', (level) => {
    expect(applyWoundEffect(BASE, level)).toEqual(expectedFor(level));
  });

  it('Sério tira 2 do REF e mais nada', () => {
    expect(applyWoundEffect(BASE, 2)).toEqual({ ...BASE, REF: 7 });
  });

  it('Crítico divide REF, INT e COOL por 2, arredondando para cima — e NÃO soma o −2 do Sério', () => {
    expect(applyWoundEffect(BASE, 3)).toMatchObject({ REF: 5, INT: 4, COOL: 4 });
  });

  it('Mortal (qualquer nível) divide REF, INT e COOL por 3, para cima', () => {
    for (let level = 4; level <= 10; level++) {
      expect(applyWoundEffect(BASE, level)).toMatchObject({ REF: 3, INT: 3, COOL: 3 });
    }
  });

  it('ferimento nunca mexe em MA — a penalidade de MA era invenção', () => {
    for (let level = 0; level <= 10; level++) expect(applyWoundEffect(BASE, level).MA).toBe(BASE.MA);
  });

  it('não altera o objeto de entrada', () => {
    const copy = { ...BASE };
    applyWoundEffect(copy, 10);
    expect(copy).toEqual(BASE);
  });

  it('nível fora de 0..10 é grampeado', () => {
    expect(applyWoundEffect(BASE, -5)).toEqual(BASE);
    expect(applyWoundEffect(BASE, 99)).toEqual(expectedFor(10));
    expect(woundRow(Number.NaN).level).toBe(0);
  });

  it.each([
    [0, '—'],
    [1, '—'],
    [2, 'REF −2'],
    [3, 'REF, INT, COOL ÷2'],
    [4, 'REF, INT, COOL ÷3'],
    [10, 'REF, INT, COOL ÷3']
  ])('texto da ficha no nível %i: "%s"', (level, text) => {
    expect(woundEffectText(level)).toBe(text);
  });
});

describe('C.6 — atributos correntes: base → humanidade → ferimento', () => {
  const sheet = (patch: Partial<{ woundLevel: number; actualHL: number[] }> = {}) => ({
    stats: { ...BASE },
    woundLevel: patch.woundLevel ?? 0,
    cyberware: (patch.actualHL ?? []).map((actualHL, i) => ({
      id: `c${i}`, name: 'cromo', category: 'x', costEb: 0, humanityLoss: '1d6', actualHL, installed: true
    }))
  });

  it('ileso e sem cromo: igual à base', () => {
    expect(deriveCurrentStats(sheet())).toEqual(BASE);
  });

  it('−1 EMP a cada 10 de humanidade perdida (14 perdidos → EMP 6)', () => {
    expect(deriveCurrentStats(sheet({ actualHL: [8, 6] })).EMP).toBe(6);
  });

  it('humanidade e ferimento juntos, cada um no seu atributo', () => {
    const cur = deriveCurrentStats(sheet({ woundLevel: 3, actualHL: [25] }));
    expect(cur).toMatchObject({ REF: 5, INT: 4, COOL: 4, EMP: 5, BODY: 8, MA: 6 });
  });

  it('EMP nunca fica negativo', () => {
    expect(empAfterHumanityLoss(3, 90)).toBe(0);
    expect(empAfterHumanityLoss(7, -20)).toBe(7);
  });

  it('ficha incompleta ou com lixo não quebra (a mesa recebe ficha da rede)', () => {
    const cur = deriveCurrentStats({ stats: { REF: 'x' } as never, woundLevel: undefined as never, cyberware: undefined as never });
    expect(cur.REF).toBe(0);
    expect(cur.INT).toBe(0);
  });

  it('ignora o currentStats que vier na ficha — ele é derivado, nunca lido', () => {
    const forged = { ...sheet(), currentStats: { ...BASE, REF: 15 } };
    expect(deriveCurrentStats(forged).REF).toBe(BASE.REF);
  });
});

describe('C.7 — alvos de stun e death save', () => {
  it.each(WOUND_TRACK.map((r) => [r.level, r.name, r.stunModifier] as const))(
    'stun save no nível %i (%s): BODY 8 %i',
    (level, _name, mod) => {
      expect(stunSaveTarget(8, level)).toBe(8 + mod);
    }
  );

  it('stun vai de BODY −0 (Leve) a BODY −9 (Mortal 6)', () => {
    expect(stunSaveTarget(8, 1)).toBe(8);
    expect(stunSaveTarget(8, 10)).toBe(-1);
  });

  it.each([
    [4, 0, 8],
    [5, 1, 7],
    [7, 3, 5],
    [10, 6, 2]
  ])('death save no nível %i (Mortal %i): BODY 8 → alvo %i', (level, mortal, target) => {
    expect(mortalLevel(level)).toBe(mortal);
    expect(deathSaveTarget(8, level)).toBe(target);
  });

  it('fora do Mortal não há nível Mortal, e o alvo é o próprio BODY', () => {
    for (const level of [0, 1, 2, 3]) {
      expect(mortalLevel(level)).toBeNull();
      expect(deathSaveTarget(8, level)).toBe(8);
    }
  });
});
