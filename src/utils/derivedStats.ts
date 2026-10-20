/**
 * Fase 9 (T9.2) — ESTATÍSTICAS DERIVADAS CP2020
 * ==============================================
 * Regras puras (sem DOM/estado) extraídas dos componentes StatBlock,
 * CyberwareManager e WeaponsArmor, para serem testáveis em unit (Vitest).
 *
 * Desde a Fase C, o BTM, a humanidade e os atributos correntes moram em
 * src/rules/character.ts (fonte única, lida também pelo servidor). Aqui
 * ficam o que ainda não passou pela conferência contra o livro:
 * - Run: MA × 3 metros por turno; Leap: Run ÷ 4, para baixo (K.7c — a tabela
 *   em src/rules/tables.ts). O Walk, que não existe no livro, saiu (RUL-11).
 * - Humanidade restante, para o painel de cromo.
 * O SP por localização (`armorSpAt`) foi para src/rules/damage.ts na Fase D.
 */

import type { CyberwareItem } from '../types/cyberpunk';
import { humanityFromEmp, humanityLossTotal } from '../rules/character';
import { armorSpAt } from '../rules/damage';
import { LEAP_RUN_DIVISOR, RUN_METERS_PER_MA } from '../rules/tables';

export { humanityFromEmp, humanityLossTotal };

// ---------------------------------------------------------------------------
// Humanidade
// ---------------------------------------------------------------------------

/**
 * Humanidade restante: EMP × 10 − Σ actualHL, nunca negativa
 * (0 = limiar de cyberpsychose, conforme o aviso do CyberwareManager).
 */
export function humanityRemaining(emp: number, cyberware: Pick<CyberwareItem, 'actualHL'>[]): number {
  return Math.max(0, humanityFromEmp(emp) - humanityLossTotal(cyberware));
}

// ---------------------------------------------------------------------------
// Movimento (Run/Leap)
// ---------------------------------------------------------------------------

/** Run em metros por turno: MA × 3 (S1, S8). */
export function runFromMa(ma: number): number {
  return ma * RUN_METERS_PER_MA;
}

/** Leap em metros: Run ÷ 4, para baixo (S1, S8). */
export function leapFromMa(ma: number): number {
  return Math.floor(runFromMa(ma) / LEAP_RUN_DIVISOR);
}

// ---------------------------------------------------------------------------
// Armadura — SP por localização
// ---------------------------------------------------------------------------

// Desde a Fase D (D.1) mora em src/rules/damage.ts: o servidor a lê para
// aplicar dano. Reexportada aqui para a ficha não mudar de import.
export { armorSpAt };
