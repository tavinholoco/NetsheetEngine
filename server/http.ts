// ==========================================================================
// L.3a (E.18) — A BORDA HTTP DA API
// ==========================================================================
// O que vale para toda rota: o proxy de confiança, o corpo JSON, o CORS, o
// limitador global, o helmet em produção, a saída de erro pela tabela
// (`sendError`, E.3c), os limitadores de mesa e de IA e a leitura da sessão.
// Saiu do `server.ts` na L.3a sem mudar comportamento.
import express, { type Express } from "express";
import helmet from "helmet";
import { allowInWindow } from "./wsLimits.js";
import { MAX_SHEET_BYTES, verifySession } from "./roomManager.js";
import { STATUS_BY_CODE, type ErrorCode } from "./errors.js";

/**
 * Revisão pós-D (R.5 — SEC-11) — em quantos proxies confiar para achar o IP
 * de quem joga. Os limitadores contam por `req.ip`; atrás do proxy do Render,
 * sem isto, o `req.ip` é o do proxy para todo mundo e os limitadores viram um
 * balde só.
 *
 * Produção: 1 salto (o proxy do Render). Fora dela: nenhum — sem proxy na
 * frente, confiar no `X-Forwarded-For` deixaria o cliente escolher o próprio
 * IP. `TRUST_PROXY` corrige sem deploy de código: número de saltos, `false`,
 * ou lista de endereços/sub-redes. `true` é recusado de propósito — confiaria
 * em qualquer `X-Forwarded-For`, e burlar o limitador seria trocar um header.
 */
export function resolveTrustProxy(env: NodeJS.ProcessEnv): boolean | number | string {
  const fallback = env.NODE_ENV === "production" ? 1 : false;
  const raw = (env.TRUST_PROXY || "").trim();
  if (!raw || raw === "true") return fallback;
  if (raw === "false") return false;
  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 0) return hops;
  return raw;
}

/** O que vale para toda requisição — chamado uma vez, antes das rotas. */
export function installHttpBasics(app: Express): void {
  app.set("trust proxy", resolveTrustProxy(process.env));

  // T1.4 — limite de payload (fichas de personagem cabem folgadamente em 1MB)
  app.use(express.json({ limit: "1mb" }));

  // T10.6 — CORS por ALLOWLIST (env CORS_ORIGINS, separada por vírgula). O
  // frontend estático (T10.2) deve declarar explicitamente as origins que podem
  // chamar a API: sem a env, NENHUM origin recebe CORS (mesmo origin continua
  // funcionando; deploy estático exige configurar). "*" reabilita o legado.
  // Auth por token de sessão no body (T1.7) — sem cookies — então origin
  // permitida não traz risco de CSRF.
  const CORS_ALLOWED: string[] = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const CORS_ANY = CORS_ALLOWED.includes("*");

  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (CORS_ANY || CORS_ALLOWED.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", CORS_ANY ? "*" : origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // T10.6 — rate limit GLOBAL da API (anti-flood por IP), além dos limiters
  // específicos de mesa (roomLimiter/chatLimiter). O /api/health é isento: é o
  // health check do Render. (Uptime bot externo, NÃO — regra 3 do contrato de
  // custo zero; a justificativa original da T10.4 era essa.)
  const apiLimiter = makeRateLimiter(600, 60_000); // 600 req/min por IP
  app.use("/api", (req, res, next) => {
    // req.path aqui é relativo ao mount "/api" — usar originalUrl para o health.
    if (req.originalUrl === "/api/health") return next();
    apiLimiter(req, res, next);
  });

  // T10.6 — helmet (security headers) apenas em PRODUÇÃO: o CSP bloqueia
  // inline/eval, que o Vite usa em dev (HMR/React refresh). O CSP é customizado
  // para o app: assets do próprio origin, imagens https (avatars do Supabase
  // storage + unsplash), estilos inline (Tailwind/React) e conexões
  // ws/wss/https (WebSocket das mesas + Supabase Realtime).
  if (process.env.NODE_ENV === "production") {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:", "https:"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'", "ws:", "wss:", "https:"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'self'"]
          }
        }
      })
    );
  }
}

/**
 * Fase E (E.3c) — a única saída de erro da API: `{ error, code }`, com o
 * status tirado da tabela de `server/errors.ts`. A mensagem é para gente e muda
 * à vontade; o cliente decide pelo `code`. Um teste trava o `server.ts` contra
 * `status(N).json({ error` escrito à mão.
 */
export function sendError(res: express.Response, code: ErrorCode, error: string) {
  return res.status(STATUS_BY_CODE[code]).json({ error, code });
}

// T1.4 — rate limit simples por IP (anti-abuso).
// NOTA (T9.3): cada limiter tem o PRÓPRIO mapa de buckets — antes, roomLimiter
// e chatLimiter compartilhavam um único mapa keyed por IP, então o limite do
// chat (30/min) contava TODAS as requisições da sala e derrubava o chat com
// 429 em mesas ativas após 30 req/min em qualquer endpoint.
// B.5 (SEC-04) — a cada N requisições o limiter varre e descarta buckets
// vencidos. Sem isso, o mapa ganhava uma entrada por IP distinto e NUNCA
// perdia nenhuma: um bucket vencido só era sobrescrito se aquele mesmo IP
// voltasse. Três limiters = três mapas crescendo para sempre.
//
// Varredura amortizada em vez de timer: custo O(n) diluído a cada N
// requisições, e nenhum intervalo novo para gerenciar no shutdown ou no HMR.
const LIMITER_SWEEP_EVERY = 500;

/** Descarta buckets vencidos. Exportada para ser testável — o mapa vive num
 *  closure, e uma poda que nunca roda falharia em silêncio. */
export function pruneExpiredBuckets(
  buckets: Map<string, { count: number; resetAt: number }>,
  now: number
): number {
  let removed = 0;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) {
      buckets.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function makeRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let sinceSweep = 0;
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    sinceSweep += 1;
    if (sinceSweep >= LIMITER_SWEEP_EVERY) {
      sinceSweep = 0;
      pruneExpiredBuckets(buckets, now);
    }

    // A mesma janela fixa do WebSocket (R.4) — uma conta só para os dois transportes.
    if (!allowInWindow(buckets, ip, maxRequests, windowMs, now)) {
      return sendError(res, "rate_limited", "Muitas requisições. Aguarde um instante.");
    }
    next();
  };
}

export const roomLimiter = makeRateLimiter(120, 60_000); // 120 req/min por IP
export const chatLimiter = makeRateLimiter(30, 60_000);  // chat mais restrito (30 msg/min)
// B.1 (SEC-01) — a IA é o único endpoint que gasta cota de serviço externo na
// chave do dono. 10/min por IP é folgado para conversa humana (uma pergunta a
// cada 6 s) e apertado para script. Somado ao JWT, o abuso exige conta válida.
export const aiLimiter = makeRateLimiter(10, 60_000);

// Mensagens de 401. São DUAS porque as credenciais são duas, e a diferença
// muda o que o usuário deve fazer: sessão de MESA se resolve reconectando à
// sala; sessão de CONTA (JWT do Supabase, usado pelo /api/gemini) se resolve
// entrando de novo no app.
//
// Constantes em vez das 17 literais que estavam espalhadas — e o passo mínimo
// na direção dos códigos de erro estáveis que a Fase I vai propor. Hoje o
// cliente decide por status HTTP e nunca por texto (`authedFetch` reconecta em
// 401), então a redação pode mudar sem quebrar ninguém.
export const ERR_SESSAO_MESA = "Sessão inválida ou expirada. Reconecte-se à mesa.";
export const ERR_SESSAO_CONTA = "Sessão inválida ou expirada. Entre novamente.";
// E.03 (SEC-15) — a mesma recusa no join e na sincronia da ficha.
export const ERR_FICHA_GRANDE = `Ficha grande demais (máx. ${MAX_SHEET_BYTES / 1024} KB).`;
// E.3c — antes "Room not found", em inglês, na tela de quem erra o convite.
export const ERR_SALA_NAO_ENCONTRADA = "Sala não encontrada. Confira o código do convite.";
// I.03 (SEC-16) — o mesmo formato no join e no create.
export const ERR_PEER_ID = "peerId inválido: use só letras, números, _ e - (até 64 caracteres).";

// T1.7 — autor do request é derivado do token de sessão, nunca do peerId livre
export function getSessionPeerId(req: express.Request, code: string): string | null {
  const token = typeof req.body?.sessionToken === "string" ? req.body.sessionToken : null;
  if (!token) return null;
  return verifySession(code, token);
}

// B.3 (SEC-02) — leitura autenticada. Um GET não tem corpo, então o token vem
// por header. Cabeçalho próprio em vez de `Authorization` para não confundir
// com o JWT do Supabase que o /api/gemini passou a exigir: são credenciais
// diferentes, de escopos diferentes (mesa × conta).
export function getSessionPeerIdFromHeader(req: express.Request, code: string): string | null {
  const raw = req.get("X-Session-Token");
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return null;
  return verifySession(code, token);
}

// B.3 (SEC-02) — SÓ para o stream SSE. O `EventSource` do navegador não
// permite header customizado; é limitação da API, não escolha. Por isso o
// token vai na query, exatamente como o WebSocket já fazia desde a T5.2.
//
// Token em URL é pior que em header (aparece em log de proxy e no histórico
// do navegador), então este caminho fica confinado ao endpoint que não tem
// alternativa. Nenhuma outra rota aceita `?token=`.
export function getSessionPeerIdFromQuery(req: express.Request, code: string): string | null {
  const raw = req.query?.token;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return null;
  return verifySession(code, token);
}
