/**
 * Fase 9 (T9.2) — ESTATÍSTICAS DERIVADAS CP2020
 * ==============================================
 * Regras puras (sem DOM/estado) extraídas dos componentes StatBlock,
 * CyberwareManager e WeaponsArmor, para serem testáveis em unit (Vitest).
 *
 * Regras implementadas (Cyberpunk 2020 2ª ed.):
 * - BTM (Body Type Modifier): tabela sobre BODY + REF — o dano é reduzido
 *   pelo BTM no combate FNFF.
 * - Humanidade: EMP × 10 (máximo 100 na criação, EMP 10).
 * - Run/Walk: MA × 3 metros por turno; Walk = metade do Run (piso).
 * - Perda de humanidade: soma do `actualHL` dos ciberimplantes instalados;
 *   a humanidade restante nunca é negativa (cyberpsychose em 0).
 * - SP (Stopping Power): SP da peça de armadura EQUIPADA que cobre a
 *   localização corporal (0 se não houver proteção).
 */

import type { ArmorLocation, ArmorPiece, CyberwareItem } from '../types/cyberpunk';

// ---------------------------------------------------------------------------
// BTM (Body Type Modifier) — tabela CP2020 sobre BODY + REF
// ---------------------------------------------------------------------------

/**
 * BTM derivado de BODY + REF (tabela CP2020, implementação atual do StatBlock):
 *
 *   BODY+REF  ≥26  ≥24  ≥22  ≥20  ≥18  ≥16  ≥14   <14
 *   BTM        5    4    3    2    1    0   −1    −2
 *
 * @param body Atributo BODY (2–15 com cromo).
 * @param ref Atributo REF (2–15 com cromo).
 */
export function btmFromStats(body: number, ref: number): number {
  const bodyRef = body + ref;
  if (bodyRef >= 26) return 5;
  if (bodyRef >= 24) return 4;
  if (bodyRef >= 22) return 3;
  if (bodyRef >= 20) return 2;
  if (bodyRef >= 18) return 1;
  if (bodyRef >= 16) return 0;
  if (bodyRef >= 14) return -1;
  return -2;
}

// ---------------------------------------------------------------------------
// Humanidade
// ---------------------------------------------------------------------------

/** Humanidade máxima derivada de EMP (EMP × 10). */
export function humanityFromEmp(emp: number): number {
  return emp * 10;
}

/** Soma da perda real de humanidade (`actualHL`) dos ciberimplantes. */
export function humanityLossTotal(cyberware: Pick<CyberwareItem, 'actualHL'>[]): number {
  return cyberware.reduce((acc, cw) => acc + (cw.actualHL || 0), 0);
}

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
