import React from 'react';
import { CharacterSheet, StatName } from '../../../types/cyberpunk';
import { humanityFromEmp, runFromMa, walkFromMa } from '../../../utils/derivedStats';
import { bodyTypeFor, deriveCurrentStats } from '../../../rules/character';
import { Heart, Shield, Brain, Wind, Flame } from 'lucide-react';

interface StatBlockProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

const STAT_ORDER: StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

const STAT_LABELS: Record<StatName, { label: string; color: string; icon: React.ReactNode }> = {
  INT: { label: 'Inteligência', color: 'text-accent-400', icon: <Brain className="w-3.5 h-3.5" /> },
  REF: { label: 'Reflexos', color: 'text-signal-400', icon: <Wind className="w-3.5 h-3.5" /> },
  TECH: { label: 'Técnica', color: 'text-cyber-400', icon: <Shield className="w-3.5 h-3.5" /> },
  COOL: { label: 'Frieza', color: 'text-ok-400', icon: <Flame className="w-3.5 h-3.5" /> },
  ATTR: { label: 'Atração', color: 'text-roll-400', icon: <Heart className="w-3.5 h-3.5" /> },
  LUCK: { label: 'Sorte', color: 'text-caution-400', icon: <Shield className="w-3.5 h-3.5" /> },
  MA: { label: 'Movimento', color: 'text-caution-600', icon: <Wind className="w-3.5 h-3.5" /> },
  BODY: { label: 'Corpo', color: 'text-fg-strong', icon: <Shield className="w-3.5 h-3.5" /> },
  EMP: { label: 'Empatia', color: 'text-cyber-300', icon: <Heart className="w-3.5 h-3.5" /> }
};

export const StatBlock: React.FC<StatBlockProps> = ({ sheet, onChange }) => {
  const stats = sheet.stats;

  const handleChange = (stat: StatName, delta: number) => {
    const next = Math.min(15, Math.max(2, (stats[stat] || 0) + delta));
    onChange({ stats: { ...stats, [stat]: next } });
  };

  const handleSet = (stat: StatName, raw: number) => {
    const next = Math.min(15, Math.max(2, raw || 0));
    onChange({ stats: { ...stats, [stat]: next } });
  };

  // BTM (Body Type Modifier): só BODY, de 0 a −5 (src/rules/character.ts — Fase C, C.2)
  const bodyType = bodyTypeFor(stats.BODY);
  const btm = bodyType.btm;

  // C.6 — o valor com que o personagem ROLA agora (humanidade e ferimento).
  const current = deriveCurrentStats(sheet);

  const humanity = humanityFromEmp(stats.EMP);
  const runMove = runFromMa(stats.MA);

  return (
    <div className="bg-raised/70 border-l-4 border-y border-r border-line rounded-lg p-5 shadow-glow-20 shadow-accent-500/10 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-accent-400 select-none">
        STATS
      </div>

      <div className="flex items-center justify-between border-b border-line pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-accent-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-accent-400 uppercase tracking-display">
            Atributos Primários & Derivados
          </h2>
        </div>
        <span className="text-micro font-mono text-subtle uppercase tracking-caps">
          BTM: {btm} • Run: {runMove}m
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 relative z-10">
        {STAT_ORDER.map((stat) => {
          const meta = STAT_LABELS[stat];
          const val = stats[stat] || 0;
          return (
            <div
              key={stat}
              className="bg-surface/80 p-3 rounded-lg border border-line hover:border-accent-500/50 transition-all group"
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <span className={meta.color}>{meta.icon}</span>
                <span className={`text-micro font-black uppercase tracking-caps ${meta.color}`}>
                  {stat} — {meta.label}
                </span>
              </div>
              <div className="flex items-center justify-between space-x-1">
                <button
                  onClick={() => handleChange(stat, -1)}
                  className="w-7 h-7 rounded bg-raised border border-line-strong text-fg-soft hover:bg-accent-950 hover:text-accent-400 hover:border-accent-500 font-bold transition-all cursor-pointer"
                >
                  −
                </button>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleSet(stat, parseInt(e.target.value))}
                  className="w-12 bg-raised border border-accent-800/70 text-center text-xl font-mono text-signal-400 rounded py-1 focus:border-accent-400 focus:outline-none"
                />
                <button
                  onClick={() => handleChange(stat, 1)}
                  className="w-7 h-7 rounded bg-raised border border-line-strong text-fg-soft hover:bg-accent-950 hover:text-accent-400 hover:border-accent-500 font-bold transition-all cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="mt-1.5 flex justify-center">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 mx-px rounded-sm ${
                      i < val ? (val >= 8 ? 'bg-signal-400' : 'bg-accent-400') : 'bg-raised-strong'
                    }`}
                  />
                ))}
              </div>
              {current[stat] !== val && (
                <p
                  className="mt-1 text-center text-micro font-mono text-caution-300 uppercase tracking-caps"
                  title="Valor usado nas rolagens: humanidade perdida e ferimento já aplicados"
                >
                  rola com {current[stat]}
                </p>
              )}
            </div>
          );
        })}

        {/* Card de estatísticas derivadas */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-surface/90 p-3 rounded-lg border-2 border-accent-500/40 space-y-2 shadow-glow-15 shadow-accent-500/15">
          <span className="text-micro font-black text-accent-400 uppercase tracking-caps block border-b border-line pb-1">
            Estatísticas Derivadas
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-raised p-2 rounded border border-line">
              <span className="text-micro text-muted block uppercase">BTM</span>
              <span className="font-mono text-signal-400 text-lg">{btm}</span>
              <span className="text-micro text-subtle block">{bodyType.bodyType}</span>
            </div>
            <div className="bg-raised p-2 rounded border border-line">
              <span className="text-micro text-muted block uppercase">Humanidade</span>
              <span className="font-mono text-cyber-400 text-lg">{humanity}</span>
            </div>
            <div className="bg-raised p-2 rounded border border-line">
              <span className="text-micro text-muted block uppercase">Run (m/turno)</span>
              <span className="font-mono text-ok-400 text-lg">{runMove}</span>
            </div>
            <div className="bg-raised p-2 rounded border border-line">
              <span className="text-micro text-muted block uppercase">Walk (m/turno)</span>
              <span className="font-mono text-accent-400 text-lg">{walkFromMa(stats.MA)}</span>
            </div>
          </div>
          <p className="text-micro text-subtle leading-relaxed">
            BTM = tipo corporal pelo BODY (0 a −5), reduz o dano que passa da armadura. Humanidade = EMP × 10.
          </p>
        </div>
      </div>
    </div>
  );
};
