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

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
    });
  } catch {
    throw new ApiError(0, 'Falha de conexão com o servidor.');
  }

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : `Erro ${res.status}`);
  }
  return data as T;
}
