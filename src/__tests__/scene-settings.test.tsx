/**
 * K.3b (o I.01 do ledger da I) — O GM ESCREVE AS CONDIÇÕES DA CENA
 * =================================================================
 * Desde a C.4 a rolagem da mesa soma o `combatModifier` e o detalhe mostra
 * "Mod. do Mestre: <motivo> (−2)" — mas a rota `/settings` não tinha chamador:
 * o valor era o 0 da criação da sala, e o cabeçalho dizia "Night City -
 * Afterlife Club" para sempre. Aqui o GM escreve o modificador (−10 a +10), o
 * motivo e o local; a mesa inteira vê o modificador ativo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import { stubRoomTransport } from '../test/roomTransport';
import type { GameRoom } from '../types/multiplayer';

const CODE = 'NC-2020-K7Q9XD';

function mesa(patch: Partial<GameRoom> = {}): GameRoom {
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
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString(),
    ...patch
  };
}

/** `fetch` que guarda cada pedido e só responde quando o teste manda. */
function net(room: GameRoom) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const release: Array<() => void> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
          release.push(() => resolve(new Response(JSON.stringify(room), { status: 200 })));
        })
    )
  );
  return {
    settings: () => calls.filter((c) => c.url.endsWith(`/api/rooms/${CODE}/settings`)),
    releaseAll: () => release.splice(0).forEach((r) => r())
  };
}

function abrir(as: 'gm' | 'player', room: GameRoom) {
  const s = useRoomStore.getState();
  s.setPeerId(as === 'gm' ? 'peer_dono' : 'peer_vex');
  s.setSessionToken('token');
  s.setRoomCode(CODE);
  s.setRoom(room);
  s.setView('active');
  render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
  return userEvent.setup();
}

let rede: ReturnType<typeof net>;

beforeEach(() => {
  sessionStorage.clear();
  stubRoomTransport();
});

afterEach(() => {
  // As respostas voltam dentro do teste: nada escreve na store do seguinte.
  rede?.releaseAll();
  vi.unstubAllGlobals();
  useRoomStore.getState().resetRoom();
});

describe('K.3b — o GM escreve as condições da cena', () => {
  it('−2 por escuridão num beco: um pedido ao /settings com o modificador, o motivo e o local', async () => {
    rede = net(mesa());
    const user = abrir('gm', mesa());

    const local = screen.getByLabelText('Local da cena');
    await user.clear(local);
    await user.type(local, 'Beco atrás do Afterlife');
    const mod = screen.getByLabelText('Modificador do Mestre');
    await user.clear(mod);
    await user.type(mod, '-2');
    await user.type(screen.getByLabelText('Motivo do modificador'), 'escuridão');
    await user.click(screen.getByRole('button', { name: /aplicar condições/i }));

    expect(rede.settings()).toHaveLength(1);
    expect(rede.settings()[0].body).toMatchObject({
      locationName: 'Beco atrás do Afterlife',
      combatModifier: -2,
      modifierReason: 'escuridão'
    });
  });

  it('o motivo apagado vai vazio, para o servidor apagá-lo', async () => {
    const room = mesa({ combatModifier: -2, modifierReason: 'escuridão' });
    rede = net(room);
    const user = abrir('gm', room);

    await user.clear(screen.getByLabelText('Motivo do modificador'));
    await user.click(screen.getByRole('button', { name: /aplicar condições/i }));

    expect(rede.settings()[0].body).toMatchObject({ combatModifier: -2, modifierReason: '' });
  });

  it('acima de +10 o campo volta a 10 ao sair dele — o mesmo teto da rota (C.4)', async () => {
    rede = net(mesa());
    const user = abrir('gm', mesa());

    const mod = screen.getByLabelText('Modificador do Mestre');
    await user.clear(mod);
    await user.type(mod, '15');
    await user.tab();
    expect(mod).toHaveValue('10');
    await user.click(screen.getByRole('button', { name: /aplicar condições/i }));
    expect(rede.settings()[0].body).toMatchObject({ combatModifier: 10 });
  });

  it('dois cliques com a resposta pendente: um pedido, e o botão espera', async () => {
    rede = net(mesa());
    const user = abrir('gm', mesa());

    await user.dblClick(screen.getByRole('button', { name: /aplicar condições/i }));
    expect(rede.settings()).toHaveLength(1);
    const botao = screen.getByRole('button', { name: /aplicando/i }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    rede.releaseAll();
    await waitFor(() => expect(screen.getByRole('button', { name: /aplicar condições/i })).not.toBeDisabled());
  });

  it('o jogador não vê o formulário', () => {
    rede = net(mesa());
    abrir('player', mesa());
    expect(screen.queryByLabelText('Modificador do Mestre')).toBeNull();
    expect(screen.queryByRole('button', { name: /aplicar condições/i })).toBeNull();
  });
});

describe('K.3b — a mesa vê a condição ativa', () => {
  it('com −2, o cabeçalho diz o modificador e o motivo, para o jogador também', () => {
    const room = mesa({ locationName: 'Beco atrás do Afterlife', combatModifier: -2, modifierReason: 'escuridão' });
    rede = net(room);
    abrir('player', room);
    expect(screen.getByText('Beco atrás do Afterlife')).toBeInTheDocument();
    expect(screen.getByText('Mod. do Mestre −2 · escuridão')).toBeInTheDocument();
  });

  it('com 0, nada no cabeçalho', () => {
    rede = net(mesa());
    abrir('player', mesa());
    expect(screen.queryByText(/Mod\. do Mestre/)).toBeNull();
  });
});
