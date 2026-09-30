/**
 * Revisão pós-D (R.11) — o botão de convite do GM
 * ================================================
 * Sem a lista do lobby, a sala se acha pelo código ou pelo link que o GM
 * manda. O cabeçalho da mesa ganhou "Copiar convite" — só para o GM — que
 * copia `/room/CÓDIGO`; se o navegador não deixar copiar, o link aparece para
 * seleção manual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import type { GameRoom } from '../types/multiplayer';

/** WebSocket inerte: o teste é do cabeçalho, não do transporte. */
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

function mesa(gmPeerId: string): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId,
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: {},
    chatMessages: [],
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

function entrarComo(peerId: string, gmPeerId: string) {
  const s = useRoomStore.getState();
  s.setPeerId(peerId);
  s.setSessionToken('token');
  s.setRoomCode(CODE);
  s.setRoom(mesa(gmPeerId));
  s.setView('active');
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('EventSource', class { close() {} });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
});

describe('R.11 — Copiar convite', () => {
  it('o GM copia o link /room/CÓDIGO', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    entrarComo('peer_dono', 'peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /copiar convite/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/room/${CODE}`);
    expect(await screen.findByRole('button', { name: /link copiado/i })).toBeTruthy();
  });

  it('sem permissão de área de transferência, o link aparece para copiar à mão', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('negado'); }) },
      configurable: true
    });
    entrarComo('peer_dono', 'peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /copiar convite/i }));
    await waitFor(() => expect(screen.getByText(`${window.location.origin}/room/${CODE}`)).toBeTruthy());
  });

  it('o jogador não vê o botão — o convite é do GM', () => {
    entrarComo('peer_vex', 'peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    expect(screen.queryByRole('button', { name: /copiar convite/i })).toBeNull();
  });
});
