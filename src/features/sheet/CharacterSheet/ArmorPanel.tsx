import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ArmorLocation, ArmorPiece, CharacterSheet } from '../../../types/cyberpunk';
import { armorEvTotal, armorLocationsOf, armorSpAt } from '../../../rules/damage';

/**
 * K.2b — A ARMADURA POR PEÇA
 * Cada peça cobre os locais dela (uma jaqueta é uma peça, não quatro), e o SP
 * de cada local sai da regra (`armorSpAt`): as peças vestidas que o cobrem,
 * combinadas pela tabela proporcional, de dentro para fora — a ordem da lista.
 * O SP de um local não se edita mais à mão: ele é o resultado das peças.
 */

const LOCATIONS: { loc: ArmorLocation; label: string; short: string; icon: string }[] = [
  { loc: 'Head', label: 'Cabeça (1)', short: 'Cab', icon: '🧠' },
  { loc: 'Torso', label: 'Tronco (2-4)', short: 'Tron', icon: '🎽' },
  { loc: 'Right Arm', label: 'Braço Dir (5)', short: 'BrD', icon: '🦾' },
  { loc: 'Left Arm', label: 'Braço Esq (6)', short: 'BrE', icon: '🦾' },
  { loc: 'Right Leg', label: 'Perna Dir (7-8)', short: 'PnD', icon: '🦿' },
  { loc: 'Left Leg', label: 'Perna Esq (9-0)', short: 'PnE', icon: '🦿' }
];

/** Os tetos do validador (sheetSchema): a tela não oferece o que ele grampearia. */
const SP_MAX = 100;
const EV_MAX = 20;

function wholeNumber(value: string, max: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}

/** A peça no formato da K.2: `locations`, sem o `location` da ficha antiga. */
function current(piece: ArmorPiece): ArmorPiece {
  const { location: _legacy, ...rest } = piece;
  return { ...rest, locations: armorLocationsOf(piece) };
}

interface ArmorPanelProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

export const ArmorPanel: React.FC<ArmorPanelProps> = ({ sheet, onChange }) => {
  const armor = sheet.armor ?? [];
  const ev = armorEvTotal(armor);

  const update = (id: string, patch: Partial<ArmorPiece>) =>
    onChange({ armor: armor.map((a) => (a.id === id ? { ...current(a), ...patch } : a)) });

  const toggleLocation = (piece: ArmorPiece, loc: ArmorLocation) => {
    const covered = armorLocationsOf(piece);
    const next = covered.includes(loc) ? covered.filter((l) => l !== loc) : [...covered, loc];
    // Peça sem local nenhum some no validador; a última cobertura não sai.
    if (next.length === 0) return;
    update(piece.id, { locations: LOCATIONS.map((l) => l.loc).filter((l) => next.includes(l)) });
  };

  const addPiece = () => {
    const piece: ArmorPiece = {
      id: 'arm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: 'Nova peça',
      locations: ['Torso'],
      sp: 10,
      ev: 0,
      equipped: true
    };
    onChange({ armor: [...armor, piece] });
  };

  const removePiece = (id: string) => onChange({ armor: armor.filter((a) => a.id !== id) });

  return (
    <div className="space-y-4">
      <div className="bg-surface/80 p-4 rounded-lg border border-line space-y-3">
        <span className="text-xs font-bold text-accent-400 uppercase tracking-caps block">
          Pontos de Parada (Stopping Power - SP) por Localização Corporal
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {LOCATIONS.map(({ loc, label, icon }) => (
            <div key={loc} className="bg-raised/90 p-3 rounded border border-line text-center space-y-2">
              <span className="text-xl block" aria-hidden="true">{icon}</span>
              <span className="text-micro text-muted block uppercase">{label}</span>
              <div className="text-lg font-mono text-signal-400" data-testid={`sp-${loc}`}>
                SP {armorSpAt(armor, loc)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-micro text-subtle">
          Duas peças no mesmo local não somam: vale o maior SP, mais um bônus pela diferença entre elas (p. 99).
        </p>
        {/* K.2c — o EV das peças vestidas sai do REF de toda rolagem. */}
        <p className="text-xs text-fg-soft" data-testid="armor-ev">
          EV das peças vestidas: <span className="font-mono text-signal-400">{ev}</span>
          {ev > 0 ? ` — o REF rola com −${ev}` : ' — o REF não perde nada'}
        </p>
      </div>

      <div className="bg-surface/80 p-4 rounded-lg border border-line space-y-3">
        <span className="text-xs font-bold text-accent-400 uppercase tracking-caps block">
          Peças de armadura — de dentro para fora
        </span>

        {armor.length === 0 && <p className="text-micro text-subtle">Nenhuma peça. Sem armadura, todo local tem SP 0.</p>}

        <div className="space-y-2">
          {armor.map((piece) => {
            const covered = armorLocationsOf(piece);
            const label = piece.name || 'peça sem nome';
            return (
              <div key={piece.id} className="bg-raised/90 p-3 rounded border border-line space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={piece.name}
                    onChange={(e) => update(piece.id, { name: e.target.value })}
                    aria-label="Nome da peça"
                    className="flex-1 min-w-[10rem] bg-surface border border-field text-xs text-fg-strong px-2.5 py-1.5 rounded focus:border-accent-400 focus:outline-none"
                  />
                  <label className="flex items-center gap-1 text-micro text-muted uppercase">
                    SP
                    <input
                      type="number"
                      min={0}
                      max={SP_MAX}
                      value={piece.sp}
                      onChange={(e) => update(piece.id, { sp: wholeNumber(e.target.value, SP_MAX) })}
                      aria-label={`SP de ${label}`}
                      className="w-14 bg-surface border border-field font-mono text-xs text-fg-strong px-1.5 py-1 rounded focus:border-accent-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-micro text-muted uppercase">
                    EV
                    <input
                      type="number"
                      min={0}
                      max={EV_MAX}
                      value={piece.ev}
                      onChange={(e) => update(piece.id, { ev: wholeNumber(e.target.value, EV_MAX) })}
                      aria-label={`EV de ${label}`}
                      className="w-12 bg-surface border border-field font-mono text-xs text-fg-strong px-1.5 py-1 rounded focus:border-accent-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-micro text-muted uppercase cursor-pointer">
                    <input
                      type="checkbox"
                      checked={piece.equipped}
                      onChange={(e) => update(piece.id, { equipped: e.target.checked })}
                      aria-label={`${label} vestida`}
                    />
                    Vestida
                  </label>
                  <button
                    type="button"
                    onClick={() => removePiece(piece.id)}
                    aria-label={`Remover ${label}`}
                    className="p-1.5 rounded bg-raised hover:bg-fault-950 border border-line hover:border-fault-500 text-subtle hover:text-fault-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Locais que ${label} cobre`}>
                  <span className="text-micro text-muted uppercase mr-1">Cobre:</span>
                  {LOCATIONS.map(({ loc, label: locLabel, short }) => {
                    const on = covered.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        aria-pressed={on}
                        title={locLabel}
                        onClick={() => toggleLocation(piece, loc)}
                        className={`px-2 py-0.5 rounded border text-micro uppercase transition-all cursor-pointer ${
                          on ? 'border-accent-500 text-accent-300 bg-accent-950/60' : 'border-line-strong text-subtle hover:text-fg-soft'
                        }`}
                      >
                        {short}
                      </button>
                    );
                  })}
                  {/* Na impressão os botões saem (K.1c): a cobertura vai por extenso. */}
                  <span className="hidden print:inline text-micro">
                    {LOCATIONS.filter((l) => covered.includes(l.loc)).map((l) => l.label).join(', ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addPiece}
          className="w-full py-2 bg-surface hover:bg-accent-950/60 border border-dashed border-accent-700/60 text-accent-400 hover:text-accent-300 font-bold text-mini uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar peça
        </button>
      </div>
    </div>
  );
};
