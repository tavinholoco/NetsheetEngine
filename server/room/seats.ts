// L.3b (E.18) — Os assentos: criar a sala (o assento do Mestre), entrar com a prova de posse (R.1), o teto de assentos (R.16), os removidos pelo GM (R.3), a ficha que o jogador sincroniza e a saída.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import { GameRoom, RoomPlayer } from "../../src/types/multiplayer.js";
import { CharacterSheet } from "../../src/types/cyberpunk.js";
import { generateRandomNpc } from "../../src/utils/npcGenerator.js";
import { sanitizeCharacterSheet } from "../../src/rules/sheetSchema.js";
import { fail } from "../errors.js";
import { logger } from "../logger.js";
import { MAX_REMOVED_PEERS, MAX_ROOMS, MAX_SHEET_BYTES, RoomResult, deleteRoom, getRoom, isValidPeerId, rooms, roomsAtCapacity, sanitizeText, sheetBytes } from "./rooms.js";
import { bindSession, revokeSessionsForPeer, verifySession } from "./sessions.js";
import { chatTime, pushChat } from "./chat.js";
import { withServerWound } from "./wounds.js";
import { removeFromInitiative } from "./combat.js";
import { roomKey } from "./key.js";

export function createRoom(code: string, roomName: string, gmHandle: string, gmPeerId?: string): { room: GameRoom; sessionToken: string } {
  const normalizedCode = roomKey(code);
  // R.2 (SEC-08) — criar nunca sobrescreve. Antes, `rooms[code] = novaSala`
  // apagava a mesa de quem já estava nela, e qualquer um tinha o código pelo
  // lobby. A rota responde 409 antes de chegar aqui; isto é a defesa para
  // qualquer caminho futuro — chegar aqui com código em uso é bug.
  if (rooms[normalizedCode]) {
    throw new Error(`Sala ${normalizedCode} já existe — criar não sobrescreve (R.2).`);
  }
  // E.03 (SEC-15) — mesma defesa: a rota responde 503 antes de chegar aqui.
  if (roomsAtCapacity()) {
    throw new Error(`Teto de ${MAX_ROOMS} salas atingido (E.03).`);
  }
  // I.03 (SEC-16) — a rota recusa antes (400); fora do formato, o servidor gera.
  const gmUserPeerId = isValidPeerId(gmPeerId) ? gmPeerId : "gm_" + Date.now().toString(36);
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
    // K.3b — sem motivo até o GM escrever um: o "Condições Normais de Combate"
    // de antes ia parar no detalhe de um −2 que o GM pôs sem motivo.
    modifierReason: "",
    players: {
      [gmUserPeerId]: {
        peerId: gmUserPeerId,
        handle: safeGmHandle,
        role: "Mestre (GM)",
        sheet: gmSheet,
        isOnline: true,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      }
    },
    chatMessages: [
      {
        id: "msg_init_" + Date.now(),
        senderHandle: "SISTEMA_NET",
        senderRole: "gm",
        text: `Sala [${normalizedCode}] criada por Mestre ${safeGmHandle}. Conexão com a Net de Night City estabelecida!`,
        timestamp: chatTime()
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

/** Ficha "utilizável" = tem handle ou stats (não é placeholder vazio). */
function isUsableSheet(sheet: unknown): boolean {
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return false;
  const s = sheet as Partial<CharacterSheet>;
  return !!s.handle || (!!s.stats && typeof s.stats === "object");
}

/**
 * Revisão pós-D (R.1 — SEC-07) — reivindicar um assento ocupado exige prova.
 *
 * Até aqui, o `join` com um `peerId` que já estava na sala era aceito como
 * reconexão e emitia sessão nova, revogando a do dono. O `peerId` é público
 * (vai no estado da sala), então funcionava como credencial: um convidado
 * lia o `gmPeerId` e virava o Mestre. A prova é o token vigente daquele
 * assento — o mesmo que o cliente já guarda para agir na mesa.
 *
 * "Ocupado" inclui o `gmPeerId` sem jogador (o GM removeu a própria ficha):
 * quem chegasse com ele viraria GM pelo `checkIsGm`.
 *
 * Devolve a mensagem de recusa, ou `null` se o `join` pode seguir. É a única
 * regra: o `joinRoom` a aplica (defesa em todo caminho que emite sessão) e a
 * rota a consulta antes, para responder 409 em vez de 404.
 */
export function seatClaimRefusal(code: string, peerId: string, proofToken?: string): string | null {
  const room = getRoom(code);
  if (!room) return null;
  const safePeerId = sanitizeText(peerId, 64);
  if (!safePeerId) return null;
  const seatTaken = !!room.players[safePeerId] || room.gmPeerId === safePeerId;
  if (!seatTaken) return null;
  if (typeof proofToken === "string" && verifySession(room.code, proofToken) === safePeerId) return null;
  return "Este assento já está ocupado na mesa. Entre como um novo jogador.";
}

/**
 * Revisão pós-D (R.16 — SEC-13) — quantos assentos cabem numa sala. Cada
 * assento abre até 3 sockets (R.4), e cada socket recebe cada reenvio da sala:
 * sem teto, dezenas de `join` multiplicavam a banda do workspace. Uma mesa de
 * CP2020 tem o GM e até ~6–8 jogadores; 16 dá folga para fichas pré-geradas.
 *
 * Conta TODO assento — GM, jogadores e fichas geradas pelo GM. Contar só os
 * "humanos" pelo prefixo do peerId seria contornável: ele vem do cliente.
 */
export const MAX_SEATS_PER_ROOM = 16;

/** A sala está cheia para um assento NOVO? Quem já tem assento sempre volta ao seu. */
export function roomIsFullFor(code: string, peerId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  const safePeerId = sanitizeText(peerId, 64);
  if (safePeerId && room.players[safePeerId]) return false;
  return Object.keys(room.players).length >= MAX_SEATS_PER_ROOM;
}

function pickSheet(clientSheet: CharacterSheet, persistedSheet: CharacterSheet | undefined): CharacterSheet {
  if (!isUsableSheet(clientSheet)) return persistedSheet ?? clientSheet;
  if (!persistedSheet) return clientSheet;
  const clientTs = clientSheet.updatedAt ? new Date(clientSheet.updatedAt).getTime() : 0;
  const persistedTs = persistedSheet.updatedAt ? new Date(persistedSheet.updatedAt).getTime() : 0;
  return clientTs >= persistedTs ? clientSheet : persistedSheet;
}

export function joinRoom(
  code: string,
  peerId: string,
  handle: string,
  sheet: CharacterSheet,
  proofToken?: string
): { room: GameRoom; sessionToken: string } | null {
  const room = getRoom(code);
  if (!room) return null;

  // I.03 (SEC-16) — a rota responde 400 antes; isto é a defesa em todo caminho.
  if (!isValidPeerId(peerId)) return null;
  const safePeerId = peerId;
  // R.3 (SEC-09) — quem o GM removeu não volta pelo mesmo peerId.
  if (wasRemovedByGm(room.code, safePeerId)) return null;
  // R.1 (SEC-07) — assento ocupado só com o token vigente dele.
  if (seatClaimRefusal(room.code, safePeerId, proofToken)) return null;
  // R.16 (SEC-13) — assento novo só se couber.
  if (roomIsFullFor(room.code, safePeerId)) return null;

  // B.2 (SEC-05) — a ficha do join é a primeira coisa que o servidor grava a
  // partir do navegador. Sem isto, atributos e woundLevel entravam verbatim.
  const validated = sanitizeCharacterSheet(sheet);
  if (!validated) return null;
  // E.03 (SEC-15) — a rota responde 413 antes; isto é a defesa em todo caminho.
  if (sheetBytes(validated.sheet) > MAX_SHEET_BYTES) return null;
  if (validated.changed.length > 0) {
    logger.warn("sheet_sanitized", { at: "joinRoom", code, peerId: safePeerId, fields: validated.changed.slice(0, 20), count: validated.changed.length });
  }
  const safeSheet = validated.sheet;

  const safeHandle = sanitizeText(handle, 30);

  // Se gmPeerId ainda não está definido, quem reivindica o handle do GM assume
  // (comparação trim + case-insensitive, idêntica ao checkIsGm)
  if (!room.gmPeerId && safeHandle && safeHandle.toLowerCase() === room.gmHandle?.toLowerCase()) {
    room.gmPeerId = safePeerId;
  }

  // Fase 3 (T3.3) — RECONEXÃO: mesmo peerId já está na mesa (incl. sala
  // restaurada do banco no boot). Em vez de criar um player novo (que perderia
  // a ficha persistida e duplicaria tokens/mensagens), atualizamos o existente.
  const existing = room.players[safePeerId];
  const isReconnect = !!existing;

  const player: RoomPlayer = existing
    ? {
        ...existing,
        handle: safeHandle || existing.handle || "Edgerunner",
        role: safeSheet.role || existing.role || "Edgerunner",
        // T3.3 — ficha resolvida por last-write-wins (updatedAt): cliente com
        // ficha antiga/estale não sobrescreve a versão mais recente do banco.
        // D.1 — menos o ferimento: esse é sempre o que a mesa já tinha.
        sheet: withServerWound(pickSheet(safeSheet, existing.sheet), existing.sheet),
        isOnline: true,
        // T3.4 — renova lastActiveAt na reconexão: sem isso, um player que
        // voltou de um restart (timestamp velho preservado) seria marcado
        // OFFLINE no próximo sweep antes do primeiro heartbeat.
        lastActiveAt: new Date().toISOString()
      }
    : {
        peerId: safePeerId,
        handle: safeHandle || safeSheet.handle || "Edgerunner",
        role: safeSheet.role || "Edgerunner",
        sheet: safeSheet,
        isOnline: true,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      };

  room.players[safePeerId] = player;

  // Auto-create tactical token for player if not existing (reconexão reutiliza)
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

  // Mensagem de sistema: silenciosa em reconexão (evita spam de "conectou-se"
  // a cada EventSource retry). Só anuncia primeiro join ou reconexão pós-offline.
  if (!isReconnect || !existing.isOnline) {
    pushChat(room, {
      id: "msg_join_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      senderHandle: "SISTEMA_NET",
      senderRole: "gm",
      text: isReconnect
        ? `🔌 Edgerunner [${player.handle}] reconectou-se à mesa!`
        : `⚡ Edgerunner [${player.handle}] (${player.role}) conectou-se à mesa!`,
      timestamp: chatTime()
    });
  }

  // Revoga tokens antigos do mesmo peer (1 sessão ativa por jogador) e emite novo.
  revokeSessionsForPeer(room.code, safePeerId);
  const sessionToken = bindSession(room.code, safePeerId);
  return { room, sessionToken };
}

export function updatePlayerSheet(code: string, peerId: string, sheet: CharacterSheet): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  if (!room.players[peerId]) return fail("not_in_room", "Você não está nesta mesa.");

  // B.2 (SEC-05) — caminho quente do problema: a ficha era gravada verbatim a
  // cada edição. O autor já vinha da sessão (T1.7); o que faltava era conferir
  // o CONTEÚDO. Sem isto, `woundLevel: -999` ou `BODY: 9999` viravam estado da
  // mesa, eram persistidos e transmitidos a todos.
  const validated = sanitizeCharacterSheet(sheet);
  if (!validated) return fail("invalid_input", "Ficha inválida.");
  if (sheetBytes(validated.sheet) > MAX_SHEET_BYTES) {
    return fail("sheet_too_large", `Ficha grande demais (máx. ${MAX_SHEET_BYTES / 1024} KB).`);
  }
  if (validated.changed.length > 0) {
    logger.warn("sheet_sanitized", { at: "updatePlayerSheet", code, peerId, fields: validated.changed.slice(0, 20), count: validated.changed.length });
  }
  // D.1 (decisão 7a) — o ferimento na mesa é do servidor e do GM: o que o
  // cliente mandou em `damagePoints`/`woundLevel`/`isDead` é descartado.
  const safeSheet = withServerWound(validated.sheet, room.players[peerId].sheet);

  room.players[peerId].sheet = safeSheet;
  room.players[peerId].handle = sanitizeText(safeSheet.handle, 30) || room.players[peerId].handle;
  room.players[peerId].role = sanitizeText(safeSheet.role, 30) || room.players[peerId].role;
  room.players[peerId].isOnline = true;

  // Also sync player's token name and HP in grid
  if (room.tacticalGrid) {
    const playerToken = room.tacticalGrid.tokens.find(t => t.peerId === peerId);
    if (playerToken) {
      playerToken.name = safeSheet.handle || playerToken.name;
      playerToken.hp = safeSheet.woundLevel;
    }
  }

  return { room };
}

/** Guarda quem o GM removeu, sem repetir, ficando com os mais recentes. */
export function rememberRemoved(room: GameRoom, peerId: string): void {
  const list = (room.removedPeerIds ?? []).filter((p) => p !== peerId);
  list.push(peerId);
  room.removedPeerIds = list.slice(-MAX_REMOVED_PEERS);
}

/**
 * R.3 (SEC-09) — o GM removeu este peerId da sala? O `join` por ele é recusado
 * (a rota responde 403 `removed_by_gm`). Sem isto, a reconexão automática do
 * cliente desfazia a expulsão. Não é banimento: sem conta, uma aba nova é
 * outro jogador — quem decide se a mesa exige identidade é a R.11.
 */
export function wasRemovedByGm(code: string, peerId: string): boolean {
  const room = getRoom(code);
  const safePeerId = sanitizeText(peerId, 64);
  return !!room && !!safePeerId && (room.removedPeerIds ?? []).includes(safePeerId);
}

// Sair da mesa — T1.8: se o GM sair, transfere o cargo ou limpa gmPeerId
export function leaveRoom(code: string, peerId: string): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

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
    // T1.8 — GM abandonou a mesa
    if (wasGm) {
      const remainingOnline = Object.values(room.players).filter(p => p.isOnline);
      if (remainingOnline.length > 0) {
        const newGm = remainingOnline[0];
        room.gmPeerId = newGm.peerId;
        room.gmHandle = newGm.handle;
        pushChat(room, {
          id: "msg_gm_transfer_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `👑 [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. [${newGm.handle}] assumiu como novo Mestre de Jogo!`,
          timestamp: chatTime()
        });
      } else {
        room.gmPeerId = undefined;
        pushChat(room, {
          id: "msg_gm_left_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `⚠️ [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. A mesa aguarda um novo Mestre de Jogo.`,
          timestamp: chatTime()
        });
      }
    }

    pushChat(room, {
      id: "msg_leave_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      senderHandle: "SISTEMA_NET",
      senderRole: "gm",
      text: `🔌 Edgerunner [${playerHandle}] desconectou-se da mesa.`,
      timestamp: chatTime()
    });

    // E.3d — sai da iniciativa sem pular a vez de ninguém (antes, só o índice
    // que passava do fim era corrigido).
    removeFromInitiative(room, (e) => e.playerId === peerId);
  }

  revokeSessionsForPeer(code, peerId);

  // Mesa vazia → encerrar a sala e revogar todas as sessões (evita salas órfãs no lobby)
  if (Object.keys(room.players).length === 0) {
    deleteRoom(code);
    return fail("room_not_found", "Sala encerrada — nenhum jogador restante.");
  }

  return { room };
}
