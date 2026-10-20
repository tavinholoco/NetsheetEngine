import React from 'react';
import { Cpu, Plus, Trash2 } from 'lucide-react';
import type { CharacterSheet, Cyberdeck, NetProgram } from '../../../types/cyberpunk';
import { deriveCurrentStats } from '../../../rules/character';
import { createDefaultDeck, deckCostEb, deckTotalMu, loadedProgramsMu, netInitiativeBonus } from '../../../rules/netrun';
import { DECK_CHASSIS, DECK_EXTRA_MEMORY_MU, DECK_UPGRADE_EB, PROGRAM_CLASSES, type DeckChassisId, type ProgramClassId } from '../../../rules/tables';
import {
  DECK_CODE_GATE_MAX,
  DECK_DATA_WALL_MAX,
  DECK_SPEED_MAX,
  PROGRAM_MU_MAX,
  PROGRAM_STRENGTH_MAX
} from '../../../rules/sheetSchema';
import { formatEb } from '../../../lib/format';
import { NumberField } from './NumberField';

/**
 * K.5c — NETRUNNER // DECK & PROGRAMAS (decisão 9: a ficha, sem a Net)
 * O deck começa no padrão do livro (10 MU, Speed 0, Data Wall 2); a MU, o preço
 * pela tabela e a iniciativa na Net (1d10 + REF + Speed) saem de src/rules/netrun.ts.
 * Os programas carregados ocupam a MU do deck, e passar dela só avisa, como o
 * Carry da K.2d. O programa é digitado, como a arma: o catálogo do livro não
 * fechou em duas fontes independentes (K.5a).
 */

interface NetrunnerSectionProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

const field = 'bg-surface border border-field text-xs text-fg-strong px-2 py-1.5 rounded focus:border-cyber-400 focus:outline-none';
const numberField = `${field} font-mono w-14`;
const label = 'flex flex-col gap-1 text-micro text-muted uppercase';

export const NetrunnerSection: React.FC<NetrunnerSectionProps> = ({ sheet, onChange }) => {
  const deck = sheet.deck;
  const programs = sheet.programs ?? [];
  const usedMu = loadedProgramsMu(programs);
  const totalMu = deck ? deckTotalMu(deck) : 0;
  const ref = deriveCurrentStats(sheet).REF;

  const setDeck = (patch: Partial<Cyberdeck>) => deck && onChange({ deck: { ...deck, ...patch } });
  const updateProgram = (id: string, patch: Partial<NetProgram>) =>
    onChange({ programs: programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const addProgram = () => {
    const program: NetProgram = {
      id: 'prog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: 'Novo programa',
      programClass: 'intrusion',
      strength: 0,
      mu: 1,
      costEb: 0,
      loaded: true
    };
    onChange({ programs: [...programs, program] });
  };

  const removeProgram = (id: string) => onChange({ programs: programs.filter((p) => p.id !== id) });

  return (
    <div className="bg-raised/70 border-l-4 border-l-cyber-500 border-y border-r border-line rounded-lg p-5 space-y-4 relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-cyber-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-cyber-400 uppercase tracking-display">
            Netrunner // Deck & Programas
          </h2>
        </div>
        {deck && (
          <span className="text-micro text-muted uppercase">
            MU <span className="font-mono text-fg-strong" data-testid="deck-mu">{usedMu}/{totalMu} MU</span>
          </span>
        )}
      </div>

      {!deck ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-micro text-subtle">Sem cyberdeck.</p>
          <button
            type="button"
            onClick={() => onChange({ deck: createDefaultDeck() })}
            className="px-3 py-1.5 bg-surface hover:bg-cyber-950/60 border border-dashed border-cyber-700/60 text-cyber-400 hover:text-cyber-300 font-bold text-mini uppercase rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Montar cyberdeck
          </button>
        </div>
      ) : (
        <div className="bg-surface/80 p-3 rounded border border-line space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${label} flex-1 min-w-[10rem]`}>
              Modelo
              <input
                type="text"
                value={deck.model}
                placeholder="Zetatech, Militech…"
                onChange={(e) => setDeck({ model: e.target.value })}
                aria-label="Modelo do deck"
                className={`${field} placeholder:text-faint`}
              />
            </label>
            <label className={label}>
              Tipo
              <select
                value={deck.chassis}
                onChange={(e) => setDeck({ chassis: e.target.value as DeckChassisId })}
                aria-label="Tipo do deck"
                className={field}
              >
                {DECK_CHASSIS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatEb(c.costEb)}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Speed
              <NumberField value={deck.speed} min={0} max={DECK_SPEED_MAX} label="Speed do deck" onCommit={(speed) => setDeck({ speed })} className={numberField} />
            </label>
            <label className={label}>
              Data Wall
              <NumberField value={deck.dataWall} min={0} max={DECK_DATA_WALL_MAX} label="Data Wall do deck" onCommit={(dataWall) => setDeck({ dataWall })} className={numberField} />
            </label>
            <label className={label}>
              Code Gate
              <NumberField value={deck.codeGate} min={0} max={DECK_CODE_GATE_MAX} label="Code Gate do deck" onCommit={(codeGate) => setDeck({ codeGate })} className={numberField} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-fg-soft cursor-pointer">
            <input
              type="checkbox"
              checked={deck.extraMemory}
              onChange={(e) => setDeck({ extraMemory: e.target.checked })}
              className="accent-cyber-500"
            />
            Segundo módulo de memória (+{DECK_EXTRA_MEMORY_MU} MU, {formatEb(DECK_UPGRADE_EB.extraMemory)})
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-soft">
            <span>
              Preço pela tabela: <span className="font-mono text-fg-strong" data-testid="deck-cost">{formatEb(deckCostEb(deck))}</span>
            </span>
            <span title="1d10 + REF + Speed do deck (S1, S6)">
              Iniciativa na Net: <span className="font-mono text-fg-strong" data-testid="net-initiative">1d10 + {netInitiativeBonus(ref, deck)}</span>
              <span className="text-subtle"> (REF {ref} + Speed {deck.speed})</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ deck: undefined })}
              className="px-2 py-1 rounded bg-raised hover:bg-fault-950 border border-line hover:border-fault-500 text-subtle hover:text-fault-400 text-micro uppercase transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Remover deck
            </button>
          </div>
        </div>
      )}

      {deck && usedMu > totalMu && (
        <p className="text-xs text-caution-400">Os programas carregados passam {usedMu - totalMu} acima da MU do deck — a ficha só avisa.</p>
      )}

      {programs.length === 0 && <p className="text-micro text-subtle">Nenhum programa.</p>}

      <div className="space-y-2" data-print-flow>
        {programs.map((p) => {
          const name = p.name || 'programa sem nome';
          return (
            <div key={p.id} className="bg-surface/80 p-2.5 rounded border border-line flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={p.name}
                onChange={(e) => updateProgram(p.id, { name: e.target.value })}
                aria-label="Nome do programa"
                className={`${field} flex-1 min-w-[9rem]`}
              />
              <select
                value={p.programClass}
                onChange={(e) => updateProgram(p.id, { programClass: e.target.value as ProgramClassId })}
                aria-label={`Classe de ${name}`}
                className={field}
              >
                {PROGRAM_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-micro text-muted uppercase">
                Força
                <NumberField value={p.strength} min={0} max={PROGRAM_STRENGTH_MAX} label={`Força de ${name}`} onCommit={(strength) => updateProgram(p.id, { strength })} className={`${numberField} w-12`} />
              </label>
              <label className="flex items-center gap-1 text-micro text-muted uppercase">
                MU
                <NumberField value={p.mu} min={0} max={PROGRAM_MU_MAX} label={`MU de ${name}`} onCommit={(mu) => updateProgram(p.id, { mu })} className={`${numberField} w-12`} />
              </label>
              <label className="flex items-center gap-1 text-micro text-muted uppercase">
                eb
                <NumberField value={p.costEb} min={0} max={10_000_000} label={`Custo de ${name}`} onCommit={(costEb) => updateProgram(p.id, { costEb })} className={`${numberField} w-20`} />
              </label>
              <label className="flex items-center gap-1 text-micro text-muted uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.loaded}
                  onChange={(e) => updateProgram(p.id, { loaded: e.target.checked })}
                  aria-label={`${name} no deck`}
                  className="accent-cyber-500"
                />
                No deck
              </label>
              <button
                type="button"
                onClick={() => removeProgram(p.id)}
                aria-label={`Remover ${name}`}
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
        onClick={addProgram}
        className="w-full py-2 bg-surface hover:bg-cyber-950/60 border border-dashed border-cyber-700/60 text-cyber-400 hover:text-cyber-300 font-bold text-mini uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar programa
      </button>
    </div>
  );
};
