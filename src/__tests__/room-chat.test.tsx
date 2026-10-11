/**
 * G.3e (G.24 do ledger da G) — o chat da mesa acompanha a mensagem nova
 * =====================================================================
 * Reproduzido em 10/10 no build de produção: com 25 mensagens, a caixa ficava
 * no topo e a última não aparecia — e na mesa a rolagem só existe no chat
 * (T5.4). Acompanhar só quando quem lê já está no fim: quem rolou para cima
 * para reler não é arrancado de lá.
 *
 * O jsdom não tem layout: a altura do conteúdo e a da caixa vêm daqui. O
 * `scrollTop` do jsdom guarda o que se escreve nele.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import type { ChatMessage, GameRoom } from '../types/multiplayer';

/** WebSocket inerte: o teste é da caixa do chat, não do transporte. */
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
/** ~108 px por mensagem: 25 mensagens = 2.703 px, como no build de produção. */
const POR_MENSAGEM = 108;
const VISIVEL = 392;

function mensagens(n: number): ChatMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    senderHandle: 'Vex',
    senderRole: 'player',
    text: `mensagem ${i}`,
    timestamp: '22:02'
  }));
}

function mesa(n: number): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: {},
    chatMessages: mensagens(n),
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

let total = 0;

function abrirMesa(n: number) {
  total = n;
  const s = useRoomStore.getState();
  s.setPeerId('peer_vex');
  s.setSessionToken('token');
  s.setRoomCode(CODE);
  s.setRoom(mesa(n));
  s.setView('active');
  render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
  return screen.getByRole('log', { name: 'Mensagens da mesa' });
}

function chegaMensagem() {
  total += 1;
  act(() => useRoomStore.getState().setRoom(mesa(total)));
}

function rolarPara(caixa: HTMLElement, scrollTop: number) {
  caixa.scrollTop = scrollTop;
  fireEvent.scroll(caixa);
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('EventSource', class { close() {} });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(() => total * POR_MENSAGEM);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => VISIVEL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useRoomStore.getState().resetRoom();
});

describe('G.24 — o chat da mesa acompanha a mensagem nova', () => {
  it('ao abrir a mesa com 25 mensagens, a caixa mostra a última', () => {
    const caixa = abrirMesa(25);
    expect(caixa.scrollTop).toBe(25 * POR_MENSAGEM);
  });

  it('chega mensagem nova com a caixa no fim: a caixa vai para o fim', () => {
    const caixa = abrirMesa(25);
    rolarPara(caixa, 25 * POR_MENSAGEM - VISIVEL);
    chegaMensagem();
    expect(caixa.scrollTop).toBe(26 * POR_MENSAGEM);
  });

  it('chega mensagem nova com a caixa lá em cima: fica onde está', () => {
    const caixa = abrirMesa(25);
    rolarPara(caixa, 300);
    chegaMensagem();
    expect(caixa.scrollTop).toBe(300);
  });

  it('com o chat no teto de 100, a mensagem nova ainda é acompanhada', () => {
    // O servidor guarda as 100 últimas (E.3b): a contagem para de crescer, a
    // última mensagem continua mudando.
    const caixa = abrirMesa(100);
    total = 101; // a nova é uma rolagem, mais alta que a que saiu do topo
    act(() => useRoomStore.getState().setRoom({ ...mesa(100), chatMessages: mensagens(101).slice(1) }));
    expect(caixa.scrollTop).toBe(101 * POR_MENSAGEM);
  });

  it('quem rolou para cima e voltou ao fim volta a acompanhar', () => {
    const caixa = abrirMesa(25);
    rolarPara(caixa, 300);
    chegaMensagem();
    rolarPara(caixa, 26 * POR_MENSAGEM - VISIVEL);
    chegaMensagem();
    expect(caixa.scrollTop).toBe(27 * POR_MENSAGEM);
  });
});
