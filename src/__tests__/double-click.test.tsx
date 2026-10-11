/**
 * G.3b (G.06 do ledger da G) — clique duplo não repete a ação
 * ============================================================
 * Reproduzido em 10/10 no build de produção: dois cliques em "Aplicar dano"
 * aplicaram o acerto duas vezes; com o `join` lento (o Render acordando), dois
 * cliques em "Entrar na Mesa" deixaram um assento órfão. Nada na tela mostrava
 * espera. Aqui a resposta fica pendente de propósito, e o teste conta quantas
 * requisições saíram.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { CombatPanel } from '../features/multiplayer/CombatPanel';
import * as roomsApi from '../api/rooms';
import { useRoomStore } from '../stores/useRoomStore';
import type { CharacterSheet } from '../types/cyberpunk';
import type { GameRoom, RoomPlayer } from '../types/multiplayer';

/** WebSocket inerte: o teste é dos botões, não do transporte. */
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
const SHEET = { handle: 'Vex', stats: {}, weapons: [], cyberware: [] } as unknown as CharacterSheet;

/** `fetch` que só responde quando o teste manda: a requisição fica "em voo". */
function pendingFetch() {
  const urls: string[] = [];
  const release: Array<() => void> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise<Response>((resolve) => {
          urls.push(url);
          release.push(() => resolve(new Response(JSON.stringify({ room: mesa(), sessionToken: 't2' }), { status: 200 })));
        })
    )
  );
  return { urls, releaseAll: () => release.splice(0).forEach((r) => r()) };
}

function mesa(): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: {},
    chatMessages: [],
    initiativeList: [
      { playerId: 'a', handle: 'Vex', role: 'Solo', score: 18, isCurrentTurn: true },
      { playerId: 'b', handle: 'Booster', role: 'Nomad', score: 12, isCurrentTurn: false }
    ],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('EventSource', class { close() {} });
  useRoomStore.getState().setPeerId('peer_vex');
  useRoomStore.getState().setSessionToken('');
});

afterEach(() => {
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
});

describe('G.06 — a chamada em voo é a mesma', () => {
  it('joinRoom duas vezes em seguida devolve a mesma promessa e faz um join só', async () => {
    const net = pendingFetch();
    const a = roomsApi.joinRoom({ code: CODE, handle: 'Vex', sheet: SHEET });
    const b = roomsApi.joinRoom({ code: CODE, handle: 'Vex', sheet: SHEET });
    expect(b).toBe(a);
    net.releaseAll();
    await Promise.all([a, b]);
    expect(net.urls.filter((u) => u.endsWith('/api/rooms/join'))).toHaveLength(1);
  });

  it('createRoom duas vezes em seguida cria uma sala só', async () => {
    const net = pendingFetch();
    const a = roomsApi.createRoom({ code: 'NC', name: 'Mesa', gmHandle: 'Dono' });
    const b = roomsApi.createRoom({ code: 'NC', name: 'Mesa', gmHandle: 'Dono' });
    expect(b).toBe(a);
    net.releaseAll();
    await Promise.all([a, b]);
    expect(net.urls.filter((u) => u.endsWith('/api/rooms/create'))).toHaveLength(1);
  });

  it('depois que a primeira volta, um novo join sai de novo', async () => {
    const net = pendingFetch();
    const a = roomsApi.joinRoom({ code: CODE, handle: 'Vex', sheet: SHEET });
    net.releaseAll();
    await a;
    const b = roomsApi.joinRoom({ code: CODE, handle: 'Vex', sheet: SHEET });
    expect(b).not.toBe(a);
    net.releaseAll();
    await b;
    expect(net.urls).toHaveLength(2);
  });
});

describe('G.06 — o lobby mostra a espera', () => {
  it('dois cliques em "Entrar na Mesa" com a resposta pendente: um join, e o botão diz "Entrando…"', async () => {
    const net = pendingFetch();
    useRoomStore.getState().setRoomCode(CODE);
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    const user = userEvent.setup();

    const entrar = screen.getByRole('button', { name: /entrar na mesa/i });
    await user.dblClick(entrar);

    expect(net.urls.filter((u) => u.endsWith('/api/rooms/join'))).toHaveLength(1);
    const esperando = screen.getByRole('button', { name: /entrando/i }) as HTMLButtonElement;
    expect(esperando.disabled).toBe(true);
    net.releaseAll();
  });
});

describe('G.06 — o GM não repete a ação de combate', () => {
  it('"Próximo Turno" duas vezes com a resposta pendente: um pedido', async () => {
    const net = pendingFetch();
    const s = useRoomStore.getState();
    s.setPeerId('peer_dono');
    s.setSessionToken('token');
    s.setRoomCode(CODE);
    s.setRoom(mesa());
    s.setView('active');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /iniciativa/i }));
    const antes = net.urls.length; // o heartbeat pode ter saído

    await user.dblClick(screen.getByRole('button', { name: /próximo turno/i }));

    expect(net.urls.slice(antes).filter((u) => u.endsWith('/initiative'))).toHaveLength(1);
    net.releaseAll();
  });

  const NPC = { peerId: 'npc_1', handle: 'Booster', role: 'Nomad', sheet: SHEET, isOnline: true, joinedAt: '' } as RoomPlayer;
  const ILESO = { label: 'Ileso', points: 0, isMortal: false, isDead: false, isStabilized: false };

  function panel() {
    const pendente = () => new Promise<void>(() => {});
    const onAttack = vi.fn(pendente);
    const onApplyDamage = vi.fn(pendente);
    render(
      <CombatPanel
        targetId="token_p1"
        targetName="Vex"
        attackers={[NPC]}
        status={ILESO}
        onAttack={onAttack}
        onApplyDamage={onApplyDamage}
        onToggleStabilized={vi.fn()}
      />
    );
    return { onAttack, onApplyDamage, user: userEvent.setup() };
  }

  it('"Aplicar dano" duas vezes com a resposta pendente: aplica uma vez', async () => {
    const { onApplyDamage, user } = panel();
    await user.click(screen.getByText(/Aplicar dano em Vex/));
    await user.type(screen.getByLabelText('Dano bruto'), '20');
    await user.dblClick(screen.getByRole('button', { name: /Aplicar 20 de dano/ }));
    expect(onApplyDamage).toHaveBeenCalledTimes(1);
  });

  it('"Rolar ataque" duas vezes com a resposta pendente: ataca uma vez', async () => {
    const { onAttack, user } = panel();
    await user.click(screen.getByText(/NPC ataca Vex/));
    await user.dblClick(screen.getByRole('button', { name: /Rolar ataque/ }));
    expect(onAttack).toHaveBeenCalledTimes(1);
  });
});
