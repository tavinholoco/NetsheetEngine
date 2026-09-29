/**
 * ============================================================
 * NETSHEET ENGINE — CLIENTE HTTP DE SALAS (/api/rooms*) (T7.3)
 * ============================================================
 * Todas as chamadas REST de multiplayer concentradas aqui, com tipos dos
 * payloads. Autenticação por token de sessão (T1.7) com auto-reconexão
 * (T3.3): num 401, re-join e retry automático da ação original. Desde a R.1
 * (SEC-07) o re-join prova o assento com o token vigente — ver `postJoin`.
 *
 * O `MultiplayerRoom` consome este módulo via namespace — nenhum fetch cru.
 */

import { apiFetch, ApiError } from './http';
import { ArmorLocation, CharacterSheet, RollResult } from '../types/cyberpunk';
import { GameRoom, InitiativeEntry, TableRollKind, TacticalGridState } from '../types/multiplayer';
import { useRoomStore } from '../stores/useRoomStore';
import { useSheetStore } from '../stores/useSheetStore';
import type { RangeBandKey } from '../rules/tables';

export interface JoinResponse {
  room: GameRoom;
  sessionToken: string;
}

export interface RoomSummary {
  code: string;
  name: string;
  gmHandle: string;
  playersCount: number;
}

// ===========================================================================
// SESSÃO (peerId + token) — estado vive na useRoomStore + sessionStorage
// ===========================================================================

function generatePeerId(): string {
  return 'peer_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

/** Retorna o peerId corrente (cria e persiste se ainda não existir). */
export function getPeerId(): string {
  const cur = useRoomStore.getState();
  if (!cur.peerId) {
    const id = generatePeerId();
    cur.setPeerId(id);
    sessionStorage.setItem('cyberpunk_peer_id', id);
    return id;
  }
  return cur.peerId;
}

function currentToken(): string {
  return useRoomStore.getState().sessionToken;
}

function persistSession(token: string, room?: GameRoom, roomCode?: string): void {
  const s = useRoomStore.getState();
  s.setSessionToken(token);
  sessionStorage.setItem('cyberpunk_session_token', token);
  if (room) s.setRoom(room);
  if (roomCode) s.setRoomCode(roomCode);
}

/**
 * T7.4 — hidrata a store com a sessão persistida no sessionStorage (reload).
 * No boot a useRoomStore começa vazia; peerId/token sobrevivem no
 * sessionStorage e são restaurados para o deep link reconectar sozinho.
 */
export function hydrateSession(): { peerId: string; sessionToken: string } {
  const s = useRoomStore.getState();
  const peerId = s.peerId || sessionStorage.getItem('cyberpunk_peer_id') || '';
  const sessionToken = s.sessionToken || sessionStorage.getItem('cyberpunk_session_token') || '';
  if (peerId && peerId !== s.peerId) s.setPeerId(peerId);
  if (sessionToken && sessionToken !== s.sessionToken) s.setSessionToken(sessionToken);
  return { peerId, sessionToken };
}

/** R.1 — peerId novo: o assento antigo ficou sem prova de posse. */
function rotatePeerId(): string {
  const id = generatePeerId();
  useRoomStore.getState().setPeerId(id);
  sessionStorage.setItem('cyberpunk_peer_id', id);
  return id;
}

/**
 * Revisão pós-D (R.1 — SEC-07) — `POST /join` provando o assento com o token
 * vigente, no header `X-Session-Token`. O `peerId` sozinho é público: o
 * servidor não entrega mais um assento ocupado a quem só o apresenta.
 *
 * 409 `seat_taken` quer dizer que a prova falhou — a sessão deste assento se
 * perdeu (ex.: queda do servidor antes de persistir). O cliente entra como
 * jogador novo, com outro peerId, uma vez só; o GM remove o assento antigo.
 */
export async function postJoin(code: string, handle: string, sheet: CharacterSheet): Promise<JoinResponse> {
  const send = (peerId: string) => {
    const token = currentToken();
    return apiFetch<JoinResponse>('/api/rooms/join', {
      method: 'POST',
      headers: token ? { 'X-Session-Token': token } : undefined,
      body: JSON.stringify({ code, peerId, handle, sheet })
    });
  };
  try {
    return await send(getPeerId());
  } catch (e) {
    if (e instanceof ApiError && e.code === 'seat_taken') return send(rotatePeerId());
    throw e;
  }
}

let reconnectInFlight: Promise<boolean> | null = null;

/**
 * Fase 3 (T3.3) — re-join automático após um 401. Desde a R.1 o `join` prova
 * o assento com o token vigente; se ele não vale mais, o `postJoin` entra como
 * jogador novo. O servidor preserva a ficha persistida de quem prova o assento.
 */
export async function reconnectSession(): Promise<boolean> {
  if (reconnectInFlight) return reconnectInFlight;
  const attempt = (async () => {
    try {
      const { roomCode } = useRoomStore.getState();
      const { sheet, user } = useSheetStore.getState();
      const handle = user?.displayName || sheet.handle || 'Edgerunner';
      const { room, sessionToken } = await postJoin(roomCode, handle, sheet);
      persistSession(sessionToken, room);
      useRoomStore.getState().setErrorMsg('');
      return true;
    } catch {
      useRoomStore
        .getState()
        .setErrorMsg('Sessão expirada e reconexão falhou — a sala pode ter sido encerrada. Saia e entre novamente.');
      return false;
    }
  })();
  reconnectInFlight = attempt;
  try {
    return await attempt;
  } finally {
    reconnectInFlight = null;
  }
}

/**
 * POST autenticado com retry (T1.7 + T3.3): se o servidor reiniciou e o token
 * expirou (401 "Sessão inválida"), reconecta automaticamente e re-tenta a
 * ação original com o token novo.
 */
export async function authedFetch<T>(path: string, body: object): Promise<T> {
  const doFetch = () =>
    apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify({ ...body, sessionToken: currentToken() })
    });
  try {
    return await doFetch();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const reconnected = await reconnectSession();
      if (reconnected) return doFetch();
    }
    throw e;
  }
}

// ===========================================================================
// ENDPOINTS — SALAS MULTIPLAYER
// ===========================================================================

/** GET /api/rooms — lista salas públicas do lobby. */
export function listRooms(): Promise<RoomSummary[]> {
  return apiFetch<RoomSummary[]>('/api/rooms');
}

/** POST /api/rooms/create — cria uma mesa (o chamador vira GM). */
export async function createRoom(input: { code: string; name: string; gmHandle: string }): Promise<JoinResponse> {
  const res = await apiFetch<JoinResponse>('/api/rooms/create', {
    method: 'POST',
    body: JSON.stringify({ ...input, gmPeerId: getPeerId() })
  });
  persistSession(res.sessionToken, res.room, input.code);
  return res;
}

/** POST /api/rooms/join — entra numa mesa existente (ou volta ao próprio assento, R.1). */
export async function joinRoom(input: { code: string; handle: string; sheet: CharacterSheet }): Promise<JoinResponse> {
  const res = await postJoin(input.code, input.handle, input.sheet);
  persistSession(res.sessionToken, res.room, input.code);
  return res;
}

/** POST /api/rooms/:code/heartbeat — mantém isOnline=true (T3.4). */
export function postHeartbeat(code: string): Promise<{ success: boolean; isOnline?: boolean }> {
  return authedFetch(`/api/rooms/${code}/heartbeat`, {});
}

/** POST /api/rooms/:code/sheet — sincroniza a ficha na mesa. */
export function syncSheet(code: string, sheet: CharacterSheet): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/sheet`, { sheet });
}

/** POST /api/rooms/:code/message — envia chat (fallback SSE). */
export function postMessage(code: string, text: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/message`, { text });
}

/** POST /api/rooms/:code/roll — pede rolagem server-authoritative (T5.4). */
export function postRoll(code: string, kind: TableRollKind, skillName?: string): Promise<{ room: GameRoom; roll: RollResult }> {
  return authedFetch(`/api/rooms/${code}/roll`, { kind, skillName });
}

/** POST /api/rooms/:code/leave — sai da mesa e fecha o WS do peer. */
export function leaveRoom(code: string): Promise<{ success: boolean }> {
  return authedFetch(`/api/rooms/${code}/leave`, {});
}

/** POST /api/rooms/:code/tactical-grid — fallback REST do grid (sem Yjs). */
export function updateTacticalGrid(code: string, gridState: TacticalGridState): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/tactical-grid`, { gridState });
}

/** POST /api/rooms/:code/npcs/generate — GM gera NPC na mesa. */
export function generateNpc(code: string, archetypeId?: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/npcs/generate`, { archetypeId });
}

/** POST /api/rooms/:code/players/generate — GM gera jogador na mesa. */
export function generatePlayers(code: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/players/generate`, {});
}

/** POST /api/rooms/:code/player-health — GM ajusta ferimento de jogador. */
export function setPlayerHealth(code: string, targetPeerId: string, woundLevel: number): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/player-health`, { targetPeerId, woundLevel });
}

/** POST /api/rooms/:code/npcs/:npcId/health — GM ajusta ferimento de NPC. */
export function setNpcHealth(code: string, npcId: string, woundLevel: number): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/npcs/${npcId}/health`, { woundLevel });
}

/**
 * POST /api/rooms/:code/damage — GM aplica dano (D.1). `targetId` é o peerId
 * do jogador, o id do NPC ou o id de um token. O servidor faz a conta.
 */
export function applyDamage(code: string, targetId: string, raw: number, location: ArmorLocation): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/damage`, { targetId, raw, location });
}

/**
 * POST /api/rooms/:code/attack — GM ataca com um NPC (D.3). `range` é uma
 * faixa de `RANGE_BANDS`, ou `difficulty` um número livre (corpo a corpo).
 */
export function gmAttack(
  code: string,
  input: { attackerId: string; targetId: string; range?: RangeBandKey; difficulty?: number }
): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/attack`, input);
}

/** POST /api/rooms/:code/stabilize — GM estabiliza (ou desfaz) quem está em Mortal (D.5). */
export function setStabilized(code: string, targetId: string, stabilized: boolean): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/stabilize`, { targetId, stabilized });
}

/** POST /api/rooms/:code/npcs/:npcId/delete — GM remove NPC. */
export function deleteNpc(code: string, npcId: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/npcs/${npcId}/delete`, {});
}

/** POST /api/rooms/:code/players/:targetPeerId/delete — GM remove jogador. */
export function deletePlayer(code: string, targetPeerId: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/players/${targetPeerId}/delete`, {});
}

/** POST /api/rooms/:code/initiative — GM define a lista de iniciativa. */
export function setInitiativeList(code: string, list: InitiativeEntry[]): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/initiative`, { initiativeList: list });
}

/** POST /api/rooms/:code/initiative — GM avança o turno. */
export function nextTurn(code: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/initiative`, { action: 'next' });
}

/** D.4 — o servidor rola 1d10 + REF (+ Combat Sense) para todo combatente com ficha. */
export function rollInitiative(code: string): Promise<GameRoom> {
  return authedFetch(`/api/rooms/${code}/initiative`, { action: 'roll' });
}
