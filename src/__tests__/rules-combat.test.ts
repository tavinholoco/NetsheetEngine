/**
 * Fase C (C.3, C.4) — ATAQUE (src/rules/combat.ts)
 * ================================================
 * Mapa tipo de arma → perícia, derivado de WEAPON_SKILL_BY_TYPE, e as
 * parcelas do ataque: REF + perícia + WA + modificador do GM.
 */
import { describe, it, expect } from 'vitest';
import { attackModifiers, gmModifier, normalizeName, skillLevelOf, weaponSkillFor } from '../rules/combat';
import { WEAPON_SKILL_BY_TYPE } from '../rules/tables';
import { DEFAULT_WEAPONS } from '../data/cyberpunkData';
import type { SkillItem } from '../types/cyberpunk';

const skills: SkillItem[] = [
  { id: '1', name: 'Handgun', stat: 'REF', level: 4 },
  { id: '2', name: 'Rifle', stat: 'REF', level: 6 },
  { id: '3', name: 'Awareness / Notice', stat: 'INT', level: 5 },
  { id: '4', name: 'Brawling', stat: 'REF', level: 2 }
];

describe('C.3 — tipo de arma → perícia', () => {
  const keywordCases = WEAPON_SKILL_BY_TYPE.flatMap((row) => row.keywords.map((kw) => [kw, row.skill] as const));
  it.each(keywordCases)('"%s" → %s', (kw, skill) => {
    expect(weaponSkillFor(kw)?.skill).toBe(skill);
  });

  it.each([
    ['Pistol', 'Handgun'],
    ['Heavy Pistol', 'Handgun'],
    ['Submachinegun', 'Submachinegun'],
    ['Assault Rifle', 'Rifle'],
    ['Sniper Rifle', 'Rifle'],
    ['Shotgun', 'Rifle'],
    ['Heavy Weapon', 'Heavy Weapons'],
    ['Melee', 'Melee']
  ])('"%s" → %s', (type, skill) => {
    expect(weaponSkillFor(type)?.skill).toBe(skill);
  });

  it('toda arma do arsenal padrão tem perícia mapeada', () => {
    for (const w of DEFAULT_WEAPONS) expect(weaponSkillFor(w.type), w.type).not.toBeNull();
  });

  it('escopeta → Rifle está marcada como inferência (não existe perícia de escopeta no 2020)', () => {
    expect(weaponSkillFor('Shotgun')?.inferred).toBe(true);
  });

  it('"Submachinegun" não cai em nenhuma linha que contenha "gun" por acaso', () => {
    expect(weaponSkillFor('SMG')?.skill).toBe('Submachinegun');
  });

  it('tipo desconhecido ou vazio não inventa perícia', () => {
    expect(weaponSkillFor('Laser Cannon')).toBeNull();
    expect(weaponSkillFor('')).toBeNull();
    expect(weaponSkillFor(undefined)).toBeNull();
  });
});

describe('nível da perícia na ficha', () => {
  it('compara sem caixa, espaço nem pontuação', () => {
    expect(normalizeName('Awareness / Notice')).toBe('awarenessnotice');
    expect(skillLevelOf(skills, 'Awareness/Notice')).toBe(5);
    expect(skillLevelOf(skills, 'HANDGUN')).toBe(4);
  });

  it('perícia ausente é nível 0 (ataque sem treino, não erro)', () => {
    expect(skillLevelOf(skills, 'Submachinegun')).toBe(0);
    expect(skillLevelOf(undefined, 'Rifle')).toBe(0);
  });
});

describe('C.4 — modificador do GM', () => {
  it('zero ou lixo não vira parcela', () => {
    expect(gmModifier(0)).toBeNull();
    expect(gmModifier('abc')).toBeNull();
    expect(gmModifier(undefined)).toBeNull();
  });

  it('leva o motivo no rótulo', () => {
    expect(gmModifier(-2, 'escuridão')).toEqual({ label: 'Mod. do Mestre: escuridão', value: -2 });
    expect(gmModifier(3, '  ')).toEqual({ label: 'Mod. do Mestre', value: 3 });
  });
});

describe('parcelas do ataque', () => {
  it('REF + perícia da arma + WA, nessa ordem', () => {
    expect(attackModifiers({ ref: 8, weapon: { type: 'Pistol', wa: 1 }, skills })).toEqual([
      { label: 'REF', value: 8 },
      { label: 'Handgun', value: 4 },
      { label: 'WA', value: 1 }
    ]);
  });

  it('o GM entra por último', () => {
    const mods = attackModifiers({ ref: 8, weapon: { type: 'Assault Rifle', wa: 1 }, skills, gm: gmModifier(-2, 'fumaça') });
    expect(mods.at(-1)).toEqual({ label: 'Mod. do Mestre: fumaça', value: -2 });
    expect(mods.reduce((a, m) => a + m.value, 0)).toBe(8 + 6 + 1 - 2);
  });

  it('desarmado usa Brawling e não tem WA', () => {
    expect(attackModifiers({ ref: 8, weapon: undefined, skills })).toEqual([
      { label: 'REF', value: 8 },
      { label: 'Brawling', value: 2 }
    ]);
  });

  it('tipo sem mapa aparece no detalhe com 0, em vez de somar perícia errada', () => {
    const mods = attackModifiers({ ref: 8, weapon: { type: 'Laser Cannon', wa: 2 }, skills });
    expect(mods[1]).toEqual({ label: 'sem perícia para "Laser Cannon"', value: 0 });
  });
});
