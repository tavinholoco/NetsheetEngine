import crypto from "crypto";
import { GameRoom, RoomPlayer, ChatMessage, InitiativeEntry, TacticalGridState } from "../src/types/multiplayer.js";
import { CharacterSheet, RollResult } from "../src/types/cyberpunk.js";
import { generateRandomNpc } from "../src/utils/npcGenerator.js";

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

const sessions: Record<string, Session> = {}; // token -> sessão

function createSessionToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function bindSession(roomCode: string, peerId: string): string {
  const token = createSessionToken();
  sessions[token] = { roomCode: roomCode.trim().toUpperCase(), peerId };
  return token;
}

/** Retorna o peerId autenticado pelo token na sala, ou null se inválido. */
export function verifySession(roomCode: string, token: string): string | null {
  const s = sessions[token];
  if (!s) return null;
  if (s.roomCode !== roomCode.trim().toUpperCase()) return null;
  return s.peerId;
}

function revokeSessionsForPeer(roomCode: string, peerId: string): void {
  const rc = roomCode.trim().toUpperCase();
  for (const [token, s] of Object.entries(sessions)) {
    if (s.peerId === peerId && s.roomCode === rc) delete sessions[token];
  }
}

/** Remove a sala da memória e revoga todas as suas sessões (mesa encerrada). */
function deleteRoom(code: string): void {
  const rc = code.trim().toUpperCase();
  delete rooms[rc];
  for (const [token, s] of Object.entries(sessions)) {
    if (s.roomCode === rc) delete sessions[token];
  }
}

// ============================================================
// VALIDAÇÃO DE ENTRADA (T1.5)
// ============================================================

/** Remove caracteres de controle, colapsa espaços e trunca. */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Código de sala: 2–12 caracteres alfanuméricos ou hífen (ex.: NC-2020). */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9-]{2,12}$/.test(code.trim().toUpperCase());
}

// In-memory store for game rooms
const rooms: Record<string, GameRoom> = {};

// ============================================================
// AUTORIZAÇÃO (T1.1) — GM SEM fallback permissivo
// GM legítimo = quem criou a sala (gmPeerId) OU jogador cujo handle coincide
// com gmHandle. Nunca `return true` genérico.
// ============================================================
function checkIsGm(room: GameRoom, requesterPeerId: string): boolean {
  if (room.gmPeerId) {
    return room.gmPeerId === requesterPeerId;
  }
  // Sem gmPeerId definido: handle igual a gmHandle assume o cargo
  const player = room.players[requesterPeerId];
  if (player && player.handle && room.gmHandle &&
      player.handle.trim().toLowerCase() === room.gmHandle.trim().toLowerCase()) {
    room.gmPeerId = requesterPeerId;
    return true;
  }
  return false;
}

export function createRoom(code: string, roomName: string, gmHandle: string, gmPeerId?: string): { room: GameRoom; sessionToken: string } {
  const normalizedCode = code.trim().toUpperCase();
  const gmUserPeerId = sanitizeText(gmPeerId, 64) || "gm_" + Date.now().toString(36);
  const safeGmHandle = sanitizeText(gmHandle, 30) || "Mestre de Jogo";
  const gmSheet = generateRandomNpc();
  gmSheet.handle = safeGmHandle;
  gmSheet.role = "Mestre (GM)";

  const newRoom: GameRoom = {
    code: normalizedCode,
    name: sanitizeText(roomName, 40) || `Mesa de ${safeGmHandle}`,
    gmHandle: safeGmHandle,
    gmPeerId: gmUserPeerId,
    locationName: "Night City - Afterlife Club",
    combatModifier: 0,
    modifierReason: "Condições Normais de Combate",
    players: {
      [gmUserPeerId]: {
        peerId: gmUserPeerId,
        handle: safeGmHandle,
        role: "Mestre (GM)",
        sheet: gmSheet,
        isOnline: true,
        joinedAt: new Date().toISOString()
      }
    },
    chatMessages: [
      {
        id: "msg_init_" + Date.now(),
        senderHandle: "SISTEMA_NET",
        senderRole: "gm",
        text: `Sala [${normalizedCode}] criada por Mestre ${safeGmHandle}. Conexão com a Net de Night City estabelecida!`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }
    ],
    initiativeList: [],
    activeTurnIndex: 0,
    tacticalGrid: {
      rows: 8,
      cols: 10,
      theme: "alley",
      tokens: [
        { id: "cover_1", name: "Barricada Concreto", type: "cover", x: 2, y: 3, spCover: 15, color: "#64748b" },
        { id: "cover_2", name: "Veículo Blindado", type: "cover", x: 7, y: 4, spCover: 25, color: "#475569" },
        { id: "npc_booster", name: "Boostergang Malandro", type: "npc", x: 8, y: 2, hp: 0, maxHp: 10, status: "Normal", color: "#ef4444" }
      ]
    },
    createdAt: new Date().toISOString()
  };

  rooms[normalizedCode] = newRoom;
  const sessionToken = bindSession(normalizedCode, gmUserPeerId);
  return { room: newRoom, sessionToken };
}

export function getRoom(code: string): GameRoom | undefined {
  return rooms[code.trim().toUpperCase()];
}

export function joinRoom(code: string, peerId: string, handle: string, sheet: CharacterSheet): { room: GameRoom; sessionToken: string } | null {
  const room = getRoom(code);
  if (!room) return null;

  const safePeerId = sanitizeText(peerId, 64);
  if (!safePeerId) return null;

  const safeHandle = sanitizeText(handle, 30);

  // Se gmPeerId ainda não está definido, quem reivindica o handle do GM assume
  // (comparação trim + case-insensitive, idêntica ao checkIsGm)
  if (!room.gmPeerId && safeHandle && safeHandle.toLowerCase() === room.gmHandle?.toLowerCase()) {
    room.gmPeerId = safePeerId;
  }

  const player: RoomPlayer = {
    peerId: safePeerId,
    handle: safeHandle || sheet?.handle || "Edgerunner",
    role: sheet?.role || "Edgerunner",
    sheet,
    isOnline: true,
    joinedAt: new Date().toISOString()
  };

  room.players[safePeerId] = player;

  // Auto-create tactical token for player if not existing
  if (room.tacticalGrid) {
    const existingToken = room.tacticalGrid.tokens.find(t => t.peerId === safePeerId);
    if (!existingToken) {
      const freeX = (Object.keys(room.players).length) % room.tacticalGrid.cols;
      room.tacticalGrid.tokens.push({
        id: `token_${safePeerId}`,
        name: player.handle,
        type: "player",
        x: freeX,
        y: 1,
        peerId: safePeerId,
        role: player.role,
        hp: player.sheet?.woundLevel ?? 0,
        color: "#06b6d4"
      });
    }
  }

  // Add system message
  room.chatMessages.push({
    id: "msg_join_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `⚡ Edgerunner [${player.handle}] (${player.role}) conectou-se à mesa!`,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });

  const sessionToken = bindSession(room.code, safePeerId);
  return { room, sessionToken };
}

export function updatePlayerSheet(code: string, peerId: string, sheet: CharacterSheet): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!room.players[peerId]) return { room: null, error: "Jogador não encontrado na mesa" };

  room.players[peerId].sheet = sheet;
  room.players[peerId].handle = sanitizeText(sheet.handle, 30) || room.players[peerId].handle;
  room.players[peerId].role = sanitizeText(sheet.role, 30) || room.players[peerId].role;
  room.players[peerId].isOnline = true;

  // Also sync player's token name and HP in grid
  if (room.tacticalGrid) {
    const playerToken = room.tacticalGrid.tokens.find(t => t.peerId === peerId);
    if (playerToken) {
      playerToken.name = sheet.handle || playerToken.name;
      playerToken.hp = sheet.woundLevel;
    }
  }

  return { room };
}

export function updatePlayerWoundLevel(
  code: string,
  requesterPeerId: string,
  targetPeerId: string,
  woundLevel: number
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  // Strict check: Only GM can modify another player's bio-monitor
  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa tem permissão para alterar o Bio-Monitor de outros jogadores." };
  }

  const player = room.players[targetPeerId];
  if (!player) return { room: null, error: "Jogador não encontrado na mesa." };

  const clamped = Math.max(0, Math.min(10, woundLevel));
  player.sheet.woundLevel = clamped;

  // Sync token HP if present
  if (room.tacticalGrid) {
    const token = room.tacticalGrid.tokens.find(t => t.peerId === targetPeerId);
    if (token) token.hp = clamped;
  }

  const woundNames = [
    "Saudável (OK)",
    "Ferimento Leve (Light)",
    "Ferimento Sério (Serious)",
    "Ferimento Crítico (Critical)",
    "Mortal 0",
    "Mortal 1",
    "Mortal 2",
    "Mortal 3",
    "Mortal 4",
    "Mortal 5",
    "Mortal 6 (Morte Iminente)"
  ];
  const statusStr = woundNames[clamped] || `Nível ${clamped}`;

  room.chatMessages.push({
    id: "msg_health_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `🩸 [MESTRE DE JOGO] alterou o Bio-Monitor de [${player.handle}] para: ${statusStr} (${clamped}/10 Caixas).`,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });

  return { room };
}

// GM Power: Update tactical grid (T1.2 — exige GM legítimo)
export function updateTacticalGrid(
  code: string,
  requesterPeerId: string,
  gridState: TacticalGridState
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode alterar o mapa tático." };
  }

  room.tacticalGrid = gridState;
  return { room };
}

// GM Power: Generate random NPC with complete sheet
export function generateRoomNpc(
  code: string,
  requesterPeerId: string,
  archetypeId?: string
): { room: GameRoom | null; npcPlayer?: RoomPlayer; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode gerar NPCs." };
  }

  const sheet = generateRandomNpc(archetypeId);
  const npcPlayer: RoomPlayer = {
    peerId: sheet.id,
    handle: sheet.handle,
    role: sheet.role,
    sheet,
    isOnline: true,
    joinedAt: new Date().toISOString()
  };

  if (!room.npcs) {
    room.npcs = {};
  }
  room.npcs[sheet.id] = npcPlayer;

  // Auto-spawn NPC token in Tactical Grid if present
  if (room.tacticalGrid) {
    const freeX = (Object.keys(room.npcs).length + 3) % room.tacticalGrid.cols;
    const freeY = Math.floor(room.tacticalGrid.rows / 2);
    room.tacticalGrid.tokens.push({
      id: `npc_token_${sheet.id}`,
      name: sheet.handle,
      type: "npc",
      x: freeX,
      y: freeY,
      peerId: sheet.id,
      role: sheet.role,
      hp: sheet.woundLevel,
      color: "#ef4444"
    });
  }

  room.chatMessages.push({
    id: "msg_npc_gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `💀 [MESTRE DE JOGO] gerou o NPC [${sheet.handle}] (${sheet.role} - Ref Nvl ${sheet.stats.REF}) e o inseriu no mapa tático!`,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });

  return { room, npcPlayer };
}

// GM Power: Generate random Player Edgerunner sheet
export function generateRoomPlayerEdgerunner(
  code: string,
  requesterPeerId: string
): { room: GameRoom | null; player?: RoomPlayer; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode gerar Edgerunners." };
  }

  const sheet = generateRandomNpc();
  const edgerunnerPlayer: RoomPlayer = {
    peerId: "edgerunner_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    handle: sheet.handle,
    role: sheet.role,
    sheet,
    isOnline: true,
    joinedAt: new Date().toISOString()
  };

  room.players[edgerunnerPlayer.peerId] = edgerunnerPlayer;

  if (room.tacticalGrid) {
    const freeX = Object.keys(room.players).length % room.tacticalGrid.cols;
    const freeY = 1;
    room.tacticalGrid.tokens.push({
      id: `token_${edgerunnerPlayer.peerId}`,
      name: edgerunnerPlayer.handle,
      type: "player",
      x: freeX,
      y: freeY,
      peerId: edgerunnerPlayer.peerId,
      role: edgerunnerPlayer.role,
      hp: edgerunnerPlayer.sheet.woundLevel || 0,
      color: "#06b6d4"
    });
  }

  room.chatMessages.push({
    id: "msg_edgerunner_gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `⚡ [MESTRE DE JOGO] gerou uma nova ficha de Edgerunner aleatória [${sheet.handle}] (${sheet.role}) para a mesa!`,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  });

  return { room, player: edgerunnerPlayer };
}

// GM Power: Delete NPC from room
export function deleteRoomNpc(
  code: string,
  requesterPeerId: string,
  npcId: string
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode remover NPCs." };
  }

  let removedHandle = "";

  const npcs = room.npcs;
  if (npcs) {
    // Find matching NPC by key, peerId, sheet.id or handle
    const targetKey = Object.keys(npcs).find(
      key => key === npcId ||
             npcs[key].peerId === npcId ||
             npcs[key].sheet?.id === npcId ||
             npcs[key].handle.toLowerCase() === npcId.toLowerCase()
    );

    if (targetKey && npcs[targetKey]) {
      removedHandle = npcs[targetKey].handle;
      delete npcs[targetKey];
    }
  }

  // Clean up tokens from tactical grid regardless of whether key was in room.npcs
  if (room.tacticalGrid) {
    const initialCount = room.tacticalGrid.tokens.length;
    room.tacticalGrid.tokens = room.tacticalGrid.tokens.filter(
      t => t.peerId !== npcId &&
           t.id !== npcId &&
           t.id !== `npc_token_${npcId}`
    );
    if (initialCount !== room.tacticalGrid.tokens.length && !removedHandle) {
      removedHandle = npcId;
    }
  }

  // Clean up initiative list
  room.initiativeList = room.initiativeList.filter(
    i => i.playerId !== npcId
  );

  if (removedHandle) {
    room.chatMessages.push({
      id: "msg_npc_del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      senderHandle: "SISTEMA_NET",
      senderRole: "gm",
      text: `🗑️ [MESTRE DE JOGO] removeu o NPC [${removedHandle}] da mesa de jogo.`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
  }

  return { room };
}

// GM Power: Delete GM-generated player sheet
export function deleteGeneratedPlayer(
  code: string,
  requesterPeerId: string,
  targetPeerId: string
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode remover Edgerunners." };
  }

  if (room.players) {
    const targetKey = Object.keys(room.players).find(
      key => key === targetPeerId ||
             room.players[key].peerId === targetPeerId ||
             room.players[key].sheet?.id === targetPeerId
    );

    if (targetKey && room.players[targetKey]) {
      const playerObj = room.players[targetKey];
      const handle = playerObj.handle;
      const actualPeerId = playerObj.peerId || targetKey;

      delete room.players[targetKey];

      if (room.tacticalGrid) {
        room.tacticalGrid.tokens = room.tacticalGrid.tokens.filter(
          t => t.peerId !== targetPeerId &&
               t.peerId !== actualPeerId &&
               t.id !== `token_${targetPeerId}` &&
               t.id !== `token_${actualPeerId}` &&
               t.id !== targetKey
        );
      }

      room.initiativeList = room.initiativeList.filter(
        i => i.playerId !== targetPeerId && i.playerId !== actualPeerId && i.playerId !== targetKey
      );

      room.chatMessages.push({
        id: "msg_plr_del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        senderHandle: "SISTEMA_NET",
        senderRole: "gm",
        text: `🗑️ [MESTRE DE JOGO] removeu a ficha do Edgerunner [${handle}] da mesa.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      });
    }
  }

  return { room };
}

// GM Power: Update NPC Wound Level
export function updateNpcWoundLevel(
  code: string,
  requesterPeerId: string,
  npcId: string,
  woundLevel: number
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode alterar o estado do Bio-Monitor de NPCs." };
  }

  if (!room.npcs || !room.npcs[npcId]) {
    return { room: null, error: "NPC não encontrado." };
  }

  const npc = room.npcs[npcId];
  const clamped = Math.max(0, Math.min(10, woundLevel));
  npc.sheet.woundLevel = clamped;

  if (room.tacticalGrid) {
    const token = room.tacticalGrid.tokens.find(t => t.peerId === npcId || t.id === `npc_token_${npcId}`);
    if (token) token.hp = clamped;
  }

  return { room };
}

// Chat da mesa — handle e role derivados do servidor (anti-spoofing)
export function postChatMessage(
  code: string,
  requesterPeerId: string,
  text: string,
  rollResult?: RollResult
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  const player = room.players[requesterPeerId];
  if (!player) return { room: null, error: "Jogador não está na mesa." };

  const safeText = sanitizeText(text, 500);
  if (!safeText && !rollResult) return { room: null, error: "Mensagem vazia" };

  const newMsg: ChatMessage = {
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    senderHandle: player.handle,
    senderRole: requesterPeerId === room.gmPeerId ? "gm" : "player",
    text: safeText,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    isDiceRoll: !!rollResult,
    rollResult
  };

  room.chatMessages.push(newMsg);
  // Keep last 100 messages
  if (room.chatMessages.length > 100) {
    room.chatMessages.shift();
  }

  return { room };
}

// GM Power: Update room atmosphere/combat modifiers (T1.3)
export function updateRoomSettings(
  code: string,
  requesterPeerId: string,
  locationName?: string,
  combatModifier?: number,
  modifierReason?: string
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode alterar as condições da mesa." };
  }

  if (locationName !== undefined) room.locationName = sanitizeText(locationName, 60) || room.locationName;
  if (combatModifier !== undefined) {
    const v = Number(combatModifier);
    room.combatModifier = Number.isFinite(v) ? Math.max(-10, Math.min(10, Math.round(v))) : 0;
  }
  if (modifierReason !== undefined) room.modifierReason = sanitizeText(modifierReason, 120) || room.modifierReason;

  return { room };
}

// GM Power: Update or replace initiative list (T1.3)
export function updateInitiative(code: string, requesterPeerId: string, initiativeList: InitiativeEntry[]): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode editar a ordem de iniciativa." };
  }

  if (!Array.isArray(initiativeList)) return { room: null, error: "Lista de iniciativa inválida" };

  room.initiativeList = initiativeList
    .map(e => ({
      ...e,
      handle: sanitizeText(e?.handle, 30) || "—",
      score: Math.max(0, Math.min(999, Number(e?.score) || 0))
    }))
    .slice(0, 50);
  room.activeTurnIndex = 0;
  return { room };
}

// GM Power: Advance to next turn (T1.3)
export function nextTurn(code: string, requesterPeerId: string): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode avançar o turno." };
  }

  if (room.initiativeList.length === 0) return { room };

  room.activeTurnIndex = (room.activeTurnIndex + 1) % room.initiativeList.length;
  room.initiativeList = room.initiativeList.map((item, idx) => ({
    ...item,
    isCurrentTurn: idx === room.activeTurnIndex
  }));

  return { room };
}

// Sair da mesa — T1.8: se o GM sair, transfere o cargo ou limpa gmPeerId
export function leaveRoom(code: string, peerId: string): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  const wasGm = room.gmPeerId === peerId;
  const player = room.players[peerId];

  if (player) {
    const playerHandle = player.handle;
    delete room.players[peerId];

    // Remove the player's token from the tactical grid (avoid orphan tokens)
    if (room.tacticalGrid) {
      room.tacticalGrid.tokens = room.tacticalGrid.tokens.filter(
        t => t.peerId !== peerId && t.id !== `token_${peerId}`
      );
    }

    // Remove player from initiative list if present
    room.initiativeList = room.initiativeList.filter(i => i.playerId !== peerId);
    if (room.initiativeList.length === 0) {
      room.activeTurnIndex = 0;
    } else if (room.activeTurnIndex >= room.initiativeList.length) {
      room.activeTurnIndex = 0;
      room.initiativeList[0].isCurrentTurn = true;
    }

    // T1.8 — GM abandonou a mesa
    if (wasGm) {
      const remainingOnline = Object.values(room.players).filter(p => p.isOnline);
      if (remainingOnline.length > 0) {
        const newGm = remainingOnline[0];
        room.gmPeerId = newGm.peerId;
        room.gmHandle = newGm.handle;
        room.chatMessages.push({
          id: "msg_gm_transfer_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `👑 [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. [${newGm.handle}] assumiu como novo Mestre de Jogo!`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        });
      } else {
        room.gmPeerId = undefined;
        room.chatMessages.push({
          id: "msg_gm_left_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `⚠️ [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. A mesa aguarda um novo Mestre de Jogo.`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        });
      }
    }

    room.chatMessages.push({
      id: "msg_leave_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      senderHandle: "SISTEMA_NET",
      senderRole: "gm",
      text: `🔌 Edgerunner [${playerHandle}] desconectou-se da mesa.`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
  }

  revokeSessionsForPeer(code, peerId);

  // Mesa vazia → encerrar a sala e revogar todas as sessões (evita salas órfãs no lobby)
  if (Object.keys(room.players).length === 0) {
    deleteRoom(code);
    return { room: null, error: "Sala encerrada — nenhum jogador restante." };
  }

  return { room };
}

export function getAllActiveRooms(): { code: string; name: string; gmHandle: string; playersCount: number }[] {
  return Object.values(rooms).map(r => ({
    code: r.code,
    name: r.name,
    gmHandle: r.gmHandle,
    playersCount: Object.keys(r.players).length
  }));
}
