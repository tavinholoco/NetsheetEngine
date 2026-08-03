import React from 'react';
import { CharacterSheet, StatName } from '../../types/cyberpunk';
import { Heart, Shield, Brain, Wind, Flame } from 'lucide-react';

interface StatBlockProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

const STAT_ORDER: StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

const STAT_LABELS: Record<StatName, { label: string; color: string; icon: React.ReactNode }> = {
  INT: { label: 'Inteligência', color: 'text-cyan-400', icon: <Brain className="w-3.5 h-3.5" /> },
  REF: { label: 'Reflexos', color: 'text-yellow-400', icon: <Wind className="w-3.5 h-3.5" /> },
  TECH: { label: 'Técnica', color: 'text-purple-400', icon: <Shield className="w-3.5 h-3.5" /> },
  COOL: { label: 'Frieza', color: 'text-emerald-400', icon: <Flame className="w-3.5 h-3.5" /> },
  ATTR: { label: 'Atração', color: 'text-pink-400', icon: <Heart className="w-3.5 h-3.5" /> },
  LUCK: { label: 'Sorte', color: 'text-amber-400', icon: <Shield className="w-3.5 h-3.5" /> },
  MA: { label: 'Movimento', color: 'text-orange-400', icon: <Wind className="w-3.5 h-3.5" /> },
  BODY: { label: 'Corpo', color: 'text-red-400', icon: <Shield className="w-3.5 h-3.5" /> },
  EMP: { label: 'Empatia', color: 'text-teal-400', icon: <Heart className="w-3.5 h-3.5" /> }
};

export const StatBlock: React.FC<StatBlockProps> = ({ sheet, onChange }) => {
  const stats = sheet.stats;

  const handleChange = (stat: StatName, delta: number) => {
    const next = Math.min(15, Math.max(2, (stats[stat] || 0) + delta));
    onChange({
      stats: { ...stats, [stat]: next },
      currentStats: { ...sheet.currentStats, [stat]: Math.min(sheet.currentStats[stat] ?? next, next) }
    });
  };

  const handleSet = (stat: StatName, raw: number) => {
    const next = Math.min(15, Math.max(2, raw || 0));
    onChange({ stats: { ...stats, [stat]: next } });
  };

  // BTM (Body Type Modifier): tabela CP2020 baseada em BODY + REF
  const btmTable: Record<string, number> = {
    '2-4': -1,
    '5-6': 0,
    '7-8': 1,
    '9-10': 2,
    '11-12': 3,
    '13-14': 4,
    '15': 5
  };
  const bodyRef = stats.BODY + stats.REF;
  const btm =
    bodyRef >= 26 ? 5 : bodyRef >= 24 ? 4 : bodyRef >= 22 ? 3 : bodyRef >= 20 ? 2 : bodyRef >= 18 ? 1 : bodyRef >= 16 ? 0 : bodyRef >= 14 ? -1 : -2;

  const humanity = stats.EMP * 10;
  const runMove = stats.MA * 3;

  return (
    <div className="bg-slate-900/70 border-l-4 border-cyan-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(6,182,212,0.1)] space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-cyan-400 select-none">
        STATS
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest">
            Atributos Primários & Derivados
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          BTM: {btm >= 0 ? `+${btm}` : btm} • Run: {runMove}m
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 relative z-10">
        {STAT_ORDER.map((stat) => {
          const meta = STAT_LABELS[stat];
          const val = stats[stat] || 0;
          return (
            <div
              key={stat}
              className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 hover:border-cyan-500/50 transition-all group"
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <span className={meta.color}>{meta.icon}</span>
                <span className={`text-[10px] font-mono font-black uppercase tracking-wider ${meta.color}`}>
                  {stat} — {meta.label}
                </span>
              </div>
              <div className="flex items-center justify-between space-x-1">
                <button
                  onClick={() => handleChange(stat, -1)}
                  className="w-7 h-7 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:bg-red-950 hover:text-red-400 hover:border-red-500 font-mono font-bold transition-all cursor-pointer"
                >
                  −
                </button>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleSet(stat, parseInt(e.target.value))}
                  className="w-12 bg-slate-900 border border-cyan-800/70 text-center text-xl font-mono font-black text-yellow-400 rounded py-1 focus:border-cyan-400 focus:outline-none"
                />
                <button
                  onClick={() => handleChange(stat, 1)}
                  className="w-7 h-7 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:bg-cyan-950 hover:text-cyan-400 hover:border-cyan-500 font-mono font-bold transition-all cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="mt-1.5 flex justify-center">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 mx-px rounded-sm ${
                      i < val ? (val >= 8 ? 'bg-yellow-400' : 'bg-cyan-400') : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Card de estatísticas derivadas */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-slate-950/90 p-3 rounded-lg border-2 border-cyan-500/40 space-y-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <span className="text-[10px] font-mono font-black text-cyan-400 uppercase tracking-widest block border-b border-slate-800 pb-1">
            Estatísticas Derivadas
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">BTM</span>
              <span className="text-yellow-400 font-black text-lg">{btm >= 0 ? `+${btm}` : btm}</span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">Humanidade</span>
              <span className="text-purple-400 font-black text-lg">{humanity}</span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">Run (m/turno)</span>
              <span className="text-emerald-400 font-black text-lg">{runMove}</span>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">Walk (m/turno)</span>
              <span className="text-cyan-400 font-black text-lg">{Math.floor(runMove / 2)}</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed">
            BTM = (BODY + REF) ajustado pela tabela CP2020. Humanidade = EMP × 10. Reputação derivada de COOL + LUCK.
          </p>
        </div>
      </div>
    </div>
  );
};
