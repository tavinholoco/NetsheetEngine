import crypto from "crypto";
import { GameRoom, RoomPlayer, ChatMessage, InitiativeEntry, TacticalGridState } from "../src/types/multiplayer.js";
import { ArmorLocation, CharacterSheet, RollResult } from "../src/types/cyberpunk.js";
import { generateRandomNpc } from "../src/utils/npcGenerator.js";
// Fase B (B.2 — SEC-05) — a ficha é entrada não confiável. A validação mora
// aqui, e não na rota HTTP, para cobrir TODO caminho que escreve ficha
// (REST, WebSocket e o que vier), não só o endpoint que existe hoje.
import { sanitizeCharacterSheet } from "../src/rules/sheetSchema.js";
// Fase C (C.1) — as regras de rolagem são as mesmas do cliente, em src/rules/.
import { parseDamageFormula, type Rng } from "../src/rules/dice.js";
import {
  FALLBACK_DAMAGE,
  sheetAttackRoll,
  sheetInitiativeRoll,
  sheetDamageRoll,
  sheetDeathSaveRoll,
  sheetSkillRoll,
  sheetStunSaveRoll,
  stunSaveRoll,
  type RollCore
} from "../src/rules/rolls.js";
import { attackHits, gmModifier, rangeBandFor } from "../src/rules/combat.js";
// Fase D (D.1) — o dano vira ferimento no servidor, com as regras do livro.
import { btmFromBody, deriveCurrentStats, mortalLevel, woundRow } from "../src/rules/character.js";
import {
  applyHit,
  armorSpAt,
  hitLocationRow,
  isArmorLocation,
  resolveHit,
  woundStateOf,
  type HitOutcome,
  type WoundState
} from "../src/rules/damage.js";
import { WOUND_TRACK_POINTS } from "../src/rules/tables.js";
import { gridChangeProblem, normalizeGridInput } from "../src/lib/gridDoc.js";
import { logger } from "./logger.js";

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

// B.4 (SEC-03) — o mapa é keyed por SHA-256 do token, não pelo token.
// O token em claro existe só no cliente e em trânsito: nem a memória do
// processo nem o banco guardam segredo recuperável. Como as sessões passaram
// a ser persistidas (senão um restart derrubava todas as mesas), gravar o
// token em claro abriria um buraco novo enquanto se fecha outro — um dump do
// banco entregaria sessões vivas.
//
// A busca continua O(1): hasheia o token recebido e olha o mapa.
const sessions: Record<string, Session> = {}; // sha256(token) -> sessão

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function bindSession(roomCode: string, peerId: string): string {
  const token = createSessionToken();
  sessions[hashToken(token)] = { roomCode: roomCode.trim().toUpperCase(), peerId };
  return token;
}

/** Retorna o peerId autenticado pelo token na sala, ou null se inválido. */
export function verifySession(roomCode: string, token: string): string | null {
  if (typeof token !== "string" || !token) return null;
  const s = sessions[hashToken(token)];
  if (!s) return null;
  if (s.roomCode !== roomCode.trim().toUpperCase()) return null;
  return s.peerId;
}

function revokeSessionsForPeer(roomCode: string, peerId: string): void {
  const rc = roomCode.trim().toUpperCase();
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.peerId === peerId && s.roomCode === rc) delete sessions[hash];
  }
}

/** Remove a sala da memória e revoga todas as suas sessões (mesa encerrada). */
function deleteRoom(code: string): void {
  const rc = code.trim().toUpperCase();
  delete rooms[rc];
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.roomCode === rc) delete sessions[hash];
  }
}

// ============================================================
// B.4 (SEC-03) — SESSÕES ATRAVESSAM O RESTART
// ============================================================
// Antes, `sessions` era só memória: deploy, crash ou o despertar da
// hibernação do plano gratuito derrubavam todas as mesas. A sala voltava do
// banco com os jogadores dentro, mas nenhum token valia — toda ação virava
// 401 e o jogador tinha que entrar de novo no meio do combate.
//
// A revogação continua server-side de propósito. Trocar por JWT stateless
// tornaria `revokeSessionsForPeer` e `deleteRoom` impossíveis de cumprir:
// um JWT emitido vale até expirar, e "saiu da mesa" precisa valer AGORA.

/** Mapa `{ sha256(token): peerId }` de uma sala, para gravar junto com ela. */
export function exportRoomSessions(code: string): Record<string, string> {
  const rc = code.trim().toUpperCase();
  const out: Record<string, string> = {};
  for (const [hash, s] of Object.entries(sessions)) {
    if (s.roomCode === rc) out[hash] = s.peerId;
  }
  return out;
}

/**
 * Repõe as sessões de uma sala no boot. Só aceita hash e peerId que sejam
 * string — linha corrompida ou de schema antigo não pode derrubar o restore
 * nem, pior, criar sessão inválida.
 */
export function restoreRoomSessions(code: string, data: unknown): number {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return 0;
  const rc = code.trim().toUpperCase();
  let count = 0;
  for (const [hash, peerId] of Object.entries(data as Record<string, unknown>)) {
    if (typeof hash !== "string" || !hash) continue;
    if (typeof peerId !== "string" || !peerId) continue;
    sessions[hash] = { roomCode: rc, peerId };
    count += 1;
  }
  return count;
}

// ============================================================
// VALIDAÇÃO DE ENTRADA (T1.5)
// ============================================================

/** Remove caracteres de controle, colapsa espaços e trunca. */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Código de sala: 2–24 caracteres alfanuméricos ou hífen. Desde a R.11 o
 * cliente cria com um sufixo aleatório (`NC-2020-K7Q9XD`, ver
 * src/lib/roomCode.ts) — o código é o convite; o teto subiu de 12 para 24.
 */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9-]{2,24}$/.test(code.trim().toUpperCase());
}

// In-memory store for game rooms
const rooms: Record<string, GameRoom> = {};

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
/** Mensagens guardadas no chat da sala — o teto que já existia em dois caminhos. */
export const MAX_CHAT_MESSAGES = 100;

/** Cabe mais uma sala? */
export function roomsAtCapacity(): boolean {
  return Object.keys(rooms).length >= MAX_ROOMS;
}

/** A sala já tem o máximo de NPCs? */
export function roomNpcsFull(code: string): boolean {
  const room = getRoom(code);
  return !!room && Object.keys(room.npcs ?? {}).length >= MAX_NPCS_PER_ROOM;
}

function sheetBytes(sheet: unknown): number {
  return Buffer.byteLength(JSON.stringify(sheet));
}

/** A ficha, depois de saneada, passa do teto? (`false` se nem é ficha — a
 *  validação de forma é de outro lugar.) */
export function sheetTooLarge(sheet: unknown): boolean {
  const validated = sanitizeCharacterSheet(sheet);
  return !!validated && sheetBytes(validated.sheet) > MAX_SHEET_BYTES;
}

/** Guarda uma mensagem no chat com o teto — o ÚNICO caminho de escrita. Antes,
 *  dois caminhos tinham teto e oito não; e o do jogador tirava uma só. */
function pushChat(room: GameRoom, message: ChatMessage): void {
  room.chatMessages.push(message);
  if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
    room.chatMessages.splice(0, room.chatMessages.length - MAX_CHAT_MESSAGES);
  }
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

// Fase 3 (T3.2) — injeta uma sala vinda da persistência (room_state jsonb).
// Valida a estrutura mínima, preenche defaults de campos que handlers usam
// (snapshot antigo de schema evoluído não pode crashar o servidor) e marca
// todos os jogadores como offline, pois o servidor acabou de reiniciar.
export function restoreRoom(room: GameRoom): boolean {
  if (!room || typeof room.code !== "string") return false;
  const code = room.code.trim().toUpperCase();
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

/** Ficha "utilizável" = tem handle ou stats (não é placeholder vazio). */
function isUsableSheet(sheet: unknown): boolean {
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return false;
  const s = sheet as Partial<CharacterSheet>;
  return !!s.handle || (!!s.stats && typeof s.stats === "object");
}

/**
 * T3.3 — resolve qual ficha vale na reconexão (last-write-wins por updatedAt).
 * - Cliente mandou ficha vazia → mantém a persistida.
 * - Ambas usáveis → vence a de `updatedAt` mais recente (ou a do cliente se
 *   as persistidas não tiverem timestamp — ficha nova/placeholder do servidor).
 */
/**
 * Fase D (D.1, decisão 7a) — grava o estado de ferimento na ficha e recalcula
 * os atributos correntes. Na mesa, só o servidor e o GM passam por aqui.
 */
function writeWound(sheet: CharacterSheet, wound: WoundState): void {
  sheet.damagePoints = wound.damagePoints;
  sheet.woundLevel = wound.woundLevel;
  sheet.isDead = wound.isDead;
  sheet.currentStats = deriveCurrentStats(sheet);
}

/**
 * Ficha vinda do cliente, com o ferimento que o SERVIDOR já tinha. Até a Fase
 * D o jogador escrevia o próprio `woundLevel` pela sincronia e, desde a C.6,
 * isso baixava a penalidade da rolagem (achado do portão C.14).
 */
function withServerWound(clientSheet: CharacterSheet, serverSheet: CharacterSheet): CharacterSheet {
  const sheet = { ...clientSheet, isStabilized: serverSheet.isStabilized === true };
  writeWound(sheet, woundStateOf(serverSheet));
  return sheet;
}

/**
 * Nível pedido no ajuste manual do GM (Bio-Monitor), grampeado em 0..10. Vira
 * o MÍNIMO da caixa em pontos: o GM escolhe o nível, não o resto da caixa. O
 * estado Morto não muda por aqui: desfazer morte na mesa é ADIAR (gatilho no
 * plano, D.1).
 */
function manualWoundLevel(woundLevel: unknown): number {
  const n = Math.round(Number(woundLevel));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
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

  const safePeerId = sanitizeText(peerId, 64);
  if (!safePeerId) return null;
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
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
  }

  // Revoga tokens antigos do mesmo peer (1 sessão ativa por jogador) e emite novo.
  revokeSessionsForPeer(room.code, safePeerId);
  const sessionToken = bindSession(room.code, safePeerId);
  return { room, sessionToken };
}

export function updatePlayerSheet(code: string, peerId: string, sheet: CharacterSheet): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!room.players[peerId]) return { room: null, error: "Jogador não encontrado na mesa" };

  // B.2 (SEC-05) — caminho quente do problema: a ficha era gravada verbatim a
  // cada edição. O autor já vinha da sessão (T1.7); o que faltava era conferir
  // o CONTEÚDO. Sem isto, `woundLevel: -999` ou `BODY: 9999` viravam estado da
  // mesa, eram persistidos e transmitidos a todos.
  const validated = sanitizeCharacterSheet(sheet);
  if (!validated) return { room: null, error: "Ficha inválida" };
  if (sheetBytes(validated.sheet) > MAX_SHEET_BYTES) {
    return { room: null, error: `Ficha grande demais (máx. ${MAX_SHEET_BYTES / 1024} KB).` };
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
): { room: GameRoom | null; error?: string; code?: "invalid_grid" } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode alterar o mapa tático." };
  }

  // E.02 (SEC-14) — o grid era gravado como veio. Um `tokens: 5` travava a
  // sala e, pelo vigia de presença, derrubava o processo. Agora ele é montado
  // campo a campo e conferido (a mesma regra da porta Yjs, em src/lib/gridDoc).
  const grid = normalizeGridInput(gridState);
  const prev = room.tacticalGrid ?? { rows: 8, cols: 10, theme: "alley", tokens: [] };
  const problem = grid ? gridChangeProblem(prev, grid) : "o mapa precisa de uma lista de tokens";
  if (!grid || problem) {
    return { room: null, error: `Mapa tático inválido: ${problem}.`, code: "invalid_grid" };
  }
  room.tacticalGrid = grid;
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
  // E.03 (SEC-15) — cada NPC é uma ficha a mais em todo reenvio da sala.
  if (roomNpcsFull(room.code)) {
    return { room: null, error: `A mesa já tem ${MAX_NPCS_PER_ROOM} NPCs. Remova algum para gerar outro.` };
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
  // R.16 (SEC-13) — ficha gerada ocupa assento como qualquer outro.
  if (Object.keys(room.players).length >= MAX_SEATS_PER_ROOM) {
    return { room: null, error: `A mesa está cheia (${MAX_SEATS_PER_ROOM} lugares). Remova alguém para gerar outra ficha.` };
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
    pushChat(room, {
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
): { room: GameRoom | null; error?: string; removedPeerId?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };

  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa pode remover Edgerunners." };
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
      return { room: null, error: "Acesso Negado! O Mestre não remove a si mesmo — use Sair." };
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

      room.initiativeList = room.initiativeList.filter(
        i => i.playerId !== targetPeerId && i.playerId !== actualPeerId && i.playerId !== targetKey
      );

      pushChat(room, {
        id: "msg_plr_del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        senderHandle: "SISTEMA_NET",
        senderRole: "gm",
        text: `🗑️ [MESTRE DE JOGO] removeu a ficha do Edgerunner [${handle}] da mesa.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      });
    }
  }

  return { room, removedPeerId };
}

/** R.3 — teto da lista de removidos: é estado persistido e transmitido (pergunta 5 do portão). */
const MAX_REMOVED_PEERS = 50;

/** Guarda quem o GM removeu, sem repetir, ficando com os mais recentes. */
function rememberRemoved(room: GameRoom, peerId: string): void {
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
  const clamped = manualWoundLevel(woundLevel);
  writeWound(npc.sheet, { ...woundStateOf({ woundLevel: clamped }), isDead: npc.sheet.isDead === true });

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

  pushChat(room, newMsg);

  return { room };
}

// ============================================================
// ROLAGENS SERVER-AUTHORITATIVE (Fase 5 — T5.4)
// ============================================================
// O cliente pede o tipo de rolagem; o servidor rola os dados com
// crypto.randomInt (seguro, não-preditível) e monta o RollResult usando a
// ficha que ELE possui (room.players[peerId].sheet) — o jogador não pode
// forjar o dado nem os bônus. O resultado entra no chat via postChatMessage
// (handle/role derivados do servidor, anti-spoofing) e é broadcastado.

/** RNG da mesa: `crypto.randomInt`, uniforme e não-preditível. Injetável em teste. */
export const serverRng: Rng = (sides) => crypto.randomInt(1, sides + 1);

/** Primeira arma equipada (ou a primeira da lista) da ficha. */
function firstWeapon(sheet: CharacterSheet) {
  const ws = Array.isArray(sheet.weapons) ? sheet.weapons : [];
  return ws.find((w) => w.equipped) || ws[0];
}

/**
 * Executa uma rolagem de mesa no SERVIDOR (T5.4), com as regras de
 * `src/rules/` — as mesmas do rolador do cliente (Fase C, C.1).
 * - `attack`: 1d10 aberto + REF + perícia da arma + WA (+ modificador do GM)
 * - `damage`: fórmula de dano da arma + local de impacto (1d10)
 * - `save`  : death save 1d10 ≤ BODY − nível Mortal
 * - `stun`  : stun save 1d10 ≤ BODY − 0 a 9 pelo nível do ferimento
 * - `skill` : 1d10 aberto + atributo da perícia + nível (+ modificador do GM)
 * Atributos CORRENTES (C.6) e bônus sempre da FICHA do servidor.
 * O `rng` só é passado em teste; em produção é sempre `serverRng`.
 * Retorna a sala com a rolagem já publicada no chat (broadcast é do chamador).
 */
export function rollDiceForPlayer(
  code: string,
  requesterPeerId: string,
  request: { kind: string; skillName?: string },
  rng: Rng = serverRng
): { room: GameRoom | null; roll?: RollResult; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  const player = room.players[requesterPeerId];
  if (!player) return { room: null, error: "Jogador não está na mesa." };

  // As parcelas saem de src/rules/rolls.ts — as mesmas funções que a ficha do
  // cliente chama (C.10). Atributos CORRENTES (C.6): o `currentStats` que o
  // cliente manda nunca é lido.
  const sheet: CharacterSheet = player.sheet || ({} as CharacterSheet);
  const kind = sanitizeText(request?.kind, 12).toLowerCase();
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const rollId = "roll_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex");
  const stamp = (core: RollCore): RollResult => ({ id: rollId, timestamp: now, characterName: player.handle, ...core });
  // C.4 — o modificador de situação do GM entra em ataque e perícia, com o
  // motivo no detalhe. Não entra em dano nem em save: não é regra do livro.
  const gm = gmModifier(room.combatModifier, room.modifierReason);

  let roll: RollResult;

  if (kind === "attack") {
    // C.3 — 1d10 + REF + perícia da arma + WA (+ GM).
    roll = stamp(sheetAttackRoll(rng, sheet, firstWeapon(sheet), gm));
  } else if (kind === "damage") {
    const { core, formula } = sheetDamageRoll(rng, firstWeapon(sheet));
    if (!core) return { room: null, error: `Fórmula de dano inválida: ${formula}` };
    roll = stamp(core);
  } else if (kind === "save") {
    // C.7 — death save: BODY − nível Mortal.
    roll = stamp(sheetDeathSaveRoll(rng, sheet));
  } else if (kind === "stun") {
    // C.7 — stun save: BODY − 0 a 9 pelo nível do ferimento. Não existia.
    roll = stamp(sheetStunSaveRoll(rng, sheet));
  } else if (kind === "skill") {
    const skillName = sanitizeText(request?.skillName, 60);
    const skill = Array.isArray(sheet.skills)
      ? sheet.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase())
      : undefined;
    if (!skill) return { room: null, error: "Perícia não encontrada na sua ficha." };
    roll = stamp(sheetSkillRoll(rng, sheet, skill, gm));
  } else {
    return { room: null, error: "Tipo de rolagem inválido. Use: attack, damage, save, stun ou skill." };
  }

  const result = postChatMessage(code, requesterPeerId, "", roll);
  if (!result.room) return result;
  return { room: result.room, roll };
}

// ============================================================
// DANO → FERIMENTO (Fase D, D.1 e D.2)
// ============================================================
// O GM aplica; o servidor faz a conta do livro (armadura → BTM mín. 1 → ×2 na
// cabeça — decisão 6), marca os PONTOS na trilha (decisão 7b), rola o stun
// save e deixa a conta inteira no chat. Uma mutação só por dano aplicado: o
// custo por broadcast (ARQ-01) não muda com a D.

/** Teto do dano bruto: 20d100 (o teto do parser de fórmula) com folga. */
const MAX_RAW_DAMAGE = 2500;

/** Horário curto do chat, igual ao resto da mesa. */
const chatTime = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Mensagem do sistema no chat da mesa — pelo `pushChat`, com o teto de todo caminho (E.03). */
function pushSystemMessage(room: GameRoom, prefix: string, text: string, rollResult?: RollResult): void {
  pushChat(room, {
    id: `msg_${prefix}_` + Date.now() + "_" + crypto.randomBytes(3).toString("hex"),
    senderHandle: "SISTEMA_NET",
    senderRole: "gm",
    text,
    timestamp: chatTime(),
    isDiceRoll: !!rollResult,
    rollResult
  });
}

/**
 * Acha a ficha do alvo: jogador, NPC, ou o token de um deles no grid. D.2
 * (decisão 7c): token sem ficha — cobertura, perigo, NPC criado direto no
 * grid — não recebe dano.
 */
function findDamageTarget(room: GameRoom, targetId: string): { target?: RoomPlayer; error?: string } {
  const byId = (id: string) => room.players[id] ?? room.npcs?.[id];
  const direct = byId(targetId);
  if (direct) return { target: direct };
  const token = room.tacticalGrid?.tokens.find((t) => t.id === targetId);
  if (!token) return { error: "Alvo não encontrado na mesa." };
  const owner = token.peerId ? byId(token.peerId) : undefined;
  if (!owner) {
    return { error: `[${token.name}] é um token sem ficha e não recebe dano. Para um NPC que sangra, gere-o com ficha.` };
  }
  return { target: owner };
}

/** A conta do acerto como o livro a faz, para o chat. */
function hitAuditText(outcome: HitOutcome): string {
  const s = outcome.steps;
  const armor = `${s.raw} − SP ${s.sp} = ${s.afterArmor}`;
  if (!s.penetrated) return `${armor}: a armadura segurou. Sem ferimento.`;
  const btm = s.btm === 0 ? "BTM 0" : `BTM −${Math.abs(s.btm)}`;
  const minNote = s.afterArmor + s.btm < s.afterBtm ? " (mín. 1)" : "";
  const head = s.multiplier > 1 ? ` → × ${s.multiplier} = ${s.final}` : "";
  return `${armor} → ${btm} = ${s.afterBtm}${minNote}${head} → ${s.final} ponto(s).`;
}


/** Carimba uma rolagem montada pelo servidor em nome de um personagem. */
function stampRoll(characterName: string, core: RollCore): RollResult {
  return { id: "roll_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex"), timestamp: chatTime(), characterName, ...core };
}

/**
 * D.5 — death save de quem está em Mortal: 1d10 ≤ BODY − nível Mortal. Falhou,
 * morto. Chamado no dano (antes do stun) e na virada de turno. Devolve se
 * sobreviveu.
 */
function rollDeathSaveFor(room: GameRoom, target: RoomPlayer, rng: Rng): boolean {
  const sheet = target.sheet;
  const core = sheetDeathSaveRoll(rng, sheet);
  const survived = core.isCriticalSuccess;
  if (!survived) writeWound(sheet, { ...woundStateOf(sheet), isDead: true });
  const verdict = survived ? "passou, segue vivo" : "FALHOU — 💀 MORTO";
  pushSystemMessage(room, "death", `☠️ Death save de [${target.handle}]: ${verdict}.`, stampRoll(target.handle, core));
  return survived;
}

/**
 * O núcleo da D.1: aplica um dano já validado no alvo, espelha no token,
 * deixa a conta no chat e rola o stun save. `applyDamage` (o GM digita o
 * dano) e `resolveGmAttack` (o NPC acertou) passam por aqui.
 */
function applyDamageTo(room: GameRoom, target: RoomPlayer, raw: number, location: ArmorLocation, rng: Rng): HitOutcome {
  const sheet = target.sheet;
  const body = deriveCurrentStats(sheet).BODY;
  const before = woundStateOf(sheet);
  const steps = {
    raw: Math.min(MAX_RAW_DAMAGE, Math.floor(raw)),
    sp: armorSpAt(sheet.armor, location),
    btm: btmFromBody(body),
    location
  };
  const outcome = applyHit(before, resolveHit(steps), location);
  writeWound(sheet, outcome.after);

  const token = room.tacticalGrid?.tokens.find((t) => t.peerId === target.peerId);
  if (token) token.hp = outcome.after.woundLevel;

  const where = hitLocationRow(location).name;
  const track = `${woundRow(before.woundLevel).name} → ${woundRow(outcome.after.woundLevel).name} (${outcome.after.damagePoints}/${WOUND_TRACK_POINTS})`;
  let text = `🩸 [${target.handle}] levou ${steps.raw} de dano — ${where}: ${hitAuditText(outcome)}`;
  if (outcome.steps.penetrated) text += ` Ferimento: ${track}.`;
  if (outcome.limbLost) {
    text += ` ⚠️ Perda de membro: mais de 8 pontos em ${where} — decepado ou inutilizado (o death save em Mortal 0 que uma fonte pede fica com o Mestre).`;
  }
  if (outcome.killed === "head") text += " 💀 MORTO — mais de 8 pontos na cabeça.";
  if (outcome.killed === "track") text += " 💀 MORTO — o dano passou da última caixa da trilha.";
  pushSystemMessage(room, "damage", text);

  if (outcome.steps.final > 0) {
    // D.5 — dano que entra desfaz a estabilização (p. 105, via S9)...
    sheet.isStabilized = false;
    // ...e, em Mortal, o death save vem na hora e ANTES do stun (S9, p. 99).
    if (!outcome.after.isDead && mortalLevel(outcome.after.woundLevel) !== null) {
      rollDeathSaveFor(room, target, rng);
    }
  }

  // Stun save a cada dano que entrou (C.7), com o nível NOVO. Morto não rola.
  if (outcome.steps.final > 0 && !sheet.isDead) {
    const core = stunSaveRoll(rng, body, outcome.after.woundLevel);
    const verdict = core.isCriticalSuccess ? "passou, segue de pé" : "FALHOU — fora de ação até passar num novo teste";
    pushSystemMessage(room, "stun", `😵 Stun save de [${target.handle}]: ${verdict}.`, stampRoll(target.handle, core));
  }

  return outcome;
}

export function applyDamage(
  code: string,
  requesterPeerId: string,
  request: { targetId?: unknown; raw?: unknown; location?: unknown },
  rng: Rng = serverRng
): { room: GameRoom | null; outcome?: HitOutcome; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa aplica dano." };
  }

  const raw = Number(request?.raw);
  if (!Number.isFinite(raw) || raw < 0) return { room: null, error: "Dano inválido: informe um número de 0 para cima." };
  if (!isArmorLocation(request?.location)) return { room: null, error: "Localização inválida." };

  const { target, error } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return { room: null, error };

  return { room, outcome: applyDamageTo(room, target, raw, request.location, rng) };
}

// ------------------------------------------------------------
// O NPC ataca (Fase D, D.3)
// ------------------------------------------------------------
// O GM escolhe atacante, alvo e faixa de alcance no grid; o servidor rola o
// ataque com a ficha do NPC e, se acertou, o dano e o local, e aplica pelo
// núcleo da D.1. Tudo numa mutação só. Jogador não passa por aqui: ele rola
// o próprio ataque e o próprio dano, e o GM aplica o dano rolado (D.1).

/** Dificuldade livre aceita (ex.: o total do defensor no corpo a corpo). */
const MIN_FREE_DIFFICULTY = 1;
const MAX_FREE_DIFFICULTY = 50;

export function resolveGmAttack(
  code: string,
  requesterPeerId: string,
  request: { attackerId?: unknown; targetId?: unknown; range?: unknown; difficulty?: unknown },
  rng: Rng = serverRng
): { room: GameRoom | null; hit?: boolean; outcome?: HitOutcome; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa ataca pelos NPCs." };
  }

  // A faixa do livro, ou uma dificuldade livre dentro do limite.
  const band = rangeBandFor(request?.range);
  const free = Number(request?.difficulty);
  const hasFree = !band && Number.isInteger(free) && free >= MIN_FREE_DIFFICULTY && free <= MAX_FREE_DIFFICULTY;
  if (!band && !hasFree) {
    return { room: null, error: `Informe a faixa de alcance, ou uma dificuldade de ${MIN_FREE_DIFFICULTY} a ${MAX_FREE_DIFFICULTY}.` };
  }
  const difficulty = band ? band.difficulty : free;
  const difficultyLabel = band ? `${band.name} (${band.difficulty})` : `Dificuldade ${free}`;

  // Atacante: um NPC com ficha, pelo id ou pelo token dele.
  const attackerKey = sanitizeText(request?.attackerId, 64);
  const attackerToken = room.tacticalGrid?.tokens.find((t) => t.id === attackerKey);
  const attackerId = attackerToken?.peerId ?? attackerKey;
  const attacker = room.npcs?.[attackerId];
  if (!attacker) {
    return room.players[attackerId]
      ? { room: null, error: "Jogador rola o próprio ataque; aplique o dano que ele rolar." }
      : { room: null, error: "Atacante não encontrado entre os NPCs da mesa." };
  }
  if (attacker.sheet.isDead) return { room: null, error: `[${attacker.handle}] está morto e não ataca.` };

  const { target, error } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return { room: null, error };
  if (target === attacker) return { room: null, error: "O NPC não ataca a si mesmo." };

  const weapon = firstWeapon(attacker.sheet);
  const formula = weapon?.damage || FALLBACK_DAMAGE;
  if (!parseDamageFormula(formula)) return { room: null, error: `Fórmula de dano inválida na arma do NPC: ${formula}` };

  // O ataque, com o modificador do GM (C.4), em nome do NPC.
  const gm = gmModifier(room.combatModifier, room.modifierReason);
  const attack = stampRoll(attacker.handle, sheetAttackRoll(rng, attacker.sheet, weapon, gm));
  const hit = attackHits(attack, difficulty);
  const verdict = hit
    ? `acertou (${attack.total} ≥ ${difficulty})`
    : attack.isCriticalFailure
      ? "errou — fumble"
      : `errou (${attack.total} < ${difficulty})`;
  pushSystemMessage(room, "attack", `🎯 [${attacker.handle}] ataca [${target.handle}] — ${difficultyLabel}: ${verdict}.`, attack);
  if (!hit) return { room, hit };

  const { core } = sheetDamageRoll(rng, weapon);
  const damage = stampRoll(attacker.handle, core!);
  pushSystemMessage(room, "dmgroll", "", damage);
  const outcome = applyDamageTo(room, target, damage.total, damage.hitLocation ?? "Torso", rng);
  return { room, hit, outcome };
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

  // D.4 — a entrada é montada campo a campo. Antes era `{ ...e }`: qualquer
  // campo que o cliente mandasse virava estado da sala, persistido e
  // transmitido a todos, sem teto de tamanho.
  setInitiativeOrder(
    room,
    initiativeList.slice(0, MAX_INITIATIVE_ENTRIES).map((e, i) => ({
      playerId: sanitizeText(e?.playerId, 64) || `init_${i}`,
      handle: sanitizeText(e?.handle, 30) || "—",
      role: sanitizeText(e?.role, 30) || "—",
      score: Math.max(0, Math.min(999, Number(e?.score) || 0)),
      isCurrentTurn: false
    }))
  );
  return { room };
}

const MAX_INITIATIVE_ENTRIES = 50;

/** Grava a ordem e dá a vez ao primeiro — a rodada (re)começa. */
function setInitiativeOrder(room: GameRoom, entries: InitiativeEntry[]): void {
  room.initiativeList = entries.map((e, i) => ({ ...e, isCurrentTurn: i === 0 }));
  room.activeTurnIndex = 0;
}

// ============================================================
// INICIATIVA AUTOMÁTICA (Fase D, D.4)
// ============================================================
// 1d10 aberto + REF corrente + Combat Sense, rolado no servidor para todo
// combatente com ficha: os jogadores (menos o GM) e os NPCs vivos. Quem o GM
// pôs à mão (sem ficha) continua na lista com o valor dele — o ajuste manual
// segue valendo, antes e depois. Empate: o livro não dá desempate; a ordem
// fica a da rolagem (a `sort` do JS é estável).
export function rollInitiative(
  code: string,
  requesterPeerId: string,
  rng: Rng = serverRng
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa rola a iniciativa." };
  }

  const combatants = [
    ...Object.values(room.players).filter((p) => p.peerId !== room.gmPeerId),
    ...Object.values(room.npcs ?? {})
  ].filter((c) => c.sheet && !c.sheet.isDead);

  const rolled = combatants.map((c) => ({ c, roll: sheetInitiativeRoll(rng, c.sheet) }));
  const isCharacter = (id: string) => !!room.players[id] || !!room.npcs?.[id];
  const manual = room.initiativeList.filter((e) => !isCharacter(e.playerId));

  const entries: InitiativeEntry[] = [
    ...rolled.map(({ c, roll }) => ({
      playerId: c.peerId,
      handle: sanitizeText(c.handle, 30) || "—",
      role: sanitizeText(c.role, 30) || "—",
      score: roll.total,
      isCurrentTurn: false
    })),
    ...manual
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INITIATIVE_ENTRIES);
  setInitiativeOrder(room, entries);

  const lines = rolled.map(({ c, roll }) => `${c.handle} ${roll.total} (${roll.details})`);
  pushSystemMessage(room, "initiative", `⚔️ Iniciativa rolada pelo servidor: ${lines.join(" · ") || "nenhum combatente com ficha"}.`);
  return { room };
}

// GM Power: Advance to next turn (T1.3)
export function nextTurn(code: string, requesterPeerId: string, rng: Rng = serverRng): { room: GameRoom | null; error?: string } {
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

  // D.5 — a vez chegou a quem está em Mortal, vivo e não estabilizado: o
  // servidor rola o death save do turno. Entrada posta à mão não tem ficha.
  const current = room.initiativeList[room.activeTurnIndex];
  const who = current && (room.players[current.playerId] ?? room.npcs?.[current.playerId]);
  if (who?.sheet && !who.sheet.isDead && !who.sheet.isStabilized && mortalLevel(woundStateOf(who.sheet).woundLevel) !== null) {
    rollDeathSaveFor(room, who, rng);
  }

  return { room };
}

/**
 * D.5 — o GM marca (ou desfaz) a estabilização, depois do teste de First Aid
 * ou Medical Tech que ele conduz. Só faz sentido em Mortal.
 */
export function setStabilized(
  code: string,
  requesterPeerId: string,
  request: { targetId?: unknown; stabilized?: unknown }
): { room: GameRoom | null; error?: string } {
  const room = getRoom(code);
  if (!room) return { room: null, error: "Sala não encontrada" };
  if (!checkIsGm(room, requesterPeerId)) {
    return { room: null, error: "Acesso Negado! Apenas o Mestre da Mesa estabiliza." };
  }
  const { target, error } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return { room: null, error };
  const stabilized = request?.stabilized === true;
  if (stabilized && mortalLevel(woundStateOf(target.sheet).woundLevel) === null) {
    return { room: null, error: `[${target.handle}] não está em Mortal: não há o que estabilizar.` };
  }
  target.sheet.isStabilized = stabilized;
  pushSystemMessage(
    room,
    "stabilize",
    stabilized
      ? `🩹 [${target.handle}] foi estabilizado: para de rolar o death save a cada turno.`
      : `🩹 [${target.handle}] não está mais estabilizado.`
  );
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
        pushChat(room, {
          id: "msg_gm_transfer_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `👑 [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. [${newGm.handle}] assumiu como novo Mestre de Jogo!`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        });
      } else {
        room.gmPeerId = undefined;
        pushChat(room, {
          id: "msg_gm_left_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          senderHandle: "SISTEMA_NET",
          senderRole: "gm",
          text: `⚠️ [SISTEMA] O Mestre [${playerHandle}] deixou a mesa. A mesa aguarda um novo Mestre de Jogo.`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        });
      }
    }

    pushChat(room, {
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
