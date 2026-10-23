// ==========================================================================
// O GERENCIADOR DE SALAS — o barril
// ==========================================================================
// L.3b (E.18): o que morava aqui (1.732 linhas) está em `server/room/`, um
// módulo por assunto, sem ciclo: `sessions` e `wounds` não dependem de nada;
// `rooms` (o mapa, a chave, os tetos, a presença) só das sessões; `chat` das
// salas; `combat` das salas, do chat e do ferimento; `seats` e `gmPowers` por
// cima. Este arquivo reexporta o mesmo que exportava antes do corte — o
// `server.ts`, as rotas e os testes importam daqui.
export { sanitizeText, isValidRoomCode, isValidPeerId, MAX_ROOMS, MAX_NPCS_PER_ROOM, MAX_SHEET_BYTES, roomsAtCapacity, roomNpcsFull, sheetTooLarge, ROOM_OFFLINE_TIMEOUT_MS, touchPlayer, ROOM_ABANDONED_TIMEOUT_MS, isRoomAbandoned, collectAbandonedRooms, markStalePlayersOffline, getRoom, restoreRoom, getRoomPublicSummary, getAllActiveRooms, type RoomResult, type RoomPublicSummary } from "./room/rooms.js";
export { verifySession, exportRoomSessions, restoreRoomSessions } from "./room/sessions.js";
export { MAX_CHAT_MESSAGES, CHAT_TIME_ZONE, chatTime, postChatMessage } from "./room/chat.js";
export { createRoom, seatClaimRefusal, MAX_SEATS_PER_ROOM, roomIsFullFor, joinRoom, updatePlayerSheet, wasRemovedByGm, leaveRoom } from "./room/seats.js";
export { updatePlayerWoundLevel, updateTacticalGrid, generateRoomNpc, generateRoomPlayerEdgerunner, deleteRoomNpc, deleteGeneratedPlayer, updateNpcWoundLevel, updateRoomSettings } from "./room/gmPowers.js";
export { serverRng, rollDiceForPlayer, applyDamage, resolveGmAttack, updateInitiative, rollInitiative, nextTurn, setStabilized } from "./room/combat.js";
export { roomKey } from "./room/key.js";
