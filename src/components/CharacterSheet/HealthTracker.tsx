import React from 'react';
import { CharacterSheet } from '../../types/cyberpunk';
import { HeartPulse, Skull, Activity, Zap } from 'lucide-react';

interface HealthTrackerProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollDeathSave: () => void;
}

/**
 * Nomes dos níveis de ferimento (índice = woundLevel 0..10).
 * Exportado porque o TacticalGrid.tsx também consome este símbolo.
 */
export const WOUND_LEVEL_NAMES: { name: string; color: string }[] = [
  { name: 'Saudável (OK)', color: 'text-emerald-400' },
  { name: 'Ferimento Leve (Light)', color: 'text-yellow-400' },
  { name: 'Ferimento Sério (Serious)', color: 'text-orange-400' },
  { name: 'Ferimento Crítico (Critical)', color: 'text-red-400' },
  { name: 'Mortal 0', color: 'text-red-500' },
  { name: 'Mortal 1', color: 'text-red-500' },
  { name: 'Mortal 2', color: 'text-red-600' },
  { name: 'Mortal 3', color: 'text-red-600' },
  { name: 'Mortal 4', color: 'text-rose-600' },
  { name: 'Mortal 5', color: 'text-rose-700' },
  { name: 'Mortal 6 (Morte Iminente)', color: 'text-rose-700' }
];

export const HealthTracker: React.FC<HealthTrackerProps> = ({ sheet, onChange, onRollDeathSave }) => {
  const woundLevel = sheet.woundLevel;
  const current = WOUND_LEVEL_NAMES[woundLevel] || WOUND_LEVEL_NAMES[0];
  const isDead = woundLevel >= 10;

  const setWound = (level: number) => {
    onChange({ woundLevel: Math.max(0, Math.min(10, level)) });
  };

  const woundRefPenalties: Record<number, string> = {
    0: '—',
    1: '—',
    2: 'REF −2, MA −2',
    3: 'REF −2, MA −2',
    4: 'REF −4, MA −4, consciência 50%',
    5: 'REF −4, MA −4',
    6: 'REF −5, MA −5',
    7: 'REF −5, MA −5',
    8: 'REF −6, MA −6, morte provável',
    9: 'REF −6, MA −6',
    10: 'Morte iminente'
  };

  return (
    <div className="bg-slate-900/70 border-l-4 border-red-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(239,68,68,0.1)] space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-red-500 select-none">
        BIOMON
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <HeartPulse className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-mono font-bold text-red-400 uppercase tracking-widest">
            Bio-Monitor // Ferimentos
          </h2>
        </div>
        <span className={`text-xs font-mono font-black px-2.5 py-1 rounded border ${isDead ? 'bg-red-950 border-red-500 text-red-300 animate-pulse' : 'bg-slate-950 border-slate-700 text-slate-200'}`}>
          {current.name}
        </span>
      </div>

      {/* Grade de caixas de ferimento (0–10) */}
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 relative z-10">
        {WOUND_LEVEL_NAMES.map((_, idx) => {
          const isActive = idx === woundLevel;
          const isFilled = idx <= woundLevel;
          return (
            <button
              key={idx}
              onClick={() => setWound(idx)}
              title={`Nível ${idx}: ${WOUND_LEVEL_NAMES[idx].name}`}
              className={`aspect-square rounded border-2 font-mono font-black text-[10px] transition-all cursor-pointer ${
                isActive
                  ? 'border-yellow-400 bg-yellow-400 text-black shadow-[0_0_12px_rgba(250,204,21,0.6)] scale-110'
                  : isFilled
                  ? `border-red-500 bg-red-950/80 text-red-300 hover:bg-red-900`
                  : 'border-slate-800 bg-slate-950/80 text-slate-600 hover:border-slate-600'
              }`}
            >
              {idx}
            </button>
          );
        })}
      </div>

      {/* Resumo e penalidades */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Estado</span>
          </div>
          <span className={`font-mono font-black text-sm ${current.color}`}>{current.name}</span>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-1.5 mb-1">
            <Skull className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Penalidades (REF/MA)</span>
          </div>
          <span className="font-mono font-black text-sm text-red-300">
            {woundRefPenalties[woundLevel] || '—'}
          </span>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-lg border border-red-500/40 flex flex-col justify-between">
          <div className="flex items-center space-x-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Teste de Morte</span>
          </div>
          <button
            onClick={onRollDeathSave}
            disabled={isDead}
            className="px-3 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-[11px] uppercase rounded transition-all font-mono shadow-[0_0_12px_rgba(250,204,21,0.4)] cursor-pointer"
          >
            1d10 ≤ BODY
          </button>
        </div>
      </div>
    </div>
  );
};
