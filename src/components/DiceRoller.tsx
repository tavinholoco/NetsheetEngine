import React, { useState } from 'react';
import { RollResult, StatName } from '../types/cyberpunk';
// Fase 6 (T6.3) — motor de dados FNFF (audit trail via @dice-roller)
import {
  rollSkill as engineRollSkill,
  rollDamage as engineRollDamage,
  rollDeathSave as engineRollDeathSave
} from '../utils/diceEngine';
import { Dice5, History, Trash2, Target, HeartPulse, Zap } from 'lucide-react';
import { useSheetStore } from '../stores/useSheetStore';
import { useRollStore } from '../stores/useRollStore';

interface DiceRollerProps {
  onAddRoll: (roll: RollResult) => void;
  onClearHistory: () => void;
}

type DiceTab = 'skill' | 'damage' | 'save';

const STATS: StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

export const DiceRoller: React.FC<DiceRollerProps> = ({ onAddRoll, onClearHistory }) => {
  // Fase 4 (T4.2) — sheet e rollHistory via stores (sem prop drilling)
  const sheet = useSheetStore((s) => s.sheet);
  const rollHistory = useRollStore((s) => s.rollHistory);

  const [tab, setTab] = useState<DiceTab>('skill');
  const [skillName, setSkillName] = useState('Handgun');
  const [skillStat, setSkillStat] = useState<StatName>('REF');
  const [skillRank, setSkillRank] = useState(3);
  const [damageFormula, setDamageFormula] = useState('2d6+2');
  const [weaponName, setWeaponName] = useState('Militech Arms 9mm');

  const rollSkill = () => {
    const statVal = sheet.stats[skillStat] || 0;
    onAddRoll(engineRollSkill(statVal, skillRank, {
      characterName: sheet.handle || 'Edgerunner',
      label: `Rolagem: ${skillName}`,
      statName: skillStat
    }));
  };

  const rollDamage = () => {
    try {
      onAddRoll(engineRollDamage(damageFormula, {
        characterName: sheet.handle || 'Edgerunner',
        label: `Dano da Arma: ${weaponName}`
      }));
    } catch {
      /* fórmula de dano inválida — nada a rolar */
    }
  };

  const rollDeathSave = () => {
    onAddRoll(engineRollDeathSave(sheet.stats.BODY, {
      characterName: sheet.handle || 'Edgerunner'
    }));
  };

  return (
    <div className="space-y-5 font-mono animate-fadeIn">
      {/* Tabs */}
      <div className="flex items-center space-x-1.5 text-xs font-mono">
        {([
          { id: 'skill' as DiceTab, label: '🎯 Perícia', icon: Target },
          { id: 'damage' as DiceTab, label: '💥 Dano', icon: Zap },
          { id: 'save' as DiceTab, label: '🩸 Death Save', icon: HeartPulse }
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-lg border-2 transition-all flex items-center space-x-1.5 uppercase font-black tracking-wider cursor-pointer ${
              tab === id
                ? 'bg-pink-600 text-white border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-pink-500/50 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="bg-slate-900/80 border-l-4 border-pink-500 border-y border-r border-slate-800 rounded-xl p-6 shadow-[0_0_25px_rgba(236,72,153,0.12)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[60px] font-black text-pink-500 select-none">
          FNFF
        </div>

        {tab === 'skill' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Dice5 className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-bold text-pink-400 uppercase tracking-widest">Rolagem de Perícia</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase">Perícia:</label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 px-2.5 py-2 rounded focus:border-pink-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase">Atributo:</label>
                <select
                  value={skillStat}
                  onChange={(e) => setSkillStat(e.target.value as StatName)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 px-2.5 py-2 rounded focus:border-pink-400 focus:outline-none"
                >
                  {STATS.map((s) => (
                    <option key={s} value={s}>{s} ({sheet.stats[s] || 0})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase">Nível da Perícia:</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={skillRank}
                  onChange={(e) => setSkillRank(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-yellow-400 px-2.5 py-2 rounded focus:border-pink-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={rollSkill}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all cursor-pointer"
            >
              🎲 Rolar 1d10 + {skillStat} + Perícia
            </button>
          </div>
        )}

        {tab === 'damage' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-yellow-400 uppercase tracking-widest">Rolagem de Dano</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase">Arma:</label>
                <input
                  type="text"
                  value={weaponName}
                  onChange={(e) => setWeaponName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 px-2.5 py-2 rounded focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 uppercase">Fórmula (ex.: 2d6+2):</label>
                <input
                  type="text"
                  value={damageFormula}
                  onChange={(e) => setDamageFormula(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-yellow-400 px-2.5 py-2 rounded focus:border-yellow-400 focus:outline-none font-bold"
                />
              </div>
            </div>
            <button
              onClick={rollDamage}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(250,204,21,0.4)] transition-all cursor-pointer"
            >
              💥 Rolar {damageFormula} + Local de Impacto
            </button>
          </div>
        )}

        {tab === 'save' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <HeartPulse className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-bold text-red-400 uppercase tracking-widest">Death Save</h2>
            </div>
            <p className="text-xs text-slate-400">
              Teste de resistência à morte: role 1d10. Sucesso se o resultado for menor ou igual ao seu atributo
              <strong className="text-yellow-400"> BODY ({sheet.stats.BODY})</strong>. Falhar significa inconsciência ou morte.
            </p>
            <button
              onClick={rollDeathSave}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer"
            >
              🩸 1d10 ≤ BODY ({sheet.stats.BODY})
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Histórico ({rollHistory.length})</span>
          </div>
          <button
            onClick={onClearHistory}
            className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 flex items-center space-x-1 uppercase cursor-pointer transition-all"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar</span>
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {rollHistory.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-slate-500 font-mono">
              Nenhuma rolagem registrada ainda.
            </div>
          ) : (
            rollHistory.map((roll) => (
              <div key={roll.id} className="flex items-start justify-between px-3 py-2 border-b border-slate-900 hover:bg-slate-900/40 transition-colors">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 uppercase font-bold">
                      {roll.rollType}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{roll.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{roll.details}</p>
                  <span className="text-[9px] text-slate-600">{roll.timestamp}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xl font-black ${roll.isCriticalSuccess ? 'text-emerald-400' : roll.isCriticalFailure ? 'text-red-500' : 'text-yellow-400'}`}>
                    {roll.total}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
