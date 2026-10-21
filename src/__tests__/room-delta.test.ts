/**
 * L.1 (ARQ-01) — O REENVIO POR DIFERENÇA, NOS MÓDULOS PUROS
 * ==========================================================
 * Até a L.1, cada ação na mesa reenviava a sala inteira a cada conexão: a mesa
 * de 6 veteranos da L.0 pesa 142 KB por reenvio, ~1 MB por ação. A diferença
 * nasce num ponto só — o servidor guarda o texto de cada parte que mandou
 * (`RoomFeed`) e manda só o que mudou; o cliente aplica (`applyRoomPatch`).
 *
 * A propriedade que importa é a ida e volta: a sala do cliente, depois de
 * aplicar a diferença, é IGUAL à vista que o servidor mandaria inteira. Os
 * testes conferem isso caso a caso e numa sequência aleatória de mutações.
 *
 * E o E.20: a ficha do NPC é segredo do Mestre. A vista do jogador não a leva.
 */
import { describe, it, expect } from 'vitest';
import { RoomFeed, roomViewFor } from '../../server/roomDelta';
import { applyRoomPatch } from '../lib/roomPatch';
import type { ChatMessage, GameRoom, RoomPlayer } from '../types/multiplayer';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function jogador(peerId: string, handle: string, extra: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    peerId, handle, role: 'Solo', isOnline: true, joinedAt: '2026-10-21T12:00:00.000Z',
    lastActiveAt: '2026-10-21T12:00:00.000Z',
    sheet: { id: `sheet_${peerId}`, handle, role: 'Solo', woundLevel: 0, damagePoints: 0 } as RoomPlayer['sheet'],
    ...extra
  };
}

function msg(i: number): ChatMessage {
  return { id: `msg_${i}`, senderHandle: 'Vex', senderRole: 'player', text: `mensagem ${i}`, timestamp: '21:00' };
}

function sala(): GameRoom {
  return {
    code: 'L1-TESTE', name: 'Mesa', gmHandle: 'Dono', gmPeerId: 'peer_gm',
    locationName: 'Night City', combatModifier: 0, modifierReason: '',
    players: { peer_gm: jogador('peer_gm', 'Dono'), peer_vex: jogador('peer_vex', 'Vex') },
    npcs: { npc_1: jogador('npc_1', 'Booster', { role: 'NPC' }) },
    chatMessages: [msg(1), msg(2)],
    initiativeList: [],
    activeTurnIndex: 0,
    tacticalGrid: { rows: 10, cols: 10, theme: 'alley', tokens: [] },
    createdAt: '2026-10-21T12:00:00.000Z'
  };
}

/** O que o cliente tem depois de receber a sala inteira e aplicar cada diferença. */
function cliente(feed: RoomFeed, room: GameRoom, audience: 'gm' | 'player') {
  const view = roomViewFor(room, audience);
  feed.advance(view);
  return { state: clone(view), rev: feed.rev };
}

function passo(feed: RoomFeed, c: { state: GameRoom; rev: number }, room: GameRoom, audience: 'gm' | 'player') {
  const patch = feed.advance(roomViewFor(room, audience));
  if (patch) {
    expect(patch.base).toBe(c.rev);
    c.state = applyRoomPatch(c.state, clone(patch));
    c.rev = patch.rev;
  }
  return patch;
}

describe('L.1 — a vista da sala por papel (E.20)', () => {
  it('o jogador não recebe a ficha do NPC; o Mestre recebe', () => {
    const room = sala();
    const doJogador = roomViewFor(room, 'player');
    const doMestre = roomViewFor(room, 'gm');
    expect(doJogador.npcs!.npc_1.handle).toBe('Booster');
    expect('sheet' in doJogador.npcs!.npc_1).toBe(false);
    expect(doMestre.npcs!.npc_1.sheet).toEqual(room.npcs!.npc_1.sheet);
  });

  it('ninguém recebe o lastActiveAt (o heartbeat o muda sem reenvio, e a tela não o lê)', () => {
    const room = sala();
    for (const a of ['gm', 'player'] as const) {
      const view = roomViewFor(room, a);
      expect(Object.values(view.players).some((p) => 'lastActiveAt' in p)).toBe(false);
      expect(Object.values(view.npcs!).some((p) => 'lastActiveAt' in p)).toBe(false);
    }
  });

  it('a vista não mexe na sala, que é o que vai para o banco', () => {
    const room = sala();
    const antes = clone(room);
    roomViewFor(room, 'player');
    roomViewFor(room, 'gm');
    expect(room).toEqual(antes);
  });

  it('a ficha do jogador continua indo a todos: a mesa vê a dos colegas', () => {
    const view = roomViewFor(sala(), 'player');
    expect(view.players.peer_vex.sheet.handle).toBe('Vex');
  });
});

describe('L.1 — a diferença e a ida e volta', () => {
  it('a primeira vista não gera diferença: quem chega recebe a sala inteira', () => {
    const feed = new RoomFeed();
    expect(feed.advance(roomViewFor(sala(), 'gm'))).toBeNull();
    expect(feed.rev).toBe(1);
  });

  it('nada mudou, nada vai — e o rev não anda', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    expect(passo(feed, c, room, 'gm')).toBeNull();
    expect(feed.rev).toBe(c.rev);
  });

  it('o heartbeat (só o lastActiveAt) não gera diferença', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'player');
    room.players.peer_vex.lastActiveAt = '2026-10-21T13:00:00.000Z';
    expect(passo(feed, c, room, 'player')).toBeNull();
  });

  it('uma mensagem de chat vai sozinha, sem as fichas', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    room.chatMessages.push(msg(3));
    const patch = passo(feed, c, room, 'gm')!;
    expect(patch.chat).toEqual({ drop: 0, append: [msg(3)] });
    expect(patch.players).toBeUndefined();
    expect(patch.npcs).toBeUndefined();
    expect(c.state).toEqual(roomViewFor(room, 'gm'));
  });

  it('o chat no teto: a mais antiga sai e a nova entra, sem reenviar as outras', () => {
    const room = sala();
    room.chatMessages = Array.from({ length: 100 }, (_, i) => msg(i));
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    room.chatMessages.push(msg(100));
    room.chatMessages.splice(0, 1);
    const patch = passo(feed, c, room, 'gm')!;
    expect(patch.chat).toEqual({ drop: 1, append: [msg(100)] });
    expect(c.state.chatMessages).toEqual(room.chatMessages);
  });

  it('uma mensagem que mudou no meio do chat reenvia o chat inteiro', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    room.chatMessages[0] = { ...room.chatMessages[0], text: 'editada' };
    const patch = passo(feed, c, room, 'gm')!;
    expect(patch.chat).toEqual({ replace: room.chatMessages });
    expect(c.state).toEqual(roomViewFor(room, 'gm'));
  });

  it('a ficha editada vai só a do jogador que mudou', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'player');
    room.players.peer_vex.sheet = { ...room.players.peer_vex.sheet, damagePoints: 7 };
    const patch = passo(feed, c, room, 'player')!;
    expect(Object.keys(patch.players!)).toEqual(['peer_vex']);
    expect(patch.chat).toBeUndefined();
    expect(c.state).toEqual(roomViewFor(room, 'player'));
  });

  it('quem sai vira null, e quem entra vem inteiro', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    delete room.players.peer_vex;
    room.players.peer_nyx = jogador('peer_nyx', 'Nyx');
    const patch = passo(feed, c, room, 'gm')!;
    expect(patch.players!.peer_vex).toBeNull();
    expect(patch.players!.peer_nyx!.handle).toBe('Nyx');
    expect(c.state).toEqual(roomViewFor(room, 'gm'));
  });

  it('o NPC novo chega ao jogador sem ficha, e ao Mestre com', () => {
    const room = sala();
    const fGm = new RoomFeed();
    const fPj = new RoomFeed();
    const gm = cliente(fGm, room, 'gm');
    const pj = cliente(fPj, room, 'player');
    room.npcs!.npc_2 = jogador('npc_2', 'Militech', { role: 'NPC' });
    expect('sheet' in passo(fPj, pj, room, 'player')!.npcs!.npc_2!).toBe(false);
    expect(passo(fGm, gm, room, 'gm')!.npcs!.npc_2!.sheet).toBeDefined();
    expect(pj.state).toEqual(roomViewFor(room, 'player'));
    expect(gm.state).toEqual(roomViewFor(room, 'gm'));
  });

  it('o ferimento do NPC muda a vista do Mestre, e não a do jogador', () => {
    const room = sala();
    const fGm = new RoomFeed();
    const fPj = new RoomFeed();
    const gm = cliente(fGm, room, 'gm');
    const pj = cliente(fPj, room, 'player');
    room.npcs!.npc_1.sheet = { ...room.npcs!.npc_1.sheet, damagePoints: 12 };
    expect(passo(fPj, pj, room, 'player')).toBeNull();
    expect(passo(fGm, gm, room, 'gm')!.npcs!.npc_1).toBeDefined();
  });

  it('o grid, a iniciativa e as condições da cena vão no topo, e um campo que some vai em unset', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    room.tacticalGrid = { ...room.tacticalGrid!, tokens: [{ id: 't1', name: 'Vex', type: 'player', x: 2, y: 3 }] };
    room.initiativeList = [{ playerId: 'peer_vex', handle: 'Vex', role: 'Solo', score: 14, isCurrentTurn: true }];
    room.combatModifier = -2;
    let patch = passo(feed, c, room, 'gm')!;
    expect(Object.keys(patch.set!).sort()).toEqual(['combatModifier', 'initiativeList', 'tacticalGrid']);
    expect(patch.players).toBeUndefined();
    expect(c.state).toEqual(roomViewFor(room, 'gm'));

    delete room.tacticalGrid;
    patch = passo(feed, c, room, 'gm')!;
    expect(patch.unset).toEqual(['tacticalGrid']);
    expect(c.state).toEqual(roomViewFor(room, 'gm'));
  });

  it('o rev anda um por diferença, e cada uma diz de qual rev parte', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    room.chatMessages.push(msg(3));
    const a = passo(feed, c, room, 'gm')!;
    room.chatMessages.push(msg(4));
    const b = passo(feed, c, room, 'gm')!;
    expect(a.rev).toBe(a.base + 1);
    expect(b.base).toBe(a.rev);
    expect(b.rev).toBe(a.rev + 1);
  });

  it('aplicar a diferença não mexe na sala que o cliente tinha (a store troca o objeto)', () => {
    const room = sala();
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'gm');
    const antes = clone(c.state);
    const guardada = c.state;
    room.chatMessages.push(msg(3));
    room.players.peer_vex.sheet = { ...room.players.peer_vex.sheet, damagePoints: 3 };
    passo(feed, c, room, 'gm');
    expect(guardada).toEqual(antes);
    expect(c.state).not.toBe(guardada);
  });

  it('numa sequência aleatória de 300 mutações, o cliente termina igual à vista do servidor', () => {
    let semente = 20261021;
    const rnd = (n: number) => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente % n;
    };
    const room = sala();
    const fGm = new RoomFeed();
    const fPj = new RoomFeed();
    const gm = cliente(fGm, room, 'gm');
    const pj = cliente(fPj, room, 'player');
    let proximaMsg = 3;
    for (let i = 0; i < 300; i++) {
      const ids = Object.keys(room.players);
      const npcs = Object.keys(room.npcs ?? {});
      switch (rnd(9)) {
        case 0: room.chatMessages.push(msg(proximaMsg++)); if (room.chatMessages.length > 100) room.chatMessages.splice(0, room.chatMessages.length - 100); break;
        case 1: if (ids.length) { const p = room.players[ids[rnd(ids.length)]]; p.sheet = { ...p.sheet, damagePoints: rnd(40) }; } break;
        case 2: room.players[`peer_${i}`] = jogador(`peer_${i}`, `J${i}`); break;
        case 3: if (ids.length > 1) delete room.players[ids[rnd(ids.length)]]; break;
        case 4: room.npcs![`npc_${i}`] = jogador(`npc_${i}`, `N${i}`, { role: 'NPC' }); break;
        case 5: if (npcs.length) { const n = room.npcs![npcs[rnd(npcs.length)]]; n.sheet = { ...n.sheet, damagePoints: rnd(40) }; } break;
        case 6: if (npcs.length) delete room.npcs![npcs[rnd(npcs.length)]]; break;
        case 7: room.combatModifier = rnd(21) - 10; room.activeTurnIndex = rnd(5); break;
        case 8: if (ids.length) room.players[ids[rnd(ids.length)]].lastActiveAt = new Date(1_800_000_000_000 + i).toISOString(); break;
      }
      // Às vezes duas mutações antes do reenvio, como uma rota que muda duas coisas.
      if (rnd(3) === 0) continue;
      passo(fGm, gm, room, 'gm');
      passo(fPj, pj, room, 'player');
    }
    passo(fGm, gm, room, 'gm');
    passo(fPj, pj, room, 'player');
    expect(gm.state).toEqual(roomViewFor(room, 'gm'));
    expect(pj.state).toEqual(roomViewFor(room, 'player'));
  });
});

describe('L.1 — o tamanho', () => {
  it('na mesa da L.0 (6 jogadores com fichas grandes), uma mensagem de chat custa menos de 1 KB, não a sala', () => {
    const room = sala();
    const ficha = { ...room.players.peer_vex.sheet, gearNotes: 'x'.repeat(16_000) } as RoomPlayer['sheet'];
    for (let i = 0; i < 6; i++) room.players[`peer_${i}`] = jogador(`peer_${i}`, `J${i}`, { sheet: ficha });
    room.chatMessages = Array.from({ length: 100 }, (_, i) => msg(i));
    const feed = new RoomFeed();
    const c = cliente(feed, room, 'player');
    const salaInteira = JSON.stringify(roomViewFor(room, 'player')).length;
    room.chatMessages.push(msg(100));
    room.chatMessages.splice(0, 1);
    const patch = passo(feed, c, room, 'player')!;
    expect(salaInteira).toBeGreaterThan(90_000);
    expect(JSON.stringify(patch).length).toBeLessThan(1024);
  });
});
