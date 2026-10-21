/**
 * L.1 (ARQ-01) — aplica a diferença da sala que o servidor manda.
 * O lado do servidor é o `server/roomDelta.ts`; os dois andam juntos, e o
 * `room-delta.test` confere a ida e volta. Devolve uma sala NOVA: a store troca
 * o objeto, e o que não mudou é o mesmo objeto de antes (React compara por
 * referência).
 */
import type { GameRoom, RoomPatchMessage, RoomPlayer } from '../types/multiplayer';

function applyEntries(
  current: Record<string, RoomPlayer> | undefined,
  changes: Record<string, RoomPlayer | null>
): Record<string, RoomPlayer> {
  const next = { ...(current ?? {}) };
  for (const [id, entry] of Object.entries(changes)) {
    if (entry === null) delete next[id];
    else next[id] = entry;
  }
  return next;
}

export function applyRoomPatch(room: GameRoom, patch: RoomPatchMessage): GameRoom {
  const next: GameRoom = { ...room, ...(patch.set ?? {}) };
  for (const key of patch.unset ?? []) delete (next as unknown as Record<string, unknown>)[key];
  if (patch.players) next.players = applyEntries(room.players, patch.players);
  if (patch.npcs) next.npcs = applyEntries(room.npcs, patch.npcs);
  if (patch.chat) {
    next.chatMessages =
      'replace' in patch.chat
        ? patch.chat.replace
        : [...room.chatMessages.slice(patch.chat.drop), ...patch.chat.append];
  }
  return next;
}
