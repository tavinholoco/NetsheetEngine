import { DiceRoll } from '@dice-roller/rpg-dice-roller';
import type { RollResult, RollType } from '../types/cyberpunk';

/**
 * Fase 6 (T6.1/T6.2) — MOTOR DE DADOS FNFF (Cyberpunk 2020)
 * =========================================================
 * Rolagens auditáveis usando `@dice-roller/rpg-dice-roller` (notação padrão
 * de RPG + audit trail em `DiceRoll.output`).
 *
 * Regras FNFF implementadas:
 * - Perícia/ataque: `1d10!` — 10 explode (+1d10, encadeado); 1 = falha crítica
 *   (fumble: rola 1d10 e SUBTRAI do total).
 * - Dano: fórmula `NdM±X` (ex.: `2d6+2`) + local de impacto (1d10).
 * - Death save: `1d10 ≤ BODY`.
 *
 * NOTA: este motor é a camada CLIENTE (rolador do app/histórico). As rolagens
 * da MESA multiplayer continuam server-authoritative em `rollDiceForPlayer`
 * (T5.4), que usa `crypto.randomInt` no servidor — o cliente nunca rola por lá.
 */

export interface DiceRollContext {
  /** Handle do personagem (default `'Edgerunner'`). */
  characterName?: string;
  /** Rótulo exibido no histórico/banner (default por tipo de rolagem). */
  label?: string;
  /** Nome do atributo usado no detalhe de perícia (default `'REF'`). */
  statName?: string;
}

/** Resultado do local de impacto (1d10) — usado por `rollDamage`. */
export interface ImpactLocation {
  roll: number;
  name: string;
}

/** Forma estrutural mínima dos resultados internos do DiceRoll. */
interface SubRoll {
  initialValue: number;
  value: number;
}
interface RollGroupLike {
  rolls?: (SubRoll | number)[];
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

let rollSeq = 0;

/** Roda a notação e monta o `RollResult` comum a todos os tipos. */
function roll(notation: string): DiceRoll {
  // Lança NotationError se a notação for inválida (caller decide como tratar).
  return new DiceRoll(notation);
}

/** Valor do primeiro dado rolado (o que decide explosão/fumble no 1d10!). */
function firstDieValue(diceRoll: DiceRoll): number {
  const first = diceRoll.rolls[0];
  if (first && typeof first === 'object' && 'rolls' in first) {
    const subs = (first as RollGroupLike).rolls;
    const firstSub = Array.isArray(subs) ? subs[0] : undefined;
    if (typeof firstSub === 'object' && firstSub !== null && 'initialValue' in firstSub) {
      return firstSub.initialValue;
    }
    return typeof firstSub === 'number' ? firstSub : 0;
  }
  return typeof first === 'number' ? first : diceRoll.total;
}

function buildRoll(partial: {
  rollType: RollType;
  label: string;
  diceFormula: string;
  baseRoll: number;
  bonus: number;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  details: string;
  characterName?: string;
}): RollResult {
  rollSeq += 1;
  return {
    id: `roll_${Date.now()}_${rollSeq.toString(36)}`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    characterName: partial.characterName || 'Edgerunner',
    rollType: partial.rollType,
    label: partial.label,
    diceFormula: partial.diceFormula,
    baseRoll: partial.baseRoll,
    bonus: partial.bonus,
    total: partial.total,
    isCriticalSuccess: partial.isCriticalSuccess,
    isCriticalFailure: partial.isCriticalFailure,
    details: partial.details
  };
}

// ---------------------------------------------------------------------------
// API pública (T6.2)
// ---------------------------------------------------------------------------

/**
 * Rola uma perícia/ataque: `1d10!` + atributo + nível.
 * - 10 → explosão (o total do `DiceRoll` já soma os dados extras).
 * - 1  → fumble: rola 1d10 e subtrai do total (falha crítica).
 *
 * @param stat Valor do atributo (ex.: REF).
 * @param skill Nível da perícia (ou WA da arma).
 * @param ctx Contexto opcional (characterName, label, statName).
 */
export function rollSkill(stat: number, skill: number, ctx: DiceRollContext = {}): RollResult {
  const diceRoll = roll('1d10!');
  const firstDie = firstDieValue(diceRoll);
  const isExploding = firstDie === 10;
  const isFumble = firstDie === 1;

  let total = diceRoll.total; // já inclui explosões
  let details = `${diceRoll.output}`;
  if (isFumble) {
    const fumbleDie = roll('1d10').total;
    total -= fumbleDie;
    details += ` - 💀 Falha Crítica (1!): -${fumbleDie}`;
  }
  total += stat + skill;
  details += ` + ${ctx.statName || 'REF'} (${stat}) + Perícia (${skill})`;

  return buildRoll({
    rollType: 'SKILL',
    label: ctx.label || 'Rolagem de Perícia',
    diceFormula: isExploding ? '1d10! (Explodiu!)' : isFumble ? '1d10! (Fumble!)' : '1d10',
    baseRoll: firstDie,
    bonus: stat + skill,
    total,
    isCriticalSuccess: isExploding,
    isCriticalFailure: isFumble,
    details,
    characterName: ctx.characterName
  });
}

/**
 * Rola dano de arma: fórmula `NdM±X` (ex.: `2d6+2`) + local de impacto (1d10).
 *
 * @throws {NotationError} se a fórmula for inválida — valide com um try/catch
 * (ou pré-valide com o próprio Parser da lib) antes de chamar.
 */
export function rollDamage(formula: string, ctx: DiceRollContext = {}): RollResult {
  const diceRoll = roll(formula);
  const location = rollLocation();
  const total = diceRoll.total;

  return buildRoll({
    rollType: 'DAMAGE',
    label: ctx.label || 'Dano da Arma',
    diceFormula: formula,
    baseRoll: total,
    bonus: 0,
    total,
    isCriticalSuccess: false,
    isCriticalFailure: false,
    details: `Dados: ${diceRoll.output} • Local de Impacto: ${location.name}`,
    characterName: ctx.characterName
  });
}

/**
 * Death save: `1d10 ≤ BODY`. Sucesso = resultado menor ou igual ao atributo.
 */
export function rollDeathSave(body: number, ctx: DiceRollContext = {}): RollResult {
  const d10 = roll('1d10').total;
  const isSuccess = d10 <= body;

  return buildRoll({
    rollType: 'SAVE',
    label: ctx.label || 'Teste de Atordoamento/Morte (Death Save)',
    diceFormula: '1d10 ≤ BODY',
    baseRoll: d10,
    bonus: body,
    total: d10,
    isCriticalSuccess: isSuccess,
    isCriticalFailure: !isSuccess,
    details: isSuccess
      ? `PASSOU! Resultado ${d10} ≤ Corpo ${body}`
      : `FALHOU! Resultado ${d10} > Corpo ${body} (Inconsciente ou Morto!)`,
    characterName: ctx.characterName
  });
}

/**
 * Local de impacto (FNFF): 1 = cabeça (dano ×2), 2–4 tronco, 5/6 braços,
 * 7–0 pernas. Retorna o valor e o nome — usado por `rollDamage`.
 */
export function rollLocation(): ImpactLocation {
  const rollValue = roll('1d10').total;
  let name = 'Tronco (2-4)';
  if (rollValue === 1) name = 'Cabeça (1) [DANO DOBRADO X2!]';
  else if (rollValue === 5) name = 'Braço Direito (5)';
  else if (rollValue === 6) name = 'Braço Esquerdo (6)';
  else if (rollValue >= 7 && rollValue <= 8) name = 'Perna Direita (7-8)';
  else name = 'Perna Esquerda (9-0)';
  return { roll: rollValue, name };
}
