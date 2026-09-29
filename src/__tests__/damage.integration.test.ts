/**
 * Fase D (D.1, D.2) — O DANO APLICADO PELA MESA (server/roomManager.ts)
 * =====================================================================
 * `applyDamage` com RNG roteirizado: o GM aplica, o servidor faz a conta do
 * livro (armadura → BTM → ×2 na cabeça), marca os pontos na trilha, rola o
 * stun save e deixa a conta inteira no chat. E, pela decisão 7a, o jogador
 * não desfaz o dano pela sincronia da ficha.
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
  updatePlayerSheet,
  updatePlayerWoundLevel
} from '../../server/roomManager';
import { scriptedRng } from '../test/scriptedRng';
import { armorSpAt, resolveHit } from '../rules/damage';
import { btmFromBody } from '../rules/character';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(() => {
  for (const r of getAllActiveRooms()) for (const p of Object.keys(getRoom(r.code)?.players ?? {})) leaveRoom(r.code, p);
});

const STATS = { INT: 8, REF: 8, TECH: 5, COOL: 7, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };

const SHEET: CharacterSheet = {
  id: 's', handle: 'Vex', realName: 'Vex', role: 'Solo', stats: STATS, currentStats: { ...STATS }, woundLevel: 0,
  skills: [], weapons: [], cyberware: [],
  // Jaqueta blindada no tronco (SP 10); nada na cabeça nem nos braços.
  armor: [{ id: 'a1', name: 'Jaqueta', location: 'Torso', sp: 10, ev: 0, equipped: true }]
} as unknown as CharacterSheet;

let seq = 0;
/** Token de sessão de `p1` por mesa — a reconexão legítima prova o assento com ele (R.1). */
const p1Token = new Map<string, string>();
/** Mesa com o GM `gm_1` (na mesa) e o jogador `p1` (BODY 8 → BTM −3, SP 10 no tronco). */
function mesa(patch: Partial<CharacterSheet> = {}): string {
  const code = `TDM-${Date.now().toString(36).slice(-4)}-${++seq}`.toUpperCase();
  const gm = createRoom(code, 'Mesa', 'Mestre', 'gm_1');
  // O GM volta ao próprio assento com o token dele (R.1 — sem token seria recusado).
  joinRoom(code, 'gm_1', 'Mestre', { ...SHEET, handle: 'Mestre' }, gm.sessionToken);
  p1Token.set(code, joinRoom(code, 'p1', 'Vex', { ...SHEET, ...patch })!.sessionToken);
  return code;
}

const vex = (code: string) => getRoom(code)!.players.p1;
const lastChat = (code: string) => getRoom(code)!.chatMessages.slice(-3).map((m) => m.text).join('\n');

describe('D.1 — o GM aplica, o servidor faz a conta do livro', () => {
  it('tronco: 20 − SP 10 = 10 → BTM −3 = 7 pontos (Sério), com a conta no chat', () => {
    const code = mesa();
    const r = applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    expect(r.error).toBeUndefined();
    expect(vex(code).sheet).toMatchObject({ damagePoints: 7, woundLevel: 2, isDead: false });
    expect(lastChat(code)).toContain('20 − SP 10 = 10 → BTM −3 = 7');
  });

  it('cabeça sem armadura: (6 − 3) × 2 = 6 pontos', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 6, location: 'Head' }, scriptedRng([5]));
    expect(vex(code).sheet.damagePoints).toBe(6);
    expect(lastChat(code)).toContain('× 2 = 6');
  });

  it('a armadura segurou: nenhum ponto, e sem stun save (a fila vazia do RNG prova)', () => {
    const code = mesa();
    const r = applyDamage(code, 'gm_1', { targetId: 'p1', raw: 8, location: 'Torso' }, scriptedRng([]));
    expect(r.error).toBeUndefined();
    expect(vex(code).sheet.damagePoints).toBe(0);
    expect(lastChat(code)).toContain('a armadura segurou');
  });

  it('o ferimento soma com o que já havia, em pontos', () => {
    const code = mesa({ damagePoints: 6 } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 6, location: 'Left Arm' }, scriptedRng([1]));
    // 6 − 3 = 3 → 9 pontos: Crítico.
    expect(vex(code).sheet).toMatchObject({ damagePoints: 9, woundLevel: 3 });
  });

  it('o token no grid acompanha o nível novo', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    expect(getRoom(code)!.tacticalGrid!.tokens.find((t) => t.peerId === 'p1')!.hp).toBe(2);
  });

  it('os atributos correntes seguem o ferimento novo (Sério: REF −2)', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    expect(vex(code).sheet.currentStats.REF).toBe(6);
  });
});

describe('D.1 — stun save automático a cada dano que entra', () => {
  it('rola com o nível NOVO: Sério é BODY 8 − 1 = 7; o 7 passa', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([7]));
    const roll = getRoom(code)!.chatMessages.at(-1)!.rollResult!;
    expect(roll.label).toBe('Stun Save (Sério)');
    expect(roll.characterName).toBe('Vex');
    expect(roll.isCriticalSuccess).toBe(true);
  });

  it('o 8 falha: o chat diz que está fora de ação', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([8]));
    expect(getRoom(code)!.chatMessages.at(-1)!.rollResult!.isCriticalFailure).toBe(true);
    expect(getRoom(code)!.chatMessages.at(-1)!.text).toContain('fora de ação');
  });
});

describe('D.5 — o dano que deixa em Mortal pede o death save na hora, antes do stun', () => {
  it('Crítico (12) + 2 no braço = 14 = Mortal 0: death 8 ≤ 8 passa, depois stun 5 ≤ 5 passa', () => {
    const code = mesa({ damagePoints: 12 } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 5, location: 'Left Arm' }, scriptedRng([8, 5]));
    const rolls = getRoom(code)!.chatMessages.slice(-2).map((m) => m.rollResult!.label);
    expect(rolls).toEqual(['Death Save (Mortal 0)', 'Stun Save (Mortal 0)']);
    expect(vex(code).sheet.isDead).toBe(false);
  });

  it('falhou o death save: morto, e sem stun save (a fila só tem o 9)', () => {
    const code = mesa({ damagePoints: 12 } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 5, location: 'Left Arm' }, scriptedRng([9]));
    expect(vex(code).sheet.isDead).toBe(true);
    expect(lastChat(code)).toContain('MORTO');
  });

  it('abaixo do Mortal não há death save — só o stun', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    expect(getRoom(code)!.chatMessages.at(-1)!.rollResult!.label).toBe('Stun Save (Sério)');
  });

  it('dano que entra desfaz a estabilização (p. 105, via S9)', () => {
    const code = mesa({ damagePoints: 14, isStabilized: true } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 4, location: 'Left Arm' }, scriptedRng([1, 1]));
    expect(vex(code).sheet.isStabilized).toBe(false);
  });

  it('dano que a armadura segurou não desfaz a estabilização', () => {
    const code = mesa({ damagePoints: 14, isStabilized: true } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 8, location: 'Torso' }, scriptedRng([]));
    expect(vex(code).sheet.isStabilized).toBe(true);
  });
});

describe('D.1 — as mortes e o membro perdido', () => {
  it('cabeça com mais de 8 (já dobrado): morto, e sem stun save', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 8, location: 'Head' }, scriptedRng([])); // (8 − 3) × 2 = 10
    expect(vex(code).sheet.isDead).toBe(true);
    expect(lastChat(code)).toContain('MORTO');
  });

  it('além dos 40 pontos: morto', () => {
    const code = mesa({ damagePoints: 38 } as Partial<CharacterSheet>);
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 6, location: 'Right Leg' }, scriptedRng([]));
    expect(vex(code).sheet).toMatchObject({ damagePoints: 40, isDead: true });
  });

  it('membro com mais de 8: avisa a perda do membro, e o personagem segue vivo', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 12, location: 'Right Arm' }, scriptedRng([1])); // 12 − 3 = 9
    expect(vex(code).sheet.isDead).toBe(false);
    expect(lastChat(code)).toContain('Perda de membro');
  });
});

describe('D.1 — quem pode aplicar, e em quem', () => {
  it('jogador não aplica dano', () => {
    const code = mesa();
    const r = applyDamage(code, 'p1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([]));
    expect(r.error).toMatch(/Mestre/);
    expect(vex(code).sheet.damagePoints).toBe(0);
  });

  it('localização fora da tabela é recusada', () => {
    const r = applyDamage(mesa(), 'gm_1', { targetId: 'p1', raw: 20, location: 'Tail' }, scriptedRng([]));
    expect(r.error).toMatch(/Localização/);
  });

  it('dano que não é número é recusado', () => {
    const r = applyDamage(mesa(), 'gm_1', { targetId: 'p1', raw: 'muito', location: 'Torso' }, scriptedRng([]));
    expect(r.error).toMatch(/Dano/);
  });

  it('pelo token do jogador no grid, acerta a ficha do jogador', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'token_p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    expect(vex(code).sheet.damagePoints).toBe(7);
  });

  it('NPC gerado pelo GM recebe dano pela ficha dele', () => {
    const code = mesa();
    const { npcPlayer } = generateRoomNpc(code, 'gm_1');
    const npc = npcPlayer!;
    const expected = resolveHit({
      raw: 40, sp: armorSpAt(npc.sheet.armor, 'Torso'), btm: btmFromBody(npc.sheet.stats.BODY), location: 'Torso'
    }).final;
    // Pode cair em Mortal: a fila cobre o death save (D.5) e o stun.
    applyDamage(code, 'gm_1', { targetId: npc.peerId, raw: 40, location: 'Torso' }, scriptedRng([1, 1]));
    expect(getRoom(code)!.npcs![npc.peerId].sheet.damagePoints).toBe(Math.min(40, expected));
  });
});

describe('D.2 — token sem ficha não recebe dano (decisão 7c)', () => {
  it('cobertura: recusado com mensagem clara', () => {
    const r = applyDamage(mesa(), 'gm_1', { targetId: 'cover_1', raw: 20, location: 'Torso' }, scriptedRng([]));
    expect(r.error).toMatch(/sem ficha/);
  });

  it('alvo que não existe: recusado', () => {
    const r = applyDamage(mesa(), 'gm_1', { targetId: 'ninguem', raw: 20, location: 'Torso' }, scriptedRng([]));
    expect(r.error).toMatch(/não encontrado/);
  });
});

describe('D.1 — na mesa, o jogador não desfaz o dano (decisão 7a, achado do portão C.14)', () => {
  it('a sincronia da ficha não baixa os pontos', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    updatePlayerSheet(code, 'p1', { ...SHEET, damagePoints: 0, woundLevel: 0 } as CharacterSheet);
    expect(vex(code).sheet).toMatchObject({ damagePoints: 7, woundLevel: 2 });
    expect(vex(code).sheet.currentStats.REF).toBe(6);
  });

  it('nem desfaz a morte', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 8, location: 'Head' }, scriptedRng([]));
    updatePlayerSheet(code, 'p1', { ...SHEET, isDead: false } as CharacterSheet);
    expect(vex(code).sheet.isDead).toBe(true);
  });

  it('nem reconectando com uma ficha "mais nova" e curada', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    // Reconexão legítima (com o token do assento, R.1) — tem de ACONTECER, senão
    // o teste passaria só porque o join foi recusado.
    const re = joinRoom(
      code, 'p1', 'Vex',
      { ...SHEET, damagePoints: 0, updatedAt: '2999-01-01T00:00:00Z' } as CharacterSheet,
      p1Token.get(code)
    );
    expect(re).not.toBeNull();
    expect(vex(code).sheet.damagePoints).toBe(7);
  });

  it('o resto da ficha continua sincronizando', () => {
    const code = mesa();
    applyDamage(code, 'gm_1', { targetId: 'p1', raw: 20, location: 'Torso' }, scriptedRng([5]));
    updatePlayerSheet(code, 'p1', { ...SHEET, gearNotes: 'granada' } as CharacterSheet);
    expect(vex(code).sheet.gearNotes).toBe('granada');
  });

  it('o ajuste manual do GM marca pontos (mínimo da caixa)', () => {
    const code = mesa();
    updatePlayerWoundLevel(code, 'gm_1', 'p1', 3);
    expect(vex(code).sheet).toMatchObject({ damagePoints: 9, woundLevel: 3 });
  });
});
