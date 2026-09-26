import React from 'react';
import { CharacterSheet } from '../../../types/cyberpunk';
import { WOUND_LEVEL_NAMES, clampWoundLevel, isLastWoundBox } from '../../../utils/injuryRules';
import { deathSaveTarget, deriveCurrentStats, mortalLevel, stunSaveTarget, woundEffectText } from '../../../rules/character';
import { HeartPulse, Skull, Activity, Zap } from 'lucide-react';

interface HealthTrackerProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollDeathSave: () => void;
  onRollStunSave: () => void;
}

export const HealthTracker: React.FC<HealthTrackerProps> = ({ sheet, onChange, onRollDeathSave, onRollStunSave }) => {
  const woundLevel = clampWoundLevel(sheet.woundLevel);
  const current = WOUND_LEVEL_NAMES[woundLevel] || WOUND_LEVEL_NAMES[0];
  const lastBox = isLastWoundBox(woundLevel);
  // C.7 — os alvos dos dois saves do livro, com o BODY corrente.
  const body = deriveCurrentStats(sheet).BODY;
  const mortal = mortalLevel(woundLevel);
  const stunTarget = stunSaveTarget(body, woundLevel);
  const deathTarget = deathSaveTarget(body, woundLevel);

  const setWound = (level: number) => {
    onChange({ woundLevel: clampWoundLevel(level) });
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
        <span className={`text-xs font-mono font-black px-2.5 py-1 rounded border ${lastBox ? 'bg-red-950 border-red-500 text-red-300 animate-pulse' : 'bg-slate-950 border-slate-700 text-slate-200'}`}>
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
            <span className="text-[10px] font-mono text-slate-400 uppercase">Efeito nos atributos</span>
          </div>
          <span className="font-mono font-black text-sm text-red-300">
            {woundEffectText(woundLevel)}
          </span>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-lg border border-red-500/40 flex flex-col justify-between">
          <div className="flex items-center space-x-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Saves</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onRollStunSave}
              title="A cada dano sofrido: falhou, está fora de ação"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase rounded transition-all font-mono cursor-pointer"
            >
              Stun · 1d10 ≤ {stunTarget}
            </button>
            <button
              onClick={onRollDeathSave}
              disabled={mortal === null}
              title={mortal === null ? 'O death save só é exigido em ferimento Mortal' : `Mortal ${mortal}: a cada turno, até ser estabilizado`}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-[11px] uppercase rounded transition-all font-mono shadow-[0_0_12px_rgba(250,204,21,0.4)] cursor-pointer"
            >
              Death · 1d10 ≤ {deathTarget}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
