import express, { Response } from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
// Fase 5 (T5.2) — WebSocket puro (ws, já instalado) como transporte base do
// multiplayer. SSE mantido como fallback automático no cliente.
import { WebSocketServer, WebSocket } from "ws";
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

const app = express();
const PORT = 3000;

// T1.4 — limite de payload (fichas de personagem cabem folgadamente em 1MB)
app.use(express.json({ limit: "1mb" }));

// T1.4 — rate limit simples por IP (anti-abuso)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function makeRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
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

// Send chat message or dice roll (T1.7 — autenticado; handle/role vêm do servidor)
app.post("/api/rooms/:code/message", roomLimiter, chatLimiter, (req, res) => {
  const requesterPeerId = getSessionPeerId(req, req.params.code);
  if (!requesterPeerId) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Reconecte-se à mesa." });
  }
  const { text, rollResult } = req.body ?? {};
  const result = postChatMessage(req.params.code, requesterPeerId, text, rollResult);
  return respondWithResult(res, result);
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

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "message": {
        // Chat ou rolagem — handle/role derivados do servidor (anti-spoofing)
        const result = postChatMessage(code, peerId, msg.text, msg.rollResult);
        if (result.room) broadcastRoomUpdate(code);
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
  });

  ws.on("close", () => {
    wsClients[code]?.delete(ws);
    if (wsClients[code] && wsClients[code].size === 0) {
      delete wsClients[code];
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

startServer();
