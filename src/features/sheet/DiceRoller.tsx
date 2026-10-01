import React, { useState } from 'react';
import { RollResult, StatName } from '../../types/cyberpunk';
// Motor de dados FNFF — casca do cliente sobre src/rules/ (Fase C, C.1)
import {
  rollSkill as engineRollSkill,
  rollDamage as engineRollDamage,
  rollSheetDeathSave,
  rollSheetStunSave
} from '../../utils/diceEngine';
import { Dice5, History, Trash2, Target, HeartPulse, Zap } from 'lucide-react';
import { useSheetStore } from '../../stores/useSheetStore';
import { useRollStore } from '../../stores/useRollStore';
import { deathSaveTarget, deriveCurrentStats, mortalLevel, stunSaveTarget, woundRow } from '../../rules/character';

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
    const statVal = deriveCurrentStats(sheet)[skillStat];
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

  // C.7 — os dois saves do livro; o alvo depende do ferimento da ficha.
  const body = deriveCurrentStats(sheet).BODY;
  const mortal = mortalLevel(sheet.woundLevel);

  const rollDeathSave = () => onAddRoll(rollSheetDeathSave(sheet));
  const rollStunSave = () => onAddRoll(rollSheetStunSave(sheet));

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Tabs */}
      <div className="flex items-center space-x-1.5 text-xs">
        {([
          { id: 'skill' as DiceTab, label: '🎯 Perícia', icon: Target },
          { id: 'damage' as DiceTab, label: '💥 Dano', icon: Zap },
          { id: 'save' as DiceTab, label: '🩸 Saves', icon: HeartPulse }
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-lg border-2 transition-all flex items-center space-x-1.5 uppercase font-black tracking-caps cursor-pointer ${
              tab === id
                ? 'bg-roll-600 text-white border-roll-400 shadow-glow-12 shadow-roll-500/50'
                : 'bg-surface text-muted border-line hover:border-roll-500/50 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="bg-raised/80 border-l-4 border-y border-r border-line rounded-xl p-6 shadow-glow-25 shadow-roll-500/12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[60px] font-black text-roll-500 select-none">
          FNFF
        </div>

        {tab === 'skill' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-line pb-3">
              <Dice5 className="w-5 h-5 text-roll-400" />
              <h2 className="font-display text-base sm:text-lg font-bold text-roll-400 uppercase tracking-display">Rolagem de Perícia</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-micro text-muted block mb-1 uppercase">Perícia:</label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="font-mono w-full bg-surface border border-line-strong text-xs text-fg-strong px-2.5 py-2 rounded focus:border-roll-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-micro text-muted block mb-1 uppercase">Atributo:</label>
                <select
                  value={skillStat}
                  onChange={(e) => setSkillStat(e.target.value as StatName)}
                  className="font-mono w-full bg-surface border border-line-strong text-xs text-accent-300 px-2.5 py-2 rounded focus:border-roll-400 focus:outline-none"
                >
                  {STATS.map((s) => (
                    <option key={s} value={s}>{s} ({sheet.stats[s] || 0})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-micro text-muted block mb-1 uppercase">Nível da Perícia:</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={skillRank}
                  onChange={(e) => setSkillRank(parseInt(e.target.value) || 0)}
                  className="font-mono w-full bg-surface border border-line-strong text-xs text-signal-400 px-2.5 py-2 rounded focus:border-roll-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={rollSkill}
              className="w-full py-3 bg-roll-600 hover:bg-roll-700 text-white font-black text-xs uppercase rounded shadow-glow-15 shadow-roll-500/40 transition-all cursor-pointer"
            >
              🎲 Rolar 1d10 + {skillStat} + Perícia
            </button>
          </div>
        )}

        {tab === 'damage' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-line pb-3">
              <Zap className="w-5 h-5 text-signal-400" />
              <h2 className="font-display text-base sm:text-lg font-bold text-signal-400 uppercase tracking-display">Rolagem de Dano</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-micro text-muted block mb-1 uppercase">Arma:</label>
                <input
                  type="text"
                  value={weaponName}
                  onChange={(e) => setWeaponName(e.target.value)}
                  className="font-mono w-full bg-surface border border-line-strong text-xs text-fg-strong px-2.5 py-2 rounded focus:border-signal-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-micro text-muted block mb-1 uppercase">Fórmula (ex.: 2d6+2):</label>
                <input
                  type="text"
                  value={damageFormula}
                  onChange={(e) => setDamageFormula(e.target.value)}
                  className="font-mono w-full bg-surface border border-line-strong text-xs text-signal-400 px-2.5 py-2 rounded focus:border-signal-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={rollDamage}
              className="w-full py-3 bg-signal-500 hover:bg-signal-400 text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-signal-400/40 transition-all cursor-pointer"
            >
              💥 Rolar {damageFormula} + Local de Impacto
            </button>
          </div>
        )}

        {tab === 'save' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center space-x-2 border-b border-line pb-3">
              <HeartPulse className="w-5 h-5 text-danger-400" />
              <h2 className="font-display text-base sm:text-lg font-bold text-danger-400 uppercase tracking-display">Stun &amp; Death Save</h2>
            </div>
            <p className="text-xs text-muted">
              Role 1d10: passa com resultado menor ou igual ao alvo. O alvo é o seu
              <strong className="text-signal-400"> BODY ({body})</strong> menos o que o ferimento atual
              (<strong className="text-signal-400">{woundRow(sheet.woundLevel).name}</strong>) tira.
              Stun a cada dano sofrido; death save a cada turno em ferimento Mortal.
            </p>
            <button
              onClick={rollStunSave}
              className="w-full py-3 bg-caution-500 hover:bg-caution-400 text-black font-black text-xs uppercase rounded transition-all cursor-pointer"
            >
              💫 Stun · 1d10 ≤ {stunSaveTarget(body, sheet.woundLevel)}
            </button>
            <button
              onClick={rollDeathSave}
              disabled={mortal === null}
              title={mortal === null ? 'O death save só é exigido em ferimento Mortal' : undefined}
              className="w-full py-3 bg-danger-600 hover:bg-danger-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase rounded shadow-glow-15 shadow-danger-500/40 transition-all cursor-pointer"
            >
              🩸 Death · 1d10 ≤ {deathSaveTarget(body, sheet.woundLevel)}
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-surface/80 border border-line rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-line">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-accent-400" />
            <span className="text-xs font-black text-accent-400 uppercase tracking-caps">Histórico ({rollHistory.length})</span>
          </div>
          <button
            onClick={onClearHistory}
            className="px-2 py-1 text-micro text-fault-400 hover:text-fault-300 flex items-center space-x-1 uppercase cursor-pointer transition-all"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar</span>
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {rollHistory.length === 0 ? (
            <div className="text-center py-8 text-mini text-subtle">
              Nenhuma rolagem registrada ainda.
            </div>
          ) : (
            rollHistory.map((roll) => (
              <div key={roll.id} className="flex items-start justify-between px-3 py-2 border-b border-line-soft hover:bg-raised/40 transition-colors">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-micro px-1.5 py-0.5 rounded bg-raised border border-line-strong text-accent-300 uppercase">
                      {roll.rollType}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{roll.label}</span>
                  </div>
                  <p className="font-mono text-micro text-muted truncate">{roll.details}</p>
                  <span className="font-mono text-micro text-faint">{roll.timestamp}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`font-mono text-xl ${roll.isCriticalSuccess ? 'text-ok-400' : roll.isCriticalFailure ? 'text-fault-500' : 'text-signal-400'}`}>
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
