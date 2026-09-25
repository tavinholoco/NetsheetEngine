import type { CharacterSheet, RollResult, SkillItem, WeaponItem } from '../types/cyberpunk';
import { rollHitLocation, type Modifier, type Rng } from '../rules/dice';
import {
  checkRoll,
  damageRoll,
  sheetAttackRoll,
  sheetDamageRoll,
  sheetDeathSaveRoll,
  sheetSkillRoll,
  sheetStunSaveRoll,
  type RollCore,
  type RollingSheet
} from '../rules/rolls';

/**
 * ROLADOR DO CLIENTE (ficha, página de dados)
 * ===========================================
 * Casca fina sobre o motor único de `src/rules/` (Fase C, C.1). As regras —
 * explosão encadeada, fumble, dano, local de impacto — vivem lá e são as
 * mesmas que o servidor usa nas rolagens da mesa. Aqui só se escolhe o RNG e
 * se carimba `id`, horário e personagem.
 *
 * As rolagens da MESA multiplayer continuam server-authoritative
 * (`rollDiceForPlayer`, T5.4): o cliente nunca rola por lá.
 */

/**
 * RNG do cliente: Web Crypto, com rejeição para não enviesar as faces.
 * (`Math.random` bastaria para um rolador pessoal, mas o custo é zero e assim
 * os dois lados têm a mesma qualidade de dado.)
 */
export const clientRng: Rng = (sides) => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  let x: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return (x % sides) + 1;
};

export interface DiceRollContext {
  /** Handle do personagem (default `'Edgerunner'`). */
  characterName?: string;
  /** Rótulo exibido no histórico/banner (default por tipo de rolagem). */
  label?: string;
  /** Nome do atributo no detalhe da rolagem (default `'REF'`). */
  statName?: string;
  /** Nome da perícia no detalhe da rolagem (default `'Perícia'`). */
  skillName?: string;
  /** Parcelas extras, com nome (WA, Awareness do Combat Sense...). */
  modifiers?: Modifier[];
}

/** Resultado do local de impacto (1d10). */
export interface ImpactLocation {
  roll: number;
  name: string;
}

let rollSeq = 0;

function stamp(core: RollCore, characterName?: string): RollResult {
  rollSeq += 1;
  return {
    id: `roll_${Date.now()}_${rollSeq.toString(36)}`,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    characterName: characterName || 'Edgerunner',
    ...core
  };
}

/** Teste genérico: 1d10 aberto + as parcelas dadas, com nome (o ataque usa este). */
export function rollCheck(modifiers: Modifier[], ctx: DiceRollContext = {}, rng: Rng = clientRng): RollResult {
  return stamp(checkRoll(rng, ctx.label || 'Rolagem', modifiers), ctx.characterName);
}

/**
 * Teste de perícia/ataque: 1d10 aberto + atributo + perícia (+ parcelas).
 * 10 explode encadeando; 1 é falha automática com dado para a tabela de fumble.
 */
export function rollSkill(stat: number, skill: number, ctx: DiceRollContext = {}, rng: Rng = clientRng): RollResult {
  const modifiers: Modifier[] = [
    { label: ctx.statName || 'REF', value: stat },
    { label: ctx.skillName || 'Perícia', value: skill },
    ...(ctx.modifiers ?? [])
  ];
  return stamp(checkRoll(rng, ctx.label || 'Rolagem de Perícia', modifiers), ctx.characterName);
}

/**
 * Dano da arma (`NdM`, `NdM±X`) + local de impacto.
 * @throws {Error} se a fórmula for inválida — o chamador trata.
 */
export function rollDamage(formula: string, ctx: DiceRollContext = {}, rng: Rng = clientRng): RollResult {
  const core = damageRoll(rng, ctx.label || 'Dano da Arma', formula);
  if (!core) throw new Error(`Fórmula de dano inválida: ${formula}`);
  return stamp(core, ctx.characterName);
}

// ------------------------------------------------------------
// Rolagens da FICHA — as mesmas funções que a mesa chama (C.10)
// ------------------------------------------------------------

type SheetWithHandle = RollingSheet & Pick<CharacterSheet, 'handle'>;

/** Perícia da ficha, com o atributo corrente. */
export function rollSheetSkill(sheet: SheetWithHandle, skill: Pick<SkillItem, 'name' | 'stat' | 'level'>, rng: Rng = clientRng): RollResult {
  return stamp(sheetSkillRoll(rng, sheet, skill), sheet.handle);
}

/** Ataque da ficha: REF corrente + perícia da arma + WA. */
export function rollSheetAttack(sheet: SheetWithHandle, weapon: Pick<WeaponItem, 'name' | 'type' | 'wa'> | undefined, rng: Rng = clientRng): RollResult {
  return stamp(sheetAttackRoll(rng, sheet, weapon), sheet.handle);
}

/**
 * Dano da arma da ficha + local de impacto.
 * @throws {Error} se a fórmula for inválida — o chamador trata.
 */
export function rollSheetDamage(sheet: SheetWithHandle, weapon: Pick<WeaponItem, 'name' | 'damage'> | undefined, rng: Rng = clientRng): RollResult {
  const { core, formula } = sheetDamageRoll(rng, weapon);
  if (!core) throw new Error(`Fórmula de dano inválida: ${formula}`);
  return stamp(core, sheet.handle);
}

/** Death save: `1d10 ≤ BODY − nível Mortal` (C.7). */
export function rollSheetDeathSave(sheet: SheetWithHandle, rng: Rng = clientRng): RollResult {
  return stamp(sheetDeathSaveRoll(rng, sheet), sheet.handle);
}

/** Stun save: `1d10 ≤ BODY − 0 a 9` pelo nível do ferimento (C.7). */
export function rollSheetStunSave(sheet: SheetWithHandle, rng: Rng = clientRng): RollResult {
  return stamp(sheetStunSaveRoll(rng, sheet), sheet.handle);
}

/** Local de impacto: 1 cabeça (×2), 2–4 tronco, 5/6 braços, 7–8 perna direita, 9–0 perna esquerda. */
export function rollLocation(rng: Rng = clientRng): ImpactLocation {
  const hit = rollHitLocation(rng);
  return { roll: hit.face, name: hit.label };
}
