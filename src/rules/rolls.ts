// ============================================================
// NETSHEET ENGINE — ROLAGENS (Fase C)
// ============================================================
// Monta o conteúdo de um RollResult a partir do motor (dice.ts). É a parte que
// cliente e servidor compartilham por inteiro: os dois lados só acrescentam
// `id`, `timestamp` e `characterName`, cada um do seu jeito. Se os dois
// mostrarem números ou textos diferentes para os mesmos dados, o defeito está
// fora daqui — é o que o teste de paridade (C.10) garante.
// ============================================================

import type { RollResult } from '../types/cyberpunk';
import {
  resolveCheck,
  resolveSave,
  rollDamageFormula,
  rollHitLocation,
  type Modifier,
  type Rng
} from './dice';

/** O RollResult sem o que é do chamador (identidade e horário). */
export type RollCore = Omit<RollResult, 'id' | 'timestamp' | 'characterName'>;

function checkFormula(exploded: boolean, fumble: boolean): string {
  if (exploded) return '1d10! (Explodiu!)';
  if (fumble) return '1d10! (Fumble!)';
  return '1d10';
}

/** Teste de perícia ou de ataque: 1d10 aberto + parcelas nomeadas. */
export function checkRoll(rng: Rng, label: string, modifiers: Modifier[]): RollCore {
  const check = resolveCheck(rng, modifiers);
  return {
    rollType: 'SKILL',
    label,
    diceFormula: checkFormula(check.roll.exploded, check.roll.fumble),
    baseRoll: check.roll.natural,
    bonus: check.bonus,
    total: check.total,
    isCriticalSuccess: check.roll.exploded,
    isCriticalFailure: check.roll.fumble,
    details: check.details
  };
}

/**
 * Dano da arma + local de impacto. `null` se a fórmula for inválida — o
 * chamador decide como avisar.
 */
export function damageRoll(rng: Rng, label: string, formula: string): RollCore | null {
  const damage = rollDamageFormula(rng, formula);
  if (!damage) return null;
  const location = rollHitLocation(rng);
  return {
    rollType: 'DAMAGE',
    label,
    diceFormula: formula,
    baseRoll: damage.total,
    bonus: 0,
    total: damage.total,
    isCriticalSuccess: false,
    isCriticalFailure: false,
    details: `Dados: [${damage.rolls.join(', ')}] • Local de Impacto: ${location.label}`
  };
}

/** Save do 2020: 1d10 ≤ alvo. `targetLabel` explica de onde veio o alvo. */
export function saveRoll(rng: Rng, label: string, target: number, targetLabel: string): RollCore {
  const save = resolveSave(rng, target);
  return {
    rollType: 'SAVE',
    label,
    diceFormula: `1d10 ≤ ${targetLabel}`,
    baseRoll: save.roll,
    bonus: target,
    total: save.roll,
    isCriticalSuccess: save.success,
    isCriticalFailure: !save.success,
    details: save.success
      ? `PASSOU! Resultado ${save.roll} ≤ ${target} (${targetLabel})`
      : `FALHOU! Resultado ${save.roll} > ${target} (${targetLabel})`
  };
}
