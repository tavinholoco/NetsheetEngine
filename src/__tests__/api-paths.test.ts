/**
 * Fase I (I.03 — SEC-16) — O CLIENTE NUNCA PÕE UM ID CRU NA URL
 * ==============================================================
 * As rotas do GM levam ids no caminho (`/players/:targetPeerId/delete`,
 * `/npcs/:npcId/...`). O `peerId` é de quem entrou na mesa: montado cru, um
 * `a/../../players/<outro>/delete?` virava, depois da normalização do fetch,
 * outra rota — e o "Remover" do GM removia outro jogador. O servidor passou a
 * recusar `peerId` fora do formato (peer-id.integration); aqui, a segunda
 * camada: cada segmento vai com `encodeURIComponent`, e o id chega à rota certa
 * como um segmento só, seja ele qual for.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as roomsApi from '../api/rooms';
import { useRoomStore } from '../stores/useRoomStore';

const HOSTIL = 'a/../../players/peer_vitima/delete?';

let urls: string[] = [];

beforeEach(() => {
  urls = [];
  useRoomStore.getState().setSessionToken('token-do-gm');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return new Response('{}', { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** O caminho como o navegador o resolve — o `..` sobe, o `?` começa a query. */
function resolvido(url: string): { segmentos: string[]; query: string } {
  const u = new URL(url, 'http://mesa.local');
  return { segmentos: u.pathname.split('/').slice(1).map(decodeURIComponent), query: u.search };
}

describe('I.03 — SEC-16: os ids vão codificados no caminho', () => {
  it('"Remover" com um peerId hostil chega à rota do próprio peerId', async () => {
    await roomsApi.deletePlayer('NC-1', HOSTIL);
    expect(resolvido(urls[0])).toEqual({ segmentos: ['api', 'rooms', 'NC-1', 'players', HOSTIL, 'delete'], query: '' });
  });

  it('remover e ferir NPC, idem', async () => {
    await roomsApi.deleteNpc('NC-1', HOSTIL);
    await roomsApi.setNpcHealth('NC-1', HOSTIL, 2);
    expect(resolvido(urls[0]).segmentos).toEqual(['api', 'rooms', 'NC-1', 'npcs', HOSTIL, 'delete']);
    expect(resolvido(urls[1]).segmentos).toEqual(['api', 'rooms', 'NC-1', 'npcs', HOSTIL, 'health']);
  });

  it('o código da sala também é um segmento só', async () => {
    await roomsApi.nextTurn('NC-1/../OUTRA');
    expect(resolvido(urls[0])).toEqual({ segmentos: ['api', 'rooms', 'NC-1/../OUTRA', 'initiative'], query: '' });
  });

  it('o id comum não muda', async () => {
    await roomsApi.deletePlayer('NC-2020-K7Q9XD', 'peer_lz9k3a_4f7q2x');
    expect(urls[0]).toBe('/api/rooms/NC-2020-K7Q9XD/players/peer_lz9k3a_4f7q2x/delete');
  });
});
