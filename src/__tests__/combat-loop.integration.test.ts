/**
 * Fase D (D.6) — O LOOP DE COMBATE INTEIRO, DE PONTA A PONTA
 * ==========================================================
 * Cada peça tem o seu teste (D.1–D.5). Este conta uma luta só, na ordem em
 * que a mesa joga, com os dados roteirizados: iniciativa → o NPC ataca →
 * o dano vira ferimento (com perda de membro e Mortal) → death save na hora
 * → virada de turno com death save → o GM estabiliza → a vez passa sem
 * rolar → novo acerto desfaz a estabilização → o death save falha → morto,
 * e o morto sai da iniciativa seguinte. (ARQ-08, parte 2.)
 */
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import {
  applyDamage,
  createRoom,
  generateRoomNpc,
  getAllActiveRooms,
  getRoom,
  joinRoom,
  leaveRoom,
  nextTurn,
  resolveGmAttack,
  rollInitiative,
  setStabilized,
  updatePlayerSheet
} from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };

/** Vex: Netrunner, REF 8, BODY 8 (BTM −3), SP 10 só no tronco, já com 6 pontos (Sério). */
const VEX = {
  id: 'v', handle: 'Vex', realName: 'Vex', role: 'Netrunner', specialAbilityName: 'Interface', specialAbilityRank: 4,
  stats: STATS, currentStats: { ...STATS }, woundLevel: 2, damagePoints: 6,
  skills: [], weapons: [], cyberware: [],
  armor: [{ id: 'a1', name: 'Jaqueta', location: 'Torso', sp: 10, ev: 0, equipped: true }]
} as unknown as CharacterSheet;

/** Booster: NPC Nomad, REF 6, Handgun 3, pistola 2d6. */
const BOOSTER = {
  ...VEX, id: 'b', handle: 'Booster', role: 'Nomad', specialAbilityName: 'Family', specialAbilityRank: 2,
  stats: { ...STATS, REF: 6 }, currentStats: { ...STATS, REF: 6 }, woundLevel: 0, damagePoints: 0, armor: [],
  skills: [{ id: 'k', name: 'Handgun', stat: 'REF', level: 3 }],
  weapons: [{ id: 'w', name: 'Pistola', type: 'Pistol', wa: 0, con: 'J', avail: 'C', damage: '2d6', shots: 10, currentShots: 10, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true }]
} as unknown as CharacterSheet;

describe('D.6 — uma luta inteira', () => {
  it('da iniciativa à morte, cada regra no seu lugar', () => {
    const code = `TLP-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    const gm = createRoom(code, 'Mesa', 'Mestre', 'gm_1');
    joinRoom(code, 'gm_1', 'Mestre', { ...VEX, handle: 'Mestre' }, gm.sessionToken); // R.1: com o token do assento
    joinRoom(code, 'p1', 'Vex', VEX);
    const npcId = generateRoomNpc(code, 'gm_1').npcPlayer!.peerId;
    const room = getRoom(code)!;
    room.npcs![npcId].sheet = { ...BOOSTER };
    room.npcs![npcId].handle = 'Booster';
    const vex = () => room.players.p1.sheet;
    const vez = () => room.initiativeList[room.activeTurnIndex].handle;
    const ok = (r: { error?: string }) => expect(r.error).toBeUndefined();

    // 1. Iniciativa com o REF corrente: o Vex está Sério (REF 8 − 2 = 6), então
    //    2 + 6 = 8; Booster 9 + REF 6 = 15. A vez é do Booster.
    ok(rollInitiative(code, 'gm_1', scriptedRng([2, 9])));
    expect(room.initiativeList.map((e) => [e.handle, e.score])).toEqual([['Booster', 15], ['Vex', 8]]);
    expect(vez()).toBe('Booster');

    // 2. O Booster atira no Vex a curta distância (15): 8 + 6 + 3 = 17, acerta.
    //    2d6 [6, 6] = 12 na perna esquerda (9): 12 − SP 0 → BTM −3 = 9 pontos.
    //    6 + 9 = 15 → Mortal 0; e 9 > 8 num membro: perda da perna.
    //    Em Mortal, o death save vem na hora (3 ≤ 8) e depois o stun (2 ≤ 5).
    const hit = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'close' }, scriptedRng([8, 6, 6, 9, 3, 2]));
    ok(hit);
    expect(hit.hit).toBe(true);
    expect(hit.outcome!.limbLost).toBe(true);
    expect(vex()).toMatchObject({ damagePoints: 15, woundLevel: 4, isDead: false });

    // 3. O jogador tenta se curar pela sincronia da ficha: não passa (decisão 7a).
    updatePlayerSheet(code, 'p1', { ...VEX, damagePoints: 0, woundLevel: 0 } as CharacterSheet);
    expect(vex().damagePoints).toBe(15);

    // 4. A vez passa ao Vex, em Mortal 0: death save do turno, 8 ≤ 8, vive.
    ok(nextTurn(code, 'gm_1', scriptedRng([8])));
    expect(vez()).toBe('Vex');
    expect(vex().isDead).toBe(false);

    // 5. A vez volta ao Booster, ileso: nada a rolar (a fila vazia prova).
    ok(nextTurn(code, 'gm_1', scriptedRng([])));
    expect(vez()).toBe('Booster');

    // 6. O GM estabiliza o Vex; na vez dele, nada rola.
    ok(setStabilized(code, 'gm_1', { targetId: 'p1', stabilized: true }));
    ok(nextTurn(code, 'gm_1', scriptedRng([])));
    expect(vez()).toBe('Vex');

    // 7. O GM aplica mais 4 no braço (dano que um jogador rolasse): 4 − 3 = 1.
    //    16 pontos, ainda Mortal 0 — e o dano desfaz a estabilização. O death
    //    save da hora falha (9 > 8): morto, sem stun.
    ok(applyDamage(code, 'gm_1', { targetId: 'p1', raw: 4, location: 'Right Arm' }, scriptedRng([9])));
    expect(vex()).toMatchObject({ damagePoints: 16, isDead: true, isStabilized: false });

    // 8. Morto não rola mais na vez dele, e sai da próxima iniciativa.
    ok(nextTurn(code, 'gm_1', scriptedRng([])));
    ok(nextTurn(code, 'gm_1', scriptedRng([])));
    ok(rollInitiative(code, 'gm_1', scriptedRng([5])));
    expect(room.initiativeList.map((e) => e.handle)).toEqual(['Booster']);

    // A trilha de auditoria conta a luta na ordem.
    const rolls = room.chatMessages.filter((m) => m.rollResult).map((m) => `${m.rollResult!.characterName}: ${m.rollResult!.label}`);
    expect(rolls).toEqual([
      'Booster: Ataque (Pistola)',
      'Booster: Dano da Arma: Pistola',
      'Vex: Death Save (Mortal 0)',
      'Vex: Stun Save (Mortal 0)',
      'Vex: Death Save (Mortal 0)',
      'Vex: Death Save (Mortal 0)'
    ]);
    const texto = room.chatMessages.map((m) => m.text).join('\n');
    expect(texto).toContain('Perda de membro');
    expect(texto).toContain('foi estabilizado');
    expect(texto).toContain('💀 MORTO');
  });
});
