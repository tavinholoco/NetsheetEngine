/**
 * Fase C (C.10) — PARIDADE CLIENTE ↔ SERVIDOR
 * ===========================================
 * A mesma fila de dados, a mesma ficha: o rolador da ficha (cliente) e a
 * rolagem da mesa (servidor) têm de produzir o MESMO RollResult — tirando o
 * que é de cada lado (id, horário, nome do personagem).
 *
 * Isto fecha o ARQ-02 ("regras implementadas duas vezes, sem teste de
 * paridade"). Antes da Fase C os dois lados divergiam no número (explosão,
 * fumble, local de impacto) e, já com o motor único, ainda divergiam no texto
 * ("Perícia (4)" × "Handgun (4)", "Ataque com X" × "Ataque (X)"). Este teste
 * pega as duas coisas.
 */
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { createRoom, getAllActiveRooms, getRoom, joinRoom, leaveRoom, rollDiceForPlayer } from '../../server/roomManager';
import {
  rollSheetAttack,
  rollSheetDamage,
  rollSheetDeathSave,
  rollSheetSkill,
  rollSheetStunSave
} from '../utils/diceEngine';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet, RollResult } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 7, REF: 9, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 7 };

function ficha(woundLevel: number, actualHL: number[]): CharacterSheet {
  return {
    id: 's', handle: 'Vex', realName: 'Vex', role: 'Solo', specialAbilityName: 'Combat Sense', specialAbilityRank: 3,
    avatarUrl: '', age: 25, sex: '', eurodollars: 0,
    stats: STATS, currentStats: { ...STATS }, woundLevel,
    skills: [
      { id: 'k1', name: 'Handgun', stat: 'REF', level: 4 },
      { id: 'k2', name: 'Awareness / Notice', stat: 'INT', level: 5 }
    ],
    cyberware: actualHL.map((hl, i) => ({ id: `c${i}`, name: 'cromo', category: 'x', costEb: 0, humanityLoss: '1d6', actualHL: hl, installed: true })),
    weapons: [{ id: 'w1', name: 'Militech Avenger', type: 'Pistol', wa: 1, con: 'J', avail: 'C', damage: '2d6+1', shots: 10, currentShots: 10, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true }],
    armor: [],
    lifepath: { familyBackground: '', parentStatus: '', familyTragedy: '', childhoodEnvironment: '', motivationStyle: '', valuedPerson: '', valuedPossession: '', lifeEvents: [] },
    gearNotes: '', createdAt: '', updatedAt: ''
  };
}

let seq = 0;
function mesaCom(sheet: CharacterSheet): string {
  const code = `PAR-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  createRoom(code, 'Paridade', 'Mestre', 'gm_1');
  joinRoom(code, 'p1', 'Vex', sheet);
  return code;
}

/** O que precisa bater: tudo menos a identidade e o horário de cada lado. */
const semCarimbo = ({ id: _id, timestamp: _t, characterName: _c, ...core }: RollResult) => core;

const FICHAS: Array<[string, CharacterSheet]> = [
  ['ilesa', ficha(0, [])],
  ['Crítica, com 23 de humanidade perdida', ficha(3, [15, 8])],
  ['Mortal 3', ficha(7, [])]
];

const FILAS_DE_TESTE: number[][] = [[5], [10, 10, 3], [1, 7], [10, 1], [9]];

describe.each(FICHAS)('ficha %s', (_nome, sheet) => {
  it.each(FILAS_DE_TESTE)('perícia com a fila %j', (...fila) => {
    const cliente = rollSheetSkill(sheet, sheet.skills[0], scriptedRng(fila));
    const servidor = rollDiceForPlayer(mesaCom(sheet), 'p1', { kind: 'skill', skillName: 'Handgun' }, scriptedRng(fila)).roll!;
    expect(semCarimbo(cliente)).toEqual(semCarimbo(servidor));
  });

  it.each(FILAS_DE_TESTE)('ataque com a fila %j', (...fila) => {
    const cliente = rollSheetAttack(sheet, sheet.weapons[0], scriptedRng(fila));
    const servidor = rollDiceForPlayer(mesaCom(sheet), 'p1', { kind: 'attack' }, scriptedRng(fila)).roll!;
    expect(semCarimbo(cliente)).toEqual(semCarimbo(servidor));
  });

  it.each([[[6, 6, 1]], [[1, 2, 3]], [[4, 4, 9]]])('dano com a fila %j', (fila) => {
    const cliente = rollSheetDamage(sheet, sheet.weapons[0], scriptedRng(fila));
    const servidor = rollDiceForPlayer(mesaCom(sheet), 'p1', { kind: 'damage' }, scriptedRng(fila)).roll!;
    expect(semCarimbo(cliente)).toEqual(semCarimbo(servidor));
  });

  it.each([[1], [5], [8], [10]])('death save e stun save com o dado %i', (dado) => {
    const code = mesaCom(sheet);
    expect(semCarimbo(rollSheetDeathSave(sheet, scriptedRng([dado])))).toEqual(
      semCarimbo(rollDiceForPlayer(code, 'p1', { kind: 'save' }, scriptedRng([dado])).roll!)
    );
    expect(semCarimbo(rollSheetStunSave(sheet, scriptedRng([dado])))).toEqual(
      semCarimbo(rollDiceForPlayer(code, 'p1', { kind: 'stun' }, scriptedRng([dado])).roll!)
    );
  });
});

describe('a paridade sobrevive ao saneamento do servidor', () => {
  it('a ficha que a mesa guardou rola igual à que o cliente tem', () => {
    const sheet = ficha(3, [15, 8]);
    const code = mesaCom(sheet);
    const guardada = getRoom(code)!.players.p1.sheet!;
    expect(semCarimbo(rollSheetSkill(guardada, guardada.skills[0], scriptedRng([10, 4])))).toEqual(
      semCarimbo(rollSheetSkill(sheet, sheet.skills[0], scriptedRng([10, 4])))
    );
  });
});
