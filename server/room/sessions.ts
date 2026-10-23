// L.3b (E.18) — As sessões de mesa (T1.7): o token secreto por jogador, guardado só como hash, emitido no `join`, conferido em toda ação e exportado com a sala para o banco (B.4).
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import crypto from "crypto";
import { roomKey } from "./key.js";

// ============================================================
// SESSÕES (T1.7) — token secreto por jogador, nunca na broadcast
// O cliente continua enviando um peerId (identificador público), mas toda ação
// autenticada exige o token de sessão que o servidor gerou no create/join.
// O peerId do autor é SEMPRE derivado do token (verifySession) — um peerId
// livre no corpo da requisição não autentica nada (anti-impersonificação).
// ============================================================
interface Session {
  roomCode: string;
  peerId: string;
}

// B.4 (SEC-03) — o mapa é keyed por SHA-256 do token, não pelo token.
// O token em claro existe só no cliente e em trânsito: nem a memória do
// processo nem o banco guardam segredo recuperável. Como as sessões passaram
// a ser persistidas (senão um restart derrubava todas as mesas), gravar o
// token em claro abriria um buraco novo enquanto se fecha outro — um dump do
// banco entregaria sessões vivas.
//
// A busca continua O(1): hasheia o token recebido e olha o mapa.
export const sessions: Record<string, Session> = {}; // sha256(token) -> sessão

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function bindSession(roomCode: string, peerId: string): string {
  const token = createSessionToken();
  sessions[hashToken(token)] = { roomCode: roomKey(roomCode), peerId };
  return token;
}

/** Retorna o peerId autenticado pelo token na sala, ou null se inválido. */
export function verifySession(roomCode: string, token: string): string | null {
  if (typeof token !== "string" || !token) return null;
  const s = sessions[hashToken(token)];
  if (!s) return null;
  if (s.roomCode !== roomKey(roomCode)) return null;
  return s.peerId;
}

export function revokeSessionsForPeer(roomCode: string, peerId: string): void {
  const rc = roomKey(roomCode);
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.peerId === peerId && s.roomCode === rc) delete sessions[hash];
  }
}

// ============================================================
// B.4 (SEC-03) — SESSÕES ATRAVESSAM O RESTART
// ============================================================
// Antes, `sessions` era só memória: deploy, crash ou o despertar da
// hibernação do plano gratuito derrubavam todas as mesas. A sala voltava do
// banco com os jogadores dentro, mas nenhum token valia — toda ação virava
// 401 e o jogador tinha que entrar de novo no meio do combate.
//
// A revogação continua server-side de propósito. Trocar por JWT stateless
// tornaria `revokeSessionsForPeer` e `deleteRoom` impossíveis de cumprir:
// um JWT emitido vale até expirar, e "saiu da mesa" precisa valer AGORA.

/** Mapa `{ sha256(token): peerId }` de uma sala, para gravar junto com ela. */
export function exportRoomSessions(code: string): Record<string, string> {
  const rc = roomKey(code);
  const out: Record<string, string> = {};
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.roomCode === rc) out[hash] = s.peerId;
  }
  return out;
}

/**
 * Repõe as sessões de uma sala no boot. Só aceita hash e peerId que sejam
 * string — linha corrompida ou de schema antigo não pode derrubar o restore
 * nem, pior, criar sessão inválida.
 */
export function restoreRoomSessions(code: string, data: unknown): number {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return 0;
  const rc = roomKey(code);
  let count = 0;
  for (const [hash, peerId] of Object.entries(data as Record<string, unknown>)) {
    if (typeof hash !== "string" || !hash) continue;
    if (typeof peerId !== "string" || !peerId) continue;
    sessions[hash] = { roomCode: rc, peerId };
    count += 1;
  }
  return count;
}

