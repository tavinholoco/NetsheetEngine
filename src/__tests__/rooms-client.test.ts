/**
 * Revisão pós-D (R.1 — SEC-07) — O CLIENTE PROVA O ASSENTO NO `join`
 * ===================================================================
 * O servidor passou a recusar (409 `seat_taken`) quem reivindica um assento
 * ocupado sem o token vigente dele. Do lado do cliente, duas coisas:
 *  - o `join` manda o token que ele tem, no header `X-Session-Token`;
 *  - se a prova falhar (a sessão se perdeu), entra como jogador novo — com
 *    outro peerId, uma vez só, sem ficar em laço.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postJoin, reconnectSession } from '../api/rooms';
import { useRoomStore } from '../stores/useRoomStore';
import type { CharacterSheet } from '../types/cyberpunk';

const SHEET = { handle: 'Vex' } as unknown as CharacterSheet;

type Call = { peerId: string; token: string | null };

function mockFetch(responses: Array<{ status: number; body: object }>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ peerId: JSON.parse(String(init.body)).peerId, token: headers['X-Session-Token'] ?? null });
      const r = responses[calls.length - 1] ?? responses[responses.length - 1];
      return new Response(JSON.stringify(r.body), { status: r.status });
    })
  );
  return calls;
}

beforeEach(() => {
  sessionStorage.clear();
  useRoomStore.getState().setPeerId('peer_vex');
  useRoomStore.getState().setSessionToken('token-vigente');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('R.1 — postJoin', () => {
  it('manda o token vigente no header X-Session-Token', async () => {
    const calls = mockFetch([{ status: 200, body: { room: {}, sessionToken: 'novo' } }]);
    await postJoin('NC-2020', 'Vex', SHEET);
    expect(calls).toEqual([{ peerId: 'peer_vex', token: 'token-vigente' }]);
  });

  it('sem token, não inventa header', async () => {
    useRoomStore.getState().setSessionToken('');
    const calls = mockFetch([{ status: 200, body: { room: {}, sessionToken: 'novo' } }]);
    await postJoin('NC-2020', 'Vex', SHEET);
    expect(calls[0].token).toBeNull();
  });

  it('409 seat_taken → entra como jogador novo, com outro peerId, uma vez só', async () => {
    const calls = mockFetch([
      { status: 409, body: { error: 'Este assento já está ocupado na mesa.', code: 'seat_taken' } },
      { status: 200, body: { room: {}, sessionToken: 'novo' } }
    ]);
    await postJoin('NC-2020', 'Vex', SHEET);
    expect(calls).toHaveLength(2);
    expect(calls[1].peerId).not.toBe('peer_vex');
    expect(useRoomStore.getState().peerId).toBe(calls[1].peerId);
    expect(sessionStorage.getItem('cyberpunk_peer_id')).toBe(calls[1].peerId);
  });

  it('409 de novo não vira laço: o erro sobe', async () => {
    const calls = mockFetch([{ status: 409, body: { error: 'ocupado', code: 'seat_taken' } }]);
    await expect(postJoin('NC-2020', 'Vex', SHEET)).rejects.toMatchObject({ status: 409, code: 'seat_taken' });
    expect(calls).toHaveLength(2);
  });

  it('outro erro (404) não troca o peerId', async () => {
    mockFetch([{ status: 404, body: { error: 'Room not found' } }]);
    await expect(postJoin('NC-2020', 'Vex', SHEET)).rejects.toMatchObject({ status: 404 });
    expect(useRoomStore.getState().peerId).toBe('peer_vex');
  });
});

describe('R.3 — reconexão depois de uma expulsão', () => {
  it('403 removed_by_gm → volta ao lobby com a mensagem, e não insiste', async () => {
    useRoomStore.getState().setRoomCode('NC-2020');
    useRoomStore.getState().setView('active');
    sessionStorage.setItem('cyberpunk_session_token', 'token-vigente');
    const calls = mockFetch([{ status: 403, body: { error: 'O Mestre removeu você desta mesa.', code: 'removed_by_gm' } }]);

    expect(await reconnectSession()).toBe(false);
    expect(calls).toHaveLength(1); // nem troca de peerId, nem segunda tentativa
    const s = useRoomStore.getState();
    expect(s.view).toBe('lobby');
    expect(s.sessionToken).toBe('');
    expect(s.errorMsg).toBe('O Mestre removeu você desta mesa.');
    expect(sessionStorage.getItem('cyberpunk_session_token')).toBeNull();
  });
});
