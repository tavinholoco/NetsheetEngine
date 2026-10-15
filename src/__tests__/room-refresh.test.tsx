/**
 * H.3a (H.03 do ledger da H) — o F5 de quem entrou pelo lobby
 * ============================================================
 * Reproduzido em 14/10 no build de produção: quem cria ou entra na mesa pelo
 * lobby fica em `/multiplayer`, e só o `/room/:código` reabre a sessão do
 * `sessionStorage`. No F5, o jogador caía no lobby e, entrando de novo, ganhava
 * outro assento; o GM que criou a mesa pela tela virava jogador comum — a mesa
 * ficava sem Mestre. Aqui as duas rotas da sala montam a mesma página que o
 * `App` monta, e o "F5" é desmontar, zerar as stores e montar de novo na URL em
 * que a pessoa estava, com o `sessionStorage` de antes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RoomPage } from '../pages/RoomPage';
import { useRoomStore } from '../stores/useRoomStore';
import { useSheetStore } from '../stores/useSheetStore';
import { stubRoomTransport } from '../test/roomTransport';
import type { GameRoom } from '../types/multiplayer';

const CODE = 'NC-2020-K7Q9XD';

function mesa(code: string): GameRoom {
  return {
    code,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
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

interface Call {
  path: string;
  token?: string;
  body: Record<string, any>;
}

/** O servidor de mentira: `join` e `create` devolvem um token novo a cada vez. */
function fakeServer() {
  const calls: Call[] = [];
  let n = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, 'http://localhost').pathname;
      const headers = (init?.headers || {}) as Record<string, string>;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ path, token: headers['X-Session-Token'], body });
      if (path === '/api/rooms/join') {
        return new Response(JSON.stringify({ room: mesa(body.code), sessionToken: `tok-${++n}` }), { status: 200 });
      }
      if (path === '/api/rooms/create') {
        return new Response(JSON.stringify({ room: mesa(body.code), sessionToken: 'tok-gm' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    })
  );
  return { joins: () => calls.filter((c) => c.path === '/api/rooms/join'), calls };
}

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

/** As duas rotas da mesa, como o `App` as declara. */
function mount(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/multiplayer" element={<RoomPage onOpenAuthModal={() => {}} />} />
        <Route path="/room/:code" element={<RoomPage onOpenAuthModal={() => {}} />} />
      </Routes>
      <Path />
    </MemoryRouter>
  );
}

const path = () => screen.getByTestId('path').textContent;
const settle = () => new Promise((r) => setTimeout(r, 20));

/** O F5: a página some, as stores voltam ao começo, o sessionStorage fica. */
function reload(url: string) {
  cleanup();
  useRoomStore.setState({ view: 'lobby', room: null, roomCode: '', peerId: '', sessionToken: '', errorMsg: '' });
  return mount(url);
}

beforeEach(() => {
  sessionStorage.clear();
  stubRoomTransport();
  useRoomStore.setState({ view: 'lobby', room: null, roomCode: '', peerId: '', sessionToken: '', errorMsg: '' });
  useSheetStore.setState({ user: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
  useSheetStore.setState({ user: null });
});

async function joinByLobby() {
  const user = userEvent.setup();
  mount('/multiplayer');
  await user.type(screen.getByPlaceholderText('Digite o código da sala'), CODE);
  await user.click(screen.getByRole('button', { name: /entrar na mesa/i }));
}

async function createByLobby() {
  useSheetStore.setState({ user: { uid: 'u1', displayName: 'Dono' } as any });
  const user = userEvent.setup();
  mount('/multiplayer');
  await user.type(screen.getByPlaceholderText(/prefixo do código/i), 'NC-2020');
  await user.click(screen.getByRole('button', { name: /criar mesa como gm/i }));
}

describe('H.03 — a mesa ativa pelo lobby mora em /room/CÓDIGO', () => {
  it('entrar pelo código deixa a URL em /room/CÓDIGO, com um join só', async () => {
    const server = fakeServer();
    await joinByLobby();
    await waitFor(() => expect(path()).toBe(`/room/${CODE}`));
    await settle();
    // Chegar à URL da sala não repete o join: a sessão já está viva.
    expect(server.joins()).toHaveLength(1);
    expect(screen.getByPlaceholderText('Mensagem para a mesa...')).toBeInTheDocument();
  });

  it('criar a mesa deixa a URL em /room/ com o código que o servidor devolveu', async () => {
    const server = fakeServer();
    await createByLobby();
    const created = () => server.calls.find((c) => c.path === '/api/rooms/create');
    await waitFor(() => expect(created()).toBeTruthy());
    await waitFor(() => expect(path()).toBe(`/room/${created()!.body.code}`));
    expect(created()!.body.code).toMatch(/^NC-2020-/);
    await settle();
    expect(server.joins()).toHaveLength(0);
  });
});

describe('H.03 — o F5 volta ao mesmo assento', () => {
  it('o jogador que entrou pelo código: o join do F5 leva o mesmo peerId e o token', async () => {
    const server = fakeServer();
    await joinByLobby();
    await waitFor(() => expect(server.joins()).toHaveLength(1));
    await waitFor(() => expect(useRoomStore.getState().view).toBe('active'));
    const peerId = useRoomStore.getState().peerId;
    const token = useRoomStore.getState().sessionToken;
    expect(token).toBe('tok-1');

    reload(path()!);
    await waitFor(() => expect(server.joins()).toHaveLength(2));
    const f5 = server.joins()[1];
    expect(f5.body.peerId).toBe(peerId);
    expect(f5.token).toBe(token);
  });

  it('o GM que criou a mesa pela tela: o join do F5 leva o peerId do GM e o token dele', async () => {
    const server = fakeServer();
    await createByLobby();
    const created = () => server.calls.find((c) => c.path === '/api/rooms/create');
    await waitFor(() => expect(useRoomStore.getState().view).toBe('active'));
    const gmPeerId = created()!.body.gmPeerId;

    reload(path()!);
    await waitFor(() => expect(server.joins()).toHaveLength(1));
    const f5 = server.joins()[0];
    expect(f5.body.peerId).toBe(gmPeerId);
    expect(f5.token).toBe('tok-gm');
    expect(f5.body.code).toBe(created()!.body.code);
  });
});
