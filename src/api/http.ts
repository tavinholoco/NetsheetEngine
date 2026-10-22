/**
 * ============================================================
 * NETSHEET ENGINE — CAMADA HTTP CENTRALIZADA (Fase 7, T7.3)
 * ============================================================
 * Wrapper único de fetch para os endpoints do servidor Express:
 *  - Serializa JSON e injeta o header Content-Type automaticamente;
 *  - Extrai `{ error }` do body e lança `ApiError` (com status HTTP);
 *  - Falha de rede vira `ApiError(0, 'Falha de conexão...')` para o caller
 *    tratar da mesma forma que um erro HTTP.
 * Os módulos `rooms.ts` / `gemini.ts` usam este helper — nenhum componente
 * deve chamar `fetch()` diretamente.
 */

import { apiUrl } from './base';

export class ApiError extends Error {
  readonly status: number;
  /** Código estável do servidor (ex.: `seat_taken`), quando ele manda. O
   *  cliente decide por ele, nunca pelo texto da mensagem (pista da Fase I). */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * H.3d (H.13) — num deploy, a instância velha entrega a mesa à nova e responde
 * `503 server_restarting` sem executar a ação, até o Render levar o tráfego à
 * nova (~7–9 s, medido na H.3d.0). Tentar de novo é seguro — nada foi feito — e
 * leva a ação à instância nova: ela demora, não some.
 */
const RESTART_RETRY_MS = 1500;
const RESTART_GIVE_UP_MS = 45_000;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const started = Date.now();
  for (;;) {
    let res: Response;
    try {
      // T10.2 — frontend estático: VITE_API_URL prefixa a chamada quando o
      // backend mora em outra origem; vazio = mesmo origin (deploy atual).
      res = await fetch(apiUrl(path), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
      });
    } catch {
      throw new ApiError(0, 'Falha de conexão com o servidor.');
    }

    const data: { code?: unknown; error?: unknown } = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof data?.code === 'string' ? data.code : undefined;
      if (res.status === 503 && code === 'server_restarting' && Date.now() - started < RESTART_GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, RESTART_RETRY_MS));
        continue;
      }
      throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : `Erro ${res.status}`, code);
    }
    return data as T;
  }
}
