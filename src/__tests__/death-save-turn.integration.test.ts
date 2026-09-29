/**
 * Fase D (D.5) — DEATH SAVE NA VIRADA DE TURNO
 * ============================================
 * Em Mortal, a cada turno, 1d10 ≤ BODY − nível Mortal, até morrer ou ser
 * estabilizado (S5; S9 cita a p. 99). O servidor rola quando a vez chega a
 * quem está em Mortal. Estabilizado não rola; dano novo desfaz (D.1).
 */
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import {
  createRoom,
  generateRoomNpc,
  getAllActiveRooms,
  getRoom,
  joinRoom,
  leaveRoom,
  nextTurn,
  setStabilized,
  updateInitiative
} from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };
const FICHA = {
  id: 's', handle: 'Vex', realName: 'Vex', role: 'Solo', stats: STATS, currentStats: { ...STATS }, woundLevel: 0,
  skills: [], weapons: [], cyberware: [], armor: []
} as unknown as CharacterSheet;

let seq = 0;
/**
 * Mesa com Kaze (ileso) e Vex, nesta ordem de iniciativa; a vez começa no
 * Kaze. Vex com 21 pontos = Mortal 2 → death save 1d10 ≤ BODY 8 − 2 = 6.
 */
function mesa(vex: Partial<CharacterSheet> = { damagePoints: 21 }): string {
  const code = `TDS-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  const gm = createRoom(code, 'Mesa', 'Mestre', 'gm_1');
  joinRoom(code, 'gm_1', 'Mestre', { ...FICHA, handle: 'Mestre' }, gm.sessionToken); // R.1: com o token do assento
  joinRoom(code, 'p2', 'Kaze', { ...FICHA, handle: 'Kaze' });
  joinRoom(code, 'p1', 'Vex', { ...FICHA, ...vex } as CharacterSheet);
  updateInitiative(code, 'gm_1', [
    { playerId: 'p2', handle: 'Kaze', role: 'Solo', score: 20, isCurrentTurn: true },
    { playerId: 'p1', handle: 'Vex', role: 'Solo', score: 10, isCurrentTurn: false }
  ]);
  return code;
}
const vex = (code: string) => getRoom(code)!.players.p1.sheet;
const last = (code: string) => getRoom(code)!.chatMessages.at(-1)!;

describe('D.5 — a vez chega a quem está em Mortal', () => {
  it('Mortal 2: rola 1d10 ≤ 6; o 6 passa e segue vivo', () => {
    const code = mesa();
    nextTurn(code, 'gm_1', scriptedRng([6]));
    expect(last(code).rollResult!.label).toBe('Death Save (Mortal 2)');
    expect(last(code).rollResult!.characterName).toBe('Vex');
    expect(vex(code).isDead).toBe(false);
  });

  it('o 7 falha: morto', () => {
    const code = mesa();
    nextTurn(code, 'gm_1', scriptedRng([7]));
    expect(vex(code).isDead).toBe(true);
    expect(last(code).text).toContain('MORTO');
  });

  it('a vez de quem não está em Mortal não rola nada (fila vazia)', () => {
    const code = mesa();
    nextTurn(code, 'gm_1', scriptedRng([6])); // vez do Vex
    expect(() => nextTurn(code, 'gm_1', scriptedRng([]))).not.toThrow(); // volta ao Kaze
    expect(getRoom(code)!.initiativeList[0].isCurrentTurn).toBe(true);
  });

  it('dando a volta na lista, rola de novo no turno seguinte do Vex', () => {
    const code = mesa();
    nextTurn(code, 'gm_1', scriptedRng([1]));
    nextTurn(code, 'gm_1', scriptedRng([]));
    nextTurn(code, 'gm_1', scriptedRng([2]));
    const saves = getRoom(code)!.chatMessages.filter((m) => m.rollResult?.label.startsWith('Death Save'));
    expect(saves).toHaveLength(2);
  });

  it('estabilizado não rola', () => {
    const code = mesa({ damagePoints: 21, isStabilized: true } as Partial<CharacterSheet>);
    nextTurn(code, 'gm_1', scriptedRng([]));
    expect(vex(code).isDead).toBe(false);
  });

  it('morto não rola mais', () => {
    const code = mesa({ damagePoints: 21, isDead: true } as Partial<CharacterSheet>);
    expect(() => nextTurn(code, 'gm_1', scriptedRng([]))).not.toThrow();
  });

  it('NPC em Mortal também rola', () => {
    const code = mesa({});
    const npcId = generateRoomNpc(code, 'gm_1').npcPlayer!.peerId;
    const npc = getRoom(code)!.npcs![npcId];
    npc.sheet = { ...npc.sheet, damagePoints: 13, woundLevel: 4, isDead: false, isStabilized: false };
    updateInitiative(code, 'gm_1', [
      { playerId: 'p2', handle: 'Kaze', role: 'Solo', score: 20, isCurrentTurn: true },
      { playerId: npcId, handle: npc.handle, role: npc.role, score: 5, isCurrentTurn: false }
    ]);
    nextTurn(code, 'gm_1', scriptedRng([1]));
    expect(last(code).rollResult!.label).toBe('Death Save (Mortal 0)');
  });

  it('entrada posta à mão (sem ficha) não rola', () => {
    const code = mesa();
    updateInitiative(code, 'gm_1', [
      { playerId: 'p2', handle: 'Kaze', role: 'Solo', score: 20, isCurrentTurn: true },
      { playerId: 'init_1', handle: 'Guarda', role: '—', score: 9, isCurrentTurn: false }
    ]);
    expect(() => nextTurn(code, 'gm_1', scriptedRng([]))).not.toThrow();
  });
});

describe('D.5 — estabilizar', () => {
  it('o GM estabiliza, e o chat registra', () => {
    const code = mesa();
    const r = setStabilized(code, 'gm_1', { targetId: 'p1', stabilized: true });
    expect(r.error).toBeUndefined();
    expect(vex(code).isStabilized).toBe(true);
    expect(last(code).text).toContain('estabilizado');
  });

  it('pelo token também', () => {
    const code = mesa();
    setStabilized(code, 'gm_1', { targetId: 'token_p1', stabilized: true });
    expect(vex(code).isStabilized).toBe(true);
  });

  it('o GM desfaz', () => {
    const code = mesa({ damagePoints: 21, isStabilized: true } as Partial<CharacterSheet>);
    setStabilized(code, 'gm_1', { targetId: 'p1', stabilized: false });
    expect(vex(code).isStabilized).toBe(false);
  });

  it('jogador não estabiliza', () => {
    expect(setStabilized(mesa(), 'p1', { targetId: 'p1', stabilized: true }).error).toMatch(/Mestre/);
  });

  it('fora do Mortal não há o que estabilizar', () => {
    expect(setStabilized(mesa({}), 'gm_1', { targetId: 'p1', stabilized: true }).error).toMatch(/Mortal/);
  });

  it('o jogador não se estabiliza pela sincronia da ficha', async () => {
    const { updatePlayerSheet } = await import('../../server/roomManager');
    const code = mesa();
    updatePlayerSheet(code, 'p1', { ...FICHA, damagePoints: 21, isStabilized: true } as CharacterSheet);
    expect(vex(code).isStabilized).toBe(false);
  });
});
