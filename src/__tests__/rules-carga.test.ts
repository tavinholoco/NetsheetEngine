/**
 * K.2 — o que a armadura, o cromo e a carga fazem com os atributos
 * ================================================================
 * K.2c — o EV: cada peça vestida tira o EV dela do REF, e soma peça por peça
 * (S6, S8). A ordem contra o efeito do ferimento só o S8 dá — o EV sai antes,
 * escolha do projeto registrada na conferência. É o `deriveCurrentStats`, que
 * toda rolagem lê, na ficha e na mesa: o servidor recalcula o corrente a cada
 * sync, então o EV chega à mesa sem caminho novo.
 */
import { describe, it, expect } from 'vitest';
import { applyWoundEffect, deriveCurrentStats } from '../rules/character';
import { armorEvTotal } from '../rules/damage';
import { sanitizeCharacterSheet } from '../rules/sheetSchema';
import type { ArmorPiece, CharacterStats } from '../types/cyberpunk';

const STATS: CharacterStats = { INT: 7, REF: 9, TECH: 5, COOL: 8, ATTR: 6, LUCK: 5, MA: 7, BODY: 8, EMP: 6 };

function peca(ev: number, equipped = true): ArmorPiece {
  return { id: `p${ev}${equipped}`, name: `EV ${ev}`, locations: ['Torso'], sp: 10, ev, equipped };
}

describe('K.2c — o EV da armadura sai do REF', () => {
  it('o EV soma peça por peça, e só a vestida conta', () => {
    expect(armorEvTotal([peca(1), peca(2), peca(3, false)])).toBe(3);
    expect(armorEvTotal(undefined)).toBe(0);
  });

  it('o REF com que se rola desconta o EV', () => {
    const current = deriveCurrentStats({ stats: STATS, woundLevel: 0, cyberware: [], armor: [peca(1), peca(1)] });
    expect(current.REF).toBe(STATS.REF - 2);
    expect(current.BODY).toBe(STATS.BODY);
  });

  it('o EV sai antes do efeito do ferimento (S8 — escolha do projeto)', () => {
    const critico = 3;
    const current = deriveCurrentStats({ stats: STATS, woundLevel: critico, cyberware: [], armor: [peca(2)] });
    const esperado = applyWoundEffect({ ...STATS, REF: STATS.REF - 2 }, critico).REF;
    expect(current.REF).toBe(esperado);
  });

  it('o REF nunca fica negativo', () => {
    const current = deriveCurrentStats({ stats: { ...STATS, REF: 2 }, woundLevel: 0, cyberware: [], armor: [peca(5)] });
    expect(current.REF).toBe(0);
  });

  it('a peça da ficha antiga (um `location`) também pesa no REF', () => {
    const antiga = { id: 'a', name: 'Colete flak', location: 'Torso', sp: 20, ev: 1, equipped: true } as unknown as ArmorPiece;
    expect(deriveCurrentStats({ stats: STATS, woundLevel: 0, cyberware: [], armor: [antiga] }).REF).toBe(STATS.REF - 1);
  });

  it('a ficha validada — a que a mesa usa — já sai com o REF descontado', () => {
    const r = sanitizeCharacterSheet({
      id: 's', handle: 'Vex', stats: STATS, skills: [], cyberware: [], weapons: [],
      armor: [{ id: 'm', name: 'MetalGear', locations: ['Torso', 'Head'], sp: 25, ev: 2, equipped: true }]
    })!;
    expect(r.sheet.currentStats.REF).toBe(STATS.REF - 2);
  });
});
