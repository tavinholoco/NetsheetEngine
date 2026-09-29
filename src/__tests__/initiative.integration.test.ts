/**
 * Fase D (D.4) — INICIATIVA AUTOMÁTICA
 * ====================================
 * 1d10 aberto + REF CORRENTE + Combat Sense (Solo), rolado no servidor para
 * todos os combatentes com ficha (S1 `1d10!!`, S8 `1d10x10`). O 1 não é
 * fumble. Quem o GM acrescentou à mão continua na lista (ajuste manual).
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
  rollInitiative,
  updateInitiative
} from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import { sheetInitiativeRoll } from '../rules/rolls';
import type { CharacterSheet } from '../types/cyberpunk';
import type { InitiativeEntry } from '../types/multiplayer';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };
const FICHA = {
  id: 's', handle: 'Vex', realName: 'Vex', role: 'Netrunner', specialAbilityName: 'Interface', specialAbilityRank: 4,
  stats: STATS, currentStats: { ...STATS }, woundLevel: 0, skills: [], weapons: [], cyberware: [], armor: []
} as unknown as CharacterSheet;
const SOLO = { ...FICHA, handle: 'Kaze', role: 'Solo', specialAbilityName: 'Combat Sense', specialAbilityRank: 2 } as CharacterSheet;

describe('D.4 — a rolagem de iniciativa', () => {
  it('7 + REF 8 = 15', () => {
    const r = sheetInitiativeRoll(scriptedRng([7]), FICHA);
    expect(r.total).toBe(15);
    expect(r.label).toBe('Iniciativa');
  });

  it('Solo soma o Combat Sense: 7 + REF 8 + Combat Sense 2 = 17', () => {
    const r = sheetInitiativeRoll(scriptedRng([7]), SOLO);
    expect(r.total).toBe(17);
    expect(r.details).toContain('Combat Sense (2)');
  });

  it('a habilidade de outro role não soma (Interface 4 do Netrunner)', () => {
    expect(sheetInitiativeRoll(scriptedRng([7]), FICHA).details).not.toContain('Interface');
  });

  it('o 10 explode: [10, 4] + 8 = 22', () => {
    expect(sheetInitiativeRoll(scriptedRng([10, 4]), FICHA).total).toBe(22);
  });

  it('o 1 não é fumble: 1 + 8 = 9, sem dado extra e sem falha', () => {
    const rng = scriptedRng([1]);
    const r = sheetInitiativeRoll(rng, FICHA);
    expect(r.total).toBe(9);
    expect(r.isCriticalFailure).toBe(false);
    expect(rng.remaining()).toBe(0);
  });

  it('o REF é o corrente: Crítico (9 pontos) põe REF 8 em 4 → 5 + 4 = 9', () => {
    expect(sheetInitiativeRoll(scriptedRng([5]), { ...FICHA, damagePoints: 9, woundLevel: 3 } as CharacterSheet).total).toBe(9);
  });
});

let seq = 0;
/** Mesa: GM `gm_1`, Vex (Netrunner, REF 8) e Kaze (Solo, REF 8, Combat Sense 2). */
function mesa(): string {
  const code = `TIN-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  const gm = createRoom(code, 'Mesa', 'Mestre', 'gm_1');
  joinRoom(code, 'gm_1', 'Mestre', { ...FICHA, handle: 'Mestre' }, gm.sessionToken); // R.1: com o token do assento
  joinRoom(code, 'p1', 'Vex', FICHA);
  joinRoom(code, 'p2', 'Kaze', SOLO);
  return code;
}
const lista = (code: string) => getRoom(code)!.initiativeList.map((e) => [e.handle, e.score, e.isCurrentTurn]);

describe('D.4 — o servidor rola para todos', () => {
  it('jogadores (menos o GM), em ordem decrescente, e a vez é do primeiro', () => {
    const code = mesa();
    const r = rollInitiative(code, 'gm_1', scriptedRng([3, 6]));
    expect(r.error).toBeUndefined();
    // Vex 3 + 8 = 11; Kaze 6 + 8 + 2 = 16.
    expect(lista(code)).toEqual([['Kaze', 16, true], ['Vex', 11, false]]);
    expect(getRoom(code)!.activeTurnIndex).toBe(0);
  });

  it('empate mantém a ordem em que rolaram — o livro não dá desempate', () => {
    const code = mesa();
    rollInitiative(code, 'gm_1', scriptedRng([5, 3])); // Vex 13, Kaze 13
    expect(lista(code).map((e) => e[0])).toEqual(['Vex', 'Kaze']);
  });

  it('NPC com ficha entra; NPC morto não', () => {
    const code = mesa();
    const vivo = generateRoomNpc(code, 'gm_1').npcPlayer!.peerId;
    const morto = generateRoomNpc(code, 'gm_1').npcPlayer!.peerId;
    getRoom(code)!.npcs![morto].sheet.isDead = true;
    rollInitiative(code, 'gm_1', scriptedRng([1, 1, 1]));
    const ids = getRoom(code)!.initiativeList.map((e) => e.playerId);
    expect(ids).toContain(vivo);
    expect(ids).not.toContain(morto);
    expect(ids).toHaveLength(3);
  });

  it('a entrada que o GM pôs à mão continua, com o valor dela (ajuste manual)', () => {
    const code = mesa();
    updateInitiative(code, 'gm_1', [{ playerId: 'init_1', handle: 'Guarda', role: '—', score: 14, isCurrentTurn: false }]);
    rollInitiative(code, 'gm_1', scriptedRng([3, 6])); // Kaze 16, Vex 11
    expect(lista(code).map((e) => e[0])).toEqual(['Kaze', 'Guarda', 'Vex']);
  });

  it('rolar de novo substitui os valores rolados antes', () => {
    const code = mesa();
    rollInitiative(code, 'gm_1', scriptedRng([3, 6]));
    rollInitiative(code, 'gm_1', scriptedRng([9, 1]));
    expect(lista(code)).toEqual([['Vex', 17, true], ['Kaze', 11, false]]);
  });

  it('cada rolagem fica no chat, com as parcelas', () => {
    const code = mesa();
    rollInitiative(code, 'gm_1', scriptedRng([3, 6]));
    const texto = getRoom(code)!.chatMessages.at(-1)!.text;
    expect(texto).toContain('Kaze 16');
    expect(texto).toContain('Combat Sense (2)');
  });

  it('jogador não rola a iniciativa da mesa', () => {
    const r = rollInitiative(mesa(), 'p1', scriptedRng([]));
    expect(r.error).toMatch(/Mestre/);
  });
});

describe('D.4 — o ajuste manual só guarda os campos da entrada', () => {
  it('campo desconhecido não vira estado da sala', () => {
    const code = mesa();
    updateInitiative(code, 'gm_1', [
      { playerId: 'x', handle: 'A', role: 'Solo', score: 5, isCurrentTurn: true, lixo: 'x'.repeat(5000) } as unknown as InitiativeEntry
    ]);
    expect(Object.keys(getRoom(code)!.initiativeList[0]).sort()).toEqual(['handle', 'isCurrentTurn', 'playerId', 'role', 'score']);
  });

  it('a vez começa no primeiro, qualquer que seja o isCurrentTurn enviado', () => {
    const code = mesa();
    updateInitiative(code, 'gm_1', [
      { playerId: 'a', handle: 'A', role: '—', score: 9, isCurrentTurn: false },
      { playerId: 'b', handle: 'B', role: '—', score: 5, isCurrentTurn: true }
    ]);
    expect(getRoom(code)!.initiativeList.map((e) => e.isCurrentTurn)).toEqual([true, false]);
  });
});
