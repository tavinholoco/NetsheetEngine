// ============================================================
// NETSHEET ENGINE — MOTOR DE DADOS FNFF (Fase C, C.1)
// ============================================================
// Uma implementação só, usada pelo cliente (rolador da ficha) e pelo servidor
// (rolagens da mesa). Antes da Fase C eram duas, e divergiam: o servidor
// explodia o 10 uma vez só, o cliente mandava acerto no tronco para a perna
// esquerda, e os dois subtraíam 1d10 no fumble — regra do Cyberpunk RED.
//
// Função pura, com o RNG INJETADO: as regras nunca escolhem de onde vem o
// dado. O servidor passa `crypto.randomInt`, o cliente passa Web Crypto, e o
// teste passa uma fila de valores — inclusive a MESMA fila para os dois lados,
// que é o teste de paridade (C.10).
//
// Por que não a biblioteca @dice-roller (ADR 0004, revisada na Fase C): o
// gerador dela é global, não aceita RNG por chamada, e ela levaria o mathjs
// para o servidor, onde a fórmula de dano vem da rede.
// ============================================================

import {
  CRITICAL_FACE,
  FUMBLE_FACE,
  HIT_LOCATIONS,
  MAX_EXPLOSION_DICE,
  type HitLocationRow
} from './tables';

/** Devolve um inteiro uniforme em `1..sides`. */
export type Rng = (sides: number) => number;

/** Uma parcela somada ao dado, com nome — vira o detalhe auditável da rolagem. */
export interface Modifier {
  label: string;
  value: number;
}

// ------------------------------------------------------------
// d10 aberto: explode no 10 (encadeando), fumble no 1
// ------------------------------------------------------------

export interface OpenD10 {
  /** Todos os dados da cadeia, na ordem. */
  dice: number[];
  /** O primeiro dado — é ele que decide explosão e fumble. */
  natural: number;
  /** Soma da cadeia. */
  sum: number;
  exploded: boolean;
  fumble: boolean;
  /** true se a cadeia parou no teto de segurança, não num dado menor que 10. */
  capped: boolean;
}

/**
 * Rola o d10 do FNFF. Um 10 rola de novo e soma, e cada 10 seguinte continua
 * (decisão 1 do plano). Só o PRIMEIRO dado pode ser fumble: um 1 depois de uma
 * explosão é só um 1.
 */
export function rollOpenD10(rng: Rng): OpenD10 {
  const natural = rng(10);
  const dice = [natural];
  let capped = false;
  if (natural === CRITICAL_FACE) {
    let last = natural;
    while (last === CRITICAL_FACE) {
      if (dice.length > MAX_EXPLOSION_DICE) {
        capped = true;
        break;
      }
      last = rng(10);
      dice.push(last);
    }
  }
  return {
    dice,
    natural,
    sum: dice.reduce((a, b) => a + b, 0),
    exploded: natural === CRITICAL_FACE,
    fumble: natural === FUMBLE_FACE,
    capped
  };
}

// ------------------------------------------------------------
// Teste: 1d10 + atributo + perícia + modificadores
// ------------------------------------------------------------

export interface CheckResult {
  roll: OpenD10;
  modifiers: Modifier[];
  /** Soma dos modificadores. */
  bonus: number;
  total: number;
  /**
   * Dado da tabela de fumble (1–10), rolado quando o primeiro dado é 1. O
   * resultado já é falha automática; este dado diz o QUE deu errado, e o GM
   * lê o efeito na tabela da categoria no livro.
   */
  fumbleRoll: number | null;
  /** Trilha auditável: cada dado e cada parcela, com nome. */
  details: string;
}

const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** Descreve a cadeia de dados: "5", "10 → 10 → 3 = 23", "1". */
function describeDice(roll: OpenD10): string {
  if (roll.dice.length === 1) return String(roll.natural);
  return `${roll.dice.join(' → ')} = ${roll.sum}`;
}

/**
 * Resolve um teste. No fumble o total NÃO perde 1d10 — no Cyberpunk 2020 o 1
 * natural é falha automática, e o segundo dado vai para a tabela de fumble.
 * (Subtrair 1d10 é regra do RED; estava nos dois motores antes da Fase C.)
 */
export function resolveCheck(rng: Rng, modifiers: Modifier[]): CheckResult {
  const roll = rollOpenD10(rng);
  const fumbleRoll = roll.fumble ? rng(10) : null;
  const bonus = modifiers.reduce((acc, m) => acc + m.value, 0);
  const total = roll.sum + bonus;

  let details = `1d10: ${describeDice(roll)}`;
  if (roll.exploded) details += ' 🔥 explodiu';
  if (roll.capped) details += ` (parou no teto de ${MAX_EXPLOSION_DICE} dados extras)`;
  if (fumbleRoll !== null) details += ` 💀 FUMBLE, falha automática (tabela de fumble: ${fumbleRoll})`;
  for (const m of modifiers) details += ` + ${m.label} (${signed(m.value)})`;
  details += ` = ${total}`;

  return { roll, modifiers, bonus, total, fumbleRoll, details };
}

// ------------------------------------------------------------
// Dano: NdM, NdM+X, NdM−X
// ------------------------------------------------------------

export interface DamageFormula {
  count: number;
  sides: number;
  bonus: number;
}

/** Tetos que o servidor já aplicava: nenhuma arma do livro passa disso. */
export const MAX_DAMAGE_DICE = 20;
export const MAX_DAMAGE_SIDES = 100;

/**
 * Lê uma fórmula de dano. Devolve `null` se for inválida ou passar dos tetos —
 * a fórmula vem da ficha, que vem da rede, então nada de avaliar expressão.
 */
export function parseDamageFormula(formula: string): DamageFormula | null {
  const m = /^(\d{1,3})d(\d{1,3})([+-]\d{1,3})?$/.exec(String(formula).replace(/\s+/g, '').toLowerCase());
  if (!m) return null;
  const count = Number(m[1]);
  const sides = Number(m[2]);
  const bonus = m[3] ? Number(m[3]) : 0;
  if (count < 1 || count > MAX_DAMAGE_DICE || sides < 2 || sides > MAX_DAMAGE_SIDES) return null;
  return { count, sides, bonus };
}

export interface DamageRoll {
  formula: DamageFormula;
  rolls: number[];
  total: number;
}

export function rollDamageFormula(rng: Rng, formula: string): DamageRoll | null {
  const parsed = parseDamageFormula(formula);
  if (!parsed) return null;
  const rolls = Array.from({ length: parsed.count }, () => rng(parsed.sides));
  return { formula: parsed, rolls, total: rolls.reduce((a, b) => a + b, parsed.bonus) };
}

// ------------------------------------------------------------
// Local de impacto
// ------------------------------------------------------------

export function hitLocationForFace(face: number): HitLocationRow {
  const row = HIT_LOCATIONS.find((r) => r.faces.includes(face));
  if (!row) throw new RangeError(`Face de d10 fora de 1..10: ${face}`);
  return row;
}

/** Rótulo exibido: "Tronco (2-4)", "Cabeça (1) [DANO DOBRADO X2!]". */
export function hitLocationLabel(row: HitLocationRow): string {
  const base = `${row.name} (${row.facesLabel})`;
  return row.damageMultiplier > 1 ? `${base} [DANO DOBRADO X${row.damageMultiplier}!]` : base;
}

export interface HitLocationRoll {
  face: number;
  row: HitLocationRow;
  label: string;
}

export function rollHitLocation(rng: Rng): HitLocationRoll {
  const face = rng(10);
  const row = hitLocationForFace(face);
  return { face, row, label: hitLocationLabel(row) };
}

// ------------------------------------------------------------
// Save: 1d10 ≤ alvo
// ------------------------------------------------------------

export interface SaveResult {
  roll: number;
  target: number;
  success: boolean;
}

/** Stun e death save do 2020: passa com resultado MENOR OU IGUAL ao alvo. */
export function resolveSave(rng: Rng, target: number): SaveResult {
  const roll = rng(10);
  return { roll, target, success: roll <= target };
}
