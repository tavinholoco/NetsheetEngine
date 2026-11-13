/**
 * L.3d — as rolagens da ficha num hook.
 *
 * Saiu do `App` inteiro (mapa da G.1f). As parcelas continuam vindo de
 * `src/rules/rolls.ts` pela casca do `utils/diceEngine` — as MESMAS funções
 * que a mesa usa no servidor (a paridade é da C.10). A ficha vem da store,
 * espelhada pelo `syncSheetStore`.
 */
import {
  // A ação do hook tem o mesmo nome do motor (rollCheck), como no App de antes.
  rollCheck as rollCheckFromEngine,
  rollSheetAttack,
  rollSheetDamage,
  rollSheetDeathSave,
  rollSheetSkill,
  rollSheetStunSave
} from '../utils/diceEngine';
import type { Modifier } from '../rules/dice';
import type { RollResult, SkillItem, WeaponItem } from '../types/cyberpunk';
import { useRollStore } from '../stores/useRollStore';
import { useSheetStore } from '../stores/useSheetStore';

export interface SheetRollHandlers {
  /** Empilha um resultado já montado (o rolador de dados e as ações da ficha). */
  addRollResult: (roll: RollResult) => void;
  rollSkill: (skill: SkillItem) => void;
  /** Teste com parcelas prontas — a habilidade especial usa este (C.8). */
  rollCheck: (label: string, modifiers: Modifier[]) => void;
  rollWeaponAttack: (weapon: WeaponItem) => void;
  rollDamageOnly: (weaponName: string, damageFormula: string) => void;
  rollDeathSave: () => void;
  rollStunSave: () => void;
}

export function useSheetRollHandlers(): SheetRollHandlers {
  const sheet = useSheetStore((s) => s.sheet);
  const addRoll = useRollStore((s) => s.addRoll);

  const addRollResult = (roll: RollResult) => {
    addRoll(roll);
  };

  const rollSkill = (skill: SkillItem) => {
    addRollResult(rollSheetSkill(sheet, skill));
  };

  const rollCheck = (label: string, modifiers: Modifier[]) => {
    addRollResult(rollCheckFromEngine(modifiers, { characterName: sheet.handle || 'Edgerunner', label }));
  };

  const rollWeaponAttack = (weapon: WeaponItem) => {
    addRollResult(rollSheetAttack(sheet, weapon));
  };

  // Fórmula de dano inválida é ignorada em silêncio, como antes.
  const rollDamageOnly = (weaponName: string, damageFormula: string) => {
    try {
      addRollResult(rollSheetDamage(sheet, { name: weaponName, damage: damageFormula }));
    } catch {
      /* fórmula de dano inválida */
    }
  };

  const rollDeathSave = () => {
    addRollResult(rollSheetDeathSave(sheet));
  };

  const rollStunSave = () => {
    addRollResult(rollSheetStunSave(sheet));
  };

  return { addRollResult, rollSkill, rollCheck, rollWeaponAttack, rollDamageOnly, rollDeathSave, rollStunSave };
}
