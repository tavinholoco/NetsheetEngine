import React from 'react';
import { Backpack, Plus, Trash2 } from 'lucide-react';
import type { CharacterSheet, GearItem } from '../../../types/cyberpunk';
import { carryKg, deriveCurrentStats, gearWeightKg, liftKg } from '../../../rules/character';
import { GEAR_QTY_MAX, GEAR_WEIGHT_MAX_KG } from '../../../rules/sheetSchema';
import { NumberField } from './NumberField';

/**
 * K.2d — INVENTÁRIO & CARGA
 * Carry e Lift saem do BODY corrente (S1, S6, S8). O peso do inventário aparece
 * contra o Carry, e passar dele só gera um aviso: nenhuma fonte penaliza o peso
 * carregado (decisão 13). As notas de equipamento (`gearNotes`) existiam na
 * ficha desde a Fase 0 sem tela nenhuma; o campo delas mora aqui.
 */

interface GearSectionProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

/** Peso com vírgula decimal, sem zeros sobrando: 2,5 · 80. */
function kg(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
}

export const GearSection: React.FC<GearSectionProps> = ({ sheet, onChange }) => {
  const gear = sheet.gear ?? [];
  const body = deriveCurrentStats(sheet).BODY;
  const carry = carryKg(body);
  const lift = liftKg(body);
  const total = gearWeightKg(gear);
  const over = total > carry;

  const update = (id: string, patch: Partial<GearItem>) =>
    onChange({ gear: gear.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  const addItem = () => {
    const item: GearItem = {
      id: 'gear_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: 'Novo item',
      weightKg: 0,
      qty: 1
    };
    onChange({ gear: [...gear, item] });
  };

  const removeItem = (id: string) => onChange({ gear: gear.filter((g) => g.id !== id) });

  return (
    <div className="bg-raised/70 border-l-4 border-l-caution-500 border-y border-r border-line rounded-lg p-5 space-y-4 relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center space-x-2">
          <Backpack className="w-5 h-5 text-caution-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-caution-400 uppercase tracking-display">
            Inventário & Carga
          </h2>
        </div>
        <div className="flex items-center gap-3 text-micro text-muted uppercase">
          <span>
            Carry <span className="font-mono text-fg-strong" data-testid="carry">{kg(carry)}</span>
          </span>
          <span>
            Lift <span className="font-mono text-fg-strong" data-testid="lift">{kg(lift)}</span>
          </span>
        </div>
      </div>

      <p className="text-xs text-fg-soft" data-testid="gear-weight">
        Peso do inventário: <span className="font-mono text-fg-strong">{kg(total)}</span> de{' '}
        <span className="font-mono">{kg(carry)}</span>
        {over && <span className="text-caution-400"> — acima do Carry (BODY × 10); a ficha só avisa.</span>}
      </p>

      {gear.length === 0 && <p className="text-micro text-subtle">Nenhum item no inventário.</p>}

      <div className="space-y-2" data-print-flow>
        {gear.map((item) => {
          const label = item.name || 'item sem nome';
          return (
            <div key={item.id} className="bg-surface/80 p-2.5 rounded border border-line flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={item.name}
                onChange={(e) => update(item.id, { name: e.target.value })}
                aria-label="Nome do item"
                className="flex-1 min-w-[10rem] bg-surface border border-field text-xs text-fg-strong px-2.5 py-1.5 rounded focus:border-caution-400 focus:outline-none"
              />
              <label className="flex items-center gap-1 text-micro text-muted uppercase">
                kg
                <NumberField
                  value={item.weightKg}
                  min={0}
                  max={GEAR_WEIGHT_MAX_KG}
                  decimals={2}
                  onCommit={(weightKg) => update(item.id, { weightKg })}
                  label={`Peso de ${label}`}
                  className="w-16 bg-surface border border-field font-mono text-xs text-fg-strong px-1.5 py-1 rounded focus:border-caution-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1 text-micro text-muted uppercase">
                ×
                <NumberField
                  value={item.qty}
                  min={1}
                  max={GEAR_QTY_MAX}
                  onCommit={(qty) => update(item.id, { qty })}
                  label={`Quantidade de ${label}`}
                  className="w-14 bg-surface border border-field font-mono text-xs text-fg-strong px-1.5 py-1 rounded focus:border-caution-400 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remover ${label}`}
                className="p-1.5 rounded bg-raised hover:bg-fault-950 border border-line hover:border-fault-500 text-subtle hover:text-fault-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="w-full py-2 bg-surface hover:bg-caution-950/60 border border-dashed border-caution-700/60 text-caution-400 hover:text-caution-300 font-bold text-mini uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar item
      </button>

      <div>
        <label htmlFor="gear-notes" className="text-micro text-muted block mb-1 uppercase">
          Notas de equipamento:
        </label>
        <textarea
          id="gear-notes"
          value={sheet.gearNotes ?? ''}
          onChange={(e) => onChange({ gearNotes: e.target.value })}
          rows={2}
          className="w-full bg-surface border border-field text-xs text-fg-strong px-2.5 py-1.5 rounded focus:border-caution-400 focus:outline-none"
        />
      </div>
    </div>
  );
};
