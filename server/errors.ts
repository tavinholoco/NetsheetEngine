/**
 * Fase E (E.01 → E.3c) — OS CÓDIGOS DE ERRO DA API
 * ================================================
 * Até a E conviviam três jeitos de classificar erro: o `respondWithResult`
 * decidia 404 × 403 procurando "não encontrad" no TEXTO da mensagem; o
 * `respondToCombat`, por `startsWith("Acesso Negado")`; e a R.1 estreou um
 * `code` estável em quatro respostas. Renomear uma mensagem mudava o status da
 * API em silêncio — e a mensagem em inglês ("Room not found") chegava à tela.
 *
 * Agora: todo erro sai como `{ error, code }`; o `code` vem deste conjunto
 * fechado, e o status sai do `code` por esta tabela — a única. A mensagem é
 * para gente e muda à vontade; o cliente decide pelo `code` (o `ApiError` o lê
 * desde a R.1). É a versão 10× menor da RFC 9457 (Problem Details), escolhida
 * no plano: a RFC inteira só com um sintoma que o `code` não resolva.
 */

export const STATUS_BY_CODE = {
  /** Entrada que não confere: campo faltando, tipo errado, valor fora da faixa. */
  invalid_input: 400,
  /** Corpo que não é JSON. */
  invalid_json: 400,
  /** Grid malformado (E.02 — SEC-14). */
  invalid_grid: 400,
  /** Sessão de MESA inválida ou revogada — o cliente reconecta à sala (T3.3). */
  session_invalid: 401,
  /** Sessão de CONTA (JWT do Supabase) ausente ou inválida — só a IA pede. */
  login_required: 401,
  /** Ação do Mestre pedida por quem não é o Mestre. */
  gm_only: 403,
  /** Ação que ninguém pode fazer assim (ex.: o GM remover a si mesmo). */
  not_allowed: 403,
  /** Quem pediu tem sessão, mas não está (mais) na mesa. */
  not_in_room: 403,
  /** R.3 — quem o GM removeu não volta pelo mesmo `peerId`. */
  removed_by_gm: 403,
  room_not_found: 404,
  /** O alvo da ação (jogador, NPC, token) não está na mesa. */
  target_not_found: 404,
  /** Rota da API que não existe. */
  route_not_found: 404,
  /** R.1 — o assento é de outro; volta-se a ele só com o token vigente. */
  seat_taken: 409,
  /** R.2 — o código já é de uma mesa. */
  room_exists: 409,
  /** R.16 — 16 assentos, contando as fichas geradas. */
  room_full: 409,
  /** E.03 — 32 NPCs por sala. */
  npcs_full: 409,
  /** A ação não cabe no estado atual (NPC morto atacando, estabilizar fora de Mortal). */
  invalid_state: 409,
  /** E.03 — ficha saneada acima de 64 KB. */
  sheet_too_large: 413,
  /** Corpo acima de 1 MB. */
  payload_too_large: 413,
  /** Prompt da IA acima do teto. */
  prompt_too_large: 413,
  rate_limited: 429,
  internal_error: 500,
  /** O provedor de IA falhou. */
  ai_failed: 502,
  /** A IA não está configurada no servidor. */
  ai_unavailable: 503,
  /** E.03 — o máximo de salas abertas (`MAX_ROOMS`). */
  rooms_full: 503
} as const;

export type ErrorCode = keyof typeof STATUS_BY_CODE;

/** Um erro do `roomManager`: a sala não muda, e a rota responde pelo `code`. */
export interface RoomFailure {
  room: null;
  error: string;
  code: ErrorCode;
}

export function fail(code: ErrorCode, error: string): RoomFailure {
  return { room: null, error, code };
}
