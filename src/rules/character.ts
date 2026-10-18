// ============================================================
// NETSHEET ENGINE — PERSONAGEM: ATRIBUTOS DERIVADOS (Fase C)
// ============================================================
// BTM (C.2), efeito de ferimento (C.5), atributos correntes (C.6), os alvos
// de stun e death save (C.7) e a perda de humanidade de um implante (G.23).
// Tudo derivado das tabelas do livro (tables.ts), sem estado e sem rede.
//
// `deriveCurrentStats` é o ÚNICO lugar que decide com que número uma rolagem
// entra. Cliente e servidor chamam a mesma função, e o servidor nunca confia
// no `currentStats` que o cliente manda: ele é recalculado a partir da ficha.
// ============================================================

import type { CharacterSheet, CharacterStats, CyberwareItem, GearItem, StatName } from '../types/cyberpunk';
import {
  BODY_TYPE_TABLE,
  CARRY_KG_PER_BODY,
  LIFT_KG_PER_BODY,
  HUMANITY_LOSS_PER_EMP_POINT,
  HUMANITY_PER_EMP,
  WOUND_TRACK,
  type BodyTypeRow,
  type WoundLevelRow
} from './tables';
import { parseDamageFormula, rollDamageFormula, type Rng } from './dice';
import { armorEvTotal } from './damage';

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

/** Custo fixo: um inteiro, sem dado. */
const FIXED_HUMANITY_COST = /^\d{1,3}$/;

/**
 * G.23 — o custo de humanidade do implante dá para resolver aqui? Número
 * inteiro ou `NdM±X` (o parser do dano). `1d6/2` e `0.5` não: o jogador digita a
 * perda, inteira — a ficha guarda inteiro, e a fração fica com ADIAR na conferência.
 */
export function humanityCostIsReadable(cost: string): boolean {
  const text = String(cost).trim();
  return FIXED_HUMANITY_COST.test(text) || parseDamageFormula(text) !== null;
}

/**
 * G.23 — a perda de humanidade de UM implante, rolada uma vez ao instalar, a
 * partir do custo do item (S8, S1 — ver a conferência). Número vale o número;
 * `NdM±X` rola com o RNG injetado; o resto devolve `null` (o jogador digita).
 * Nunca negativa.
 */
export function rollHumanityLoss(rng: Rng, cost: string): number | null {
  const text = String(cost).trim();
  if (FIXED_HUMANITY_COST.test(text)) return Number(text);
  const roll = rollDamageFormula(rng, text);
  return roll ? Math.max(0, roll.total) : null;
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
 * Os atributos com que o personagem ROLA agora: base → REF menos o EV da
 * armadura (K.2c) → EMP menos o cromo → efeito do ferimento. Toda rolagem, do
 * cliente ou da mesa, lê daqui.
 *
 * O EV sai ANTES do ferimento: só o S8 dá a ordem, e é a escolha do projeto
 * (o EV muda o atributo corrente; o ferimento age sobre o corrente) — pergunta
 * aberta na conferência.
 */
export function deriveCurrentStats(
  sheet: Pick<CharacterSheet, 'stats' | 'woundLevel' | 'cyberware' | 'armor'> | Partial<CharacterSheet>
): CharacterStats {
  const base = Object.fromEntries(STAT_NAMES.map((s) => [s, statOf(sheet.stats, s)])) as unknown as CharacterStats;
  base.REF = Math.max(0, base.REF - armorEvTotal(sheet.armor));
  base.EMP = empAfterHumanityLoss(base.EMP, humanityLossTotal(sheet.cyberware));
  return applyWoundEffect(base, Number(sheet.woundLevel) || 0);
}

// ------------------------------------------------------------
// Carga (K.2d)
// ------------------------------------------------------------

/** Carry: o que o personagem carrega, em kg — BODY corrente × 10 (S1, S6, S8). */
export function carryKg(body: number): number {
  return Math.max(0, body) * CARRY_KG_PER_BODY;
}

/** Lift: o peso morto que levanta, em kg — BODY corrente × 40 (S1, S6, S8). */
export function liftKg(body: number): number {
  return Math.max(0, body) * LIFT_KG_PER_BODY;
}

/** Peso do inventário: cada item × a quantidade, em kg, com duas casas. */
export function gearWeightKg(gear: readonly Pick<GearItem, 'weightKg' | 'qty'>[] | undefined): number {
  const total = (gear ?? []).reduce(
    (kg, g) => kg + Math.max(0, Number(g.weightKg) || 0) * Math.max(0, Math.floor(Number(g.qty) || 0)),
    0
  );
  return Math.round(total * 100) / 100;
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
