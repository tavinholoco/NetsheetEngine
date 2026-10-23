// L.3b (E.18) — O ferimento na ficha (decisão 7): pontos de 0 a 40, o nível derivado. Puro — os assentos, os poderes do GM e o combate escrevem por aqui.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import { CharacterSheet } from "../../src/types/cyberpunk.js";
import { deriveCurrentStats } from "../../src/rules/character.js";
import { woundStateOf, type WoundState } from "../../src/rules/damage.js";

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
export function writeWound(sheet: CharacterSheet, wound: WoundState): void {
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
export function withServerWound(clientSheet: CharacterSheet, serverSheet: CharacterSheet): CharacterSheet {
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
export function manualWoundLevel(woundLevel: unknown): number {
  const n = Math.round(Number(woundLevel));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
}
