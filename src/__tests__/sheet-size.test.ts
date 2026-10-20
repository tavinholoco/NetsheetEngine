/**
 * K.2f — a ficha cheia com o formato da K.2, contra os 64 KB da sincronia
 * =======================================================================
 * O I.06 (ADIAR, na lista da Q, dono a K.2) dizia: se a ficha engordar até
 * perto do teto, a sincronia falha calada (`sheet_too_large`) e a tela não
 * avisa. A K.2 engordou a ficha — inventário, armadura por peça, bônus de
 * cromo. Aqui fica a medida, do jeito que o servidor mede (o JSON da ficha já
 * saneada, em bytes), e a trava: a ficha de um veterano cabe com folga.
 */
import { describe, it, expect } from 'vitest';
import { MAX_SHEET_BYTES } from '../../server/roomManager';
import { sanitizeCharacterSheet } from '../rules/sheetSchema';
import { STAT_NAMES } from '../rules/character';
import type { ArmorLocation } from '../types/cyberpunk';

const texto = (n: number, base: string) => (base + ' ').repeat(Math.ceil(n / (base.length + 1))).slice(0, n);
const LOCAIS: ArmorLocation[] = ['Head', 'Torso', 'Right Arm', 'Left Arm', 'Right Leg', 'Left Leg'];

/** Um Solo veterano depois de uma campanha longa, com tudo preenchido. */
function fichaCheia(q: { skills: number; cyberware: number; weapons: number; armor: number; gear: number; events: number }) {
  return {
    id: 'sheet_veterano', handle: 'Vex Kaiser "Navalha"', realName: 'Verônica Kaiser Albuquerque',
    role: 'Solo', specialAbilityName: 'Combat Sense', specialAbilityRank: 8,
    avatarUrl: 'https://xyzproject.supabase.co/storage/v1/object/public/avatars/0f8b9c2e-1d3a-4b5c-9e7f-1234567890ab/avatar.png',
    age: 31, sex: 'F', eurodollars: 48_500,
    stats: Object.fromEntries(STAT_NAMES.map((s) => [s, 9])),
    damagePoints: 13, woundLevel: 4, isDead: false, isStabilized: false,
    skills: Array.from({ length: q.skills }, (_, i) => ({
      id: `sk_1792300000000_${i}abc`, name: texto(22, `Perícia de campanha ${i}`), stat: STAT_NAMES[i % 9], level: 6
    })),
    cyberware: Array.from({ length: q.cyberware }, (_, i) => ({
      id: `cw_1792300000000_${i}abc`, name: texto(28, `Implante militar ${i}`), category: 'Bioware', costEb: 2500,
      humanityLoss: '1d6+1', actualHL: 4, installed: true, notes: texto(60, 'Instalado na clínica do Doc Ruiz'),
      ...(i % 5 === 0 ? { statBonus: { stat: 'BODY', amount: 2 } } : {})
    })),
    weapons: Array.from({ length: q.weapons }, (_, i) => ({
      id: `wp_1792300000000_${i}abc`, name: texto(40, `Militech Arms Avenger modificada ${i}`), type: 'Pistol', wa: 1,
      con: 'J', avail: 'C', damage: '2d6+3', shots: 12, currentShots: 9, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true
    })),
    armor: Array.from({ length: q.armor }, (_, i) => ({
      id: `arm_1792300000000_${i}abc`, name: texto(26, `Jaqueta blindada pesada ${i}`),
      locations: LOCAIS.slice(0, 1 + (i % 6)), sp: 18, ev: 1, equipped: true
    })),
    gear: Array.from({ length: q.gear }, (_, i) => ({
      id: `gear_1792300000000_${i}abc`, name: texto(24, `Item do inventário ${i}`), weightKg: 1.25, qty: 2
    })),
    lifepath: {
      familyBackground: texto(40, 'Classe média baixa'), parentStatus: texto(40, 'Um vivo, um morto'),
      familyTragedy: texto(40, 'Família vítima de crime'), childhoodEnvironment: texto(40, 'Zona de Combate'),
      motivationStyle: texto(40, 'Vingança'), valuedPerson: texto(40, 'A irmã mais nova'),
      valuedPossession: texto(40, 'O isqueiro do pai'),
      lifeEvents: Array.from({ length: q.events }, (_, i) => texto(80, `Evento de vida número ${i}`))
    },
    gearNotes: texto(800, 'Dois carregadores extras, kit de primeiros socorros, agenda eletrônica'),
    createdAt: '2026-10-18T12:00:00.000Z', updatedAt: '2026-10-18T12:00:00.000Z'
  };
}

function bytes(input: unknown): number {
  const r = sanitizeCharacterSheet(input)!;
  return Buffer.byteLength(JSON.stringify(r.sheet));
}

describe('K.2f — a ficha cheia contra os 64 KB', () => {
  it('a ficha de um veterano cabe com folga: menos de um terço do teto', () => {
    const veterano = bytes(fichaCheia({ skills: 45, cyberware: 15, weapons: 8, armor: 8, gear: 40, events: 12 }));
    expect(veterano).toBeLessThan(MAX_SHEET_BYTES / 3);
  });

  // K.5b — o netrunner engorda a ficha com o deck e os programas.
  it('o veterano netrunner, com o deck e 40 programas, ainda cabe com folga', () => {
    const programs = Array.from({ length: 40 }, (_, i) => ({
      id: `prog_1792300000000_${i}abc`, name: texto(20, `Programa de ataque ${i}`), programClass: 'antiIc',
      strength: 6, mu: 5, costEb: 1480, loaded: i < 4
    }));
    const deck = { model: texto(30, 'Zetatech Paraline 5750 modificado'), chassis: 'cellular', speed: 3, dataWall: 8, codeGate: 4, extraMemory: true };
    const netrunner = bytes({ ...fichaCheia({ skills: 45, cyberware: 15, weapons: 8, armor: 8, gear: 40, events: 12 }), deck, programs });
    expect(netrunner).toBeLessThan(MAX_SHEET_BYTES / 2);
  });

  it('a ficha de colecionador (o dobro de tudo) ainda cabe', () => {
    const colecionador = bytes(fichaCheia({ skills: 100, cyberware: 30, weapons: 20, armor: 16, gear: 100, events: 30 }));
    expect(colecionador).toBeLessThan(MAX_SHEET_BYTES);
  });
});
