/**
 * Fase H (H.3d — H.13) — O CLIENTE ESPERA A TROCA DE INSTÂNCIA
 * ===========================================================
 * Num deploy, a instância velha entrega a mesa à nova e passa a responder
 * `503 server_restarting` a toda ação, sem executá-la, até o Render levar o
 * tráfego à nova — ~7–9 s pela medição da H.3d.0. O cliente tenta de novo
 * sozinho: a ação do jogador (o chat, a rolagem, o dano do GM) demora, não some.
 * Qualquer outro erro segue como antes — inclusive outro 503.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../api/http';

function mockFetch(responses: Array<{ status: number; body: object }>) {
  const calls: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      calls.push(Date.now());
      const r = responses[calls.length - 1] ?? responses[responses.length - 1];
      return new Response(JSON.stringify(r.body), { status: r.status });
    })
  );
  return calls;
}

const RESTARTING = { status: 503, body: { error: 'O servidor está trocando de instância.', code: 'server_restarting' } };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('apiFetch diante do server_restarting', () => {
  it('tenta de novo até a instância nova responder — e devolve a resposta dela', async () => {
    const calls = mockFetch([RESTARTING, RESTARTING, RESTARTING, { status: 200, body: { ok: 'nova' } }]);
    const done = apiFetch<{ ok: string }>('/api/rooms/NC-1/message', { method: 'POST', body: '{"text":"oi"}' });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(done).resolves.toEqual({ ok: 'nova' });
    expect(calls).toHaveLength(4);
  });

  it('outro 503 (o teto de mesas) não é tentado de novo', async () => {
    const calls = mockFetch([{ status: 503, body: { error: 'cheio', code: 'rooms_full' } }]);
    const done = apiFetch('/api/rooms/create', { method: 'POST', body: '{}' }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await done;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('rooms_full');
    expect(calls).toHaveLength(1);
  });

  it('desiste depois de 45 s e mostra o erro — a troca não pode prender a tela para sempre', async () => {
    const calls = mockFetch([RESTARTING]);
    const done = apiFetch('/api/rooms/NC-1/message', { method: 'POST', body: '{}' }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(50_000);
    const err = await done;
    expect((err as ApiError).code).toBe('server_restarting');
    expect(calls.length).toBeGreaterThan(20);
    expect(calls.length).toBeLessThan(40);
  });
});
