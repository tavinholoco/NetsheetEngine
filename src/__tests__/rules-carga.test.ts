/**
 * K.2 — o que a armadura, o cromo e a carga fazem com os atributos
 * ================================================================
 * K.2c — o EV: cada peça vestida tira o EV dela do REF, e soma peça por peça
 * (S6, S8). A ordem contra o efeito do ferimento só o S8 dá — o EV sai antes,
 * escolha do projeto registrada na conferência. É o `deriveCurrentStats`, que
 * toda rolagem lê, na ficha e na mesa: o servidor recalcula o corrente a cada
 * sync, então o EV chega à mesa sem caminho novo.
 *
 * K.2d — a carga: Carry = BODY × 10 kg e Lift = BODY × 40 kg (S1, S6, S8), com o
 * BODY corrente. O peso do inventário aparece contra o Carry, sem pena nenhuma —
 * nenhuma fonte penaliza o peso carregado (decisão 13).
 *
 * K.2e — o cromo que soma atributo: o Muscle and Bone Lace dá BODY +2, e o BTM
 * melhora com ele (S6 leva BODY 10 a 12 e o BTM a −5; S8). Só o implante
 * instalado soma, e o cromo entra antes do EV — é o corpo, a armadura vem por cima.
 */
import { describe, it, expect } from 'vitest';
import { applyWoundEffect, btmFromBody, carryKg, deriveCurrentStats, gearWeightKg, liftKg } from '../rules/character';
import { CARRY_KG_PER_BODY, LIFT_KG_PER_BODY } from '../rules/tables';
import { armorEvTotal } from '../rules/damage';
import { sanitizeCharacterSheet } from '../rules/sheetSchema';
import type { ArmorPiece, CharacterStats, CyberwareItem } from '../types/cyberpunk';

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

describe('K.2d — a carga pelo BODY', () => {
  it('Carry e Lift pela tabela', () => {
    for (const body of [2, 8, 10, 12]) {
      expect(carryKg(body)).toBe(body * CARRY_KG_PER_BODY);
      expect(liftKg(body)).toBe(body * LIFT_KG_PER_BODY);
    }
  });

  it('o peso do inventário é o peso de cada item vezes a quantidade', () => {
    expect(gearWeightKg([{ weightKg: 2.5, qty: 2 }, { weightKg: 0.5, qty: 3 }])).toBe(6.5);
    expect(gearWeightKg(undefined)).toBe(0);
  });

  it('o validador guarda o inventário com tetos, e a ficha antiga ganha um inventário vazio', () => {
    const base = { id: 's', handle: 'Vex', stats: STATS, skills: [], cyberware: [], weapons: [], armor: [] };
    const antiga = sanitizeCharacterSheet(base)!;
    expect(antiga.sheet.gear).toEqual([]);
    expect(antiga.changed).toEqual([]);

    const r = sanitizeCharacterSheet({
      ...base,
      gear: [
        { id: 'g1', name: 'Kit médico', weightKg: 1.5, qty: 1 },
        { id: 'g2', name: 'Bigorna', weightKg: 99999, qty: 5000 },
        'lixo'
      ]
    })!;
    expect(r.sheet.gear).toEqual([
      { id: 'g1', name: 'Kit médico', weightKg: 1.5, qty: 1 },
      { id: 'g2', name: 'Bigorna', weightKg: 1000, qty: 999 }
    ]);
    expect(r.changed).toEqual(expect.arrayContaining(['gear[1].weightKg', 'gear[1].qty', 'gear[2]']));
  });
});

describe('K.2e — o cromo que soma atributo', () => {
  const lace: CyberwareItem = {
    id: 'lace', name: 'Muscle and Bone Lace', category: 'Bioware', costEb: 1500, humanityLoss: '1d6/2',
    actualHL: 2, installed: true, statBonus: { stat: 'BODY', amount: 2 }
  };
  const corrente = (stats: CharacterStats, cyberware: CyberwareItem[], armor: ArmorPiece[] = []) =>
    deriveCurrentStats({ stats, woundLevel: 0, cyberware, armor });

  it('instalado, soma no atributo com que se rola', () => {
    expect(corrente(STATS, [lace]).BODY).toBe(STATS.BODY + 2);
  });

  it('o BTM melhora com ele — o exemplo do S6: BODY 10 com o Lace vira 12', () => {
    const body = corrente({ ...STATS, BODY: 10 }, [lace]).BODY;
    expect(body).toBe(12);
    expect(btmFromBody(body)).toBe(btmFromBody(12));
    expect(btmFromBody(body)).toBeLessThan(btmFromBody(10));
  });

  it('desinstalado, não soma', () => {
    expect(corrente(STATS, [{ ...lace, installed: false }]).BODY).toBe(STATS.BODY);
  });

  it('dois implantes somam, e o bônus negativo não deixa o atributo abaixo de zero', () => {
    const outro: CyberwareItem = { ...lace, id: 'o', statBonus: { stat: 'BODY', amount: 1 } };
    expect(corrente(STATS, [lace, outro]).BODY).toBe(STATS.BODY + 3);
    const pesado: CyberwareItem = { ...lace, id: 'p', statBonus: { stat: 'REF', amount: -5 } };
    expect(corrente({ ...STATS, REF: 3 }, [pesado]).REF).toBe(0);
  });

  it('o cromo entra antes do EV: o corpo primeiro, a armadura por cima', () => {
    const reflexo: CyberwareItem = { ...lace, statBonus: { stat: 'REF', amount: 2 } };
    expect(corrente({ ...STATS, REF: 2 }, [reflexo], [peca(3)]).REF).toBe(2 + 2 - 3);
  });

  it('o validador guarda o bônus com teto, e descarta o que não é atributo', () => {
    const r = sanitizeCharacterSheet({
      id: 's', handle: 'Vex', stats: STATS, skills: [], weapons: [], armor: [],
      cyberware: [
        lace,
        { ...lace, id: 'x', statBonus: { stat: 'ALMA', amount: 2 } },
        { ...lace, id: 'y', statBonus: { stat: 'REF', amount: 9 } }
      ]
    })!;
    expect(r.sheet.cyberware[0].statBonus).toEqual({ stat: 'BODY', amount: 2 });
    expect(r.sheet.cyberware[1].statBonus).toBeUndefined();
    expect(r.sheet.cyberware[2].statBonus).toEqual({ stat: 'REF', amount: 5 });
    expect(r.changed).toEqual(expect.arrayContaining(['cyberware[1].statBonus', 'cyberware[2].statBonus.amount']));
    // Só o Lace soma no BODY: o bônus descartado não conta, e o terceiro soma no REF.
    expect(r.sheet.currentStats.BODY).toBe(STATS.BODY + 2);
    expect(r.sheet.currentStats.REF).toBe(STATS.REF + 5);
  });
});
