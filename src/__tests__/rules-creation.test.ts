/**
 * K.6b — A CRIAÇÃO COM ORÇAMENTO, COMO REGRA E COMO DADO DA FICHA
 * ================================================================
 * Os números esperados saem da tabela (src/rules/tables.ts, K.6a), nunca da
 * implementação: o bolo de atributos (9D10 ou o do Mestre), os 40 pontos de
 * carreira no pacote do role, o pickup de REF + INT fora dele, e a verba pelo
 * salário × 1D6/3. A ficha grava o que foi gasto (`creation`), e o validador o
 * deixa passar — sem ele, o registro nunca chegaria à mesa (K.6c).
 */
import { describe, it, expect } from 'vitest';
import { SKILL_TABLES, OFFICIAL_ROLES } from '../data/cyberpunkData';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { normalizeName } from '../rules/combat';
import {
  applyCreation,
  blockersOf,
  careerSkillsOf,
  createDraft,
  creationBudgets,
  rollStatPool,
  salaryFor,
  startingFunds,
  type CreationDraft
} from '../rules/creation';
import { sanitizeCharacterSheet } from '../rules/sheetSchema';
import {
  CAREER_PACKAGES,
  CAREER_SKILL_POINTS,
  CREATION_SKILL_MAX,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  STARTING_FUNDS_DIE,
  STARTING_SALARY,
  STAT_POOL_DICE,
  STAT_POOL_MIN
} from '../rules/tables';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet, CharacterStats } from '../types/cyberpunk';

const statsAll = (n: number): CharacterStats => ({ INT: n, REF: n, TECH: n, COOL: n, ATTR: n, LUCK: n, MA: n, BODY: n, EMP: n });
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Os atributos em cuja lista a perícia está, sem o "(escolha)". */
const statsInTables = (name: string) =>
  (Object.keys(SKILL_TABLES) as (keyof typeof SKILL_TABLES)[]).filter((stat) =>
    SKILL_TABLES[stat].some((s) => normalizeName(s.replace('(escolha)', '')) === normalizeName(name))
  );

function solo(patch: Partial<CharacterSheet> = {}): CharacterSheet {
  return { ...createBlankCharacterSheet(), role: 'Solo', specialAbilityName: 'Combat Sense', ...patch };
}

/** Um rascunho de Solo dentro de todos os orçamentos. */
function soloPronto(): CreationDraft {
  const draft = createDraft(solo());
  const pkg = CAREER_PACKAGES.find((p) => p.role === 'Solo')!;
  return {
    ...draft,
    method: 'roll9d10',
    dice: [5, 6, 7, 5, 6, 7, 5, 6, 7],
    pool: 54,
    stats: statsAll(6),
    picks: ['Brawling'],
    saRank: 4,
    // 9 perícias × 4 + a habilidade 4 = 40
    career: Object.fromEntries([...pkg.skills.map((s) => s.name), 'Brawling'].map((n) => [n, 4])),
    pickup: [{ name: 'Driving', stat: 'REF', level: 6 }, { name: 'Dance', stat: 'REF', level: 6 }],
    fundsDie: 3,
    funds: startingFunds(salaryFor('Solo', 4)!, 3)
  };
}

describe('K.6a — a tabela da criação', () => {
  it('os dez roles do livro têm pacote, cada um com nove perícias (a décima é a habilidade)', () => {
    expect(CAREER_PACKAGES.map((p) => p.role).sort()).toEqual(OFFICIAL_ROLES.map((r) => r.name).sort());
    for (const pkg of CAREER_PACKAGES) {
      const slots = pkg.skills.length + sum((pkg.choices ?? []).map((c) => c.count));
      expect(slots, pkg.role).toBe(9);
    }
  });

  it('cada perícia do pacote tem o atributo das listas da ficha, e nenhuma falta nelas (a K.7a pôs as quatro)', () => {
    const faltam = new Set<string>();
    for (const pkg of CAREER_PACKAGES) {
      for (const skill of [...pkg.skills, ...(pkg.choices ?? []).flatMap((c) => c.options)]) {
        const stats = statsInTables(skill.name);
        if (stats.length) expect(stats, `${pkg.role}: ${skill.name}`).toContain(skill.stat);
        else faltam.add(skill.name);
      }
    }
    expect([...faltam]).toEqual([]);
  });

  it('o salário: nove roles, seis colunas que nunca descem; o Fixer, sem duas fontes, não está', () => {
    expect(STARTING_SALARY).toHaveLength(9);
    expect(STARTING_SALARY.some((r) => r.role === 'Fixer')).toBe(false);
    for (const row of STARTING_SALARY) {
      expect(OFFICIAL_ROLES.some((r) => r.name === row.role), row.role).toBe(true);
      row.byRank.slice(1).forEach((v, i) => expect(v, row.role).toBeGreaterThanOrEqual(row.byRank[i]));
    }
  });
});

describe('K.6b — as contas da criação', () => {
  it('o 9D10: nove dados de 10, somados', () => {
    const faces = [3, 10, 1, 7, 7, 2, 9, 4, 6];
    const rng = scriptedRng(faces);
    const r = rollStatPool(rng);
    expect(r.dice).toEqual(faces);
    expect(r.dice).toHaveLength(STAT_POOL_DICE);
    expect(r.pool).toBe(sum(faces));
    expect(rng.remaining()).toBe(0);
  });

  it('o salário pelo nível: 1–5 numa coluna, 6 a 10 uma a uma; o nível 0 cai na primeira', () => {
    for (const row of STARTING_SALARY) {
      for (const rank of [0, 1, 5]) expect(salaryFor(row.role, rank)).toBe(row.byRank[0]);
      for (const rank of [6, 7, 8, 9, 10]) expect(salaryFor(row.role, rank)).toBe(row.byRank[rank - 5]);
    }
    expect(salaryFor('Fixer', 6)).toBeNull();
    expect(salaryFor('Ronin', 6)).toBeNull();
  });

  it('a verba: o salário × 1D6/3, arredondada para baixo', () => {
    for (let die = 1; die <= STARTING_FUNDS_DIE.sides; die++) {
      expect(startingFunds(2000, die)).toBe(Math.floor((2000 * die) / STARTING_FUNDS_DIE.divisor));
    }
    expect(startingFunds(2000, 3)).toBe(2000);
    expect(startingFunds(1000, 1)).toBe(333);
  });

  it('as perícias de carreira são as fixas mais as escolhidas, até o número de cada escolha', () => {
    const tech = CAREER_PACKAGES.find((p) => p.role === 'Tech')!;
    const nomes = careerSkillsOf(tech, ['Gyro Tech', 'Aero Tech', 'Weaponsmith', 'Electronic Security', 'Rifle']).map((s) => s.name);
    expect(nomes).toHaveLength(9);
    expect(nomes).toContain('Gyro Tech');
    expect(nomes).not.toContain('Electronic Security');
    expect(nomes).not.toContain('Rifle');
  });

  it('o rascunho dentro dos orçamentos não tem bloqueio', () => {
    const b = creationBudgets(soloPronto());
    expect(b.stats).toMatchObject({ spent: 54, budget: 54 });
    expect(b.career).toMatchObject({ spent: CAREER_SKILL_POINTS, budget: CAREER_SKILL_POINTS });
    expect(b.pickup).toMatchObject({ spent: 12, budget: 12 });
    expect(blockersOf(soloPronto())).toEqual([]);
  });

  it('passar de cada orçamento, ou de 2 a 10, bloqueia', () => {
    const base = soloPronto();
    expect(blockersOf({ ...base, stats: { ...base.stats, BODY: 7 } }).join(' ')).toMatch(/atributos/i);
    expect(blockersOf({ ...base, stats: { ...base.stats, BODY: CREATION_STAT_MAX + 1, INT: 5 } }).join(' ')).toMatch(/2 a 10/);
    expect(blockersOf({ ...base, stats: { ...base.stats, BODY: CREATION_STAT_MIN - 1, INT: 7 } }).join(' ')).toMatch(/2 a 10/);
    expect(blockersOf({ ...base, saRank: 5 }).join(' ')).toMatch(/carreira/i);
    expect(blockersOf({ ...base, career: { ...base.career, Rifle: CREATION_SKILL_MAX + 1, Melee: 0 } }).join(' ')).toMatch(/até 10/);
    expect(blockersOf({ ...base, pickup: [...base.pickup, { name: 'Swimming', stat: 'BODY', level: 1 }] }).join(' ')).toMatch(/pickup/i);
  });

  it('sobrar não bloqueia: só passar', () => {
    const base = soloPronto();
    expect(blockersOf({ ...base, saRank: 3, pickup: [] })).toEqual([]);
  });

  it('o pickup não entra em perícia de carreira nem na habilidade especial', () => {
    const base = soloPronto();
    expect(blockersOf({ ...base, pickup: [{ name: 'Rifle', stat: 'REF', level: 1 }] }).join(' ')).toMatch(/Rifle/);
    expect(blockersOf({ ...base, pickup: [{ name: 'Combat Sense', stat: 'INT', level: 1 }] }).join(' ')).toMatch(/Combat Sense/);
  });

  it('sem o bolo, sem a escolha do pacote ou sem rolar a verba, não aplica', () => {
    const base = soloPronto();
    expect(blockersOf({ ...base, dice: [], pool: 0 }).join(' ')).toMatch(/bolo/i);
    expect(blockersOf({ ...base, method: 'gmPool', dice: [], pool: STAT_POOL_MIN - 1 }).join(' ')).toMatch(/bolo/i);
    expect(blockersOf({ ...base, picks: [] }).join(' ')).toMatch(/escolh/i);
    expect(blockersOf({ ...base, fundsDie: null }).join(' ')).toMatch(/verba/i);
  });

  it('o role sem linha de salário (o Fixer) tem a verba do Mestre, sem dado', () => {
    const fixer = createDraft({ ...createBlankCharacterSheet(), role: 'Fixer', specialAbilityName: 'Streetdeal' });
    expect(blockersOf(fixer).join(' ')).not.toMatch(/verba/i);
  });

  it('o 9D10 abaixo de 18 deixa cada atributo no 2, sem bloquear', () => {
    const base = soloPronto();
    expect(blockersOf({ ...base, dice: [1, 1, 2, 1, 2, 1, 2, 1, 2], pool: 13, stats: statsAll(2), pickup: [] })).toEqual([]);
  });
});

describe('K.6b — o rascunho sai da ficha e volta para ela', () => {
  it('o rascunho lê as perícias que a ficha já tem: carreira pelo nome, o resto no pickup', () => {
    const draft = createDraft(
      solo({
        specialAbilityRank: 3,
        skills: [
          { id: 'a', name: 'Awareness / Notice', stat: 'INT', level: 5 },
          { id: 'b', name: 'Martial Art', stat: 'REF', level: 2 },
          { id: 'c', name: 'Swimming', stat: 'BODY', level: 1 }
        ]
      })
    );
    expect(draft.role).toBe('Solo');
    expect(draft.saRank).toBe(3);
    expect(draft.picks).toEqual(['Martial Art']);
    expect(draft.career['Awareness/Notice']).toBe(5);
    expect(draft.career['Martial Art']).toBe(2);
    expect(draft.pickup).toEqual([{ name: 'Swimming', stat: 'BODY', level: 1 }]);
  });

  it('aplicar grava os atributos, as perícias, a verba e o que foi gasto', () => {
    const sheet = solo({ skills: [{ id: 'sk_rifle', name: 'Rifle', stat: 'REF', level: 1 }] });
    const draft = soloPronto();
    const patch = applyCreation(sheet, draft);
    expect(patch.stats).toEqual(draft.stats);
    expect(patch.specialAbilityRank).toBe(4);
    expect(patch.eurodollars).toBe(draft.funds);
    // a perícia que já existia mantém o id
    expect(patch.skills!.find((s) => s.name === 'Rifle')).toMatchObject({ id: 'sk_rifle', level: 4 });
    expect(patch.skills!.find((s) => s.name === 'Driving')).toMatchObject({ stat: 'REF', level: 6 });
    expect(patch.skills!.some((s) => s.name === 'Martial Art')).toBe(false);
    expect(patch.creation).toEqual({
      method: 'roll9d10',
      dice: draft.dice,
      pool: 54,
      stats: draft.stats,
      careerSkills: careerSkillsOf(CAREER_PACKAGES.find((p) => p.role === 'Solo')!, ['Brawling']).map((s) => s.name),
      careerPoints: 40,
      pickupPoints: 12,
      fundsDie: 3,
      funds: draft.funds
    });
  });
});

describe('K.6b — o registro da criação passa pelo validador', () => {
  it('a ficha com `creation` chega inteira ao outro lado', () => {
    const creation = applyCreation(solo(), soloPronto()).creation!;
    const out = sanitizeCharacterSheet({ ...solo(), creation })!;
    expect(out.sheet.creation).toEqual(creation);
    expect(out.changed).toEqual([]);
  });

  it('a ficha de antes da K.6 abre sem registro, sem correção', () => {
    const out = sanitizeCharacterSheet(solo())!;
    expect(out.sheet.creation).toBeUndefined();
    expect(out.changed).toEqual([]);
  });

  it('o registro malformado é grampeado ou descartado, nunca cru', () => {
    const creation = applyCreation(solo(), soloPronto()).creation!;
    const out = sanitizeCharacterSheet({
      ...solo(),
      creation: { ...creation, dice: [...creation.dice, 99, 4], pool: 500, careerSkills: [...creation.careerSkills, 'x'.repeat(500)], fundsDie: 9 }
    })!;
    const c = out.sheet.creation!;
    expect(c.dice).toHaveLength(STAT_POOL_DICE);
    expect(c.pool).toBe(90);
    expect(c.careerSkills.every((s) => s.length <= 120)).toBe(true);
    expect(c.fundsDie).toBe(STARTING_FUNDS_DIE.sides);
    expect(out.changed.length).toBeGreaterThan(0);

    expect(sanitizeCharacterSheet({ ...solo(), creation: { ...creation, method: 'roubado' } })!.sheet.creation).toBeUndefined();
    expect(sanitizeCharacterSheet({ ...solo(), creation: 'x' })!.sheet.creation).toBeUndefined();
  });
});
