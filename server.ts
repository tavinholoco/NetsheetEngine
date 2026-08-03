import express, { Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
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
  updateNpcWoundLevel
} from "./server/roomManager.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// SSE Active Connections Map: roomCode -> Set<Response>
const sseClients: Record<string, Set<Response>> = {};

function broadcastRoomUpdate(code: string) {
  const room = getRoom(code);
  if (!room) return;
  const clients = sseClients[code.toUpperCase()];
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify(room)}\n\n`;
    clients.forEach(res => {
      try {
        res.write(payload);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch (e) {
        clients.delete(res);
      }
    });
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
app.post("/api/rooms/create", (req, res) => {
  const { code, name, gmHandle, gmPeerId } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Room code is required" });
  }
  const room = createRoom(code, name, gmHandle, gmPeerId);
  broadcastRoomUpdate(room.code);
  res.json(room);
});

// Join a room
app.post("/api/rooms/join", (req, res) => {
  const { code, peerId, handle, sheet } = req.body;
  if (!code || !peerId || !sheet) {
    return res.status(400).json({ error: "Code, peerId, and sheet are required" });
  }
  const room = joinRoom(code, peerId, handle, sheet);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  broadcastRoomUpdate(room.code);
  res.json(room);
});

// Get current room state
app.get("/api/rooms/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json(room);
});

// Sync player sheet
app.post("/api/rooms/:code/sheet", (req, res) => {
  const { peerId, sheet } = req.body;
  const room = updatePlayerSheet(req.params.code, peerId, sheet);
  if (!room) {
    return res.status(404).json({ error: "Room or player not found" });
  }
  broadcastRoomUpdate(room.code);
  res.json(room);
});

// GM Power: Update player's Bio-Monitor / health
app.post("/api/rooms/:code/player-health", (req, res) => {
  const { requesterPeerId, targetPeerId, woundLevel } = req.body;
  if (!requesterPeerId || !targetPeerId || woundLevel === undefined) {
    return res.status(400).json({ error: "requesterPeerId, targetPeerId, and woundLevel are required" });
  }
  const result = updatePlayerWoundLevel(req.params.code, requesterPeerId, targetPeerId, woundLevel);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Ação não permitida" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// Tactical Grid sync
app.post("/api/rooms/:code/tactical-grid", (req, res) => {
  const { requesterPeerId, gridState } = req.body;
  if (!requesterPeerId || !gridState) {
    return res.status(400).json({ error: "requesterPeerId and gridState are required" });
  }
  const result = updateTacticalGrid(req.params.code, requesterPeerId, gridState);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Ação não permitida" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Generate random NPC
app.post("/api/rooms/:code/npcs/generate", (req, res) => {
  const { requesterPeerId, archetypeId } = req.body;
  if (!requesterPeerId) {
    return res.status(400).json({ error: "requesterPeerId is required" });
  }
  const result = generateRoomNpc(req.params.code, requesterPeerId, archetypeId);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Erro ao gerar NPC" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Generate random Player Edgerunner sheet
app.post("/api/rooms/:code/players/generate", (req, res) => {
  const { requesterPeerId } = req.body;
  if (!requesterPeerId) {
    return res.status(400).json({ error: "requesterPeerId is required" });
  }
  const result = generateRoomPlayerEdgerunner(req.params.code, requesterPeerId);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Erro ao gerar Edgerunner" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Delete GM-generated player sheet
app.post("/api/rooms/:code/players/:targetPeerId/delete", (req, res) => {
  const { requesterPeerId } = req.body;
  if (!requesterPeerId) {
    return res.status(400).json({ error: "requesterPeerId is required" });
  }
  const result = deleteGeneratedPlayer(req.params.code, requesterPeerId, req.params.targetPeerId);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Erro ao remover Edgerunner gerado" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Delete NPC
app.post("/api/rooms/:code/npcs/:npcId/delete", (req, res) => {
  const { requesterPeerId } = req.body;
  if (!requesterPeerId) {
    return res.status(400).json({ error: "requesterPeerId is required" });
  }
  const result = deleteRoomNpc(req.params.code, requesterPeerId, req.params.npcId);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Erro ao remover NPC" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// GM Power: Update NPC Wound Level
app.post("/api/rooms/:code/npcs/:npcId/health", (req, res) => {
  const { requesterPeerId, woundLevel } = req.body;
  if (!requesterPeerId || woundLevel === undefined) {
    return res.status(400).json({ error: "requesterPeerId and woundLevel are required" });
  }
  const result = updateNpcWoundLevel(req.params.code, requesterPeerId, req.params.npcId, woundLevel);
  if (result.error || !result.room) {
    return res.status(403).json({ error: result.error || "Erro ao atualizar bio-monitor do NPC" });
  }
  broadcastRoomUpdate(result.room.code);
  res.json(result.room);
});

// Send chat message or dice roll
app.post("/api/rooms/:code/message", (req, res) => {
  const { senderHandle, senderRole, text, rollResult } = req.body;
  const room = postChatMessage(req.params.code, senderHandle, senderRole, text, rollResult);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  broadcastRoomUpdate(room.code);
  res.json(room);
});

// Update room atmosphere/combat modifiers
app.post("/api/rooms/:code/settings", (req, res) => {
  const { locationName, combatModifier, modifierReason } = req.body;
  const room = updateRoomSettings(req.params.code, locationName, combatModifier, modifierReason);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  broadcastRoomUpdate(room.code);
  res.json(room);
});

// Leave room endpoint
app.post("/api/rooms/:code/leave", (req, res) => {
  const { peerId } = req.body;
  if (!peerId) {
    return res.status(400).json({ error: "peerId is required" });
  }
  const room = leaveRoom(req.params.code, peerId);
  if (room) {
    broadcastRoomUpdate(room.code);
  }
  res.json({ success: true });
});

// Update or advance initiative
app.post("/api/rooms/:code/initiative", (req, res) => {
  const { action, initiativeList } = req.body;
  let room;
  if (action === 'next') {
    room = nextTurn(req.params.code);
  } else if (initiativeList) {
    room = updateInitiative(req.params.code, initiativeList);
  } else {
    room = getRoom(req.params.code);
  }
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  broadcastRoomUpdate(room.code);
  res.json(room);
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

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "online", system: "Cyberpunk 2020 Sheet Builder & Multiplayer API" });
});

async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cyberpunk 2020 Engine & Multiplayer Server] Active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
