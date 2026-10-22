// L.3b (E.18) — O chat da mesa: o horário no fuso de Brasília (E.10), o teto de mensagens (E.03), as mensagens do sistema e o `postChatMessage`.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import crypto from "crypto";
import { GameRoom, ChatMessage } from "../../src/types/multiplayer.js";
import { RollResult } from "../../src/types/cyberpunk.js";
import { fail } from "../errors.js";
import { type RoomResult, getRoom, sanitizeText } from "./rooms.js";

/** Mensagens guardadas no chat da sala — o teto que já existia em dois caminhos. */
export const MAX_CHAT_MESSAGES = 100;

/**
 * Fase E (E.10 → E.3e) — o fuso do horário da mesa. O servidor monta o horário
 * de cada mensagem como texto, e o cliente o mostra como veio; sem o fuso
 * explícito, valia o do processo — e o Render roda em UTC: às 22:02 de
 * Brasília a mesa via 01:02. A mesa é de convidados do dono, no Brasil (sem
 * horário de verão desde 2019). Jogador de outro fuso é a versão maior —
 * mandar o instante e formatar no cliente —, ADIAR no ledger da E.
 */
export const CHAT_TIME_ZONE = "America/Sao_Paulo";

/** Horário curto do chat (`22:02`), no fuso da mesa — o único formatador. */
export function chatTime(at: Date = new Date()): string {
  return at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CHAT_TIME_ZONE });
}

/** Guarda uma mensagem no chat com o teto — o ÚNICO caminho de escrita. Antes,
 *  dois caminhos tinham teto e oito não; e o do jogador tirava uma só. */
export function pushChat(room: GameRoom, message: ChatMessage): void {
  room.chatMessages.push(message);
  if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
    room.chatMessages.splice(0, room.chatMessages.length - MAX_CHAT_MESSAGES);
  }
}

// Chat da mesa — handle e role derivados do servidor (anti-spoofing)
export function postChatMessage(
  code: string,
  requesterPeerId: string,
  text: string,
  rollResult?: RollResult
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  const player = room.players[requesterPeerId];
  if (!player) return fail("not_in_room", "Você não está nesta mesa.");

  const safeText = sanitizeText(text, 500);
  if (!safeText && !rollResult) return fail("invalid_input", "Mensagem vazia.");

  const newMsg: ChatMessage = {
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    senderHandle: player.handle,
    senderRole: requesterPeerId === room.gmPeerId ? "gm" : "player",
    text: safeText,
    timestamp: chatTime(),
    isDiceRoll: !!rollResult,
    rollResult
  };

  pushChat(room, newMsg);

  return { room };
}

/** Mensagem do sistema no chat da mesa — pelo `pushChat`, com o teto de todo caminho (E.03). */
export function pushSystemMessage(room: GameRoom, prefix: string, text: string, rollResult?: RollResult): void {
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
