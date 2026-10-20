/**
 * ============================================================
 * NETSHEET ENGINE — A CRIAÇÃO COM ORÇAMENTO (K.6b, decisão 13)
 * ============================================================
 * O bolo de atributos (o 9D10 ou o do Mestre), os 40 pontos de carreira no
 * pacote do role, o pickup de REF + INT fora dele e a verba pelo salário ×
 * 1D6/3 — a tabela em src/rules/tables.ts, as fontes na conferência. O
 * assistente da ficha monta um rascunho, confere cada orçamento aqui e, ao
 * aplicar, grava o que foi gasto (`creation`). Funções puras, RNG injetado.
 *
 * Passar de um orçamento bloqueia; sobrar, não — o livro não manda gastar tudo,
 * e quem deixa pontos na mesa só perde. Depois da criação, o IP e o cromo sobem
 * os números: o orçamento vale no dia, e a mesa o mostra ao GM (K.6c).
 */
import { OFFICIAL_ROLES } from '../data/cyberpunkData';
import type { CharacterCreation, CharacterSheet, CharacterStats, SkillItem, StatName } from '../types/cyberpunk';
import { STAT_NAMES } from './character';
import { normalizeName } from './combat';
import type { Rng } from './dice';
import { officialRoleFor } from './roles';
import {
  CAREER_PACKAGES,
  CAREER_SKILL_POINTS,
  CREATION_SKILL_MAX,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  PICKUP_STATS,
  STARTING_FUNDS_DIE,
  STARTING_SALARY,
  STAT_POOL_DICE,
  STAT_POOL_MAX,
  STAT_POOL_MIN,
  type CareerPackageRow,
  type CareerSkill
} from './tables';

export type CreationMethod = CharacterCreation['method'];

export interface PickupSkill {
  name: string;
  stat: StatName;
  level: number;
}

/** O que o assistente edita antes de aplicar à ficha. */
export interface CreationDraft {
  method: CreationMethod;
  dice: number[];
  pool: number;
  stats: CharacterStats;
  /** O role do livro, como o `OFFICIAL_ROLES` o chama; vazio se a ficha não tem. */
  role: string;
  /** As perícias escolhidas nas escolhas do pacote (o Solo, o Techie). */
  picks: string[];
  saRank: number;
  /** O nível de cada perícia do pacote, pelo nome da tabela (escolhidas ou não). */
  career: Record<string, number>;
  pickup: PickupSkill[];
  fundsDie: number | null;
  funds: number;
}

export interface Budget {
  spent: number;
  budget: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(n) || 0)));
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** O 9D10 num bolo: nove dados de 10, somados (S5, S6). Sem explosão: não é teste. */
export function rollStatPool(rng: Rng): { dice: number[]; pool: number } {
  const dice = Array.from({ length: STAT_POOL_DICE }, () => rng(10));
  return { dice, pool: sum(dice) };
}

export function statsTotal(stats: CharacterStats): number {
  return sum(STAT_NAMES.map((s) => Number(stats[s]) || 0));
}

/** O pickup: REF + INT da criação (S3, S6). */
export function pickupBudgetOf(stats: CharacterStats): number {
  return sum(PICKUP_STATS.map((s) => Number(stats[s]) || 0));
}

export function careerPackageFor(role: string): CareerPackageRow | undefined {
  return CAREER_PACKAGES.find((p) => p.role === role);
}

/** Toda perícia que o pacote pode ter: as fixas e todas as opções das escolhas. */
export function packageSkills(pkg: CareerPackageRow): CareerSkill[] {
  return [...pkg.skills, ...(pkg.choices ?? []).flatMap((c) => c.options)];
}

/** Quantas perícias o pacote tem, sem a habilidade especial: as fixas e as escolhas (nove nos dez). */
export function careerSlots(pkg: CareerPackageRow): number {
  return pkg.skills.length + sum((pkg.choices ?? []).map((c) => c.count));
}

/** As nove perícias de carreira: as fixas, mais as escolhidas, até o número de cada escolha. */
export function careerSkillsOf(pkg: CareerPackageRow, picks: readonly string[]): CareerSkill[] {
  const picked = picks.map(normalizeName);
  const chosen = (pkg.choices ?? []).flatMap((choice) =>
    picked
      .map((name) => choice.options.find((o) => normalizeName(o.name) === name))
      .filter((o): o is CareerSkill => o !== undefined)
      .slice(0, choice.count)
  );
  return [...pkg.skills, ...chosen];
}

/** O salário do mês pelo role e o nível da habilidade; `null` sem linha na tabela (o Fixer). */
export function salaryFor(role: string, rank: number): number | null {
  const row = STARTING_SALARY.find((r) => r.role === role);
  if (!row) return null;
  // 1–5 numa coluna, e o 6 ao 10 uma a uma. O nível 0 cai na primeira (escolha do projeto).
  return row.byRank[Math.max(0, clamp(rank, 0, CREATION_SKILL_MAX) - 5)];
}

/** A verba: o salário × 1D6/3, para baixo (a fração nenhuma fonte arredonda — escolha do projeto). */
export function startingFunds(salary: number, die: number): number {
  return Math.floor((salary * die) / STARTING_FUNDS_DIE.divisor);
}

/**
 * A verba do rascunho: com linha de salário, o salário do nível × o 1D6 rolado
 * (0 antes de rolar); sem linha (o Fixer), o número que o Mestre deu.
 */
export function draftFunds(draft: Pick<CreationDraft, 'role' | 'saRank' | 'fundsDie' | 'funds'>): number {
  const salary = salaryFor(draft.role, draft.saRank);
  if (salary === null) return draft.funds;
  return draft.fundsDie === null ? 0 : startingFunds(salary, draft.fundsDie);
}

function specialAbilityOf(role: string): string {
  return OFFICIAL_ROLES.find((r) => r.name === role)?.specialAbility ?? '';
}

export function creationBudgets(draft: CreationDraft): { stats: Budget; career: Budget; pickup: Budget } {
  const pkg = careerPackageFor(draft.role);
  const careerSpent = pkg ? sum(careerSkillsOf(pkg, draft.picks).map((s) => draft.career[s.name] ?? 0)) : 0;
  return {
    // Um 9D10 abaixo de 18 não paga o 2 de cada atributo: o 2 fica, e o bolo sobe junto.
    stats: { spent: statsTotal(draft.stats), budget: Math.max(draft.pool, STAT_POOL_MIN) },
    career: { spent: careerSpent + draft.saRank, budget: CAREER_SKILL_POINTS },
    pickup: { spent: sum(draft.pickup.map((p) => p.level)), budget: pickupBudgetOf(draft.stats) }
  };
}

/** O que impede de aplicar o rascunho — vazio quando está pronto. Sobrar não entra aqui. */
export function blockersOf(draft: CreationDraft): string[] {
  const out: string[] = [];
  const pkg = careerPackageFor(draft.role);
  const budgets = creationBudgets(draft);

  if (draft.method === 'roll9d10' && draft.dice.length !== STAT_POOL_DICE) {
    out.push('Role o 9D10: sem o bolo, os atributos não têm orçamento.');
  }
  if (draft.method === 'gmPool' && (draft.pool < STAT_POOL_MIN || draft.pool > STAT_POOL_MAX)) {
    out.push(`O bolo do Mestre vai de ${STAT_POOL_MIN} a ${STAT_POOL_MAX}.`);
  }
  const fora = STAT_NAMES.filter((s) => draft.stats[s] < CREATION_STAT_MIN || draft.stats[s] > CREATION_STAT_MAX);
  if (fora.length) out.push(`Cada atributo vai de ${CREATION_STAT_MIN} a ${CREATION_STAT_MAX} na criação (${fora.join(', ')}).`);
  if (budgets.stats.spent > budgets.stats.budget) {
    out.push(`Os atributos passam do bolo: ${budgets.stats.spent} de ${budgets.stats.budget}.`);
  }

  if (!pkg) {
    out.push('Escolha um role do livro: o pacote de carreira sai dele.');
  } else {
    const career = careerSkillsOf(pkg, draft.picks);
    const missing = careerSlots(pkg) - career.length;
    if (missing > 0) out.push(`Faça as escolhas do pacote de carreira (falta${missing > 1 ? 'm' : ''} ${missing}).`);
    const acima = career.filter((s) => (draft.career[s.name] ?? 0) > CREATION_SKILL_MAX).map((s) => s.name);
    if (draft.saRank > CREATION_SKILL_MAX) acima.push(specialAbilityOf(draft.role));
    if (acima.length) out.push(`Perícia de carreira vai até ${CREATION_SKILL_MAX} (${acima.join(', ')}).`);
    if (budgets.career.spent > budgets.career.budget) {
      out.push(`Os pontos de carreira passam de ${CAREER_SKILL_POINTS}: ${budgets.career.spent}.`);
    }

    const careerNames = new Set(career.map((s) => normalizeName(s.name)));
    const sa = normalizeName(specialAbilityOf(draft.role));
    for (const p of draft.pickup) {
      if (careerNames.has(normalizeName(p.name))) out.push(`${p.name} é perícia de carreira: o pickup não entra nela.`);
      else if (normalizeName(p.name) === sa) out.push(`${p.name} é a habilidade especial: o pickup não entra nela.`);
    }
    if (salaryFor(draft.role, draft.saRank) !== null && draft.fundsDie === null) out.push('Role o 1D6 da verba.');
  }

  const pickupAcima = draft.pickup.filter((p) => p.level > CREATION_SKILL_MAX).map((p) => p.name);
  if (pickupAcima.length) out.push(`Perícia de pickup vai até ${CREATION_SKILL_MAX} (${pickupAcima.join(', ')}).`);
  if (budgets.pickup.spent > budgets.pickup.budget) {
    out.push(`O pickup passa de REF + INT: ${budgets.pickup.spent} de ${budgets.pickup.budget}.`);
  }
  return out;
}

/**
 * O rascunho a partir da ficha: os atributos grampeados em 2–10, as perícias do
 * pacote pelo nome, e todo o resto no pickup — aplicar não perde perícia.
 */
export function createDraft(sheet: CharacterSheet): CreationDraft {
  const role = officialRoleFor(sheet)?.name ?? '';
  const pkg = careerPackageFor(role);
  const byName = new Map((sheet.skills ?? []).map((s) => [normalizeName(s.name), s] as const));
  const levelOf = (name: string) => clamp(byName.get(normalizeName(name))?.level ?? 0, 0, CREATION_SKILL_MAX);

  // A escolha do pacote vem do registro, se houver: a opção que o jogador deixou
  // de fora pode estar no pickup, e a primeira que a ficha tem não é a escolhida.
  const recorded = new Set((sheet.creation?.careerSkills ?? []).map(normalizeName));
  const picks = (pkg?.choices ?? []).flatMap((choice) => {
    const present = choice.options.filter((o) => byName.has(normalizeName(o.name)));
    const chosen = present.filter((o) => recorded.has(normalizeName(o.name)));
    return [...chosen, ...present.filter((o) => !chosen.includes(o))].slice(0, choice.count).map((o) => o.name);
  });
  const allCareer = pkg ? packageSkills(pkg) : [];
  const careerNames = new Set((pkg ? careerSkillsOf(pkg, picks) : []).map((s) => normalizeName(s.name)));
  const sa = normalizeName(sheet.specialAbilityName);

  const stats = {} as CharacterStats;
  for (const s of STAT_NAMES) stats[s] = clamp(sheet.stats?.[s] ?? CREATION_STAT_MIN, CREATION_STAT_MIN, CREATION_STAT_MAX);

  return {
    method: sheet.creation?.method ?? 'roll9d10',
    dice: sheet.creation?.dice ?? [],
    pool: sheet.creation?.pool ?? 0,
    stats,
    role,
    picks,
    saRank: clamp(sheet.specialAbilityRank, 0, CREATION_SKILL_MAX),
    career: Object.fromEntries(allCareer.map((s) => [s.name, levelOf(s.name)])),
    pickup: (sheet.skills ?? [])
      .filter((s) => !s.isSpecialAbility && !careerNames.has(normalizeName(s.name)) && normalizeName(s.name) !== sa)
      .map((s) => ({ name: s.name, stat: s.stat, level: clamp(s.level, 0, CREATION_SKILL_MAX) })),
    fundsDie: sheet.creation?.fundsDie ?? null,
    funds: sheet.creation?.funds ?? 0
  };
}

const newSkillId = () => 'sk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

/** O que aplicar o rascunho muda na ficha — e o registro do que foi gasto. */
export function applyCreation(sheet: CharacterSheet, draft: CreationDraft): Partial<CharacterSheet> {
  const pkg = careerPackageFor(draft.role);
  const career = pkg ? careerSkillsOf(pkg, draft.picks) : [];
  const byName = new Map((sheet.skills ?? []).map((s) => [normalizeName(s.name), s] as const));
  const skill = (name: string, stat: StatName, level: number): SkillItem => {
    const found = byName.get(normalizeName(name));
    return found ? { ...found, stat, level } : { id: newSkillId(), name, stat, level };
  };
  const budgets = creationBudgets(draft);
  const funds = draftFunds(draft);

  return {
    role: draft.role,
    specialAbilityName: specialAbilityOf(draft.role),
    specialAbilityRank: draft.saRank,
    stats: { ...draft.stats },
    skills: [
      ...career.map((s) => skill(s.name, s.stat, draft.career[s.name] ?? 0)),
      ...draft.pickup.map((p) => skill(p.name, p.stat, p.level)),
      ...(sheet.skills ?? []).filter((s) => s.isSpecialAbility)
    ],
    eurodollars: funds,
    creation: {
      method: draft.method,
      dice: draft.method === 'roll9d10' ? [...draft.dice] : [],
      pool: draft.pool,
      stats: { ...draft.stats },
      careerSkills: career.map((s) => s.name),
      careerPoints: budgets.career.spent,
      pickupPoints: budgets.pickup.spent,
      fundsDie: salaryFor(draft.role, draft.saRank) === null ? null : draft.fundsDie,
      funds
    }
  };
}

// ------------------------------------------------------------
// K.6c — o orçamento à vista do GM
// ------------------------------------------------------------

export interface CreationReportLine {
  key: 'stats' | 'career' | 'pickup';
  label: string;
  /** O que a criação registrou; `null` sem registro. */
  atCreation: number | null;
  /** O orçamento; `null` quando não se sabe (o bolo de quem não registrou). */
  budget: number | null;
  now: number;
}

export interface CreationReport {
  recorded: boolean;
  method: CreationMethod | null;
  dice: number[];
  pool: number | null;
  funds: number | null;
  lines: CreationReportLine[];
  /** O que passou de um orçamento, ou não bate — a lista de jogadores marca. */
  warnings: string[];
  /** O que o GM deve saber e não é passar do orçamento (a ficha sem registro). */
  notes: string[];
}

/**
 * A ficha de hoje contra o que a criação gastou. Não decide nada: o IP e o cromo
 * sobem os números depois da criação, e o servidor não tem o histórico (K.0).
 * Sem registro, confere o pacote do role (todas as opções) contra os 40 e o
 * pickup contra o REF + INT de hoje — o que dá para conferir sem o bolo.
 */
export function creationReport(sheet: CharacterSheet): CreationReport {
  const c = sheet.creation;
  const skills = sheet.skills ?? [];
  const role = officialRoleFor(sheet)?.name ?? '';
  const pkg = careerPackageFor(role);
  const careerNames = new Set(
    (c ? c.careerSkills : pkg ? packageSkills(pkg).map((s) => s.name) : []).map(normalizeName)
  );
  const sa = normalizeName(sheet.specialAbilityName);
  const level = (n: unknown) => Number(n) || 0;
  const careerNow = sum(skills.filter((s) => careerNames.has(normalizeName(s.name))).map((s) => level(s.level))) + level(sheet.specialAbilityRank);
  const pickupNow = sum(
    skills.filter((s) => !s.isSpecialAbility && !careerNames.has(normalizeName(s.name)) && normalizeName(s.name) !== sa).map((s) => level(s.level))
  );
  const statsNow = statsTotal(sheet.stats);

  const lines: CreationReportLine[] = [
    { key: 'stats', label: 'Atributos', atCreation: c ? statsTotal(c.stats) : null, budget: c ? Math.max(c.pool, STAT_POOL_MIN) : null, now: statsNow },
    { key: 'career', label: 'Carreira', atCreation: c ? c.careerPoints : null, budget: CAREER_SKILL_POINTS, now: careerNow },
    { key: 'pickup', label: 'Pickup', atCreation: c ? c.pickupPoints : null, budget: pickupBudgetOf(c ? c.stats : sheet.stats), now: pickupNow }
  ];

  const warnings: string[] = [];
  const notes: string[] = [];
  if (!c) {
    notes.push('Sem registro de criação: a ficha não diz de que orçamento saiu.');
  } else {
    if (c.method === 'roll9d10' && (c.dice.length !== STAT_POOL_DICE || sum(c.dice) !== c.pool)) {
      warnings.push(`O bolo (${c.pool}) não bate com os dados registrados (${c.dice.join(' ') || 'nenhum'}).`);
    }
    const foraNaCriacao = STAT_NAMES.filter((s) => c.stats[s] < CREATION_STAT_MIN || c.stats[s] > CREATION_STAT_MAX);
    if (foraNaCriacao.length) warnings.push(`Na criação, atributo fora de 2 a 10 (${foraNaCriacao.map((s) => `${s} ${c.stats[s]}`).join(', ')}).`);
    for (const l of lines) {
      if (l.atCreation !== null && l.budget !== null && l.atCreation > l.budget) {
        warnings.push(`Na criação, ${l.label.toLowerCase()} passou do orçamento: ${l.atCreation} de ${l.budget}.`);
      }
    }
    const statsAtCreation = lines[0].atCreation!;
    if (statsNow > statsAtCreation) {
      warnings.push(`Os atributos base subiram desde a criação: ${statsAtCreation} → ${statsNow} (o cromo soma à parte, e o IP não sobe atributo).`);
    }
  }
  const acimaDe10 = STAT_NAMES.filter((s) => level(sheet.stats?.[s]) > CREATION_STAT_MAX);
  if (acimaDe10.length) {
    warnings.push(`Atributo base acima de 10 (${acimaDe10.map((s) => `${s} ${sheet.stats[s]}`).join(', ')}): o cromo soma à parte.`);
  }
  for (const l of lines.slice(1)) {
    if (l.budget !== null && l.now > l.budget) warnings.push(`${l.label} hoje: ${l.now} de ${l.budget} — o IP explica? Pergunte.`);
  }

  return {
    recorded: !!c,
    method: c?.method ?? null,
    dice: c?.dice ?? [],
    pool: c?.pool ?? null,
    funds: c?.funds ?? null,
    lines,
    warnings,
    notes
  };
}
