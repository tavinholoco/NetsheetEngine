// L.3a (E.18) — o WebSocket da mesa: o upgrade com a sessão, os tetos por
// jogador (R.4), as mensagens de texto e o roteamento do binário para o Yjs.
// Saiu do `server.ts` na L.3a.
import http from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import * as decoding from "lib0/decoding";
import { logger } from "./logger.js";
import { WS_LIMITS, WsRateLimiter, type WsBudget } from "./wsLimits.js";
import {
  getRoom,
  postChatMessage,
  rollDiceForPlayer,
  touchPlayer,
  nextTurn,
  rollInitiative,
  updateInitiative,
  verifySession
} from "./roomManager.js";
import type { InitiativeEntry } from "../src/types/multiplayer.js";
import {
  broadcastRoomUpdate,
  dropFeedIfIdle,
  isAnnouncing,
  isDraining,
  roomEntryFor,
  sendToSocket,
  wsClients,
  wsDelta,
  wsPeer
} from "./realtime.js";
import { destroyRoomYjs, dropSocketAwareness, handleYjsBinary, messageAwareness } from "./yjsGrid.js";
import { roomKey } from "./room/key.js";

// ==========================================
// FASE 5 (T5.2) — WEBSOCKET: /ws/rooms/:code
// ==========================================
// Transporte base do multiplayer. Handshake autenticado pelo token de sessão
// (T1.7) via query param `?token=`; sessão inválida responde HTTP 401 no
// próprio handshake (não há socket para um close code). Os fechamentos
// 4400–4499 são permanentes (4400 saída/expulsão, 4409 socket substituído —
// R.4), mas o cliente ainda não olha o código: reconecta e cai no re-join
// (T3.3). Pista da Fase H.
// Mensagens do cliente (JSON):
//   { type: "message", text?, rollResult? }  → postChatMessage (broadcast)
//   { type: "heartbeat" }                    → touchPlayer (sem broadcast)
//   { type: "initiative", action?, initiativeList? } → nextTurn/updateInitiative
//   { type: "resync" }                       → a sala inteira, só a quem pediu (L.1)
// O broadcast é o MESMO do SSE — o cliente usa WS ou cai para SSE
// automaticamente. Desde a L.1, com `?delta=1`, é a diferença (ver o reenvio).
// R.4 (SEC-10) — o `maxPayload` era o padrão do `ws` (100 MiB); agora é o
// mesmo teto do REST. Quadro maior fecha o socket com 1009.
const wss = new WebSocketServer({ noServer: true, maxPayload: WS_LIMITS.maxPayloadBytes });
// R.4 (SEC-10) — contas por jogador para os quadros do WS. Ver server/wsLimits.
const wsLimiter = new WsRateLimiter();

/**
 * R.4 — `false` se o jogador estourou o orçamento. Na primeira vez em cada
 * janela, registra no log (sinal de abuso para o Registro de sessões) e, se
 * houver `aviso`, conta ao autor — uma vez só, porque o aviso também é banda.
 */
function wsAllow(ws: WebSocket, code: string, peerId: string, budget: WsBudget, aviso?: string): boolean {
  if (wsLimiter.allow(code, peerId, budget)) return true;
  if (wsLimiter.justExceeded(code, peerId, budget)) {
    logger.warn("ws_rate_limited", { room: code, peerId, budget });
    if (aviso) sendToSocket(code, ws, JSON.stringify({ type: "error", error: aviso, code: "rate_limited" }));
  }
  return false;
}

interface WsConnMeta {
  code: string;
  peerId: string;
  /** L.1 — o cliente pediu o reenvio por diferença (`?delta=1`). */
  delta: boolean;
}

wss.on("connection", (ws: WebSocket, _req: http.IncomingMessage, meta: WsConnMeta) => {
  const { code, peerId, delta } = meta;
  // L.1 — a sala inteira de entrada, antes de entrar na lista (ver o SSE).
  const inicial = getRoom(code);
  const entrada = inicial ? roomEntryFor(code, inicial, peerId, delta) : null;
  wsPeer.set(ws, peerId);
  if (delta) wsDelta.add(ws);
  if (!wsClients[code]) wsClients[code] = new Set();
  wsClients[code].add(ws);

  // R.4 (SEC-10) — cada socket recebe cada reenvio da sala: sockets demais do
  // mesmo jogador multiplicam a banda. Fecha os mais antigos (o Set guarda a
  // ordem de entrada) — uma aba recarregando convive com a anterior.
  const doPeer = [...wsClients[code]].filter((s) => wsPeer.get(s) === peerId);
  for (const velho of doPeer.slice(0, Math.max(0, doPeer.length - WS_LIMITS.maxSocketsPerPeer))) {
    wsClients[code].delete(velho);
    velho.close(4409, "Conexão substituída por uma mais nova");
  }

  // Estado inicial imediato (mesmo comportamento do SSE)
  if (entrada) sendToSocket(code, ws, entrada);

  ws.on("message", (raw: RawData, isBinary: boolean) => {
    // H.3d — o que chega entre a entrega do bastão e o fechamento do socket
    // não é executado: a instância nova não leria.
    if (isDraining()) return;
    // R.4 — teto de quadros antes de qualquer parse (CPU).
    if (!wsAllow(ws, code, peerId, "frame")) return;
    // Texto → protocolo JSON existente; binário → Yjs (grid CRDT / awareness)
    // NOTA: frames de texto podem chegar como string OU Buffer conforme a
    // versão do ws — o discriminador confiável é o flag `isBinary`, não o
    // typeof (que em ws@8.21.1 entrega texto como Buffer).
    if (!isBinary) {
      const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
      // Cada campo é conferido por quem o usa (o roomManager saneia e valida).
      let msg: { type?: unknown; text?: unknown; kind?: unknown; skillName?: unknown; action?: unknown; initiativeList?: unknown };
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "message": {
          // Chat — handle/role derivados do servidor (anti-spoofing).
          // T5.4: rolagens NÃO vêm por aqui (rollResult do cliente é ignorado
          // — só o tipo "roll" gera dado, no servidor).
          // R.4 — o mesmo teto do `chatLimiter` do REST, que o WS não tinha.
          if (!wsAllow(ws, code, peerId, "chat", "Muitas mensagens. Aguarde um instante.")) break;
          const result = postChatMessage(code, peerId, msg.text as string);
          if (result.room) broadcastRoomUpdate(code);
          // Erro de volta para o autor (ex.: mensagem vazia)
          else if (result.error) sendToSocket(code, ws, JSON.stringify({ type: "error", error: result.error, code: result.code }));
          break;
        }
        case "roll": {
          // Fase 5 (T5.4) — RNG server-authoritative
          // R.4 — rolagem e iniciativa dividem o teto do `roomLimiter` do REST.
          if (!wsAllow(ws, code, peerId, "action", "Muitas ações. Aguarde um instante.")) break;
          const result = rollDiceForPlayer(code, peerId, { kind: msg.kind as string, skillName: msg.skillName as string | undefined });
          if (result.room) broadcastRoomUpdate(code);
          else sendToSocket(code, ws, JSON.stringify({ type: "roll-error", error: result.error, code: result.code }));
          break;
        }
        case "heartbeat": {
          // Mantém isOnline=true; o watcher (T3.4) marca offline após timeout
          touchPlayer(code, peerId);
          break;
        }
        case "initiative": {
          if (!wsAllow(ws, code, peerId, "action", "Muitas ações. Aguarde um instante.")) break;
          const result =
            msg.action === "next"
              ? nextTurn(code, peerId)
              : msg.action === "roll"
                ? rollInitiative(code, peerId)
                : Array.isArray(msg.initiativeList)
                ? updateInitiative(code, peerId, msg.initiativeList as InitiativeEntry[])
                : null;
          if (result?.room) broadcastRoomUpdate(code);
          break;
        }
        case "resync": {
          // L.1 — o cliente viu um buraco no rev e pede a sala inteira. É banda
          // (a sala inteira a um socket), então tem o teto das ações.
          if (!wsDelta.has(ws)) break;
          if (!wsAllow(ws, code, peerId, "action", "Muitas ações. Aguarde um instante.")) break;
          const room = getRoom(code);
          if (room) sendToSocket(code, ws, roomEntryFor(code, room, peerId, true, ws));
          break;
        }
        default:
          break;
      }
      return;
    }

    // Binário → Yjs (lida com mensagens fragmentadas ws como Buffer[])
    const bin = Array.isArray(raw) ? Buffer.concat(raw) : (Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer));
    // R.4 — o tipo do quadro decide o orçamento. Update do grid aceito reenvia
    // a sala inteira; awareness é repassado a todos — e o estado dele é livre,
    // então o tamanho também tem teto.
    let kind: number;
    try {
      kind = decoding.readVarUint(decoding.createDecoder(new Uint8Array(bin)));
    } catch {
      return;
    }
    if (kind === messageAwareness) {
      if (bin.byteLength > WS_LIMITS.maxAwarenessBytes) {
        logger.warn("ws_awareness_too_big", { room: code, peerId, bytes: bin.byteLength });
        return;
      }
      if (!wsAllow(ws, code, peerId, "awareness")) return;
    } else if (!wsAllow(ws, code, peerId, "sync")) {
      return;
    }
    try {
      handleYjsBinary(code, ws, bin);
    } catch (e) {
      // Frame Yjs malformado (payload truncado/aleatório) — nunca derruba o
      // socket nem o processo; o servidor continua atendendo a mesa.
      logger.warn("ws_invalid_yjs_frame", { room: code, message: (e as Error).message });
    }
  });

  ws.on("close", () => {
    // J.1d (SEC-17) — antes de sair do mapa: a remoção vai aos outros sockets.
    dropSocketAwareness(code, ws);
    wsClients[code]?.delete(ws);
    if (wsClients[code] && wsClients[code].size === 0) {
      delete wsClients[code];
      // Sem sockets WS — o doc Yjs pode ser descartado (o JSON é a verdade)
      destroyRoomYjs(code);
    }
    dropFeedIfIdle(code);
  });

  ws.on("error", () => {
    wsClients[code]?.delete(ws);
  });
});

/**
 * Liga o WebSocket da mesa ao `upgrade` de um servidor HTTP. Separado do
 * `startServer` na R.4 para os testes subirem o transporte real sem o resto
 * (restore do banco, watchers, Vite) — os tetos do WS só se testam de verdade
 * com um socket de verdade.
 */
export function attachRealtime(server: http.Server): void {
  // Upgrade handshake: /ws/rooms/:code?token=<sessão T1.7>
  server.on("upgrade", (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    } catch {
      socket.destroy();
      return;
    }
    const match = url.pathname.match(/^\/ws\/rooms\/([A-Za-z0-9-]+)$/i);
    if (!match) {
      socket.destroy();
      return;
    }
    // H.3d — entregou o bastão (ou já avisou que vai entregar): o cliente tenta
    // de novo, e o Render o leva à nova.
    if (isDraining() || isAnnouncing()) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    const code = roomKey(match[1]);
    const token = url.searchParams.get("token") || "";
    const peerId = verifySession(code, token);
    if (!peerId) {
      // Sessão inválida/expirada — HTTP 401 no handshake
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const meta: WsConnMeta = { code, peerId, delta: url.searchParams.get("delta") === "1" };
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, meta);
      });
    } catch (e) {
      // Socket pode fechar entre o handshake e o upgrade (cliente desistiu)
      socket.destroy();
    }
  });
}
