// L.3b (E.18) — O mapa das salas e o que vale para todas: a chave (`roomKey`, o E.11), os tetos (E.03), a presença, o coletor das abandonadas, o GM de cada uma e o recorte público.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import { GameRoom } from "../../src/types/multiplayer.js";
import { sanitizeCharacterSheet } from "../../src/rules/sheetSchema.js";
import { type RoomFailure } from "../errors.js";
import { sessions } from "./sessions.js";
import { roomKey } from "./key.js";

/**
 * Fase E (E.3c) — o resultado de toda ação na sala: a sala (e o que a ação
 * devolve junto), ou uma falha com `code` obrigatório — o compilador não deixa
 * um erro sair sem código. A rota responde pelo `code` (server/errors.ts).
 */
export type RoomResult<T extends object = Record<never, never>> =
  | ({ room: GameRoom; error?: undefined; code?: undefined } & T)
  | (RoomFailure & { [K in keyof T]?: undefined });

/** Remove a sala da memória e revoga todas as suas sessões (mesa encerrada). */
export function deleteRoom(code: string): void {
  const rc = roomKey(code);
  delete rooms[rc];
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.roomCode === rc) delete sessions[hash];
  }
}

// ============================================================
// VALIDAÇÃO DE ENTRADA (T1.5)
// ============================================================

/** Remove caracteres de controle, colapsa espaços e trunca. */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // L.5 — exceção nomeada ao no-control-regex: tirar caractere de controle é o propósito.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Código de sala: 2–24 caracteres alfanuméricos ou hífen. Desde a R.11 o
 * cliente cria com um sufixo aleatório (`NC-2020-K7Q9XD`, ver
 * src/lib/roomCode.ts) — o código é o convite; o teto subiu de 12 para 24.
 */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9-]{2,24}$/.test(roomKey(code));
}

/**
 * Fase I (I.03 — SEC-16) — o `peerId` vem de quem entra (o `join`, e o
 * `gmPeerId` do `create`) e vira segmento de URL no cliente
 * (`/players/:targetPeerId/delete`). Sem formato, um `/`, um `..` ou um `?`
 * levava o "Remover" do GM a outra rota — a de outro jogador. O cliente gera
 * `peer_<base36>_<base36>`; o servidor, `gm_…` e `edgerunner_…`.
 */
export function isValidPeerId(peerId: unknown): peerId is string {
  return typeof peerId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(peerId);
}

// In-memory store for game rooms
export const rooms: Record<string, GameRoom> = {};

// ============================================================
// Fase E (E.03 — SEC-15) — OS TETOS DE TAMANHO
// ============================================================
// A R.4 e a R.16 limitaram o ritmo e os assentos; o tamanho do que o servidor
// guarda e reenvia seguia livre. E criar sala não exige login no servidor:
// qualquer visitante é GM da própria sala. Medido em 30/09: salas a ~4 KB
// cada, sem limite (um IP enchia os 512 MB da instância em horas, e o banco
// passava dos 500 MB do Supabase gratuito, que então vira só-leitura); ficha
// saneada de até ~557 KB; NPCs e chat sem teto em todo caminho.

/** Salas abertas ao mesmo tempo. A mesa do dono usa poucas; o coletor libera
 *  a vaga 24 h depois da última atividade. `MAX_ROOMS` no painel muda sem
 *  deploy de código — é a saída se alguém ocupar as vagas. */
export const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 30;

/** NPCs com ficha por sala. Um tiroteio grande tem uma ou duas dezenas. */
export const MAX_NPCS_PER_ROOM = 32;

/** Tamanho da ficha saneada, em bytes de JSON. A do gerador tem 2,7 KB; uma
 *  ficha cheia de verdade, ~10–15 KB. */
export const MAX_SHEET_BYTES = 64 * 1024;

/** Cabe mais uma sala? */
export function roomsAtCapacity(): boolean {
  return Object.keys(rooms).length >= MAX_ROOMS;
}

/** A sala já tem o máximo de NPCs? */
export function roomNpcsFull(code: string): boolean {
  const room = getRoom(code);
  return !!room && Object.keys(room.npcs ?? {}).length >= MAX_NPCS_PER_ROOM;
}

export function sheetBytes(sheet: unknown): number {
  return Buffer.byteLength(JSON.stringify(sheet));
}

/** A ficha, depois de saneada, passa do teto? (`false` se nem é ficha — a
 *  validação de forma é de outro lugar.) */
export function sheetTooLarge(sheet: unknown): boolean {
  const validated = sanitizeCharacterSheet(sheet);
  return !!validated && sheetBytes(validated.sheet) > MAX_SHEET_BYTES;
}

// Fase 3 (T3.4) — timeout de isOnline por inatividade.
// Sobrescrevível via env (ex.: ROOM_OFFLINE_TIMEOUT_MS=8000 para testes).
export const ROOM_OFFLINE_TIMEOUT_MS =
  Number(process.env.ROOM_OFFLINE_TIMEOUT_MS) || 60_000;

/** Marca o jogador como ativo agora (heartbeat ou qualquer ação na mesa). */
export function touchPlayer(code: string, peerId: string): boolean {
  const room = getRoom(code);
  const player = room?.players[peerId];
  if (!player) return false;
  player.isOnline = true;
  player.lastActiveAt = new Date().toISOString();
  return true;
}

// B.5 (SEC-04) — janela de abandono. Uma mesa sem NINGUÉM ativo por este
// tempo é considerada encerrada e recolhida. Sobrescrevível por env.
//
// 24 h é deliberadamente conservador. O risco de recolher cedo demais não é
// simétrico: recolher tarde custa uma linha a mais no banco por mais um dia;
// recolher cedo apaga a mesa de alguém, e o `deleteRoomPersisted` é
// irreversível. Uma sessão de jogo que "pausa" (todos desconectam no
// intervalo) volta em minutos, nunca em um dia.
export const ROOM_ABANDONED_TIMEOUT_MS =
  Number(process.env.ROOM_ABANDONED_TIMEOUT_MS) || 24 * 60 * 60 * 1000;

/** Timestamp em ms, ou `null` se a data for ausente/inválida. */
function parseTime(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * B.5 (SEC-04) — implementa a transição `Ociosa → Encerrada` do
 * [ciclo de vida](../docs/ARQUITETURA.md#ciclo-de-vida-de-sala-e-sessão), que
 * o diagrama especificava e o código não tinha: o `markStalePlayersOffline`
 * marcava jogador como offline, mas a sala ficava na memória e no banco para
 * sempre, e as sessões junto.
 *
 * Remove da memória e revoga as sessões (via `deleteRoom`). O chamador
 * completa o encerramento apagando a linha no banco e destruindo o Y.Doc — os
 * outros dois passos que a nota do diagrama lista.
 *
 * Retorna os códigos recolhidos.
 */
/**
 * A sala está abandonada? Sem jogador, ou sem nenhum timestamp legível, cai
 * para a criação da sala; se nem isso der, a linha é lixo. Exportada para o
 * restore (E.03): sala abandonada não volta no boot — o coletor só roda 15 min
 * depois, e o restore trazia tudo de volta antes dele.
 */
export function isRoomAbandoned(room: GameRoom, maxIdleMs: number = ROOM_ABANDONED_TIMEOUT_MS, now: number = Date.now()): boolean {
  const players = room.players && typeof room.players === "object" ? Object.values(room.players) : [];
  const times = players
    .map((p) => parseTime(p?.lastActiveAt))
    .filter((t): t is number => t !== null);
  const lastActivity = times.length > 0 ? Math.max(...times) : parseTime(room.createdAt);
  return lastActivity === null || now - lastActivity > maxIdleMs;
}

export function collectAbandonedRooms(maxIdleMs: number = ROOM_ABANDONED_TIMEOUT_MS): string[] {
  const now = Date.now();
  const doomed: string[] = [];

  for (const room of Object.values(rooms)) {
    if (isRoomAbandoned(room, maxIdleMs, now)) doomed.push(room.code);
  }

  // Deletar só depois de percorrer — mutar o mapa durante a iteração é
  // exatamente o tipo de bug que aparece com a mesa cheia e não no teste.
  for (const code of doomed) deleteRoom(code);
  return doomed;
}

/** T3.4 — varre todas as salas e marca OFFLINE players sem heartbeat recente.
 *  Retorna os códigos das salas que mudaram (para broadcast + persistência). */
export function markStalePlayersOffline(): string[] {
  const now = Date.now();
  const changed: string[] = [];
  for (const room of Object.values(rooms)) {
    let roomChanged = false;
    for (const player of Object.values(room.players)) {
      if (!player.isOnline) continue;
      const last = player.lastActiveAt ? new Date(player.lastActiveAt).getTime() : 0;
      if (now - last > ROOM_OFFLINE_TIMEOUT_MS) {
        player.isOnline = false;
        roomChanged = true;
      }
    }
    if (roomChanged) changed.push(room.code);
  }
  return changed;
}

// ============================================================
// AUTORIZAÇÃO (T1.1) — GM SEM fallback permissivo
// GM legítimo = quem criou a sala (gmPeerId) OU jogador cujo handle coincide
// com gmHandle. Nunca `return true` genérico.
// ============================================================
export function checkIsGm(room: GameRoom, requesterPeerId: string): boolean {
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

export function getRoom(code: string): GameRoom | undefined {
  return rooms[roomKey(code)];
}

// Fase 3 (T3.2) — injeta uma sala vinda da persistência (room_state jsonb).
// Valida a estrutura mínima, preenche defaults de campos que handlers usam
// (snapshot antigo de schema evoluído não pode crashar o servidor) e marca
// todos os jogadores como offline, pois o servidor acabou de reiniciar.
export function restoreRoom(room: GameRoom): boolean {
  if (!room || typeof room.code !== "string") return false;
  const code = roomKey(room.code);
  if (!code || !isValidRoomCode(code)) return false;
  if (!room.players || typeof room.players !== "object") return false;
  // E.03 (SEC-15) — o boot não traz de volta mais salas do que cabem. O
  // restore lê as mais recentes primeiro (`updated_at` decrescente).
  if (!rooms[code] && roomsAtCapacity()) return false;

  // Defaults defensivos: handlers operam nestes campos (postChatMessage
  // faz .push, updateTacticalGrid acessa .tokens, nextTurn lê a lista).
  if (!Array.isArray(room.chatMessages)) room.chatMessages = [];
  if (!Array.isArray(room.initiativeList)) room.initiativeList = [];
  if (typeof room.activeTurnIndex !== "number") room.activeTurnIndex = 0;
  if (!room.tacticalGrid || typeof room.tacticalGrid !== "object") {
    room.tacticalGrid = { rows: 8, cols: 10, theme: "alley", tokens: [] };
  }
  if (!Array.isArray(room.tacticalGrid.tokens)) room.tacticalGrid.tokens = [];
  if (!room.npcs || typeof room.npcs !== "object") room.npcs = {};
  // R.3 — a lista de removidos vem do banco: só strings, com o mesmo teto.
  if (room.removedPeerIds !== undefined) {
    room.removedPeerIds = Array.isArray(room.removedPeerIds)
      ? room.removedPeerIds.filter((p): p is string => typeof p === "string" && p.length > 0).slice(-MAX_REMOVED_PEERS)
      : undefined;
  }

  for (const player of Object.values(room.players)) {
    if (player) player.isOnline = false;
  }
  rooms[code] = room;
  return true;
}

/** R.3 — teto da lista de removidos: é estado persistido e transmitido (pergunta 5 do portão). */
export const MAX_REMOVED_PEERS = 50;

/**
 * Recorte PÚBLICO de uma sala (B.3 — SEC-02).
 * Só o que já é exposto no lobby por `getAllActiveRooms`: nada de fichas,
 * chat, grid ou iniciativa. É o payload de quem ainda não entrou na mesa.
 */
export interface RoomPublicSummary {
  code: string;
  name: string;
  gmHandle: string;
  playersCount: number;
}

function toPublicSummary(r: GameRoom): RoomPublicSummary {
  return {
    code: r.code,
    name: r.name,
    gmHandle: r.gmHandle,
    playersCount: Object.keys(r.players).length
  };
}

export function getRoomPublicSummary(code: string): RoomPublicSummary | null {
  const room = getRoom(code);
  return room ? toPublicSummary(room) : null;
}

export function getAllActiveRooms(): RoomPublicSummary[] {
  return Object.values(rooms).map(toPublicSummary);
}
