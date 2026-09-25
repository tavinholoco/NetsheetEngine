// ============================================================
// NETSHEET ENGINE — HABILIDADE ESPECIAL (Fase C, C.8)
// ============================================================
// Antes da Fase C o atributo da Special Ability era escolhido por um ternário
// no componente — Netrunner → INT, Solo → REF, o resto → EMP — e acertava 1
// dos 10 roles. Nenhuma habilidade do livro usa EMP. O atributo agora mora
// em OFFICIAL_ROLES, que é a fonte única de "role → habilidade".
// ============================================================

import { OFFICIAL_ROLES, type OfficialRole } from '../data/cyberpunkData';
import type { CharacterSheet, CharacterStats, StatName } from '../types/cyberpunk';
import { normalizeName, skillLevelOf } from './combat';
import type { Modifier } from './dice';

/**
 * Role oficial da ficha: pelo nome do role, ou — se o role for livre — pelo
 * nome da habilidade. `undefined` quando nenhum dos dois é do livro.
 */
export function officialRoleFor(sheet: Pick<CharacterSheet, 'role' | 'specialAbilityName'>): OfficialRole | undefined {
  const role = normalizeName(sheet.role);
  const ability = normalizeName(sheet.specialAbilityName);
  return (
    OFFICIAL_ROLES.find((r) => normalizeName(r.name) === role) ??
    OFFICIAL_ROLES.find((r) => normalizeName(r.specialAbility) === ability)
  );
}

export interface SpecialAbilityRoll {
  label: string;
  /** `null` quando o role não é do livro e não há atributo a somar. */
  statName: StatName | null;
  modifiers: Modifier[];
}

/**
 * Parcelas da rolagem da habilidade especial, com o atributo CORRENTE.
 * Combat Sense vira um teste de Awareness/Notice com o bônus somado.
 */
export function specialAbilityRoll(
  sheet: Pick<CharacterSheet, 'role' | 'specialAbilityName' | 'specialAbilityRank' | 'skills'>,
  current: CharacterStats
): SpecialAbilityRoll {
  const role = officialRoleFor(sheet);
  const name = sheet.specialAbilityName || role?.specialAbility || 'Habilidade Especial';
  const rank = Number(sheet.specialAbilityRank) || 0;
  if (!role) {
    return { label: `Rolagem: ${name} (role fora do livro, sem atributo)`, statName: null, modifiers: [{ label: name, value: rank }] };
  }
  const stat = role.specialAbilityStat;
  const modifiers: Modifier[] = [{ label: stat, value: current[stat] }];
  if (role.specialAbilityAddsTo) {
    modifiers.push({ label: role.specialAbilityAddsTo, value: skillLevelOf(sheet.skills, role.specialAbilityAddsTo) });
  }
  modifiers.push({ label: name, value: rank });
  const label = role.specialAbilityAddsTo ? `Rolagem: ${role.specialAbilityAddsTo} + ${name}` : `Rolagem: ${name}`;
  return { label, statName: stat, modifiers };
}
