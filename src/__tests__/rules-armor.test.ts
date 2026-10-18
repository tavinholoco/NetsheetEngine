/**
 * K.2b — a armadura como peça que cobre locais, e as camadas pelo livro
 * =====================================================================
 * Até a K.2 a armadura era uma peça por local: uma jaqueta virava quatro
 * peças, e duas camadas no mesmo local não se combinavam (vencia a primeira
 * da lista). A regra do livro (p. 99, S9 e S11 na conferência): vale o maior
 * SP, mais um bônus pela diferença entre os dois; três ou mais, em pares, de
 * dentro para fora — no NetSheet, a ordem da lista.
 *
 * Os casos derivam do `ARMOR_LAYER_BONUS`, nunca da implementação. A ficha de
 * antes da K.2 (um `location` por peça) tem de dar o mesmo SP de antes.
 */
import { describe, it, expect } from 'vitest';
import { ARMOR_LAYER_BONUS } from '../rules/tables';
import { armorLocationsOf, armorSpAt, combineArmorSp } from '../rules/damage';
import { sanitizeCharacterSheet } from '../rules/sheetSchema';
import type { ArmorLocation, ArmorPiece } from '../types/cyberpunk';

/** O bônus da tabela para uma diferença — a leitura direta do livro. */
const bonusDaTabela = (diff: number) => ARMOR_LAYER_BONUS.find((row) => diff >= row.minDiff)!.bonus;

function peca(sp: number, locations: ArmorLocation[], extra: Partial<ArmorPiece> = {}): ArmorPiece {
  return { id: `a${sp}${locations.join('')}`, name: `SP ${sp}`, locations, sp, ev: 0, equipped: true, ...extra };
}

describe('K.2b — duas camadas: o maior SP mais o bônus da diferença', () => {
  for (const row of ARMOR_LAYER_BONUS) {
    it(`diferença ${row.minDiff}: +${row.bonus}`, () => {
      expect(combineArmorSp(10, 10 + row.minDiff)).toBe(10 + row.minDiff + row.bonus);
      expect(combineArmorSp(10 + row.minDiff, 10)).toBe(10 + row.minDiff + row.bonus);
    });
    if (row.minDiff > 0) {
      it(`diferença ${row.minDiff - 1}: o degrau de baixo, +${bonusDaTabela(row.minDiff - 1)}`, () => {
        expect(combineArmorSp(10, 10 + row.minDiff - 1)).toBe(10 + row.minDiff - 1 + bonusDaTabela(row.minDiff - 1));
      });
    }
  }

  it('camada de SP 0 não soma nada', () => {
    expect(combineArmorSp(0, 14)).toBe(14);
    expect(combineArmorSp(14, 0)).toBe(14);
  });
});

describe('K.2b — o SP de um local', () => {
  it('uma peça que cobre vários locais protege cada um deles, e só eles', () => {
    const jaqueta = peca(14, ['Torso', 'Right Arm', 'Left Arm']);
    expect(armorSpAt([jaqueta], 'Torso')).toBe(14);
    expect(armorSpAt([jaqueta], 'Left Arm')).toBe(14);
    expect(armorSpAt([jaqueta], 'Head')).toBe(0);
  });

  it('peça que não está vestida não protege', () => {
    expect(armorSpAt([peca(14, ['Torso'], { equipped: false })], 'Torso')).toBe(0);
  });

  it('duas camadas no mesmo local combinam pela tabela', () => {
    const camiseta = peca(10, ['Torso']);
    const jaqueta = peca(14, ['Torso', 'Right Arm', 'Left Arm']);
    expect(armorSpAt([camiseta, jaqueta], 'Torso')).toBe(14 + bonusDaTabela(4));
    expect(armorSpAt([camiseta, jaqueta], 'Right Arm')).toBe(14);
  });

  it('três camadas: em pares, de dentro para fora, na ordem da lista', () => {
    const [a, b, c] = [10, 14, 20];
    const dentro = b + bonusDaTabela(b - a);
    const esperado = Math.max(dentro, c) + bonusDaTabela(Math.abs(dentro - c));
    expect(armorSpAt([peca(a, ['Torso']), peca(b, ['Torso']), peca(c, ['Torso'])], 'Torso')).toBe(esperado);
  });

  it('a ficha de antes da K.2 (um `location` por peça) dá o mesmo SP de antes', () => {
    const antiga = [
      { id: 'h', name: 'Capacete', location: 'Head', sp: 18, ev: 0, equipped: true },
      { id: 't', name: 'Colete', location: 'Torso', sp: 18, ev: 0, equipped: true },
      { id: 'l', name: 'Calça', location: 'Left Leg', sp: 16, ev: 0, equipped: false }
    ] as unknown as ArmorPiece[];
    expect(armorSpAt(antiga, 'Head')).toBe(18);
    expect(armorSpAt(antiga, 'Torso')).toBe(18);
    expect(armorSpAt(antiga, 'Left Leg')).toBe(0);
    expect(armorLocationsOf(antiga[0])).toEqual(['Head']);
  });
});

describe('K.2b — o validador grava a peça no formato novo', () => {
  const base = { id: 's', handle: 'Vex', stats: {}, skills: [], cyberware: [], weapons: [] };

  it('converte o `location` antigo em `locations`, sem marcar como correção', () => {
    const r = sanitizeCharacterSheet({
      ...base,
      armor: [{ id: 'a', name: 'Colete', location: 'Torso', sp: 18, ev: 1, equipped: true }]
    })!;
    expect(r.sheet.armor).toEqual([{ id: 'a', name: 'Colete', locations: ['Torso'], sp: 18, ev: 1, equipped: true }]);
    expect(r.changed).toEqual([]);
  });

  it('guarda a cobertura sem repetir local e sem local que não existe', () => {
    const r = sanitizeCharacterSheet({
      ...base,
      armor: [{ id: 'a', name: 'Jaqueta', locations: ['Torso', 'Torso', 'Tail', 'Left Arm'], sp: 14, ev: 0, equipped: true }]
    })!;
    expect(r.sheet.armor[0].locations).toEqual(['Torso', 'Left Arm']);
    expect(r.changed).toContain('armor[0].locations');
  });

  it('peça que não cobre local nenhum some — quebraria o dano da D', () => {
    const r = sanitizeCharacterSheet({
      ...base,
      armor: [{ id: 'a', name: 'Nada', locations: [], sp: 14, ev: 0, equipped: true }]
    })!;
    expect(r.sheet.armor).toEqual([]);
    expect(r.changed).toContain('armor[0].locations');
  });
});
