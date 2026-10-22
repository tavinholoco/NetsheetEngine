// ==========================================================================
// L.3a (E.18) — QUEM ESCUTA CADA SALA, E O REENVIO
// ==========================================================================
// Os sockets e os streams de cada sala, de quem é cada um, o envio com o teto
// (SEC-18), o reenvio por diferença e por papel (L.1) e o fim das conexões na
// troca de instância (H.3d). O protocolo do socket mora no `wsGateway`, o grid
// CRDT no `yjsGrid`, e as rotas em `routes/`. Saiu do `server.ts` na L.3a.
import type { Response } from "express";
import { WebSocket } from "ws";
import { logger } from "./logger.js";
import { WS_LIMITS } from "./wsLimits.js";
import { RoomFeed, audienceOf, roomViewFor, type RoomAudience } from "./roomDelta.js";
import { getRoom } from "./roomManager.js";
import { queueRoomPersist } from "./roomPersistence.js";
import type { GameRoom } from "../src/types/multiplayer.js";
import { roomKey } from "./room/key.js";

// SSE Active Connections Map: roomCode -> Set<Response>
export const sseClients: Record<string, Set<Response>> = {};
// R.3 (SEC-09) — de quem é cada stream. O token só é conferido na abertura;
// sem saber o dono, um stream de quem foi removido seguia recebendo a sala.
export const ssePeer = new WeakMap<Response, string>();

// Fase 5 (T5.2) — WebSocket Active Connections Map: roomCode -> Set<WebSocket>
export const wsClients: Record<string, Set<WebSocket>> = {};
// De quem é cada socket — o autor vem da sessão validada no upgrade. Era um
// campo `_peerId` pendurado no objeto com `as any`; o mesmo mapa do SSE (R.3).
export const wsPeer = new WeakMap<WebSocket, string>();

// Fase 5 (T5.2) — fecha as conexões de um peer (sair da mesa ou ser removido
// pelo GM). Desde a R.3, as duas: WebSocket e stream SSE.
export function closePeerSockets(code: string, peerId: string): void {
  const key = roomKey(code);
  const sockets = wsClients[key];
  if (sockets) {
    for (const ws of sockets) {
      if (wsPeer.get(ws) === peerId) {
        ws.close(4400, "Sessão encerrada");
        sockets.delete(ws);
      }
    }
    if (sockets.size === 0) delete wsClients[key];
  }
  const streams = sseClients[key];
  if (streams) {
    for (const res of streams) {
      if (ssePeer.get(res) === peerId) {
        streams.delete(res);
        try {
          res.end();
        } catch {
          /* conexão já fechada */
        }
      }
    }
  }
}

/**
 * J.1e (SEC-18) — todo envio a um socket da mesa passa por aqui. A E.03 derrubava
 * o socket que não lê só no reenvio da SALA; o repasse do awareness e do Yjs e as
 * respostas do sync iam direto ao `ws.send`, e o buffer de um socket parado
 * chegou a 33 MB (o teto é 1 MiB). `terminate`, não `close`: o aperto de mão de
 * fechamento também ficaria preso no buffer.
 */
export function sendToSocket(code: string, ws: WebSocket, data: string | Uint8Array): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  const key = roomKey(code);
  if (ws.bufferedAmount > WS_LIMITS.maxBufferedBytes) {
    logger.warn("slow_consumer_closed", { room: key, peerId: wsPeer.get(ws), transport: "ws", bytes: ws.bufferedAmount });
    wsClients[key]?.delete(ws);
    ws.terminate();
    return false;
  }
  try {
    ws.send(data);
    return true;
  } catch {
    wsClients[key]?.delete(ws);
    return false;
  }
}

// ==========================================
// L.1 (ARQ-01) — O REENVIO POR DIFERENÇA
// ==========================================
// Quem conecta com `delta=1` recebe a sala inteira uma vez (`room:full`, com o
// `rev`) e depois só o que mudou (`room:patch`); quem não pede — a aba aberta
// antes do deploy — recebe a sala inteira a cada mudança, como antes. As peças
// puras estão em server/roomDelta.ts. Um `RoomFeed` por papel e por sala: o
// Mestre e o jogador recebem vistas diferentes (E.20). O feed só vive enquanto
// a sala tem quem escute: sem ninguém, quem chegar recebe a sala inteira.
export const roomFeeds = new Map<string, Record<RoomAudience, RoomFeed>>();
export const wsDelta = new WeakSet<WebSocket>();
export const sseDelta = new WeakSet<Response>();

function feedFor(key: string): Record<RoomAudience, RoomFeed> {
  let feed = roomFeeds.get(key);
  if (!feed) {
    feed = { gm: new RoomFeed(), player: new RoomFeed() };
    roomFeeds.set(key, feed);
  }
  return feed;
}

export function dropFeedIfIdle(key: string): void {
  if (!wsClients[key]?.size && !sseClients[key]?.size) roomFeeds.delete(key);
}

/** Leva o feed do papel até a sala de agora: a diferença (se houve) e a sala inteira, sob demanda. */
export function advanceFeed(key: string, room: GameRoom, audience: RoomAudience) {
  const view = roomViewFor(room, audience);
  const patch = feedFor(key)[audience].advance(view);
  let full: string | null = null;
  return {
    view,
    patch: patch ? JSON.stringify(patch) : null,
    full: () => (full ??= JSON.stringify(view))
  };
}

interface RoomListener {
  audience: RoomAudience;
  delta: boolean;
  send: (text: string) => void;
}

/** Cada socket e cada stream da sala, com o papel de quem escuta. */
export function forEachListener(key: string, room: GameRoom, fn: (l: RoomListener) => void, except?: WebSocket | Response): void {
  for (const res of [...(sseClients[key] ?? [])]) {
    if (res === except) continue;
    fn({ audience: audienceOf(room, ssePeer.get(res)), delta: sseDelta.has(res), send: (t) => sendToSse(key, res, t) });
  }
  for (const ws of [...(wsClients[key] ?? [])]) {
    if (ws === except) continue;
    fn({ audience: audienceOf(room, wsPeer.get(ws)), delta: wsDelta.has(ws), send: (t) => sendToSocket(key, ws, t) });
  }
}

/**
 * A sala inteira para quem chega (ou pede `resync`). Antes, o feed do papel vai
 * até agora — e quem já escuta recebe a diferença que isso der, para todos
 * ficarem no mesmo `rev`. Quem chega fica de fora dessa diferença (`except`):
 * ela parte de um rev que ele não tem.
 */
export function roomEntryFor(key: string, room: GameRoom, peerId: string, delta: boolean, except?: WebSocket | Response): string {
  const audience = audienceOf(room, peerId);
  const d = advanceFeed(key, room, audience);
  if (d.patch) {
    forEachListener(key, room, (l) => {
      if (l.delta && l.audience === audience) l.send(d.patch!);
    }, except);
  }
  if (!delta) return d.full();
  return JSON.stringify({ type: "room:full", rev: feedFor(key)[audience].rev, room: d.view });
}

/** E.03 (SEC-15) — stream que não lê não acumula reenvios na memória. */
export function sendToSse(key: string, res: Response, text: string): void {
  const clients = sseClients[key];
  if (res.writableLength > WS_LIMITS.maxBufferedBytes) {
    logger.warn("slow_consumer_closed", { room: key, peerId: ssePeer.get(res), transport: "sse", bytes: res.writableLength });
    clients?.delete(res);
    try { res.end(); } catch { /* já fechado */ }
    return;
  }
  try {
    res.write(`data: ${text}\n\n`);
    (res as Response & { flush?: () => void }).flush?.();
  } catch (e) {
    clients?.delete(res);
  }
}

/** A sala acabou (a saída do último, o coletor): o feed dela vai junto. */
export function dropRoomFeed(code: string): void {
  roomFeeds.delete(roomKey(code));
}

/** O que roda a cada reenvio, antes de entregar (o espelho do grid no doc Yjs). */
const beforeBroadcast: Array<(code: string) => void> = [];
export function onBeforeBroadcast(hook: (code: string) => void): void {
  beforeBroadcast.push(hook);
}

export function broadcastRoomUpdate(code: string) {
  const room = getRoom(code);
  if (!room) return;
  // Fase 3 (T3.1) — persistir a sala após cada mutação (debounce 2s)
  queueRoomPersist(code);
  // Fase 5 (T5.3) — o espelho JSON → doc Yjs (registrado pelo `server.ts`: o
  // `yjsGrid` depende deste módulo, e não o contrário). Não lança (E.02).
  for (const hook of beforeBroadcast) hook(code);
  // L.1 — o mesmo texto pelo SSE (fallback) e pelo WebSocket (o transporte
  // base, T5.2); o que muda é o papel e se quem escuta pediu diferença. Os dois
  // feeds andam a cada reenvio, mesmo sem ninguém do papel escutando: quem
  // chegar depois recebe a sala inteira com o rev certo.
  // E.03 (SEC-15) — socket que não lê é fechado, em vez de o servidor guardar
  // cada reenvio da sala para ele; desde a J (SEC-18), no `sendToSocket`.
  const key = roomKey(code);
  if (!wsClients[key]?.size && !sseClients[key]?.size) return;
  const deliveries = { gm: advanceFeed(key, room, "gm"), player: advanceFeed(key, room, "player") };
  forEachListener(key, room, (l) => {
    const d = deliveries[l.audience];
    if (!l.delta) l.send(d.full());
    else if (d.patch) l.send(d.patch);
  });
}

// H.3d (H.13) — o estado da troca de instância, que as rotas, o upgrade e o
// socket consultam. Quem muda é o `drainForHandoff` do `server.ts`.
let draining = false;
let announcing = false;
/** Entregou o bastão: a mesa não executa mais nada (503 `server_restarting`). */
export const isDraining = (): boolean => draining;
export function setDraining(): void {
  draining = true;
}
/** Avisou que vai entregar: conexão nova é recusada — ela ficaria presa a esta instância. */
export const isAnnouncing = (): boolean => announcing;
export function setAnnouncing(): void {
  announcing = true;
}
/** O EventSource reconecta sozinho de um stream que ACABA — e o `retry` diz em quanto. */
export const SSE_RETRY_SOON = "retry: 1500\n\n";

/** Fecha toda conexão de mesa: o WebSocket com 1012 (Service Restart), o stream SSE com o fim. */
export function closeAllRealtime(): number {
  let closed = 0;
  for (const key of Object.keys(wsClients)) {
    for (const ws of wsClients[key]) {
      try {
        ws.close(1012, "server_restarting");
      } catch {
        /* já fechado */
      }
      closed += 1;
    }
    delete wsClients[key];
  }
  for (const key of Object.keys(sseClients)) {
    for (const res of sseClients[key]) {
      try {
        res.end(SSE_RETRY_SOON);
      } catch {
        /* já fechado */
      }
      closed += 1;
    }
    delete sseClients[key];
  }
  return closed;
}

/**
 * H.3d.4 — o aviso de que a mesa vai mudar de instância. No ar, o proxy do Render
 * segurou o FECHAMENTO que o servidor manda por 13–16 s: a tela achava o socket
 * aberto e mandou uma mensagem para uma instância que já tinha saído. Um quadro de
 * DADOS chega na hora, como cada atualização da mesa; o cliente que o recebe fecha o
 * próprio socket e passa ao REST. `type: "error"`: o navegador com o bundle de antes
 * só mostra o texto, não quebra a sala.
 */
export const RESTART_NOTICE = JSON.stringify({
  type: "error",
  code: "server_restarting",
  error: "O servidor está trocando de instância — reconectando…"
});

export function announceRestart(): number {
  let announced = 0;
  // Direto, não pelo `sendToSocket` (SEC-18): um quadro por socket, uma vez, com
  // o processo de saída — o teto é para o envio que se repete.
  for (const sockets of Object.values(wsClients)) {
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(RESTART_NOTICE);
        announced += 1;
      } catch {
        /* fechando */
      }
    }
  }
  return announced;
}
