/**
 * H.3b (H.09 do ledger da H) — a queda breve não prende o jogador no SSE
 * ============================================================
 * Reproduzido em 14/10 no build de produção (o E.14 da Fase E): o "já abriu uma
 * vez" era uma variável de cada rodada do efeito de transporte. Uma queda de
 * rede agendava a rodada seguinte em 3 s; se essa tentativa falhava, o cliente
 * abria o SSE e ficava nele para sempre — sem arrastar o próprio token (o REST
 * do grid é do GM), com o grid congelado na última posição do Yjs, e com um
 * `sse_fallback` no log contando queda de rede como proxy. Aqui o WebSocket é
 * do teste: ele abre, cai e faz a tentativa seguinte falhar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { writeGridToDoc } from '../lib/gridDoc';
import { useRoomStore } from '../stores/useRoomStore';
import { controlRoomTransport, ControlledWebSocket, ControlledEventSource } from '../test/roomTransport';
import type { GameRoom, TacticalGridState } from '../types/multiplayer';

const CODE = 'NC-2020-K7Q9XD';

function grid(x: number, y: number): TacticalGridState {
  return {
    rows: 8,
    cols: 10,
    theme: 'alley',
    tokens: [{ id: 'token_peer_vex', name: 'Vex', type: 'player', x, y, peerId: 'peer_vex' }]
  };
}

function mesa(g: TacticalGridState): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: {
      peer_vex: { peerId: 'peer_vex', handle: 'Vex', isOnline: true, sheet: { handle: 'Vex' } } as any
    },
    chatMessages: [],
    initiativeList: [],
    activeTurnIndex: 0,
    tacticalGrid: g,
    createdAt: new Date().toISOString()
  } as GameRoom;
}

/** O que o servidor manda pelo Yjs: o doc inteiro do grid, como um update. */
function yjsGridUpdate(g: TacticalGridState): ArrayBuffer {
  const doc = new Y.Doc();
  writeGridToDoc(doc, g, 'servidor');
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // messageSync
  syncProtocol.writeUpdate(enc, Y.encodeStateAsUpdate(doc));
  return encoding.toUint8Array(enc).buffer as ArrayBuffer;
}

let net: { sockets: ControlledWebSocket[]; streams: ControlledEventSource[] };
const last = () => net.sockets[net.sockets.length - 1];
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  net = controlRoomTransport();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  useRoomStore.setState({
    view: 'active',
    roomCode: CODE,
    room: mesa(grid(0, 0)),
    peerId: 'peer_vex',
    sessionToken: 't1',
    errorMsg: ''
  });
  render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
});

describe('H.09 — a queda depois de uma conexão que funcionou', () => {
  it('a tentativa seguinte falha, e o cliente tenta o WebSocket de novo — não o EventSource', async () => {
    act(() => net.sockets[0].open());
    act(() => net.sockets[0].drop()); // a rede piscou
    await wait(3000);
    expect(net.sockets).toHaveLength(2);
    act(() => net.sockets[1].drop()); // a rede ainda fora: a tentativa falha
    await wait(60_000);
    expect(net.streams).toHaveLength(0);
    expect(net.sockets.length).toBeGreaterThan(2);
  });

  it('a espera cresce a cada tentativa que falha, e volta ao começo quando conecta', async () => {
    act(() => net.sockets[0].open());
    act(() => net.sockets[0].drop());
    await wait(3000);
    expect(net.sockets).toHaveLength(2);
    act(() => last().drop()); // falhou: a próxima espera é maior que 3 s
    await wait(3000);
    expect(net.sockets).toHaveLength(2);
    await wait(3000);
    expect(net.sockets).toHaveLength(3);
    act(() => last().open()); // voltou
    act(() => last().drop());
    await wait(3000);
    expect(net.sockets).toHaveLength(4);
  });

  it('quem NUNCA conectou ainda cai no SSE — o proxy que bloqueia o WebSocket', async () => {
    act(() => net.sockets[0].drop());
    expect(net.streams).toHaveLength(1);
    await wait(60_000);
    expect(net.sockets).toHaveLength(1);
  });
});

describe('H.09 — sem Yjs, a tela segue o grid da sala', () => {
  it('o socket cai, e um token movido no JSON da sala aparece no grid', async () => {
    act(() => net.sockets[0].open());
    act(() => net.sockets[0].receive(yjsGridUpdate(grid(0, 0))));
    fireEvent.click(screen.getByRole('button', { name: /grid tático/i }));
    expect(screen.getByTitle(/Vex \(PLAYER\) - Setor A1$/)).toBeInTheDocument();

    act(() => net.sockets[0].drop());
    // O GM moveu o Vex para C6; a sala nova chega sem Yjs.
    act(() => useRoomStore.getState().setRoom(mesa(grid(5, 2))));
    expect(screen.getByTitle(/Vex \(PLAYER\) - Setor C6$/)).toBeInTheDocument();
  });
});
