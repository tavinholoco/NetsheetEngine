// L.3a (E.18) — o grid como estado CRDT (Yjs) por sala: o doc, o awareness, o
// espelho doc ↔ JSON e a posse dos tokens. Saiu do `server.ts` na L.3a.
import { WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { TOKEN_KEYS, deriveGridFromDoc, docTokensProblem, gridChangeProblem, writeGridToDoc } from "../src/lib/gridDoc.js";
import { checkAwarenessUpdate } from "./awarenessGuard.js";
import { logger } from "./logger.js";
import { getRoom } from "./roomManager.js";
import { queueRoomPersist } from "./roomPersistence.js";
import { broadcastRoomUpdate, sendToSocket, wsClients, wsPeer } from "./realtime.js";

// ==========================================
// FASE 5 (T5.3) — GRID CRDT (Yjs) POR SALA
// ==========================================
// Cada sala com membros WS ativos tem um `Y.Doc` + `Awareness`:
//   doc: grid tático como estado CRDT (meta + tokens) — camada de sync ao vivo
//   awareness: cursores do GM (não-persistente)
// O JSON `room.tacticalGrid` continua a verdade durável (decisão T5.1):
//   doc → JSON: espelhado quando um update de cliente é autorizado (abaixo)
//   JSON → doc: seedado a cada reenvio, pelo `onBeforeBroadcast` do realtime (mutações REST convergem)
//
// Protocolo de mensagens binárias (y-websocket wire):
//   [messageSync(0) + syncStep1/syncStep2/update]
//   [messageAwareness(1) + update]
//   [messageQueryAwareness(3)] → servidor responde awareness completo
export const messageSync = 0;
export const messageAwareness = 1;
export const messageQueryAwareness = 3;

interface RoomYjsEntry {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
}
const roomYjs = new Map<string, RoomYjsEntry>();

/**
 * Cria (ou reutiliza) o doc CRDT + awareness de uma sala, seedado do JSON,
 * e acopla os watchers de updates/awareness (uma única vez por entrada).
 */
export function getRoomYjs(code: string): RoomYjsEntry | null {
  const key = code.toUpperCase();
  let entry = roomYjs.get(key);
  if (entry) return entry;
  const room = getRoom(key);
  if (!room) return null;
  const doc = new Y.Doc();
  if (room.tacticalGrid) {
    writeGridToDoc(doc, room.tacticalGrid, "server");
  }
  const awareness = new awarenessProtocol.Awareness(doc);
  entry = { doc, awareness };
  roomYjs.set(key, entry);
  watchYjsUpdates(entry, key);
  return entry;
}

/**
 * Watchers do doc/awareness de uma sala:
 * - update do doc → espelha para o JSON durável (se origin é socket) + propaga
 *   aos outros sockets (nunca ecoa o autor).
 * - update do awareness → propaga para os outros sockets (cursores do GM).
 */
function watchYjsUpdates(entry: RoomYjsEntry, code: string): void {
  entry.doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin && typeof (origin as WebSocket).send === "function") {
      // Mutação de cliente: valida e espelha para o JSON. Se foi REVERTIDA,
      // o update original NÃO é propagado (o revert já foi, sincronamente,
      // pelo doc.on('update') aninhado dentro do mirrorDocToJson).
      if (!mirrorDocToJson(code, origin as WebSocket)) return;
    }
    broadcastYjsUpdate(code, update, origin);
  });

  entry.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    const sockets = wsClients[code.toUpperCase()];
    if (!sockets || sockets.size === 0) return;
    const changed = [...added, ...updated, ...removed];
    if (changed.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(entry.awareness, changed));
    const payload = encoding.toUint8Array(encoder);
    for (const ws of sockets) {
      if (ws !== origin) sendToSocket(code, ws, payload);
    }
  });
}

/** Destrói o doc/awareness de uma sala (ex.: sala encerrada). */
export function destroyRoomYjs(code: string): void {
  const key = code.toUpperCase();
  const entry = roomYjs.get(key);
  if (entry) {
    roomYjs.delete(key);
    try {
      entry.awareness.destroy();
      entry.doc.destroy();
    } catch {
      /* ignore */
    }
  }
}

/** Encaminha um update Yjs para os outros sockets da sala (não ecoa o autor). */
function broadcastYjsUpdate(code: string, update: Uint8Array, origin: unknown): void {
  const sockets = wsClients[code.toUpperCase()];
  if (!sockets || sockets.size === 0) return;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const payload = encoding.toUint8Array(encoder);
  for (const ws of sockets) {
    if (ws !== origin) sendToSocket(code, ws, payload);
  }
}

/**
 * Espelha doc → JSON (verdade durável) após um update vindo de um cliente.
 * Valida a permissão da mutação: GM pode tudo; jogador só move o PRÓPRIO
 * token (x/y). Mutação não autorizada → reverte o doc (os outros clientes
 * recebem o revert via broadcastYjsUpdate).
 */
function mirrorDocToJson(code: string, originWs: WebSocket): boolean {
  const key = code.toUpperCase();
  const entry = roomYjs.get(key);
  const room = getRoom(key);
  if (!entry || !room) return true;
  const prev = room.tacticalGrid;
  if (!prev) return true;
  const originPeerId = wsPeer.get(originWs);
  // E.02 (SEC-14) — a FORMA antes da permissão, e para todo mundo, GM
  // inclusive: validar forma não é autorização. Um item que não é token no
  // array (o `deriveGridFromDoc` o ignora, então a comparação abaixo não o
  // veria) ou um token malformado são revertidos — o revert apaga o lixo.
  const junk = docTokensProblem(entry.doc);
  const next = deriveGridFromDoc(entry.doc);
  if (!junk && JSON.stringify(prev) === JSON.stringify(next)) return true;
  const shapeProblem = junk ?? gridChangeProblem(prev, next);
  if (shapeProblem) {
    logger.warn("grid_update_rejected", { room: key, peerId: originPeerId, reason: shapeProblem.slice(0, 120) });
    writeGridToDoc(entry.doc, prev, "server");
    return false;
  }

  const isGm = room.gmPeerId === originPeerId;
  const prevById = new Map(prev.tokens.map((t) => [t.id, t]));
  const nextIds = new Set(next.tokens.map((t) => t.id));

  let allowed = true;
  // Estrutura (meta) só GM
  if (!isGm && (prev.rows !== next.rows || prev.cols !== next.cols || prev.theme !== next.theme)) {
    allowed = false;
  }
  // Tokens adicionados/removidos só GM
  if (!isGm) {
    for (const t of next.tokens) if (!prevById.has(t.id)) { allowed = false; break; }
    if (allowed) for (const id of prevById.keys()) if (!nextIds.has(id)) { allowed = false; break; }
  }
  // Tokens alterados: jogador só pode mudar x/y do PRÓPRIO token.
  // R.6 (SEC-12) — duas correções. (1) O dono é o de ANTES da mudança: a
  // checagem olhava o `peerId` novo, e o jogador reescrevia o dono e movia no
  // mesmo update. (2) Todo campo que o doc carrega, menos x/y, é imutável para
  // o jogador — a lista escrita à mão tinha esquecido `peerId` e `icon`.
  if (allowed && !isGm) {
    for (const t of next.tokens) {
      const p = prevById.get(t.id);
      if (!p) continue;
      const posChanged = p.x !== t.x || p.y !== t.y;
      const otherChanged = TOKEN_KEYS.some((k) => k !== "x" && k !== "y" && p[k] !== t[k]);
      if (posChanged && p.peerId !== originPeerId) { allowed = false; break; }
      if (otherChanged) { allowed = false; break; }
    }
  }

  if (!allowed) {
    // Reverte o doc para o estado anterior; o revert é propagado aos clientes
    // (sincronamente via doc.on('update') aninhado). Retorna false para o
    // watcher NÃO propagar o update original não autorizado depois do revert.
    writeGridToDoc(entry.doc, prev, "server");
    return false;
  }
  room.tacticalGrid = next;
  queueRoomPersist(key);
  broadcastRoomUpdate(key);
  return true;
}

/** Seed JSON → doc quando o grid mudou por REST (no-op se já igual). */
export function seedDocFromJson(code: string): void {
  const key = code.toUpperCase();
  const entry = roomYjs.get(key);
  const room = getRoom(key);
  if (!entry || !room || !room.tacticalGrid) return;
  const fromDoc = deriveGridFromDoc(entry.doc);
  if (JSON.stringify(fromDoc) !== JSON.stringify(room.tacticalGrid)) {
    writeGridToDoc(entry.doc, room.tacticalGrid, "server");
  }
}

/** Processa uma mensagem binária (protocolo Yjs) vinda de um socket. */
export function handleYjsBinary(code: string, ws: WebSocket, raw: Buffer): void {
  const entry = getRoomYjs(code);
  if (!entry) return;
  const decoder = decoding.createDecoder(new Uint8Array(raw));
  const messageType = decoding.readVarUint(decoder);

  if (messageType === messageSync) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    // Aplica updates no doc com origin=ws; responde syncStep2 se necessário.
    // try/catch próprio: update malformado não pode derrubar o handler nem
    // logar stack trace do lib0 (o Yjs captura internamente via console.error).
    try {
      syncProtocol.readSyncMessage(decoder, encoder, entry.doc, ws);
    } catch {
      /* update Yjs inválido — socket mantido; estado durável é o JSON */
    }
    // J.1e (SEC-18) — o doc inteiro volta a quem pede: um socket que pede e
    // não lê enchia o próprio buffer sem passar pelo teto.
    const reply = encoding.toUint8Array(encoder);
    if (reply.byteLength > 1) sendToSocket(code, ws, reply);
  } else if (messageType === messageAwareness) {
    const update = decoding.readVarUint8Array(decoder);
    // J.1d (SEC-17) — quem escreve e o que vem dentro, antes de aplicar e repassar.
    const key = code.toUpperCase();
    const peerId = wsPeer.get(ws);
    const verdict = checkAwarenessUpdate(update, {
      own: wsAwarenessId.get(ws),
      takenByOther: (id) => [...(wsClients[key] ?? [])].some((s) => s !== ws && wsAwarenessId.get(s) === id),
      isGm: !!peerId && getRoom(key)?.gmPeerId === peerId
    });
    if ("problem" in verdict) {
      // Uma linha por socket: o recusado volta a cada quadro, no ritmo do orçamento.
      if (!awarenessRejectLogged.has(ws)) {
        awarenessRejectLogged.add(ws);
        logger.warn("awareness_rejected", { room: key, peerId, reason: verdict.problem });
      }
      return;
    }
    wsAwarenessId.set(ws, verdict.clientID);
    awarenessProtocol.applyAwarenessUpdate(entry.awareness, update, ws);
  } else if (messageType === messageQueryAwareness) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, Array.from(entry.awareness.getStates().keys()))
    );
    sendToSocket(code, ws, encoding.toUint8Array(encoder));
  }
}

/**
 * J.1d (SEC-17) — o `clientID` de awareness de cada socket: o primeiro que ele
 * usar. Um socket não escreve o estado de outro, e o dele sai da mesa quando o
 * socket fecha (antes, ficava até o awareness vencer, 30 s depois).
 */
const wsAwarenessId = new WeakMap<WebSocket, number>();
const awarenessRejectLogged = new WeakSet<WebSocket>();

/** Tira da mesa o estado de awareness de um socket que fechou. */
export function dropSocketAwareness(code: string, ws: WebSocket): void {
  const id = wsAwarenessId.get(ws);
  const entry = roomYjs.get(code.toUpperCase());
  if (id === undefined || !entry || !entry.awareness.getStates().has(id)) return;
  awarenessProtocol.removeAwarenessStates(entry.awareness, [id], "server");
}

/**
 * O espelho JSON → doc que roda a cada reenvio. E.02 (SEC-14) — nunca lança:
 * o reenvio roda dentro das rotas e do vigia de presença (um `setInterval`), e
 * um grid que o espelho não entendia travava a sala e, pelo vigia, derrubava o
 * processo inteiro. O JSON é a verdade durável (T5.1): se o espelho falhar, o
 * doc é descartado e renasce do JSON na próxima mensagem Yjs.
 */
export function seedDocFromJsonSafely(code: string): void {
  try {
    seedDocFromJson(code);
  } catch (e) {
    logger.error("yjs_seed_failed", { room: code.toUpperCase(), message: (e as Error)?.message || String(e) });
    destroyRoomYjs(code);
  }
}
