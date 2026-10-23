// L.3b (E.18) — Os poderes do Mestre fora do combate: o grid, os NPCs e as fichas geradas, as remoções, o ferimento manual e as condições da cena.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import { RoomPlayer } from "../../src/types/multiplayer.js";
import { generateRandomNpc } from "../../src/utils/npcGenerator.js";
import { woundRow } from "../../src/rules/character.js";
import { woundStateOf } from "../../src/rules/damage.js";
import { WOUND_TRACK_POINTS } from "../../src/rules/tables.js";
import { gridChangeProblem, normalizeGridInput } from "../../src/lib/gridDoc.js";
import { fail } from "../errors.js";
import { MAX_NPCS_PER_ROOM, RoomResult, checkIsGm, getRoom, roomNpcsFull, sanitizeText } from "./rooms.js";
import { revokeSessionsForPeer } from "./sessions.js";
import { chatTime, pushChat, pushSystemMessage } from "./chat.js";
import { manualWoundLevel, writeWound } from "./wounds.js";
import { MAX_SEATS_PER_ROOM, rememberRemoved } from "./seats.js";
import { removeFromInitiative } from "./combat.js";

export function updatePlayerWoundLevel(
  code: string,
  requesterPeerId: string,
  targetPeerId: string,
  woundLevel: number
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  // Strict check: Only GM can modify another player's bio-monitor
  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa tem permissão para alterar o Bio-Monitor de outros jogadores.");
  }

  const player = room.players[targetPeerId];
  if (!player) return fail("target_not_found", "Jogador não encontrado na mesa.");

  const clamped = manualWoundLevel(woundLevel);
  writeWound(player.sheet, { ...woundStateOf({ woundLevel: clamped }), isDead: player.sheet.isDead === true });

  // Sync token HP if present
  if (room.tacticalGrid) {
    const token = room.tacticalGrid.tokens.find(t => t.peerId === targetPeerId);
    if (token) token.hp = clamped;
  }

  // Os nomes vêm da trilha do livro (WOUND_TRACK) — a lista própria que
  // morava aqui duplicava a tabela. Desde a D.1 a trilha conta pontos.
  pushSystemMessage(
    room,
    "health",
    `🩸 [MESTRE DE JOGO] alterou o Bio-Monitor de [${player.handle}] para: ${woundRow(clamped).name} (${player.sheet.damagePoints}/${WOUND_TRACK_POINTS} pontos).`
  );

  return { room };
}

// GM Power: Update tactical grid (T1.2 — exige GM legítimo)
export function updateTacticalGrid(
  code: string,
  requesterPeerId: string,
  gridState: unknown
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode alterar o mapa tático.");
  }

  // E.02 (SEC-14) — o grid era gravado como veio. Um `tokens: 5` travava a
  // sala e, pelo vigia de presença, derrubava o processo. Agora ele é montado
  // campo a campo e conferido (a mesma regra da porta Yjs, em src/lib/gridDoc).
  const grid = normalizeGridInput(gridState);
  const prev = room.tacticalGrid ?? { rows: 8, cols: 10, theme: "alley", tokens: [] };
  const problem = grid ? gridChangeProblem(prev, grid) : "o mapa precisa de uma lista de tokens";
  if (!grid || problem) {
    return fail("invalid_grid", `Mapa tático inválido: ${problem}.`);
  }
  room.tacticalGrid = grid;
  return { room };
}

// GM Power: Generate random NPC with complete sheet
export function generateRoomNpc(
  code: string,
  requesterPeerId: string,
  archetypeId?: string
): RoomResult<{ npcPlayer: RoomPlayer }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode gerar NPCs.");
  }
  // E.03 (SEC-15) — cada NPC é uma ficha a mais em todo reenvio da sala.
  if (roomNpcsFull(room.code)) {
    return fail("npcs_full", `A mesa já tem ${MAX_NPCS_PER_ROOM} NPCs. Remova algum para gerar outro.`);
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

  pushChat(room, {
    id: "msg_npc_gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `💀 [MESTRE DE JOGO] gerou o NPC [${sheet.handle}] (${sheet.role} - Ref Nvl ${sheet.stats.REF}) e o inseriu no mapa tático!`,
    timestamp: chatTime()
  });

  return { room, npcPlayer };
}

// GM Power: Generate random Player Edgerunner sheet
export function generateRoomPlayerEdgerunner(
  code: string,
  requesterPeerId: string
): RoomResult<{ player: RoomPlayer }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode gerar Edgerunners.");
  }
  // R.16 (SEC-13) — ficha gerada ocupa assento como qualquer outro.
  if (Object.keys(room.players).length >= MAX_SEATS_PER_ROOM) {
    return fail("room_full", `A mesa está cheia (${MAX_SEATS_PER_ROOM} lugares). Remova alguém para gerar outra ficha.`);
  }

  const sheet = generateRandomNpc();
  const edgerunnerPlayer: RoomPlayer = {
    peerId: "edgerunner_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    handle: sheet.handle,
    role: sheet.role,
    sheet,
    isOnline: true,
    joinedAt: new Date().toISOString(),
    // T3.4 — sem lastActiveAt, o primeiro sweep marcaria o edgerunner OFFLINE
    // (now - 0 > timeout) apesar de ter acabado de ser gerado pelo GM.
    lastActiveAt: new Date().toISOString()
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

  pushChat(room, {
    id: "msg_edgerunner_gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text: `⚡ [MESTRE DE JOGO] gerou uma nova ficha de Edgerunner aleatória [${sheet.handle}] (${sheet.role}) para a mesa!`,
    timestamp: chatTime()
  });

  return { room, player: edgerunnerPlayer };
}

// GM Power: Delete NPC from room
export function deleteRoomNpc(
  code: string,
  requesterPeerId: string,
  npcId: string
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode remover NPCs.");
  }

  let removedHandle = "";
  // E.3d — os ids do NPC achado: a iniciativa o guarda pelo peerId, e a rota
  // pode ter recebido o nome. Filtrar só pelo que chegou deixava a entrada.
  const removedIds = new Set<string>([npcId]);

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
      removedIds.add(targetKey);
      if (npcs[targetKey].peerId) removedIds.add(npcs[targetKey].peerId);
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
  if (removedHandle) {
    pushChat(room, {
      id: "msg_npc_del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      senderHandle: "SISTEMA_NET",
      senderRole: "gm",
      text: `🗑️ [MESTRE DE JOGO] removeu o NPC [${removedHandle}] da mesa de jogo.`,
      timestamp: chatTime()
    });
  }

  // Depois do aviso: se a vez passar, o death save do turno vem em seguida no chat.
  removeFromInitiative(room, (e) => removedIds.has(e.playerId));

  return { room };
}

// GM Power: Delete GM-generated player sheet
export function deleteGeneratedPlayer(
  code: string,
  requesterPeerId: string,
  targetPeerId: string
): RoomResult<{ removedPeerId?: string }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode remover Edgerunners.");
  }

  let removedPeerId: string | undefined;
  if (room.players) {
    const targetKey = Object.keys(room.players).find(
      key => key === targetPeerId ||
             room.players[key].peerId === targetPeerId ||
             room.players[key].sheet?.id === targetPeerId
    );

    // R.3 — desde que remover revoga e barra a volta, o GM se removendo ficaria
    // trancado fora da própria mesa. A tela já não oferece; o servidor recusa.
    if (targetKey && targetKey === requesterPeerId) {
      return fail("not_allowed", "Acesso Negado! O Mestre não remove a si mesmo — use Sair.");
    }

    if (targetKey && room.players[targetKey]) {
      const playerObj = room.players[targetKey];
      const handle = playerObj.handle;
      const actualPeerId = playerObj.peerId || targetKey;

      delete room.players[targetKey];

      // R.3 (SEC-09) — remover tira o ACESSO, não só o assento. Antes o
      // expulso seguia com sessão: reabria o socket e lia a mesa inteira. E a
      // sala lembra quem saiu assim, senão a reconexão automática do cliente
      // (401 → join) o traria de volta em segundos. A rota fecha os sockets.
      revokeSessionsForPeer(room.code, actualPeerId);
      if (targetKey !== actualPeerId) revokeSessionsForPeer(room.code, targetKey);
      rememberRemoved(room, actualPeerId);
      removedPeerId = actualPeerId;

      if (room.tacticalGrid) {
        room.tacticalGrid.tokens = room.tacticalGrid.tokens.filter(
          t => t.peerId !== targetPeerId &&
               t.peerId !== actualPeerId &&
               t.id !== `token_${targetPeerId}` &&
               t.id !== `token_${actualPeerId}` &&
               t.id !== targetKey
        );
      }

      pushChat(room, {
        id: "msg_plr_del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        senderHandle: "SISTEMA_NET",
        senderRole: "gm",
        text: `🗑️ [MESTRE DE JOGO] removeu a ficha do Edgerunner [${handle}] da mesa.`,
        timestamp: chatTime()
      });

      removeFromInitiative(room, (e) => e.playerId === targetPeerId || e.playerId === actualPeerId || e.playerId === targetKey);
    }
  }

  return { room, removedPeerId };
}

// GM Power: Update NPC Wound Level
export function updateNpcWoundLevel(
  code: string,
  requesterPeerId: string,
  npcId: string,
  woundLevel: number
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode alterar o estado do Bio-Monitor de NPCs.");
  }

  if (!room.npcs || !room.npcs[npcId]) {
    return fail("target_not_found", "NPC não encontrado.");
  }

  const npc = room.npcs[npcId];
  const clamped = manualWoundLevel(woundLevel);
  writeWound(npc.sheet, { ...woundStateOf({ woundLevel: clamped }), isDead: npc.sheet.isDead === true });

  if (room.tacticalGrid) {
    const token = room.tacticalGrid.tokens.find(t => t.peerId === npcId || t.id === `npc_token_${npcId}`);
    if (token) token.hp = clamped;
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
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode alterar as condições da mesa.");
  }

  if (locationName !== undefined) room.locationName = sanitizeText(locationName, 60) || room.locationName;
  if (combatModifier !== undefined) {
    const v = Number(combatModifier);
    room.combatModifier = Number.isFinite(v) ? Math.max(-10, Math.min(10, Math.round(v))) : 0;
  }
  // K.3b — o motivo é o que veio, até vazio: a tela do GM o manda sempre, e
  // apagá-lo tem de apagar. O local vazio, não: a mesa sempre tem um.
  if (modifierReason !== undefined) room.modifierReason = sanitizeText(modifierReason, 120);

  return { room };
}
