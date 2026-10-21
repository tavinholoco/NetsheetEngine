/**
 * L.1 (ARQ-01) — a tela da mesa recebe a sala por diferença
 * ==========================================================
 * O cliente pede `delta=1` no WebSocket e no SSE, guarda o `rev` da sala
 * inteira de entrada e aplica cada diferença que parte dele. Se uma diferença
 * partir de outro rev — uma que ele não viu —, ele pede a sala inteira
 * (`resync` no socket; o SSE reabre o stream, que começa com ela) e ignora as
 * diferenças até ela chegar. A sala inteira sem `type`, a de antes da L.1,
 * continua valendo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import { controlRoomTransport, ControlledWebSocket, ControlledEventSource } from '../test/roomTransport';
import type { ChatMessage, GameRoom, RoomFullMessage, RoomPatchMessage } from '../types/multiplayer';

const CODE = 'NC-2020-L1PTCH';

function msg(i: number): ChatMessage {
  return { id: `msg_${i}`, senderHandle: 'Vex', senderRole: 'player', text: `mensagem ${i}`, timestamp: '21:00' };
}

function mesa(): GameRoom {
  return {
    code: CODE, name: 'Mesa de sexta', gmHandle: 'Dono', gmPeerId: 'peer_dono',
    locationName: 'Afterlife', combatModifier: 0, modifierReason: '',
    players: {
      peer_vex: { peerId: 'peer_vex', handle: 'Vex', role: 'Solo', isOnline: true, joinedAt: '', sheet: { handle: 'Vex' } } as GameRoom['players'][string],
      peer_nyx: { peerId: 'peer_nyx', handle: 'Nyx', role: 'Netrunner', isOnline: true, joinedAt: '', sheet: { handle: 'Nyx' } } as GameRoom['players'][string]
    },
    npcs: {},
    chatMessages: [msg(1)],
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

const full = (rev: number, room: GameRoom): string => JSON.stringify({ type: 'room:full', rev, room } satisfies RoomFullMessage);
const patch = (p: Omit<RoomPatchMessage, 'type'>): string => JSON.stringify({ type: 'room:patch', ...p } satisfies RoomPatchMessage);
const sala = () => useRoomStore.getState().room!;
/** Só os quadros de texto: o Yjs também manda os dele, binários. */
const resyncs = (ws: ControlledWebSocket) =>
  ws.sent.filter((s) => typeof s === 'string' && JSON.parse(s).type === 'resync').length;

let net: { sockets: ControlledWebSocket[]; streams: ControlledEventSource[] };

beforeEach(() => {
  vi.useFakeTimers();
  net = controlRoomTransport();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  useRoomStore.setState({ view: 'active', roomCode: CODE, room: mesa(), peerId: 'peer_vex', sessionToken: 't1', errorMsg: '' });
  render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
});

describe('L.1 — o cliente pede e aplica a diferença', () => {
  it('o WebSocket e o SSE pedem delta=1', () => {
    expect(net.sockets[0].url).toContain('delta=1');
    act(() => net.sockets[0].drop()); // nunca conectou: o SSE
    expect(net.streams[0].url).toContain('delta=1');
  });

  it('a sala inteira e depois a mensagem nova: o chat cresce, e o jogador que não mudou é o mesmo objeto', () => {
    const ws = net.sockets[0];
    act(() => ws.open());
    act(() => ws.receive(full(5, mesa())));
    const nyxAntes = sala().players.peer_nyx;
    act(() => ws.receive(patch({ base: 5, rev: 6, chat: { drop: 0, append: [msg(2)] } })));
    expect(sala().chatMessages.map((m) => m.id)).toEqual(['msg_1', 'msg_2']);
    expect(sala().players.peer_nyx).toBe(nyxAntes);
    act(() => ws.receive(patch({ base: 6, rev: 7, players: { peer_nyx: null }, set: { combatModifier: -2 } })));
    expect(Object.keys(sala().players)).toEqual(['peer_vex']);
    expect(sala().combatModifier).toBe(-2);
    expect(resyncs(ws)).toBe(0);
  });

  it('uma diferença de outro rev: pede a sala inteira uma vez, ignora as seguintes até ela chegar, e volta a aplicar', () => {
    const ws = net.sockets[0];
    act(() => ws.open());
    act(() => ws.receive(full(5, mesa())));
    act(() => ws.receive(patch({ base: 7, rev: 8, chat: { drop: 0, append: [msg(9)] } })));
    act(() => ws.receive(patch({ base: 8, rev: 9, chat: { drop: 0, append: [msg(10)] } })));
    expect(resyncs(ws)).toBe(1);
    expect(sala().chatMessages.map((m) => m.id)).toEqual(['msg_1']);

    const agora = { ...mesa(), chatMessages: [msg(1), msg(9), msg(10)] };
    act(() => ws.receive(full(9, agora)));
    act(() => ws.receive(patch({ base: 9, rev: 10, chat: { drop: 0, append: [msg(11)] } })));
    expect(sala().chatMessages.map((m) => m.id)).toEqual(['msg_1', 'msg_9', 'msg_10', 'msg_11']);
    expect(resyncs(ws)).toBe(1);
  });

  it('uma diferença antes da sala inteira também pede a sala inteira', () => {
    const ws = net.sockets[0];
    act(() => ws.open());
    act(() => ws.receive(patch({ base: 3, rev: 4, set: { combatModifier: 1 } })));
    expect(resyncs(ws)).toBe(1);
    expect(sala().combatModifier).toBe(0);
  });

  it('a sala inteira sem type (a de antes da L.1) continua valendo', () => {
    const ws = net.sockets[0];
    act(() => ws.open());
    act(() => ws.receive(JSON.stringify({ ...mesa(), locationName: 'Watson' })));
    expect(sala().locationName).toBe('Watson');
  });

  it('no SSE, o buraco reabre o stream — que começa com a sala inteira', () => {
    act(() => net.sockets[0].drop());
    const es = net.streams[0];
    act(() => es.receive(full(2, mesa())));
    act(() => es.receive(patch({ base: 4, rev: 5, set: { combatModifier: 3 } })));
    expect(es.closed).toBe(true);
    expect(net.streams).toHaveLength(2);
    act(() => net.streams[1].receive(full(5, { ...mesa(), combatModifier: 3 })));
    expect(sala().combatModifier).toBe(3);
  });
});
