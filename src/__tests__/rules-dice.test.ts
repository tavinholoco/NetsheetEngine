/**
 * Fase C (C.1) — MOTOR DE DADOS ÚNICO (src/rules/dice.ts)
 * =======================================================
 * As expectativas vêm de src/rules/tables.ts (o livro como dado), nunca da
 * implementação. Antes da Fase C, os casos de explosão, fumble e tronco
 * falhavam contra o código da época — a prova está no PLANO_MESTRE, C.0/C.1.
 */
import { describe, it, expect } from 'vitest';
import {
  hitLocationForFace,
  hitLocationLabel,
  parseDamageFormula,
  resolveCheck,
  resolveSave,
  rollDamageFormula,
  rollHitLocation,
  rollOpenD10
} from '../rules/dice';
import { HIT_LOCATIONS, MAX_EXPLOSION_DICE } from '../rules/tables';
import { scriptedRng } from '../test/scriptedRng';

const REF8_HANDGUN4 = [
  { label: 'REF', value: 8 },
  { label: 'Handgun', value: 4 }
];

describe('d10 aberto — o 10 encadeia (decisão 1)', () => {
  it('10 → 10 → 3 soma a cadeia inteira: 23', () => {
    const r = rollOpenD10(scriptedRng([10, 10, 3]));
    expect(r.dice).toEqual([10, 10, 3]);
    expect(r.sum).toBe(23);
    expect(r.exploded).toBe(true);
    expect(r.fumble).toBe(false);
    expect(r.capped).toBe(false);
  });

  it('um 1 depois de explodir é só um 1, não fumble', () => {
    const r = rollOpenD10(scriptedRng([10, 1]));
    expect(r.sum).toBe(11);
    expect(r.fumble).toBe(false);
  });

  it(`para no teto de ${MAX_EXPLOSION_DICE} dados extras em vez de rodar para sempre`, () => {
    const rng = scriptedRng(Array(MAX_EXPLOSION_DICE + 5).fill(10));
    const r = rollOpenD10(rng);
    expect(r.dice).toHaveLength(MAX_EXPLOSION_DICE + 1);
    expect(r.capped).toBe(true);
    expect(rng.remaining()).toBe(4);
  });

  it('sem 10 e sem 1, um dado só', () => {
    const r = rollOpenD10(scriptedRng([5]));
    expect(r).toMatchObject({ dice: [5], sum: 5, exploded: false, fumble: false });
  });
});

describe('Teste — fumble do 2020: falha automática, sem subtrair', () => {
  it('1 natural: total 1 + 8 + 4 = 13, e o segundo dado vai para a tabela de fumble', () => {
    const r = resolveCheck(scriptedRng([1, 7]), REF8_HANDGUN4);
    expect(r.roll.fumble).toBe(true);
    expect(r.total).toBe(13);
    expect(r.fumbleRoll).toBe(7);
    expect(r.details).toContain('FUMBLE, falha automática (tabela de fumble: 7)');
  });

  it('não existe mais o "−1d10" do Cyberpunk RED no detalhe', () => {
    const r = resolveCheck(scriptedRng([1, 7]), REF8_HANDGUN4);
    expect(r.details).not.toMatch(/-7|−7/);
  });

  it('explosão soma na trilha: [10, 10, 3] + 12 = 35', () => {
    const r = resolveCheck(scriptedRng([10, 10, 3]), REF8_HANDGUN4);
    expect(r.total).toBe(35);
    expect(r.fumbleRoll).toBeNull();
    expect(r.details).toBe('1d10: 10 → 10 → 3 = 23 🔥 explodiu + REF (8) + Handgun (4) = 35');
  });

  it('cada parcela aparece com nome, inclusive negativa', () => {
    const r = resolveCheck(scriptedRng([5]), [...REF8_HANDGUN4, { label: 'Mod. do Mestre', value: -2 }]);
    expect(r.total).toBe(15);
    expect(r.bonus).toBe(10);
    expect(r.details).toBe('1d10: 5 + REF (8) + Handgun (4) + Mod. do Mestre (−2) = 15');
  });
});

describe('Local de impacto — as 10 faces, da tabela do livro', () => {
  const faces = HIT_LOCATIONS.flatMap((row) => row.faces.map((face) => [face, row] as const));

  it('a tabela cobre as 10 faces, cada uma uma vez', () => {
    expect(faces.map(([f]) => f).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(faces)('face %i → %o', (face, row) => {
    expect(hitLocationForFace(face)).toBe(row);
    const hit = rollHitLocation(scriptedRng([face]));
    expect(hit.row.location).toBe(row.location);
    expect(hit.label.startsWith(`${row.name} (${row.facesLabel})`)).toBe(true);
  });

  it('o tronco (2–4) é tronco — o cliente antigo mandava para "Perna Esquerda"', () => {
    for (const face of [2, 3, 4]) expect(rollHitLocation(scriptedRng([face])).label).toBe('Tronco (2-4)');
  });

  it('só a cabeça dobra o dano, e o rótulo avisa', () => {
    expect(hitLocationLabel(hitLocationForFace(1))).toBe('Cabeça (1) [DANO DOBRADO X2!]');
    expect(HIT_LOCATIONS.filter((r) => r.damageMultiplier !== 1).map((r) => r.location)).toEqual(['Head']);
  });

  it('face fora de 1..10 é erro de programação, não um local', () => {
    expect(() => hitLocationForFace(0)).toThrow(RangeError);
    expect(() => hitLocationForFace(11)).toThrow(RangeError);
  });
});

describe('Dano — NdM, NdM±X, e nada além disso', () => {
  it.each([
    ['2d6+2', { count: 2, sides: 6, bonus: 2 }],
    ['4D10', { count: 4, sides: 10, bonus: 0 }],
    ['1d6-1', { count: 1, sides: 6, bonus: -1 }],
    [' 3d6 + 1 ', { count: 3, sides: 6, bonus: 1 }]
  ])('%s é válida', (formula, parsed) => {
    expect(parseDamageFormula(formula)).toEqual(parsed);
  });

  it.each(['', 'd6', '2d', '2d6+', '2x6', '1d6/2', '2d6+1d4', 'Math.max(1)', '21d6', '0d6', '1d1', '1d101'])(
    '%s é inválida (vem da rede: nada de avaliar expressão)',
    (formula) => {
      expect(parseDamageFormula(formula)).toBeNull();
    }
  );

  it('2d6+2 com [4, 5] = 11', () => {
    expect(rollDamageFormula(scriptedRng([4, 5]), '2d6+2')).toMatchObject({ rolls: [4, 5], total: 11 });
  });

  it('fórmula inválida não rola dado nenhum', () => {
    const rng = scriptedRng([3]);
    expect(rollDamageFormula(rng, 'banana')).toBeNull();
    expect(rng.remaining()).toBe(1);
  });
});

describe('Save — passa com resultado menor ou igual ao alvo', () => {
  it.each([
    [4, 8, true],
    [8, 8, true],
    [9, 8, false],
    [1, 0, false]
  ])('rolou %i contra %i → %s', (roll, target, success) => {
    expect(resolveSave(scriptedRng([roll]), target)).toEqual({ roll, target, success });
  });
});
