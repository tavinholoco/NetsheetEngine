/**
 * Fase 9 (T9.2) — ESTATÍSTICAS DERIVADAS CP2020
 * ==============================================
 * Regras puras (sem DOM/estado) extraídas dos componentes StatBlock,
 * CyberwareManager e WeaponsArmor, para serem testáveis em unit (Vitest).
 *
 * Desde a Fase C, o BTM, a humanidade e os atributos correntes moram em
 * src/rules/character.ts (fonte única, lida também pelo servidor). Aqui
 * ficam o que ainda não passou pela conferência contra o livro:
 * - Run/Walk: MA × 3 metros por turno; Walk = metade do Run (piso).
 *   (Walk não existe no livro — RUL-11, Fase K.)
 * - Humanidade restante, para o painel de cromo.
 * O SP por localização (`armorSpAt`) foi para src/rules/damage.ts na Fase D.
 */

import type { CyberwareItem } from '../types/cyberpunk';
import { humanityFromEmp, humanityLossTotal } from '../rules/character';
import { armorSpAt } from '../rules/damage';

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
// Movimento (Run/Walk)
// ---------------------------------------------------------------------------

/** Run em metros por turno: MA × 3. */
export function runFromMa(ma: number): number {
  return ma * 3;
}

/** Walk em metros por turno: metade do Run, arredondado para baixo. */
export function walkFromMa(ma: number): number {
  return Math.floor(runFromMa(ma) / 2);
}

// ---------------------------------------------------------------------------
// Armadura — SP por localização
// ---------------------------------------------------------------------------

// Desde a Fase D (D.1) mora em src/rules/damage.ts: o servidor a lê para
// aplicar dano. Reexportada aqui para a ficha não mudar de import.
export { armorSpAt };
