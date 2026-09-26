// ============================================================
// NETSHEET ENGINE — PERSONAGEM: ATRIBUTOS DERIVADOS (Fase C)
// ============================================================
// BTM (C.2), efeito de ferimento (C.5), atributos correntes (C.6) e os alvos
// de stun e death save (C.7). Tudo derivado das tabelas do livro
// (tables.ts), sem estado e sem rede.
//
// `deriveCurrentStats` é o ÚNICO lugar que decide com que número uma rolagem
// entra. Cliente e servidor chamam a mesma função, e o servidor nunca confia
// no `currentStats` que o cliente manda: ele é recalculado a partir da ficha.
// ============================================================

import type { CharacterSheet, CharacterStats, CyberwareItem, StatName } from '../types/cyberpunk';
import {
  BODY_TYPE_TABLE,
  HUMANITY_LOSS_PER_EMP_POINT,
  HUMANITY_PER_EMP,
  WOUND_TRACK,
  type BodyTypeRow,
  type WoundLevelRow
} from './tables';

export const STAT_NAMES: readonly StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

// ------------------------------------------------------------
// Tipo corporal (C.2)
// ------------------------------------------------------------

/** Linha da tabela de tipo corporal. BODY abaixo de 2 cai na primeira linha. */
export function bodyTypeFor(body: number): BodyTypeRow {
  const b = Number.isFinite(body) ? Math.floor(body) : BODY_TYPE_TABLE[0].minBody;
  return BODY_TYPE_TABLE.find((row) => b >= row.minBody && b <= row.maxBody) ?? BODY_TYPE_TABLE[0];
}

/** BTM: só BODY, de 0 a −5. Reduz o dano que passou da armadura (Fase D). */
export function btmFromBody(body: number): number {
  return bodyTypeFor(body).btm;
}

// ------------------------------------------------------------
// Ferimento (C.5)
// ------------------------------------------------------------

/** Linha da trilha para um `woundLevel` qualquer (grampeado em 0..10). */
export function woundRow(woundLevel: number): WoundLevelRow {
  const level = Number.isFinite(woundLevel) ? Math.round(woundLevel) : 0;
  return WOUND_TRACK[Math.max(0, Math.min(WOUND_TRACK.length - 1, level))];
}

/** Aplica o efeito de UM nível de ferimento. Os efeitos não se acumulam entre níveis. */
export function applyWoundEffect(stats: CharacterStats, woundLevel: number): CharacterStats {
  const effect = woundRow(woundLevel).effect;
  const out = { ...stats };
  if (effect.kind === 'subtract') {
    for (const s of effect.stats) out[s] = Math.max(0, out[s] - effect.amount);
  } else if (effect.kind === 'divide') {
    for (const s of effect.stats) out[s] = Math.ceil(out[s] / effect.divisor);
  }
  return out;
}

/** Texto curto do efeito, para a ficha: "—", "REF −2", "REF, INT, COOL ÷2". */
export function woundEffectText(woundLevel: number): string {
  const effect = woundRow(woundLevel).effect;
  if (effect.kind === 'subtract') return `${effect.stats.join(', ')} −${effect.amount}`;
  if (effect.kind === 'divide') return `${effect.stats.join(', ')} ÷${effect.divisor}`;
  return '—';
}

// ------------------------------------------------------------
// Humanidade → EMP
// ------------------------------------------------------------

/** Soma da perda real de humanidade dos implantes. */
export function humanityLossTotal(cyberware: readonly Pick<CyberwareItem, 'actualHL'>[] | undefined): number {
  return (cyberware ?? []).reduce((acc, cw) => acc + Math.max(0, Number(cw.actualHL) || 0), 0);
}

/** EMP depois do cromo: −1 a cada 10 de humanidade perdida, nunca negativo. */
export function empAfterHumanityLoss(emp: number, loss: number): number {
  return Math.max(0, emp - Math.floor(Math.max(0, loss) / HUMANITY_LOSS_PER_EMP_POINT));
}

/** Humanidade máxima: EMP × 10. */
export function humanityFromEmp(emp: number): number {
  return emp * HUMANITY_PER_EMP;
}

// ------------------------------------------------------------
// Atributos correntes (C.6)
// ------------------------------------------------------------

/** Atributo numérico da ficha, com 0 para ausente ou lixo. */
function statOf(stats: Partial<CharacterStats> | undefined, s: StatName): number {
  const v = Number(stats?.[s]);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Os atributos com que o personagem ROLA agora: base → EMP menos o cromo →
 * efeito do ferimento. Toda rolagem, do cliente ou da mesa, lê daqui.
 *
 * Fica de fora, com gatilho na conferência: cromo que soma atributo (o tipo
 * não tem esse campo) e o EV da armadura (a armadura é modelada por peça de
 * localização, e somar o EV contaria a mesma jaqueta várias vezes).
 */
export function deriveCurrentStats(
  sheet: Pick<CharacterSheet, 'stats' | 'woundLevel' | 'cyberware'> | Partial<CharacterSheet>
): CharacterStats {
  const base = Object.fromEntries(STAT_NAMES.map((s) => [s, statOf(sheet.stats, s)])) as unknown as CharacterStats;
  base.EMP = empAfterHumanityLoss(base.EMP, humanityLossTotal(sheet.cyberware));
  return applyWoundEffect(base, Number(sheet.woundLevel) || 0);
}

// ------------------------------------------------------------
// Saves (C.7)
// ------------------------------------------------------------

/** Stun save: 1d10 ≤ BODY + modificador do nível (0 a −9). */
export function stunSaveTarget(body: number, woundLevel: number): number {
  return body + woundRow(woundLevel).stunModifier;
}

/** Nível Mortal (0–6) ou `null` fora do Mortal. */
export function mortalLevel(woundLevel: number): number | null {
  return woundRow(woundLevel).mortalLevel;
}

/** Death save: 1d10 ≤ BODY − nível Mortal. Fora do Mortal o alvo é o BODY (o livro não exige o teste). */
export function deathSaveTarget(body: number, woundLevel: number): number {
  return body - (mortalLevel(woundLevel) ?? 0);
}
