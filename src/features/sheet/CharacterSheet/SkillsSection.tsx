import React, { useState } from 'react';
import { CharacterSheet, SkillItem, StatName } from '../../../types/cyberpunk';
import { SKILL_TABLES } from '../../../data/cyberpunkData';
import { Swords, Plus, Trash2, Dice5, Star } from 'lucide-react';

interface SkillsSectionProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollSkill: (skillName: string, statName: StatName, statVal: number, skillRank: number) => void;
}

const STAT_OPTIONS: StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

export const SkillsSection: React.FC<SkillsSectionProps> = ({ sheet, onChange, onRollSkill }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillStat, setSkillStat] = useState<StatName>('REF');
  const [skillLevel, setSkillLevel] = useState(3);
  const [suggestions, setSuggestions] = useState<string[]>(SKILL_TABLES.REF.slice(0, 8));

  const skills = sheet.skills || [];

  const changeStatForSuggestions = (stat: StatName) => {
    setSkillStat(stat);
    setSuggestions(SKILL_TABLES[stat]?.slice(0, 8) || []);
  };

  const addSkill = () => {
    if (!skillName.trim()) return;
    const item: SkillItem = {
      id: 'sk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: skillName.trim(),
      stat: skillStat,
      level: Math.max(0, Math.min(10, skillLevel))
    };
    onChange({ skills: [...skills, item] });
    setSkillName('');
    setShowAdd(false);
  };

  const removeSkill = (id: string) => {
    onChange({ skills: skills.filter((s) => s.id !== id) });
  };

  const changeLevel = (id: string, delta: number) => {
    onChange({
      skills: skills.map((s) => (s.id === id ? { ...s, level: Math.max(0, Math.min(10, s.level + delta)) } : s))
    });
  };

  const rollSkill = (skill: SkillItem) => {
    onRollSkill(skill.name, skill.stat, sheet.stats[skill.stat] || 0, skill.level);
  };

  return (
    <div className="bg-slate-900/70 border-l-4 border-yellow-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(234,179,8,0.1)] space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-yellow-500 select-none">
        SKILLS
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Swords className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-mono font-bold text-yellow-400 uppercase tracking-widest">
            Árvore de Perícias ({skills.length})
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Atributo + Nível de Perícia
        </span>
      </div>

      {/* Habilidade Especial */}
      {sheet.specialAbilityName && (
        <div className="bg-gradient-to-r from-yellow-950/60 to-slate-950 border border-yellow-500/50 rounded-lg p-3 flex items-center justify-between relative z-10 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
          <div className="flex items-center space-x-2.5">
            <Star className="w-4 h-4 text-yellow-400" />
            <div>
              <span className="text-[9px] text-yellow-400/80 uppercase font-mono block">Habilidade Especial</span>
              <span className="text-sm font-mono font-black text-yellow-300 uppercase">{sheet.specialAbilityName}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-black text-yellow-400 bg-slate-950 border border-yellow-600/60 px-2.5 py-1 rounded">
              +{sheet.specialAbilityRank}
            </span>
            <button
              onClick={() => onRollSkill(sheet.specialAbilityName, sheet.role === 'Netrunner' ? 'INT' : sheet.role === 'Solo' ? 'REF' : 'EMP', sheet.stats[sheet.role === 'Netrunner' ? 'INT' : sheet.role === 'Solo' ? 'REF' : 'EMP'], sheet.specialAbilityRank)}
              className="px-2 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold text-[10px] uppercase flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Dice5 className="w-3 h-3" />
              <span>Rolar</span>
            </button>
          </div>
        </div>
      )}

      {/* Lista de perícias */}
      <div className="space-y-1.5 relative z-10">
        {skills.length === 0 ? (
          <div className="text-center py-6 text-xs font-mono text-slate-500 bg-slate-950/60 rounded border border-dashed border-slate-700">
            Nenhuma perícia adicionada. Use "Adicionar Perícia" para montar sua árvore.
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-slate-950/80 p-2.5 rounded-lg border-l-2 border-l-yellow-500 border-y border-r border-slate-800 flex items-center justify-between gap-2 hover:border-yellow-500/40 transition-all"
            >
              <div className="min-w-0 flex items-center space-x-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold shrink-0">
                  {skill.stat}
                </span>
                <span className="text-sm font-mono font-bold text-white truncate">{skill.name}</span>
                {skill.isSpecialAbility && <Star className="w-3 h-3 text-yellow-400 shrink-0" />}
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded px-1 py-0.5">
                  <button
                    onClick={() => changeLevel(skill.id, -1)}
                    className="w-5 h-5 rounded bg-slate-950 text-slate-400 hover:text-red-400 font-mono cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-xs font-mono font-black text-yellow-400">{skill.level}</span>
                  <button
                    onClick={() => changeLevel(skill.id, 1)}
                    className="w-5 h-5 rounded bg-slate-950 text-slate-400 hover:text-cyan-400 font-mono cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => rollSkill(skill)}
                  title="Rolar perícia"
                  className="px-2 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold text-[10px] uppercase flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Dice5 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeSkill(skill.id)}
                  className="p-1.5 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form de adição */}
      {showAdd ? (
        <div className="bg-slate-950/90 border border-yellow-500/40 rounded-lg p-3 space-y-2.5 relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black text-yellow-400 uppercase tracking-widest">
              Nova Perícia
            </span>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="Ex: Handgun, Stealth, Brawling..."
              className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 px-2.5 py-1.5 rounded focus:border-yellow-400 focus:outline-none"
              list="skill-suggestions"
            />
            <datalist id="skill-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <select
              value={skillStat}
              onChange={(e) => changeStatForSuggestions(e.target.value as StatName)}
              className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 px-2.5 py-1.5 rounded focus:border-yellow-400 focus:outline-none"
            >
              {STAT_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-[10px] text-slate-400 shrink-0">Nível:</label>
              <input
                type="number"
                min={0}
                max={10}
                value={skillLevel}
                onChange={(e) => setSkillLevel(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-yellow-400 px-2.5 py-1.5 rounded focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setSkillName(s)}
                className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-yellow-500/50 text-slate-400 px-1.5 py-0.5 rounded font-mono cursor-pointer transition-all"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={addSkill}
              disabled={!skillName.trim()}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-black text-[10px] uppercase rounded transition-all cursor-pointer font-mono"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 bg-slate-950 hover:bg-yellow-950/60 border border-dashed border-yellow-700/60 text-yellow-400 hover:text-yellow-300 font-mono font-bold text-[11px] uppercase rounded transition-all cursor-pointer relative z-10"
        >
          + Adicionar Perícia
        </button>
      )}
    </div>
  );
};
