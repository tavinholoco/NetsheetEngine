import React, { useState } from 'react';
import { ClipboardList, Dice5, Plus, Trash2 } from 'lucide-react';
import type { CharacterSheet, StatName } from '../../../types/cyberpunk';
import { OFFICIAL_ROLES, SKILL_TABLES } from '../../../data/cyberpunkData';
import { STAT_NAMES } from '../../../rules/character';
import { normalizeName } from '../../../rules/combat';
import type { Rng } from '../../../rules/dice';
import {
  applyCreation,
  blockersOf,
  careerPackageFor,
  careerSkillsOf,
  createDraft,
  creationBudgets,
  draftFunds,
  rollStatPool,
  salaryFor,
  type Budget,
  type CreationDraft
} from '../../../rules/creation';
import {
  CREATION_SKILL_MAX,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  STARTING_FUNDS_DIE,
  STAT_POOL_MAX,
  STAT_POOL_MIN
} from '../../../rules/tables';
import { clientRng } from '../../../utils/diceEngine';
import { formatEb } from '../../../lib/format';
import { NumberField } from './NumberField';

/**
 * K.6b — CRIAÇÃO // O ORÇAMENTO DO LIVRO (decisão 13)
 * O assistente rola o 9D10 ou recebe o bolo do Mestre, distribui os atributos
 * (2 a 10), os 40 pontos de carreira no pacote do role e o pickup de REF + INT,
 * rola a verba (salário × 1D6/3) e grava o que foi gasto (`creation`). As contas
 * e os bloqueios saem de src/rules/creation.ts: passar de um orçamento trava o
 * "Aplicar"; sobrar, só aparece. O GM vê o registro na mesa (K.6c).
 */

interface CreationSectionProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  /** Injetável nos testes; o padrão é o RNG do cliente (Web Crypto). */
  rng?: Rng;
}

const eb = formatEb;

const field = 'bg-surface border border-field text-xs text-fg-strong px-2 py-1.5 rounded focus:border-accent-400 focus:outline-none';
const numberField = `${field} font-mono w-12`;
const stepTitle = 'text-micro text-accent-400 uppercase tracking-caps';

/** Toda perícia das listas da ficha, com o atributo dela (cada nome em um atributo só — K.7a). */
const ALL_SKILLS: { name: string; stat: StatName }[] = (Object.keys(SKILL_TABLES) as StatName[]).flatMap((stat) =>
  SKILL_TABLES[stat].map((name) => ({ name, stat }))
);
const baseName = (name: string) => normalizeName(name.replace('(escolha)', ''));

const BudgetLine: React.FC<{ label: string; budget: Budget; testId: string }> = ({ label, budget, testId }) => {
  const over = budget.spent > budget.budget;
  const left = budget.budget - budget.spent;
  return (
    <span className="text-micro text-muted uppercase">
      {label}{' '}
      <span data-testid={testId} className={`font-mono ${over ? 'text-fault-400' : 'text-fg-strong'}`}>
        {budget.spent}/{budget.budget}
      </span>
      {left > 0 && <span className="normal-case text-subtle"> — sobram {left}</span>}
    </span>
  );
};

export const CreationSection: React.FC<CreationSectionProps> = ({ sheet, onChange, rng = clientRng }) => {
  const [draft, setDraft] = useState<CreationDraft | null>(null);
  const [pickupChoice, setPickupChoice] = useState('');
  const creation = sheet.creation;

  const set = (patch: Partial<CreationDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
      <div className="flex items-center space-x-2">
        <ClipboardList className="w-5 h-5 text-accent-400" />
        <h2 className="text-base sm:text-lg font-display font-bold text-accent-400 uppercase tracking-display">
          Criação // Orçamento do Livro
        </h2>
      </div>
    </div>
  );

  if (!draft) {
    return (
      <div className="print:hidden bg-raised/70 border-l-4 border-l-accent-500 border-y border-r border-line rounded-lg p-5 space-y-4">
        {header}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {creation ? (
            <p className="text-micro text-muted" data-testid="creation-summary">
              {creation.method === 'roll9d10' ? (
                <>Criada pelo 9D10 — bolo <span className="font-mono text-fg-strong">{creation.pool}</span> ({creation.dice.join(' ')})</>
              ) : (
                <>Criada pelo bolo do Mestre — <span className="font-mono text-fg-strong">{creation.pool}</span></>
              )}
              {' · '}carreira <span className="font-mono text-fg-strong">{creation.careerPoints}/40</span>
              {' · '}pickup <span className="font-mono text-fg-strong">{creation.pickupPoints}</span>
              {' · '}verba <span className="font-mono text-fg-strong">{eb(creation.funds)}</span>
            </p>
          ) : (
            <p className="text-micro text-subtle">Sem registro de criação — a ficha não diz de que orçamento saiu.</p>
          )}
          <button
            type="button"
            onClick={() => setDraft(createDraft(sheet))}
            className="px-3 py-1.5 bg-surface hover:bg-accent-950/60 border border-dashed border-accent-700/60 text-accent-400 hover:text-accent-300 font-bold text-mini uppercase rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {creation ? 'Refazer pelo livro' : 'Montar pelo livro'}
          </button>
        </div>
      </div>
    );
  }

  const pkg = careerPackageFor(draft.role);
  const career = pkg ? careerSkillsOf(pkg, draft.picks) : [];
  const careerNames = new Set(career.map((s) => normalizeName(s.name)));
  const ability = OFFICIAL_ROLES.find((r) => r.name === draft.role)?.specialAbility ?? '';
  const budgets = creationBudgets(draft);
  const blockers = blockersOf(draft);
  const salary = salaryFor(draft.role, draft.saRank);
  const funds = draftFunds(draft);
  const inPickup = new Set(draft.pickup.map((p) => baseName(p.name)));
  const pickupOptions = ALL_SKILLS.filter(
    (s) => !careerNames.has(baseName(s.name)) && baseName(s.name) !== normalizeName(ability) && !inPickup.has(baseName(s.name))
  );

  const changeRole = (role: string) => {
    const specialAbilityName = OFFICIAL_ROLES.find((r) => r.name === role)?.specialAbility ?? '';
    const fresh = createDraft({ ...sheet, role, specialAbilityName });
    setDraft({ ...fresh, method: draft.method, dice: draft.dice, pool: draft.pool, stats: draft.stats });
  };

  const togglePick = (name: string) =>
    set({ picks: draft.picks.includes(name) ? draft.picks.filter((p) => p !== name) : [...draft.picks, name] });

  const addPickup = () => {
    const skill = ALL_SKILLS.find((s) => s.name === (pickupChoice || pickupOptions[0]?.name));
    if (!skill) return;
    set({ pickup: [...draft.pickup, { name: skill.name, stat: skill.stat, level: 0 }] });
    setPickupChoice('');
  };

  const apply = () => {
    onChange(applyCreation(sheet, draft));
    setDraft(null);
  };

  return (
    <div className="print:hidden bg-raised/70 border-l-4 border-l-accent-500 border-y border-r border-line rounded-lg p-5 space-y-4">
      {header}

      {/* 1. O bolo de atributos */}
      <div className="bg-surface/80 p-3 rounded border border-line space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={stepTitle}>1 · Atributos</span>
          <BudgetLine label="Atributos" budget={budgets.stats} testId="budget-stats" />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-fg-soft">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="creation-method" checked={draft.method === 'roll9d10'} onChange={() => set({ method: 'roll9d10', dice: [], pool: 0 })} />
            9D10 num bolo
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="creation-method" checked={draft.method === 'gmPool'} onChange={() => set({ method: 'gmPool', dice: [], pool: 0 })} />
            Bolo do Mestre
          </label>
          {draft.method === 'roll9d10' ? (
            <>
              <button
                type="button"
                onClick={() => set(rollStatPool(rng))}
                className="px-2.5 py-1 bg-roll-500 hover:bg-roll-400 text-black rounded font-bold text-micro uppercase flex items-center gap-1 cursor-pointer transition-all"
              >
                <Dice5 className="w-3 h-3" />
                Rolar 9D10
              </button>
              {draft.dice.length > 0 && (
                <span className="text-micro text-muted">
                  <span className="font-mono text-roll-300" data-testid="creation-dice">{draft.dice.join(' ')}</span> = bolo{' '}
                  <span className="font-mono text-fg-strong">{draft.pool}</span>
                </span>
              )}
            </>
          ) : (
            <label className="flex items-center gap-1.5 text-micro text-muted uppercase">
              Bolo
              <NumberField
                value={draft.pool}
                min={STAT_POOL_MIN}
                max={STAT_POOL_MAX}
                label="Bolo de atributos"
                className={numberField}
                onCommit={(pool) => set({ pool })}
              />
              <span className="normal-case text-subtle">({STAT_POOL_MIN} a {STAT_POOL_MAX}, o Mestre diz)</span>
            </label>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
          {STAT_NAMES.map((stat) => (
            <label key={stat} className="flex flex-col items-center gap-1 text-micro text-muted uppercase">
              {stat}
              <NumberField
                value={draft.stats[stat]}
                min={CREATION_STAT_MIN}
                max={CREATION_STAT_MAX}
                label={`${stat} na criação`}
                className={`${numberField} text-center`}
                onCommit={(v) => set({ stats: { ...draft.stats, [stat]: v } })}
              />
            </label>
          ))}
        </div>
      </div>

      {/* 2. Os 40 pontos de carreira */}
      <div className="bg-surface/80 p-3 rounded border border-line space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={stepTitle}>2 · Carreira</span>
          <BudgetLine label="Carreira" budget={budgets.career} testId="budget-career" />
        </div>
        <label className="flex items-center gap-2 text-micro text-muted uppercase">
          Role
          <select value={draft.role} onChange={(e) => changeRole(e.target.value)} aria-label="Role da criação" className={field}>
            {!draft.role && <option value="">— escolha —</option>}
            {OFFICIAL_ROLES.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {pkg && (
          <>
            {(pkg.choices ?? []).map((choice, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 text-xs text-fg-soft">
                <span className="text-micro text-muted uppercase">Escolha {choice.count}:</span>
                {choice.options.map((o) => {
                  const checked = draft.picks.includes(o.name);
                  const full = choice.options.filter((x) => draft.picks.includes(x.name)).length >= choice.count;
                  return (
                    <label key={o.name} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => togglePick(o.name)} />
                      {o.name}
                    </label>
                  );
                })}
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
              <label className="flex items-center justify-between gap-2 text-xs text-signal-300">
                <span>{ability} <span className="text-micro text-muted">(habilidade especial)</span></span>
                <NumberField
                  value={draft.saRank}
                  min={0}
                  max={CREATION_SKILL_MAX}
                  label={`${ability} (habilidade especial)`}
                  className={numberField}
                  onCommit={(saRank) => set({ saRank })}
                />
              </label>
              {career.map((s) => (
                <label key={s.name} className="flex items-center justify-between gap-2 text-xs text-fg-soft">
                  <span>
                    {s.name} <span className="text-micro text-muted font-mono">{s.stat}</span>
                  </span>
                  <NumberField
                    value={draft.career[s.name] ?? 0}
                    min={0}
                    max={CREATION_SKILL_MAX}
                    label={`${s.name} (carreira)`}
                    className={numberField}
                    onCommit={(v) => set({ career: { ...draft.career, [s.name]: v } })}
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. O pickup: REF + INT */}
      <div className="bg-surface/80 p-3 rounded border border-line space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={stepTitle}>3 · Pickup (REF + INT)</span>
          <BudgetLine label="Pickup" budget={budgets.pickup} testId="budget-pickup" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pickupChoice}
            onChange={(e) => setPickupChoice(e.target.value)}
            aria-label="Perícia de pickup"
            className={`${field} flex-1 min-w-[10rem]`}
          >
            {pickupOptions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.stat})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addPickup}
            className="px-2.5 py-1.5 bg-surface hover:bg-accent-950/60 border border-accent-700/60 text-accent-400 font-bold text-micro uppercase rounded cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Adicionar ao pickup
          </button>
        </div>
        {draft.pickup.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {draft.pickup.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2 text-xs text-fg-soft">
                <span>
                  {p.name} <span className="text-micro text-muted font-mono">{p.stat}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <NumberField
                    value={p.level}
                    min={0}
                    max={CREATION_SKILL_MAX}
                    label={`${p.name} (pickup)`}
                    className={numberField}
                    onCommit={(level) => set({ pickup: draft.pickup.map((x) => (x.name === p.name ? { ...x, level } : x)) })}
                  />
                  <button
                    type="button"
                    onClick={() => set({ pickup: draft.pickup.filter((x) => x.name !== p.name) })}
                    aria-label={`Tirar ${p.name} do pickup`}
                    className="p-1 text-subtle hover:text-fault-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. A verba inicial */}
      <div className="bg-surface/80 p-3 rounded border border-line space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={stepTitle}>4 · Verba inicial</span>
          <span className="text-micro text-muted uppercase">
            Verba <span data-testid="creation-funds" className="font-mono text-fg-strong">{eb(funds)}</span>
          </span>
        </div>
        {salary !== null ? (
          <div className="flex flex-wrap items-center gap-3 text-micro text-muted">
            <span>
              Salário de <span className="font-mono text-fg-strong">{eb(salary)}</span> por mês ({draft.role}, nível {draft.saRank}) ×
              1D{STARTING_FUNDS_DIE.sides}/{STARTING_FUNDS_DIE.divisor}
              {draft.fundsDie !== null && (
                <> — rolou <span className="font-mono text-roll-300">{draft.fundsDie}</span></>
              )}
            </span>
            <button
              type="button"
              onClick={() => set({ fundsDie: rng(STARTING_FUNDS_DIE.sides) })}
              className="px-2.5 py-1 bg-roll-500 hover:bg-roll-400 text-black rounded font-bold text-micro uppercase flex items-center gap-1 cursor-pointer transition-all"
            >
              <Dice5 className="w-3 h-3" />
              Rolar 1D6
            </button>
          </div>
        ) : (
          <label className="flex flex-wrap items-center gap-2 text-micro text-muted">
            <span className="uppercase">Verba</span>
            <NumberField
              value={draft.funds}
              min={0}
              max={10_000_000}
              label="Verba do Mestre"
              className={`${field} font-mono w-24`}
              onCommit={(v) => set({ funds: v })}
            />
            <span>
              {draft.role || 'Este role'} não tem linha de salário com duas fontes: o Mestre define.
            </span>
          </label>
        )}
      </div>

      {blockers.length > 0 && (
        <ul data-testid="creation-blockers" className="text-micro text-fault-300 space-y-0.5 list-disc pl-4">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="px-3 py-1.5 bg-raised hover:bg-raised-strong border border-line-strong text-fg-soft rounded font-bold text-micro uppercase cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={blockers.length > 0}
          className="px-4 py-1.5 bg-accent-500 hover:bg-accent-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded font-bold text-micro uppercase cursor-pointer transition-all"
        >
          Aplicar à ficha
        </button>
      </div>
    </div>
  );
};
