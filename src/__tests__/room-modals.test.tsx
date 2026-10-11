/**
 * G.3c e G.3d — os controles do GM na lista de jogadores da mesa
 * ===============================================================
 * - G.07: o `deletePlayer` existia de ponta a ponta (componente, API e servidor,
 *   que a R.3 endureceu) e nenhum botão o chamava desde a Fase 0. A mensagem de
 *   mesa cheia manda o GM "remover alguém".
 * - G.04: reproduzido em 10/10 — aberto o Bio-Monitor, o GM clicou 5 e depois 2,
 *   o servidor aplicou os dois, e o modal ficou com só o 0 aceso: o estado
 *   guardava uma cópia do jogador tirada no clique. O de inspecionar ficha, igual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import type { CharacterSheet } from '../types/cyberpunk';
import type { GameRoom, RoomPlayer } from '../types/multiplayer';

/** WebSocket inerte: o teste é da lista e dos modais, não do transporte. */
class FakeWebSocket {
  static OPEN = 1;
  readyState = 0;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send() {}
  close() {}
}

const CODE = 'NC-2020-K7Q9XD';
const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };

function jogador(peerId: string, handle: string, woundLevel = 0): RoomPlayer {
  const sheet = { handle, stats: STATS, woundLevel, eurodollars: 100, weapons: [], cyberware: [] } as unknown as CharacterSheet;
  return { peerId, handle, role: 'Solo', sheet, isOnline: true, joinedAt: '' };
}

function mesa(players: RoomPlayer[]): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: Object.fromEntries(players.map((p) => [p.peerId, p])),
    chatMessages: [],
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

const DONO = jogador('peer_dono', 'Dono');
const VEX = jogador('peer_vex', 'Vex');
const KID = jogador('peer_kid', 'Kid');

let fetchMock: ReturnType<typeof vi.fn>;

function entrarComo(peerId: string, players: RoomPlayer[] = [DONO, VEX, KID]) {
  const s = useRoomStore.getState();
  s.setPeerId(peerId);
  s.setSessionToken('token');
  s.setRoomCode(CODE);
  s.setRoom(mesa(players));
  s.setView('active');
}

/** O servidor reenvia a sala com o jogador mudado — como o broadcast faz. */
function salaMuda(player: RoomPlayer) {
  const room = useRoomStore.getState().room!;
  act(() => useRoomStore.getState().setRoom({ ...room, players: { ...room.players, [player.peerId]: player } }));
}

function chamadasA(trecho: string): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes(trecho));
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('EventSource', class { close() {} });
  fetchMock = vi.fn(async () => new Response(JSON.stringify(useRoomStore.getState().room), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useRoomStore.getState().resetRoom();
});

describe('G.07 — o GM remove um jogador da mesa', () => {
  it('o GM vê "Remover" ao lado de cada outro jogador, e não ao lado de si', () => {
    entrarComo('peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remover Vex da mesa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover Kid da mesa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remover Dono da mesa' })).toBeNull();
  });

  it('confirmado, chama a API com o peerId de quem sai', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    entrarComo('peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover Vex da mesa' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(chamadasA('/players/')).toEqual([expect.stringContaining(`/api/rooms/${CODE}/players/peer_vex/delete`)]);
  });

  it('cancelado, nada sai', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    entrarComo('peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover Vex da mesa' }));
    expect(chamadasA('/players/')).toEqual([]);
  });

  it('o jogador não vê o botão — remover é do GM', () => {
    entrarComo('peer_vex');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    expect(screen.queryByRole('button', { name: /remover .* da mesa/i })).toBeNull();
  });
});
