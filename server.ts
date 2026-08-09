import express, { Response } from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
// Fase 5 (T5.2) — WebSocket puro (ws, já instalado) como transporte base do
// multiplayer. SSE mantido como fallback automático no cliente.
import { WebSocketServer, WebSocket } from "ws";
// Fase 5 (T5.3) — Grid tático como estado CRDT (Yjs) sobre o mesmo WebSocket.
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { deriveGridFromDoc, writeGridToDoc } from "./src/lib/gridDoc.js";
import {
  createRoom,
  getRoom,
  joinRoom,
  updatePlayerSheet,
  postChatMessage,
  updateRoomSettings,
  updateInitiative,
  nextTurn,
  leaveRoom,
  getAllActiveRooms,
  updatePlayerWoundLevel,
  updateTacticalGrid,
  generateRoomNpc,
  generateRoomPlayerEdgerunner,
  deleteGeneratedPlayer,
  deleteRoomNpc,
  updateNpcWoundLevel,
  rollDiceForPlayer,
  verifySession,
  sanitizeText,
  isValidRoomCode,
  touchPlayer,
  markStalePlayersOffline,
  ROOM_OFFLINE_TIMEOUT_MS
} from "./server/roomManager.js";
import {
  queueRoomPersist,
  deleteRoomPersisted,
  restoreRoomsFromDb,
  flushAllPending
} from "./server/roomPersistence.js";

// Fase 3 — o servidor lê .env.local (VITE_* + chaves de serviço)
dotenv.config({ path: ['.env', '.env.local'] });

// `app` exportado para testes de integração (T9.3 — supertest) sem subir o
// listener; o `startServer()` (porta 3000 + Vite/SPA + restore do banco) roda
// em produção/dev mas é pulado quando NODE_ENV === "test".
export const app = express();
const PORT = 3000;

// T1.4 — limite de payload (fichas de personagem cabem folgadamente em 1MB)
app.use(express.json({ limit: "1mb" }));

// T1.4 — rate limit simples por IP (anti-abuso).
// NOTA (T9.3): cada limiter tem o PRÓPRIO mapa de buckets — antes, roomLimiter
// e chatLimiter compartilhavam um único mapa keyed por IP, então o limite do
// chat (30/min) contava TODAS as requisições da sala e derrubava o chat com
// 429 em mesas ativas após 30 req/min em qualquer endpoint.
function makeRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({ error: "Muitas requisições. Aguarde um instante." });
    }
    next();
  };
}

const roomLimiter = makeRateLimiter(120, 60_000); // 120 req/min por IP
const chatLimiter = makeRateLimiter(30, 60_000);  // chat mais restrito (30 msg/min)

// T1.7 — autor do request é derivado do token de sessão, nunca do peerId livre
function getSessionPeerId(req: express.Request, code: string): string | null {
  const token = typeof req.body?.sessionToken === "string" ? req.body.sessionToken : null;
  if (!token) return null;
  return verifySession(code, token);
}

// Resposta padronizada: 404 p/ sala não encontrada, 403 p/ negação de autorização
function respondWithResult(res: express.Response, result: { room: { code: string } | null; error?: string }) {
  if (!result.room) {
    const msg = result.error || "Ação não permitida";
    const isNotFound = msg.includes("não encontrada") || msg.includes("não encontrado") || msg.includes("encerrada");
    return res.status(isNotFound ? 404 : 403).json({ error: msg });
  }
  broadcastRoomUpdate(result.room.code);
  return res.json(result.room);
}

// SSE Active Connections Map: roomCode -> Set<Response>
const sseClients: Record<string, Set<Response>> = {};

// Fase 5 (T5.2) — WebSocket Active Connections Map: roomCode -> Set<WebSocket>
const wsClients: Record<string, Set<WebSocket>> = {};

// Fase 5 (T5.2) — fecha os sockets WS de um peer (ex.: ao sair da mesa via REST)
function closePeerSockets(code: string, peerId: string): void {
  const sockets = wsClients[code.toUpperCase()];
  if (!sockets) return;
  for (const ws of sockets) {
    if ((ws as any)._peerId === peerId) {
      ws.close(4400, "Sessão encerrada");
      sockets.delete(ws);
    }
  }
  if (sockets.size === 0) delete wsClients[code.toUpperCase()];
}

function broadcastRoomUpdate(code: string) {
  const room = getRoom(code);
  if (!room) return;
  // Fase 3 (T3.1) — persistir a sala após cada mutação (debounce 2s)
  queueRoomPersist(code);
  // Fase 5 (T5.3) — espelha JSON → doc Yjs quando o grid mudou por REST
  // (joinRoom, generateNpc, etc.) para os clientes CRDT convergirem.
  seedDocFromJson(code);
  const payload = JSON.stringify(room);

  // SSE (fallback) — mesmo payload JSON
  const clients = sseClients[code.toUpperCase()];
  if (clients && clients.size > 0) {
    const ssePayload = `data: ${payload}\n\n`;
    clients.forEach(res => {
      try {
        res.write(ssePayload);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch (e) {
        clients.delete(res);
      }
    });
  }

  // Fase 5 (T5.2) — WebSocket (transporte base): mesmo payload, menor latência
  const sockets = wsClients[code.toUpperCase()];
  if (sockets && sockets.size > 0) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (e) {
          sockets.delete(ws);
        }
      }
    }
  }
}

// Server-side Gemini API route for Cyberpunk Netrunner assistant
app.post("/api/gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "GEMINI_API_KEY environment variable is not configured." });
    }
    const ai = new GoogleGenAI({ apiKey });
    const { prompt, systemInstruction } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error?.message || "Failed to contact Gemini Netrunner AI" });
  }
});

// ==========================================
// MULTIPLAYER ROOM API ENDPOINTS (FASE 3)
// ==========================================

// Get list of public active rooms
app.get("/api/rooms", (_req, res) => {
  res.json(getAllActiveRooms());
});

// Create a new room
app.post("/api/rooms/create", roomLimiter, (req, res) => {
  const { code, name, gmHandle, gmPeerId } = req.body ?? {};
  if (typeof code !== "string" || !isValidRoomCode(code)) {
    return res.status(400).json({ error: "Código de sala inválido. Use 2–12 caracteres alfanuméricos ou hífen (ex.: NC-2020)." });
  }
  const result = createRoom(code, name, gmHandle, gmPeerId);
  broadcastRoomUpdate(result.room.code);
  res.json({ room: result.room, sessionToken: result.sessionToken });
});

// Join a room
app.post("/api/rooms/join", roomLimiter, (req, res) => {
  const { code, peerId, handle, sheet } = req.body ?? {};
  if (typeof code !== "string" || !isValidRoomCode(code)) {
    return res.status(400).json({ error: "Código de sala inválido." });
  }
  if (typeof peerId !== "string" || !peerId.trim()) {
    return res.status(400).json({ error: "peerId é obrigatório." });
  }
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
    return res.status(400).json({ error: "Ficha de personagem inválida." });
  }
  const result = joinRoom(code, peerId, handle, sheet);
  if (!result) {
    return res.status(404).json({ error: "Room not found" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json({ room: result.room, sessionToken: result.sessionToken });
});

// Get current room state
app.get("/api/rooms/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json(room);
});

// Sync player sheet (T1.7 — autenticado por token)
app.post("/api/rooms/:code/sheet", roomLimiter, (req, res) => {
  const peerId = getSessionPeerId(req, req.params.code);
  if (!peerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { sheet } = req.body ?? {};
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
    return res.status(400).json({ error: "Ficha inválida." });
  }
  const result = updatePlayerSheet(req.params.code, peerId, sheet);
  if (result.error || !result.room) {
    return res.status(404).json({ error: result.error || "Room or player not found" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Update player's Bio-Monitor / health
app.post("/api/rooms/:code/player-health", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { targetPeerId, woundLevel } = req.body ?? {};
  if (typeof targetPeerId !== "string" || woundLevel === undefined) {
    return res.status(400).json({ error: "targetPeerId e woundLevel são obrigatórios" });
  }
  const result = updatePlayerWoundLevel(req.params.code, requesterPeerId, targetPeerId, woundLevel);
  return respondWithResult(res, result);
});

// Tactical Grid sync (T1.2 — apenas GM)
app.post("/api/rooms/:code/tactical-grid", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { gridState } = req.body ?? {};
  if (!gridState || typeof gridState !== "object") {
    return res.status(400).json({ error: "gridState são obrigatórios" });
  }
  const result = updateTacticalGrid(req.params.code, requesterPeerId, gridState);
  return respondWithResult(res, result);
});

// GM Power: Generate random NPC
app.post("/api/rooms/:code/npcs/generate", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { archetypeId } = req.body ?? {};
  const result = generateRoomNpc(req.params.code, requesterPeerId, archetypeId);
  return respondWithResult(res, result);
});

// GM Power: Generate random Player Edgerunner sheet
app.post("/api/rooms/:code/players/generate", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const result = generateRoomPlayerEdgerunner(req.params.code, requesterPeerId);
  return respondWithResult(res, result);
});

// GM Power: Delete GM-generated player sheet
app.post("/api/rooms/:code/players/:targetPeerId/delete", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const result = deleteGeneratedPlayer(req.params.code, requesterPeerId, req.params.targetPeerId);
  return respondWithResult(res, result);
});

// GM Power: Delete NPC
app.post("/api/rooms/:code/npcs/:npcId/delete", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const result = deleteRoomNpc(req.params.code, requesterPeerId, req.params.npcId);
  return respondWithResult(res, result);
});

// GM Power: Update NPC Wound Level
app.post("/api/rooms/:code/npcs/:npcId/health", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { woundLevel } = req.body ?? {};
  if (woundLevel === undefined) {
    return res.status(400).json({ error: "woundLevel é obrigatório" });
  }
  const result = updateNpcWoundLevel(req.params.code, requesterPeerId, req.params.npcId, woundLevel);
  return respondWithResult(res, result);
});

// Send chat message (T1.7 — autenticado; handle/role vêm do servidor).
// Fase 5 (T5.4) — o cliente NÃO pode enviar rollResult no message: rolagens
// só existem via /roll (RNG server-authoritative). rollResult do cliente é
// ignorado (anti-forjamento).
app.post("/api/rooms/:code/message", roomLimiter, chatLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { text } = req.body ?? {};
  const result = postChatMessage(req.params.code, requesterPeerId, text);
  return respondWithResult(res, result);
});

// Fase 5 (T5.4) — rolagem server-authoritative (fallback REST p/ SSE): o
// servidor rola os dados (crypto.randomInt) usando a ficha que ELE possui.
app.post("/api/rooms/:code/roll", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { kind, skillName } = req.body ?? {};
  const result = rollDiceForPlayer(req.params.code, requesterPeerId, { kind, skillName });
  if (!result.room) {
    const msg = result.error || "Rolagem não permitida";
    return res.status(400).json({ error: msg });
  }
  broadcastRoomUpdate(result.room.code);
  return res.json({ room: result.room, roll: result.roll });
});

// Fase 3 (T3.4) — heartbeat: mantém o jogador online enquanto a aba estiver
// aberta na mesa. O timeout marca como offline após inatividade.
// SEM broadcast: o status isOnline não muda no heartbeat (já é true), e a
// virada para OFFLINE já é broadcastada pelo watcher — broadcast aqui seria
// um payload SSE redundante de 100–300 KB a cada 20s × jogador.
app.post("/api/rooms/:code/heartbeat", roomLimiter, (req, res) => {
  const peerId = getSessionPeerId(req, req.params.code);
  if (!peerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  if (!touchPlayer(req.params.code, peerId)) {
    return res.status(404).json({ error: "Jogador não está na mesa." });
  }
  res.json({ success: true, isOnline: true });
});

// Update room atmosphere/combat modifiers (T1.3 — apenas GM)
app.post("/api/rooms/:code/settings", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { locationName, combatModifier, modifierReason } = req.body ?? {};
  const result = updateRoomSettings(req.params.code, requesterPeerId, locationName, combatModifier, modifierReason);
  return respondWithResult(res, result);
});

// Leave room endpoint (T1.7 — autenticado por token)
app.post("/api/rooms/:code/leave", roomLimiter, async (req, res) => {
  const peerId = getSessionPeerId(req, req.params.code);
  if (!peerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const result = leaveRoom(req.params.code, peerId);
  // Fase 5 (T5.2) — fecha o socket WS do peer que saiu (evita fantasma)
  closePeerSockets(req.params.code, peerId);
  if (result.room) {
    broadcastRoomUpdate(result.room.code);
  } else {
    // Fase 3 (T3.1) — mesa encerrada: remover do banco (o broadcast não roda).
    // Await para não deixar linha órfã que ressuscitaria a sala no próximo boot.
    await deleteRoomPersisted(req.params.code);
    // Fase 5 (T5.3) — descarta o doc CRDT/awareness da sala encerrada.
    destroyRoomYjs(req.params.code);
  }
  res.json({ success: true });
});

// Update or advance initiative (T1.3 — apenas GM)
app.post("/api/rooms/:code/initiative", roomLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { action, initiativeList } = req.body ?? {};
  let result;
  if (action === 'next') {
    result = nextTurn(req.params.code, requesterPeerId);
  } else if (initiativeList) {
    result = updateInitiative(req.params.code, requesterPeerId, initiativeList);
  } else {
    result = { room: getRoom(req.params.code) ?? null };
  }
  return respondWithResult(res, result);
});

// Server-Sent Events (SSE) stream for live real-time updates (< 50ms latency)
app.get("/api/rooms/:code/stream", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = getRoom(code);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!sseClients[code]) {
    sseClients[code] = new Set();
  }
  sseClients[code].add(res);

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(room)}\n\n`);

  // Keep-alive ping interval to keep connection alive through cloud proxies
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (e) {
      clearInterval(keepAlive);
      sseClients[code]?.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients[code]?.delete(res);
  });
});

// ==========================================
// FASE 5 (T5.2) — WEBSOCKET: /ws/rooms/:code
// ==========================================
// Transporte base do multiplayer. Handshake autenticado pelo token de sessão
// (T1.7) via query param `?token=`; close 4401 se a sessão for inválida
// (código na faixa 4400–4499 = permanente, o cliente não tenta reconectar
// com o mesmo token — alinhado com a T3.3).
// Mensagens do cliente (JSON):
//   { type: "message", text?, rollResult? }  → postChatMessage (broadcast)
//   { type: "heartbeat" }                    → touchPlayer (sem broadcast)
//   { type: "initiative", action?, initiativeList? } → nextTurn/updateInitiative
// O broadcast (room inteiro em JSON) é o MESMO do SSE — o cliente usa WS ou
// cai para SSE automaticamente.
const wss = new WebSocketServer({ noServer: true });

// ==========================================
// FASE 5 (T5.3) — GRID CRDT (Yjs) POR SALA
// ==========================================
// Cada sala com membros WS ativos tem um `Y.Doc` + `Awareness`:
//   doc: grid tático como estado CRDT (meta + tokens) — camada de sync ao vivo
//   awareness: cursores do GM (não-persistente)
// O JSON `room.tacticalGrid` continua a verdade durável (decisão T5.1):
//   doc → JSON: espelhado quando um update de cliente é autorizado (abaixo)
//   JSON → doc: seedado em broadcastRoomUpdate (mutações REST convergem)
//
// Protocolo de mensagens binárias (y-websocket wire):
//   [messageSync(0) + syncStep1/syncStep2/update]
//   [messageAwareness(1) + update]
//   [messageQueryAwareness(3)] → servidor responde awareness completo
const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

interface RoomYjsEntry {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
}
const roomYjs = new Map<string, RoomYjsEntry>();

/**
 * Cria (ou reutiliza) o doc CRDT + awareness de uma sala, seedado do JSON,
 * e acopla os watchers de updates/awareness (uma única vez por entrada).
 */
function getRoomYjs(code: string): RoomYjsEntry | null {
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

  entry.awareness.on("update", ({ added, updated, removed }: any, origin: unknown) => {
    const sockets = wsClients[code.toUpperCase()];
    if (!sockets || sockets.size === 0) return;
    const changed = [...added, ...updated, ...removed];
    if (changed.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(entry.awareness, changed));
    const payload = encoding.toUint8Array(encoder);
    for (const ws of sockets) {
      if (ws === origin) continue;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch {
          sockets.delete(ws);
        }
      }
    }
  });
}

/** Destrói o doc/awareness de uma sala (ex.: sala encerrada). */
function destroyRoomYjs(code: string): void {
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
    if (ws === origin) continue;
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        sockets.delete(ws);
      }
    }
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
  const next = deriveGridFromDoc(entry.doc);
  if (JSON.stringify(prev) === JSON.stringify(next)) return true;

  const originPeerId = (originWs as any)._peerId as string | undefined;
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
  // Tokens alterados: jogador só pode mudar x/y do PRÓPRIO token
  if (allowed && !isGm) {
    for (const t of next.tokens) {
      const p = prevById.get(t.id);
      if (!p) continue;
      const posChanged = p.x !== t.x || p.y !== t.y;
      const otherChanged =
        p.name !== t.name ||
        p.type !== t.type ||
        p.hp !== t.hp ||
        p.maxHp !== t.maxHp ||
        p.spCover !== t.spCover ||
        p.status !== t.status ||
        p.color !== t.color ||
        p.role !== t.role;
      if (posChanged && t.peerId !== originPeerId) { allowed = false; break; }
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
function seedDocFromJson(code: string): void {
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
function handleYjsBinary(code: string, ws: WebSocket, raw: Buffer): void {
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
    const reply = encoding.toUint8Array(encoder);
    if (reply.byteLength > 1 && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(reply);
      } catch {
        /* ignore */
      }
    }
  } else if (messageType === messageAwareness) {
    const update = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(entry.awareness, update, ws);
  } else if (messageType === messageQueryAwareness) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, Array.from(entry.awareness.getStates().keys()))
    );
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(encoding.toUint8Array(encoder));
      } catch {
        /* ignore */
      }
    }
  }
}

interface WsConnMeta {
  code: string;
  peerId: string;
}

wss.on("connection", (ws: WebSocket, _req: http.IncomingMessage, meta: WsConnMeta) => {
  const { code, peerId } = meta;
  (ws as any)._peerId = peerId;
  if (!wsClients[code]) wsClients[code] = new Set();
  wsClients[code].add(ws);

  // Estado inicial imediato (mesmo comportamento do SSE)
  const room = getRoom(code);
  if (room && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(room));
  }

  ws.on("message", (raw: any, isBinary: boolean) => {
    // Texto → protocolo JSON existente; binário → Yjs (grid CRDT / awareness)
    // NOTA: frames de texto podem chegar como string OU Buffer conforme a
    // versão do ws — o discriminador confiável é o flag `isBinary`, não o
    // typeof (que em ws@8.21.1 entrega texto como Buffer).
    if (!isBinary) {
      const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
      let msg: any;
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
          const result = postChatMessage(code, peerId, msg.text);
          if (result.room) broadcastRoomUpdate(code);
          else if (result.error) {
            // Erro de volta para o autor (ex.: mensagem vazia)
            if (ws.readyState === WebSocket.OPEN) {
              try { ws.send(JSON.stringify({ type: "error", error: result.error })); } catch { /* ignore */ }
            }
          }
          break;
        }
        case "roll": {
          // Fase 5 (T5.4) — RNG server-authoritative
          const result = rollDiceForPlayer(code, peerId, { kind: msg.kind, skillName: msg.skillName });
          if (result.room) broadcastRoomUpdate(code);
          else if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "roll-error", error: result.error || "Rolagem não permitida" })); } catch { /* ignore */ }
          }
          break;
        }
        case "heartbeat": {
          // Mantém isOnline=true; o watcher (T3.4) marca offline após timeout
          touchPlayer(code, peerId);
          break;
        }
        case "initiative": {
          const result =
            msg.action === "next"
              ? nextTurn(code, peerId)
              : Array.isArray(msg.initiativeList)
                ? updateInitiative(code, peerId, msg.initiativeList)
                : null;
          if (result?.room) broadcastRoomUpdate(code);
          break;
        }
        default:
          break;
      }
      return;
    }

    // Binário → Yjs (lida com mensagens fragmentadas ws como Buffer[])
    const bin = Array.isArray(raw) ? Buffer.concat(raw) : (Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer));
    try {
      handleYjsBinary(code, ws, bin);
    } catch (e) {
      // Frame Yjs malformado (payload truncado/aleatório) — nunca derruba o
      // socket nem o processo; o servidor continua atendendo a mesa.
      console.warn(`[ws] frame Yjs inválido ignorado (${code}):`, (e as Error).message);
    }
  });

  ws.on("close", () => {
    wsClients[code]?.delete(ws);
    if (wsClients[code] && wsClients[code].size === 0) {
      delete wsClients[code];
      // Sem sockets WS — o doc Yjs pode ser descartado (o JSON é a verdade)
      destroyRoomYjs(code);
    }
  });

  ws.on("error", () => {
    wsClients[code]?.delete(ws);
  });
});


// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "online", system: "Cyberpunk 2020 Sheet Builder & Multiplayer API" });
});

// T1.4 — erro de parsing/payload do express.json em formato JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload excede o limite de 1MB." });
  }
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "JSON inválido no corpo da requisição." });
  }
  console.error("Erro não tratado:", err);
  return res.status(500).json({ error: "Erro interno do servidor." });
});

// Fase 3 (T3.4) — varre periodicamente e marca como offline jogadores sem
// heartbeat dentro da janela. Salas alteradas são broadcastadas + persistidas.
// Iniciado dentro do startServer (após o restore) — no topo do módulo um
// re-evaluate (watch/HMR) vazaria interval sem cleanup.
let presenceWatcher: NodeJS.Timeout | null = null;
function startPresenceWatcher(): void {
  presenceWatcher = setInterval(() => {
    const changedCodes = markStalePlayersOffline();
    for (const code of changedCodes) {
      broadcastRoomUpdate(code); // já faz queueRoomPersist (T3.1)
    }
  }, Math.min(15_000, Math.max(2_000, ROOM_OFFLINE_TIMEOUT_MS / 2)));
}

async function startServer() {
  // Fase 3 (T3.2) — restaurar salas persistidas antes de aceitar conexões
  await restoreRoomsFromDb();

  // Fase 3 (T3.4) — watcher de presença (timeout de isOnline)
  startPresenceWatcher();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Fase 5 (T5.2) — servidor HTTP explícito para anexar o WebSocket ao upgrade
  const server = http.createServer(app);

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
    const code = match[1].toUpperCase();
    const token = url.searchParams.get("token") || "";
    const peerId = verifySession(code, token);
    if (!peerId) {
      // Sessão inválida/expirada — rejeita de forma permanente (close 4401)
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const meta: WsConnMeta = { code, peerId };
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, meta);
      });
    } catch (e) {
      // Socket pode fechar entre o handshake e o upgrade (cliente desistiu)
      socket.destroy();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cyberpunk 2020 Engine & Multiplayer Server] Active on http://0.0.0.0:${PORT} (SSE + WebSocket)`);
  });
}

// Fase 3 (T3.1) — grava pendências de persistência no shutdown gracioso
function shutdown(signal: string) {
  console.log(`[server] ${signal} recebido — persistindo salas pendentes...`);
  if (presenceWatcher) clearInterval(presenceWatcher);
  void flushAllPending().finally(() => {
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// T9.3 — em testes (Vitest define NODE_ENV=test), o módulo é importado via
// supertest: NÃO sobe listener, watcher de presença nem restore do banco.
if (process.env.NODE_ENV !== "test") {
  startServer();
}
