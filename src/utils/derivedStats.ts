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
 * - SP (Stopping Power) da peça EQUIPADA que cobre a localização.
 */

import type { ArmorLocation, ArmorPiece, CyberwareItem } from '../types/cyberpunk';
import { humanityFromEmp, humanityLossTotal } from '../rules/character';

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

/**
 * SP (Stopping Power) da peça EQUIPADA que cobre a localização corporal.
 * Retorna 0 quando não há proteção equipada naquela localização
 * (sem peça, peça desequipada ou localização sem cobertura).
 */
export function armorSpAt(armor: ArmorPiece[], location: ArmorLocation): number {
  return armor.find((a) => a.location === location && a.equipped)?.sp ?? 0;
}
