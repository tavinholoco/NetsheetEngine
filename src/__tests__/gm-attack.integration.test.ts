/**
 * Fase D (D.3) — O GM ATACA COM O NPC, SEM SAIR DO GRID
 * =====================================================
 * `resolveGmAttack`: o NPC rola o ataque contra a dificuldade da faixa de
 * alcance (p. 99 — igualar ou superar, S8 e S9); se acertou, rola o dano e o
 * local de impacto e aplica pelo mesmo caminho da D.1. Uma mutação só.
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
  resolveGmAttack,
  rollDiceForPlayer
} from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import { attackHits, rangeBandFor, rangeBandMeters } from '../rules/combat';
import { RANGE_BANDS } from '../rules/tables';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 6, REF: 6, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };

/** Alvo: BODY 8 (BTM −3), SP 10 no tronco, nada na cabeça. */
const ALVO = {
  id: 's', handle: 'Vex', realName: 'Vex', role: 'Solo', stats: STATS, currentStats: { ...STATS }, woundLevel: 0,
  skills: [], weapons: [], cyberware: [],
  armor: [{ id: 'a1', name: 'Jaqueta', location: 'Torso', sp: 10, ev: 0, equipped: true }]
} as unknown as CharacterSheet;

/** Atacante: REF 6, Handgun 3, pistola WA 0, 2d6, alcance 50 m. */
const ATIRADOR = {
  ...ALVO, id: 'n', handle: 'Booster', role: 'Solo', armor: [],
  skills: [{ id: 'k', name: 'Handgun', stat: 'REF', level: 3 }],
  weapons: [{ id: 'w', name: 'Pistola', type: 'Pistol', wa: 0, con: 'J', avail: 'C', damage: '2d6', shots: 10, currentShots: 10, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true }]
} as unknown as CharacterSheet;

let seq = 0;
/** Mesa com o GM, o jogador `p1` (alvo) e um NPC com a ficha do ATIRADOR. */
function mesa(): { code: string; npcId: string } {
  const code = `TGA-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  const gm = createRoom(code, 'Mesa', 'Mestre', 'gm_1');
  joinRoom(code, 'gm_1', 'Mestre', { ...ALVO, handle: 'Mestre' }, gm.sessionToken); // R.1: com o token do assento
  joinRoom(code, 'p1', 'Vex', ALVO);
  const npcId = generateRoomNpc(code, 'gm_1').npcPlayer!.peerId;
  getRoom(code)!.npcs![npcId].sheet = { ...ATIRADOR };
  getRoom(code)!.npcs![npcId].handle = 'Booster';
  return { code, npcId };
}

const vex = (code: string) => getRoom(code)!.players.p1.sheet;
const chat = (code: string) => getRoom(code)!.chatMessages.map((m) => m.text).join('\n');

describe('D.3 — a tabela de alcance e o critério de acerto', () => {
  it('cinco faixas, 10 a 30, de 5 em 5 (p. 99)', () => {
    expect(RANGE_BANDS.map((b) => b.difficulty)).toEqual([10, 15, 20, 25, 30]);
  });

  it('as faixas em metros para uma pistola de 50 m: 1, 13, 25, 50, 100', () => {
    expect(RANGE_BANDS.map((b) => rangeBandMeters(b, 50))).toEqual([1, 13, 25, 50, 100]);
  });

  it('igualar a dificuldade acerta; ficar abaixo erra; fumble erra sempre', () => {
    expect(attackHits({ total: 20, isCriticalFailure: false }, 20)).toBe(true);
    expect(attackHits({ total: 19, isCriticalFailure: false }, 20)).toBe(false);
    expect(attackHits({ total: 30, isCriticalFailure: true }, 10)).toBe(false);
  });

  it('chave fora da tabela não é faixa', () => {
    expect(rangeBandFor('perto')).toBeNull();
  });
});

describe('D.3 — o NPC ataca', () => {
  it('Média (20): 9 + REF 6 + Handgun 3 = 18 — errou, e nada de dano (a fila vazia prova)', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'medium' }, scriptedRng([9]));
    expect(r.error).toBeUndefined();
    expect(r.hit).toBe(false);
    expect(vex(code).damagePoints).toBe(0);
    expect(chat(code)).toContain('Média (20)');
    expect(chat(code)).toContain('errou');
  });

  it('Média (20): 10 explode + 2 = 12 + 9 = 21 — acertou; 2d6 [6, 6] no tronco → 12 − SP 10 = 2 → BTM −3 = 1', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'medium' }, scriptedRng([10, 2, 6, 6, 3, 1]));
    expect(r.hit).toBe(true);
    expect(vex(code).damagePoints).toBe(1);
    expect(chat(code)).toContain('12 − SP 10 = 2 → BTM −3 = 1 (mín. 1)');
  });

  it('igualar acerta: Curta (15) com 6 + 9 = 15; 2d6 [1, 1] na cabeça → (2 − 3 → 1) × 2 = 2', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'close' }, scriptedRng([6, 1, 1, 1, 1]));
    expect(r.hit).toBe(true);
    expect(vex(code).damagePoints).toBe(2);
  });

  it('fumble erra mesmo à queima-roupa (1 + 9 = 10 ≥ 10)', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'pointBlank' }, scriptedRng([1, 5]));
    expect(r.hit).toBe(false);
    expect(vex(code).damagePoints).toBe(0);
  });

  it('dificuldade livre (ex.: o total do defensor no corpo a corpo): 2 + 9 = 11 contra 12 — errou', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', difficulty: 12 }, scriptedRng([2]));
    expect(r.hit).toBe(false);
    expect(chat(code)).toContain('Dificuldade 12');
  });

  it('pelo token do NPC e o token do alvo também funciona', () => {
    const { code, npcId } = mesa();
    const r = resolveGmAttack(code, 'gm_1', { attackerId: `npc_token_${npcId}`, targetId: 'token_p1', range: 'medium' }, scriptedRng([9]));
    expect(r.error).toBeUndefined();
  });

  it('a rolagem do ataque sai no chat em nome do NPC', () => {
    const { code, npcId } = mesa();
    resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'medium' }, scriptedRng([9]));
    const roll = getRoom(code)!.chatMessages.find((m) => m.rollResult?.label.startsWith('Ataque'))!.rollResult!;
    expect(roll.characterName).toBe('Booster');
    expect(roll.total).toBe(18);
  });
});

describe('D.3 — o que é recusado antes de rolar qualquer dado', () => {
  const recusa = (req: Record<string, unknown>, who = 'gm_1') => {
    const { code, npcId } = mesa();
    return resolveGmAttack(code, who, { attackerId: npcId, targetId: 'p1', range: 'medium', ...req }, scriptedRng([])).error;
  };

  it('jogador não ataca pelo NPC', () => expect(recusa({}, 'p1')).toMatch(/Mestre/));
  it('atacante que é jogador rola o próprio ataque', () => expect(recusa({ attackerId: 'p1' })).toMatch(/próprio ataque/));
  it('alvo sem ficha (cobertura)', () => expect(recusa({ targetId: 'cover_1' })).toMatch(/sem ficha/));
  it('faixa fora da tabela e sem dificuldade', () => expect(recusa({ range: 'perto' })).toMatch(/alcance/));
  it('dificuldade fora de 1..50', () => expect(recusa({ range: undefined, difficulty: 999 })).toMatch(/alcance/));

  it('o NPC não ataca a si mesmo', () => {
    const { code, npcId } = mesa();
    expect(resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: npcId, range: 'medium' }, scriptedRng([])).error).toMatch(/si mesmo/);
  });

  it('NPC morto não ataca', () => {
    const { code, npcId } = mesa();
    getRoom(code)!.npcs![npcId].sheet.isDead = true;
    expect(resolveGmAttack(code, 'gm_1', { attackerId: npcId, targetId: 'p1', range: 'medium' }, scriptedRng([])).error).toMatch(/morto/);
  });
});

describe('D.3 — o dano rolado pelo jogador traz o local estruturado', () => {
  it('rolagem de dano da mesa tem `hitLocation`', () => {
    const { code } = mesa();
    getRoom(code)!.players.p1.sheet.weapons = ATIRADOR.weapons;
    const r = rollDiceForPlayer(code, 'p1', { kind: 'damage' }, scriptedRng([3, 4, 2])).roll!;
    expect(r.hitLocation).toBe('Torso');
  });
});
