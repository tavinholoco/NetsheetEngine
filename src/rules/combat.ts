// ============================================================
// NETSHEET ENGINE — ATAQUE (Fase C, C.3 e C.4; Fase D, D.3)
// ============================================================
// Monta as parcelas de uma rolagem de ataque do jeito do livro:
// 1d10 + REF + perícia da arma + WA + modificador de situação.
// Desde a D.3, também decide se o ataque acerta: contra a dificuldade da
// faixa de alcance (RANGE_BANDS), igualando ou superando.
//
// Antes da Fase C, o servidor rolava 1d10 + REF + WA (sem a perícia) e o
// cliente passava o WA NO LUGAR da perícia. O `combatModifier` do GM era
// validado, persistido e exibido — e nenhuma rolagem o somava.
// ============================================================

import type { CharacterSheet, SkillItem, WeaponItem } from '../types/cyberpunk';
import type { Modifier } from './dice';
import { RANGE_BANDS, WEAPON_SKILL_BY_TYPE, type RangeBandRow, type WeaponSkillRow } from './tables';

/** Perícia de ataque desarmado. */
export const UNARMED_SKILL = 'Brawling';

/** Compara nomes sem caixa, espaço nem pontuação: "Awareness / Notice" = "awarenessnotice". */
export function normalizeName(name: unknown): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Linha do mapa tipo → perícia, ou `null` se o tipo não for reconhecido. */
export function weaponSkillFor(weaponType: unknown): WeaponSkillRow | null {
  const words = String(weaponType ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const whole = normalizeName(weaponType);
  return WEAPON_SKILL_BY_TYPE.find((row) => row.keywords.some((kw) => kw === whole || words.includes(kw))) ?? null;
}

/** Nível da perícia na ficha (0 se o personagem não a tem — ataque sem treino). */
export function skillLevelOf(skills: readonly SkillItem[] | undefined, skillName: string): number {
  const target = normalizeName(skillName);
  const found = (skills ?? []).find((s) => normalizeName(s.name) === target);
  const level = Number(found?.level);
  return Number.isFinite(level) ? level : 0;
}

/** Modificador de situação do GM (`combatModifier` da sala) como parcela. `null` quando é zero. */
export function gmModifier(value: unknown, reason?: unknown): Modifier | null {
  const v = Number(value);
  if (!Number.isFinite(v) || v === 0) return null;
  const why = String(reason ?? '').trim();
  return { label: why ? `Mod. do Mestre: ${why}` : 'Mod. do Mestre', value: Math.trunc(v) };
}

export interface AttackInput {
  /** REF CORRENTE (já com ferimento) — vem de `deriveCurrentStats`. */
  ref: number;
  weapon: Pick<WeaponItem, 'type' | 'wa'> | undefined;
  skills: CharacterSheet['skills'] | undefined;
  /** Parcela do GM, se houver (só existe na mesa). */
  gm?: Modifier | null;
}

// ------------------------------------------------------------
// Acertar o alvo (Fase D, D.3)
// ------------------------------------------------------------

/** Faixa de alcance pela chave, ou `null` se a chave não for do livro. */
export function rangeBandFor(key: unknown): RangeBandRow | null {
  return RANGE_BANDS.find((row) => row.key === key) ?? null;
}

/** Até onde vai a faixa, em metros, para uma arma com este alcance (queima-roupa: 1 m). */
export function rangeBandMeters(band: RangeBandRow, weaponRangeMeters: number): number {
  return band.ofWeaponRange === null ? 1 : Math.round((Number(weaponRangeMeters) || 0) * band.ofWeaponRange);
}

/**
 * O ataque acerta se o total IGUALA OU SUPERA a dificuldade (S8, S9). O
 * fumble é sempre erro, mesmo com total alto — o 1 é falha automática (C.1).
 */
export function attackHits(roll: { total: number; isCriticalFailure: boolean }, difficulty: number): boolean {
  return !roll.isCriticalFailure && roll.total >= difficulty;
}

/** Parcelas do ataque, na ordem em que aparecem no detalhe da rolagem. */
export function attackModifiers({ ref, weapon, skills, gm }: AttackInput): Modifier[] {
  const mods: Modifier[] = [{ label: 'REF', value: ref }];
  if (!weapon) {
    mods.push({ label: UNARMED_SKILL, value: skillLevelOf(skills, UNARMED_SKILL) });
  } else {
    const row = weaponSkillFor(weapon.type);
    mods.push(
      row
        ? { label: row.skill, value: skillLevelOf(skills, row.skill) }
        : { label: `sem perícia para "${String(weapon.type ?? '').slice(0, 30)}"`, value: 0 }
    );
    mods.push({ label: 'WA', value: Number(weapon.wa) || 0 });
  }
  if (gm) mods.push(gm);
  return mods;
}
