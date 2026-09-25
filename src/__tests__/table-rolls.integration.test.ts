/**
 * Fase C — ROLAGENS DA MESA COM AS REGRAS DO LIVRO (server/roomManager.ts)
 * =======================================================================
 * `rollDiceForPlayer` com RNG roteirizado. Cada caso aqui falhava contra o
 * servidor de antes da Fase C (prova no PLANO_MESTRE, C.0): explosão única,
 * fumble que subtraía, ataque sem perícia, modificador do GM ignorado, REF
 * ferido ignorado, death save sem o nível Mortal.
 */
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { createRoom, getAllActiveRooms, getRoom, joinRoom, leaveRoom, rollDiceForPlayer, updateRoomSettings } from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 8, REF: 8, TECH: 5, COOL: 7, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };

let seq = 0;
/** Mesa com o GM `gm_1` e um jogador `p1` (REF 8, Handgun 4, pistola WA +1). */
function mesa(patch: Partial<CharacterSheet> = {}): string {
  const code = `TCR-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  createRoom(code, 'Mesa', 'Mestre', 'gm_1');
  joinRoom(code, 'p1', 'Vex', {
    id: 's', handle: 'Vex', realName: 'Vex', role: 'Solo', stats: STATS, currentStats: { ...STATS }, woundLevel: 0,
    skills: [{ id: 'k1', name: 'Handgun', stat: 'REF', level: 4 }],
    weapons: [{ id: 'w1', name: 'Pistola', type: 'Pistol', wa: 1, con: 'J', avail: 'C', damage: '2d6+2', shots: 10, currentShots: 10, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true }],
    cyberware: [], armor: [],
    ...patch
  } as CharacterSheet);
  return code;
}

const skill = (code: string, faces: number[]) =>
  rollDiceForPlayer(code, 'p1', { kind: 'skill', skillName: 'Handgun' }, scriptedRng(faces)).roll!;

describe('C.1 — o motor da mesa é o do livro', () => {
  it('10 encadeia: [10, 10, 3] + REF 8 + Handgun 4 = 35', () => {
    expect(skill(mesa(), [10, 10, 3]).total).toBe(35);
  });

  it('1 natural: falha automática, sem subtrair (1 + 8 + 4 = 13), dado de fumble no detalhe', () => {
    const r = skill(mesa(), [1, 7]);
    expect(r.isCriticalFailure).toBe(true);
    expect(r.total).toBe(13);
    expect(r.details).toContain('tabela de fumble: 7');
  });

  it('dano marca o tronco como tronco', () => {
    const r = rollDiceForPlayer(mesa(), 'p1', { kind: 'damage' }, scriptedRng([3, 4, 2])).roll!;
    expect(r.total).toBe(9);
    expect(r.details).toBe('Dados: [3, 4] • Local de Impacto: Tronco (2-4)');
  });
});

const attack = (code: string, faces: number[]) =>
  rollDiceForPlayer(code, 'p1', { kind: 'attack' }, scriptedRng(faces)).roll!;

describe('C.3 — o ataque soma a perícia da arma', () => {
  it('5 + REF 8 + Handgun 4 + WA 1 = 18', () => {
    const r = attack(mesa(), [5]);
    expect(r.total).toBe(18);
    expect(r.details).toBe('1d10: 5 + REF (8) + Handgun (4) + WA (1) = 18');
  });

  it('sem a perícia na ficha, ataca sem treino (nível 0), e o detalhe diz qual perícia faltou', () => {
    const r = attack(mesa({ skills: [] }), [5]);
    expect(r.total).toBe(14);
    expect(r.details).toContain('Handgun (0)');
  });

  it('desarmado usa Brawling', () => {
    const r = attack(mesa({ weapons: [], skills: [{ id: 'b', name: 'Brawling', stat: 'REF', level: 3 }] }), [5]);
    expect(r.label).toBe('Ataque (desarmado)');
    expect(r.total).toBe(16);
  });
});

describe('C.4 — o modificador do GM entra em ataque e perícia', () => {
  function comModificador(value: number, reason: string): string {
    const code = mesa();
    expect(updateRoomSettings(code, 'gm_1', undefined, value, reason).error).toBeUndefined();
    return code;
  }

  it('ataque: 18 − 2 = 16, com o motivo no detalhe', () => {
    const r = attack(comModificador(-2, 'escuridão'), [5]);
    expect(r.total).toBe(16);
    expect(r.details).toContain('Mod. do Mestre: escuridão (−2)');
  });

  it('perícia: 5 + 8 + 4 + 1 = 18', () => {
    expect(skill(comModificador(1, 'mira laser'), [5]).total).toBe(18);
  });

  it('não entra no dano nem no save', () => {
    const code = comModificador(-3, 'chuva');
    const dano = rollDiceForPlayer(code, 'p1', { kind: 'damage' }, scriptedRng([3, 4, 2])).roll!;
    expect(dano.total).toBe(9);
    const save = rollDiceForPlayer(code, 'p1', { kind: 'save' }, scriptedRng([8])).roll!;
    expect(save.isCriticalSuccess).toBe(true);
  });

  it('modificador zero não polui o detalhe', () => {
    expect(attack(mesa(), [5]).details).not.toContain('Mestre');
  });
});

describe('C.7 — death save e stun save do livro', () => {
  const save = (code: string, kind: 'save' | 'stun', faces: number[]) =>
    rollDiceForPlayer(code, 'p1', { kind }, scriptedRng(faces)).roll!;

  it('death save em Mortal 3 é contra BODY − 3: 7 em BODY 8 FALHA (antes passava)', () => {
    const r = save(mesa({ woundLevel: 7 }), 'save', [7]);
    expect(r.isCriticalFailure).toBe(true);
    expect(r.diceFormula).toBe('1d10 ≤ BODY 8 − 3');
  });

  it('Mortal 6 ainda rola death save (BODY − 6), não é "morto"', () => {
    expect(save(mesa({ woundLevel: 10 }), 'save', [2]).isCriticalSuccess).toBe(true);
  });

  it('stun save existe na mesa: Crítico é BODY − 2', () => {
    const r = save(mesa({ woundLevel: 3 }), 'stun', [6]);
    expect(r.label).toBe('Stun Save (Crítico)');
    expect(r.isCriticalSuccess).toBe(true);
    expect(save(mesa({ woundLevel: 3 }), 'stun', [7]).isCriticalFailure).toBe(true);
  });

  it('tipo de rolagem desconhecido continua recusado', () => {
    expect(rollDiceForPlayer(mesa(), 'p1', { kind: 'pray' }, scriptedRng([5])).error).toMatch(/stun/);
  });
});

describe('C.6 — a mesa rola com os atributos correntes', () => {
  it('ferimento Crítico corta o REF pela metade: 5 + ceil(8/2) + 4 = 13', () => {
    const r = skill(mesa({ woundLevel: 3 }), [5]);
    expect(r.total).toBe(13);
    expect(r.details).toContain('REF (4)');
  });

  it('o currentStats que o cliente manda é ignorado — REF 15 forjado não entra', () => {
    const code = mesa({ currentStats: { ...STATS, REF: 15 } });
    expect(skill(code, [5]).total).toBe(17);
    expect(getRoom(code)!.players.p1.sheet!.currentStats.REF).toBe(8);
  });

  it('a ficha guardada na sala traz o currentStats recalculado pelo servidor', () => {
    const code = mesa({ woundLevel: 5, currentStats: { ...STATS } });
    expect(getRoom(code)!.players.p1.sheet!.currentStats).toMatchObject({ REF: 3, INT: 3, COOL: 3, MA: 6 });
  });
});
