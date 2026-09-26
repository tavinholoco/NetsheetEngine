/**
 * Fase C (C.8) — ATRIBUTO DA HABILIDADE ESPECIAL (src/rules/roles.ts)
 * ===================================================================
 * O oráculo é a tabela de docs/CONFERENCIA_CP2020.md, repetida aqui de
 * propósito: se alguém mudar OFFICIAL_ROLES sem mudar a conferência, este
 * teste quebra.
 */
import { describe, it, expect } from 'vitest';
import { officialRoleFor, specialAbilityRoll } from '../rules/roles';
import { OFFICIAL_ROLES } from '../data/cyberpunkData';
import type { CharacterStats, SkillItem, StatName } from '../types/cyberpunk';

/** Role → [habilidade, atributo] segundo a conferência contra o livro. */
const LIVRO: Record<string, [string, StatName]> = {
  Solo: ['Combat Sense', 'INT'],
  Netrunner: ['Interface', 'INT'],
  Tech: ['Jury Rig', 'TECH'],
  Medtechie: ['Medical Tech', 'TECH'],
  Media: ['Credibility', 'INT'],
  Cop: ['Authority', 'COOL'],
  Corp: ['Resources', 'INT'],
  Fixer: ['Streetdeal', 'COOL'],
  Rockerboy: ['Charismatic Leadership', 'COOL'],
  Nomad: ['Family', 'INT']
};

const CURRENT: CharacterStats = { INT: 7, REF: 8, TECH: 6, COOL: 5, ATTR: 4, LUCK: 3, MA: 6, BODY: 8, EMP: 9 };
const sheet = (role: string, skills: SkillItem[] = []) => ({
  role,
  specialAbilityName: LIVRO[role]?.[0] ?? 'Coisa',
  specialAbilityRank: 4,
  skills
});

describe('C.8 — OFFICIAL_ROLES bate com a conferência', () => {
  it('os 10 roles, nem mais nem menos', () => {
    expect(OFFICIAL_ROLES.map((r) => r.name).sort()).toEqual(Object.keys(LIVRO).sort());
  });

  it.each(Object.entries(LIVRO))('%s: %o', (role, [ability, stat]) => {
    const r = OFFICIAL_ROLES.find((x) => x.name === role)!;
    expect(r.specialAbility).toBe(ability);
    expect(r.specialAbilityStat).toBe(stat);
  });

  it('nenhuma habilidade usa EMP — era o chute do ternário antigo', () => {
    expect(OFFICIAL_ROLES.filter((r) => r.specialAbilityStat === 'EMP')).toEqual([]);
  });

  it('o ternário antigo acertava 1 de 10 (registro do achado RUL-07)', () => {
    const antigo = (role: string): StatName => (role === 'Netrunner' ? 'INT' : role === 'Solo' ? 'REF' : 'EMP');
    const acertos = Object.entries(LIVRO).filter(([role, [, stat]]) => antigo(role) === stat);
    expect(acertos.map(([role]) => role)).toEqual(['Netrunner']);
  });
});

describe('rolagem da habilidade especial', () => {
  it('Fixer: COOL corrente + Streetdeal', () => {
    const r = specialAbilityRoll(sheet('Fixer'), CURRENT);
    expect(r.statName).toBe('COOL');
    expect(r.modifiers).toEqual([
      { label: 'COOL', value: 5 },
      { label: 'Streetdeal', value: 4 }
    ]);
    expect(r.label).toBe('Rolagem: Streetdeal');
  });

  it('Solo: Combat Sense rola como Awareness/Notice + INT + o bônus', () => {
    const r = specialAbilityRoll(sheet('Solo', [{ id: 'a', name: 'Awareness / Notice', stat: 'INT', level: 3 }]), CURRENT);
    expect(r.label).toBe('Rolagem: Awareness/Notice + Combat Sense');
    expect(r.modifiers).toEqual([
      { label: 'INT', value: 7 },
      { label: 'Awareness/Notice', value: 3 },
      { label: 'Combat Sense', value: 4 }
    ]);
  });

  it('Solo sem Awareness na ficha soma 0 dela, não quebra', () => {
    expect(specialAbilityRoll(sheet('Solo'), CURRENT).modifiers[1]).toEqual({ label: 'Awareness/Notice', value: 0 });
  });

  it('role livre com habilidade do livro: acha pelo nome da habilidade', () => {
    expect(officialRoleFor({ role: 'Mercenário', specialAbilityName: 'Jury Rig' })?.name).toBe('Tech');
  });

  it('role e habilidade fora do livro: rola só o nível, e o rótulo diz por quê', () => {
    const r = specialAbilityRoll({ role: 'Bardo', specialAbilityName: 'Canto', specialAbilityRank: 3, skills: [] }, CURRENT);
    expect(r.statName).toBeNull();
    expect(r.modifiers).toEqual([{ label: 'Canto', value: 3 }]);
    expect(r.label).toContain('fora do livro');
  });
});
