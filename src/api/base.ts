/**
 * ============================================================
 * NETSHEET ENGINE — BASE URL DO BACKEND (Fase 10, T10.2)
 * ============================================================
 * Quando o frontend é estático (Vercel/Netlify) e o backend vive em outra
 * origem (Railway/Fly.io/Render), toda a comunicação REST/SSE/WS precisa
 * apontar para o backend na nuvem. Isso é resolvido por VITE_API_URL:
 *
 *   VITE_API_URL=https://netsheet-api.onrender.com  →  API/SSE/WS na nuvem
 *   (vazio / ausente)                              →  mesmo origin (deploy
 *      atual: o SPA é servido pelo próprio Express)
 *
 * A variável é substituída estaticamente pelo Vite no build (import.meta.env),
 * então o valor é fixo por build — o padrão recomendado é um build por
 * ambiente (staging/produção), nunca trocar em runtime.
 */

// Sem barra final — os callers concatenam caminhos começando com "/".
const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) || "")
  .trim()
  .replace(/\/+$/, "");

/** Prefixa um caminho REST/SSE com a base do backend (vazio = mesmo origin). */
export function apiUrl(path: string): string {
  return API_BASE + path;
}

/**
 * URL do WebSocket derivada da MESMA base do backend.
 * - Com VITE_API_URL: http(s) → ws(s), preservando host/porta da base.
 * - Sem base: mesmo origin do navegador (comportamento original).
 */
export function wsUrl(path: string): string {
  if (API_BASE) {
    const scheme = API_BASE.replace(/^http/, "ws");
    return `${scheme}${path}`;
  }
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`;
}
