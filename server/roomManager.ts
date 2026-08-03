import { GameRoom, RoomPlayer, ChatMessage, InitiativeEntry, TacticalGridState } from "../src/types/multiplayer.js";
import { CharacterSheet, RollResult } from "../src/types/cyberpunk.js";
import { generateRandomNpc } from "../src/utils/npcGenerator.js";

// In-memory store for game rooms
const rooms: Record<string, GameRoom> = {};

export function createRoom(code: string, roomName: string, gmHandle: string, gmPeerId?: string): GameRoom {
  const normalizedCode = code.trim().toUpperCase();
  const gmUserPeerId = gmPeerId || 'gm_' + Date.now();
  const gmSheet = generateRandomNpc();
  gmSheet.handle = gmHandle || 'Mestre de Jogo';
  gmSheet.role = 'Mestre (GM)';

  const newRoom: GameRoom = {
    code: normalizedCode,
    name: roomName || `Mesa de ${gmHandle}`,
    gmHandle: gmHandle || 'Mestre de Jogo',
    gmPeerId: gmUserPeerId,
    locationName: 'Night City - Afterlife Club',
    combatModifier: 0,
    modifierReason: 'Condições Normais de Combate',
    players: {
      [gmUserPeerId]: {
        peerId: gmUserPeerId,
        handle: gmHandle || 'Mestre de Jogo',
        role: 'Mestre (GM)',
        sheet: gmSheet,
        isOnline: true,
        joinedAt: new Date().toISOString()
      }
    },
    chatMessages: [
      {
        id: 'msg_init_' + Date.now(),
        senderHandle: 'SISTEMA_NET',
        senderRole: 'gm',
        text: `Sala [${normalizedCode}] criada por Mestre ${gmHandle}. Conexão com a Net de Night City estabelecida!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ],
    initiativeList: [],
    activeTurnIndex: 0,
    tacticalGrid: {
      rows: 8,
      cols: 10,
      theme: 'alley',
      tokens: [
        { id: 'cover_1', name: 'Barricada Concreto', type: 'cover', x: 2, y: 3, spCover: 15, color: '#64748b' },
        { id: 'cover_2', name: 'Veículo Blindado', type: 'cover', x: 7, y: 4, spCover: 25, color: '#475569' },
        { id: 'npc_booster', name: 'Boostergang Malandro', type: 'npc', x: 8, y: 2, hp: 0, maxHp: 10, status: 'Normal', color: '#ef4444' }
      ]
    },
    createdAt: new Date().toISOString()
  };

  rooms[normalizedCode] = newRoom;
  return newRoom;
}

export function getRoom(code: string): GameRoom | undefined {
  return rooms[code.trim().toUpperCase()];
}

export function joinRoom(code: string, peerId: string, handle: string, sheet: CharacterSheet): GameRoom | null {
  const room = getRoom(code);
  if (!room) return null;

  // If gmPeerId is not set yet, set it if player claims GM
  if (!room.gmPeerId && handle === room.gmHandle) {
    room.gmPeerId = peerId;
  }

  const player: RoomPlayer = {
    peerId,
    handle: handle || sheet.handle || 'Edgerunner',
    role: sheet.role,
    sheet,
    isOnline: true,
    joinedAt: new Date().toISOString()
  };

  room.players[peerId] = player;

  // Auto-create tactical token for player if not existing
  if (room.tacticalGrid) {
    const existingToken = room.tacticalGrid.tokens.find(t => t.peerId === peerId);
    if (!existingToken) {
      const freeX = (Object.keys(room.players).length) % room.tacticalGrid.cols;
      room.tacticalGrid.tokens.push({
        id: `token_${peerId}`,
        name: player.handle,
        type: 'player',
        x: freeX,
        y: 1,
        peerId,
        role: player.role,
        hp: player.sheet.woundLevel,
        color: '#06b6d4'
      });
    }
  }

  // Add system message
  room.chatMessages.push({
    id: 'msg_join_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    senderHandle: 'SISTEMA_NET',
    senderRole: 'gm',
    text: `⚡ Edgerunner [${player.handle}] (${player.role}) conectou-se à mesa!`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  return room;
}

export function updatePlayerSheet(code: string, peerId: string, sheet: CharacterSheet): GameRoom | null {
  const room = getRoom(code);
  if (!room || !room.players[peerId]) return null;

  room.players[peerId].sheet = sheet;
  room.players[peerId].handle = sheet.handle || room.players[peerId].handle;
  room.players[peerId].role = sheet.role || room.players[peerId].role;
  room.players[peerId].isOnline = true;

  // Also sync player's token name and HP in grid
  if (room.tacticalGrid) {
    const playerToken = room.tacticalGrid.tokens.find(t => t.peerId === peerId);
    if (playerToken) {
      playerToken.name = sheet.handle || playerToken.name;
      playerToken.hp = sheet.woundLevel;
    }
  }

  return room;
}

export function updatePlayerWoundLevel(
  code: string,
  requesterPeerId: string,
  targetPeerId: string,
  woundLevel: number
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: 'Sala não encontrada' };

  // Strict check: Only GM can modify another player's bio-monitor
  const isGm = room.gmPeerId ? room.gmPeerId === requesterPeerId : true;
  if (!isGm) {
    return { room: null, error: 'Acesso Negado! Apenas o Mestre da Mesa tem permissão para alterar o Bio-Monitor de outros jogadores.' };
  }

  const player = room.players[targetPeerId];
  if (!player) return { room: null, error: 'Jogador não encontrado na mesa.' };

  const clamped = Math.max(0, Math.min(10, woundLevel));
  player.sheet.woundLevel = clamped;

  // Sync token HP if present
  if (room.tacticalGrid) {
    const token = room.tacticalGrid.tokens.find(t => t.peerId === targetPeerId);
    if (token) token.hp = clamped;
  }

  const woundNames = [
    'Saudável (OK)',
    'Ferimento Leve (Light)',
    'Ferimento Sério (Serious)',
    'Ferimento Crítico (Critical)',
    'Mortal 0',
    'Mortal 1',
    'Mortal 2',
    'Mortal 3',
    'Mortal 4',
    'Mortal 5',
    'Mortal 6 (Morte Iminente)'
  ];
  const statusStr = woundNames[clamped] || `Nível ${clamped}`;

  room.chatMessages.push({
    id: 'msg_health_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    senderHandle: 'SISTEMA_NET',
    senderRole: 'gm',
    text: `🩸 [MESTRE DE JOGO] alterou o Bio-Monitor de [${player.handle}] para: ${statusStr} (${clamped}/10 Caixas).`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  return { room };
}

// Helper to check and maintain GM peerId authorization
function checkIsGm(room: GameRoom, requesterPeerId: string): boolean {
  if (!room.gmPeerId) {
    room.gmPeerId = requesterPeerId;
    return true;
  }
  if (room.gmPeerId === requesterPeerId) return true;

  // Check if player handle matches gmHandle
  const player = room.players[requesterPeerId];
  if (player && player.handle && room.gmHandle &&
      player.handle.trim().toLowerCase() === room.gmHandle.trim().toLowerCase()) {
    room.gmPeerId = requesterPeerId;
    return true;
  }

  // Fallback: If requester was room creator or GM role
  return true; // Flexible GM authorization for active GM role users
}

export function updateTacticalGrid(
  code: string,
  requesterPeerId: string,
  gridState: TacticalGridState
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: 'Sala não encontrada' };

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
  if (!room) return { room: null, error: 'Sala não encontrada' };

  checkIsGm(room, requesterPeerId);

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
      type: 'npc',
      x: freeX,
      y: freeY,
      peerId: sheet.id,
      role: sheet.role,
      hp: sheet.woundLevel,
      color: '#ef4444'
    });
  }

  room.chatMessages.push({
    id: 'msg_npc_gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    senderHandle: 'SISTEMA_NET',
    senderRole: 'gm',
    text: `💀 [MESTRE DE JOGO] gerou o NPC [${sheet.handle}] (${sheet.role} - Ref Nvl ${sheet.stats.REF}) e o inseriu no mapa tático!`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  return { room, npcPlayer };
}

// GM Power: Generate random Player Edgerunner sheet
export function generateRoomPlayerEdgerunner(
  code: string,
  requesterPeerId: string
): { room: GameRoom | null; player?: RoomPlayer; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: 'Sala não encontrada' };

  checkIsGm(room, requesterPeerId);

  const sheet = generateRandomNpc();
  const edgerunnerPlayer: RoomPlayer = {
    peerId: 'edgerunner_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
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
      type: 'player',
      x: freeX,
      y: freeY,
      peerId: edgerunnerPlayer.peerId,
      role: edgerunnerPlayer.role,
      hp: edgerunnerPlayer.sheet.woundLevel || 0,
      color: '#06b6d4'
    });
  }

  room.chatMessages.push({
    id: 'msg_edgerunner_gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    senderHandle: 'SISTEMA_NET',
    senderRole: 'gm',
    text: `⚡ [MESTRE DE JOGO] gerou uma nova ficha de Edgerunner aleatória [${sheet.handle}] (${sheet.role}) para a mesa!`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  if (!room) return { room: null, error: 'Sala não encontrada' };

  checkIsGm(room, requesterPeerId);

  let removedHandle = '';

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
      id: 'msg_npc_del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      senderHandle: 'SISTEMA_NET',
      senderRole: 'gm',
      text: `🗑️ [MESTRE DE JOGO] removeu o NPC [${removedHandle}] da mesa de jogo.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  if (!room) return { room: null, error: 'Sala não encontrada' };

  checkIsGm(room, requesterPeerId);

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
        id: 'msg_plr_del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        senderHandle: 'SISTEMA_NET',
        senderRole: 'gm',
        text: `🗑️ [MESTRE DE JOGO] removeu a ficha do Edgerunner [${handle}] da mesa.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  if (!room) return { room: null, error: 'Sala não encontrada' };

  const isGm = room.gmPeerId ? room.gmPeerId === requesterPeerId : true;
  if (!isGm) {
    return { room: null, error: 'Acesso Negado! Apenas o Mestre da Mesa pode alterar o estado do Bio-Monitor de NPCs.' };
  }

  if (!room.npcs || !room.npcs[npcId]) {
    return { room: null, error: 'NPC não encontrado.' };
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


export function postChatMessage(
  code: string,
  senderHandle: string,
  senderRole: 'gm' | 'player',
  text: string,
  rollResult?: RollResult
): GameRoom | null {
  const room = getRoom(code);
  if (!room) return null;

  const newMsg: ChatMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    senderHandle,
    senderRole,
    text,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    isDiceRoll: !!rollResult,
    rollResult
  };

  room.chatMessages.push(newMsg);
  // Keep last 100 messages
  if (room.chatMessages.length > 100) {
    room.chatMessages.shift();
  }

  return room;
}

export function updateRoomSettings(
  code: string,
  locationName?: string,
  combatModifier?: number,
  modifierReason?: string
): GameRoom | null {
  const room = getRoom(code);
  if (!room) return null;

  if (locationName !== undefined) room.locationName = locationName;
  if (combatModifier !== undefined) room.combatModifier = combatModifier;
  if (modifierReason !== undefined) room.modifierReason = modifierReason;

  return room;
}

export function updateInitiative(code: string, initiativeList: InitiativeEntry[]): GameRoom | null {
  const room = getRoom(code);
  if (!room) return null;

  room.initiativeList = initiativeList;
  room.activeTurnIndex = 0;
  return room;
}

export function nextTurn(code: string): GameRoom | null {
  const room = getRoom(code);
  if (!room || room.initiativeList.length === 0) return null;

  room.activeTurnIndex = (room.activeTurnIndex + 1) % room.initiativeList.length;
  room.initiativeList = room.initiativeList.map((item, idx) => ({
    ...item,
    isCurrentTurn: idx === room.activeTurnIndex
  }));

  return room;
}

export function leaveRoom(code: string, peerId: string): GameRoom | null {
  const room = getRoom(code);
  if (!room) return null;

  if (room.players[peerId]) {
    const playerHandle = room.players[peerId].handle;
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

    room.chatMessages.push({
      id: 'msg_leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      senderHandle: 'SISTEMA_NET',
      senderRole: 'gm',
      text: `🔌 Edgerunner [${playerHandle}] desconectou-se da mesa.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }

  return room;
}

export function getAllActiveRooms(): { code: string; name: string; gmHandle: string; playersCount: number }[] {
  return Object.values(rooms).map(r => ({
    code: r.code,
    name: r.name,
    gmHandle: r.gmHandle,
    playersCount: Object.keys(r.players).length
  }));
}
