import React, { useState } from 'react';
import { CharacterSheet, SkillItem, StatName } from '../../../types/cyberpunk';
import { SKILL_TABLES } from '../../../data/cyberpunkData';
import { deriveCurrentStats } from '../../../rules/character';
import { specialAbilityRoll } from '../../../rules/roles';
import type { Modifier } from '../../../rules/dice';
import { Swords, Plus, Trash2, Dice5, Star } from 'lucide-react';

interface SkillsSectionProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollSkill: (skill: SkillItem) => void;
  onRollCheck: (label: string, modifiers: Modifier[]) => void;
}

const STAT_OPTIONS: StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];

export const SkillsSection: React.FC<SkillsSectionProps> = ({ sheet, onChange, onRollSkill, onRollCheck }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillStat, setSkillStat] = useState<StatName>('REF');
  const [skillLevel, setSkillLevel] = useState(3);
  const [suggestions, setSuggestions] = useState<string[]>(SKILL_TABLES.REF.slice(0, 8));

  const skills = sheet.skills || [];
  // C.6 — rola com o atributo CORRENTE (humanidade e ferimento aplicados).
  const current = deriveCurrentStats(sheet);
  // C.8 — o atributo da habilidade vem de OFFICIAL_ROLES, não de um ternário.
  const special = specialAbilityRoll(sheet, current);

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

  return (
    <div className="bg-raised/70 border-l-4 border-l-signal-500 border-y border-r border-line rounded-lg p-5 shadow-glow-20 shadow-signal-500/10 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-signal-500 select-none">
        SKILLS
      </div>

      <div className="flex items-center justify-between border-b border-line pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Swords className="w-5 h-5 text-signal-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-signal-400 uppercase tracking-display">
            Árvore de Perícias ({skills.length})
          </h2>
        </div>
        <span className="text-micro text-subtle uppercase">
          Atributo + Nível de Perícia
        </span>
      </div>

      {/* Habilidade Especial */}
      {sheet.specialAbilityName && (
        <div className="bg-gradient-to-r from-signal-950/60 to-surface border border-signal-500/50 rounded-lg p-3 flex items-center justify-between relative z-10 shadow-glow-12 shadow-signal-500/15">
          <div className="flex items-center space-x-2.5">
            <Star className="w-4 h-4 text-signal-400" />
            <div>
              <span className="text-micro text-signal-400/80 uppercase block">Habilidade Especial</span>
              <span className="text-sm font-mono text-signal-300 uppercase">{sheet.specialAbilityName}</span>
              <span className="text-micro text-signal-400/70 font-mono block">
                {special.modifiers.slice(0, -1).map((m) => m.label).join(' + ') || 'sem atributo'} + nível
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-signal-400 bg-surface border border-signal-600/60 px-2.5 py-1 rounded">
              +{sheet.specialAbilityRank}
            </span>
            <button
              onClick={() => onRollCheck(special.label, special.modifiers)}
              className="px-2 py-1.5 bg-signal-500 hover:bg-signal-400 text-black rounded font-bold text-micro uppercase flex items-center space-x-1 cursor-pointer transition-all"
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
          <div className="text-center py-6 text-xs text-subtle bg-surface/60 rounded border border-dashed border-line-strong">
            Nenhuma perícia adicionada. Use "Adicionar Perícia" para montar sua árvore.
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-surface/80 p-2.5 rounded-lg border-l-2 border-l-signal-500 border-y border-r border-line flex items-center justify-between gap-2 hover:border-signal-500/40 transition-all"
            >
              <div className="min-w-0 flex items-center space-x-2">
                <span className="text-micro px-1.5 py-0.5 rounded bg-raised border border-line-strong text-accent-300 font-mono shrink-0">
                  {skill.stat}
                </span>
                <span className="text-sm font-bold text-white truncate">{skill.name}</span>
                {skill.isSpecialAbility && <Star className="w-3 h-3 text-signal-400 shrink-0" />}
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <div className="flex items-center space-x-1 bg-raised border border-line rounded px-1 py-0.5">
                  <button
                    onClick={() => changeLevel(skill.id, -1)}
                    className="w-5 h-5 rounded bg-surface text-muted hover:text-accent-400 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-xs font-mono text-signal-400">{skill.level}</span>
                  <button
                    onClick={() => changeLevel(skill.id, 1)}
                    className="w-5 h-5 rounded bg-surface text-muted hover:text-accent-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRollSkill(skill)}
                  title="Rolar perícia"
                  className="px-2 py-1.5 bg-signal-500 hover:bg-signal-400 text-black rounded font-bold text-micro uppercase flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Dice5 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeSkill(skill.id)}
                  className="p-1.5 rounded bg-raised hover:bg-fault-950 border border-line hover:border-fault-500 text-subtle hover:text-fault-400 transition-all cursor-pointer"
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
        <div className="bg-surface/90 border border-signal-500/40 rounded-lg p-3 space-y-2.5 relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-micro font-black text-signal-400 uppercase tracking-caps">
              Nova Perícia
            </span>
            <button onClick={() => setShowAdd(false)} className="text-muted hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="Ex: Handgun, Stealth, Brawling..."
              className="w-full bg-raised border border-field text-xs font-mono text-fg-strong px-2.5 py-1.5 rounded focus:border-signal-400 focus:outline-none"
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
              className="w-full bg-raised border border-field text-xs font-mono text-accent-300 px-2.5 py-1.5 rounded focus:border-signal-400 focus:outline-none"
            >
              {STAT_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-micro text-muted shrink-0">Nível:</label>
              <input
                type="number"
                min={0}
                max={10}
                value={skillLevel}
                onChange={(e) => setSkillLevel(parseInt(e.target.value) || 0)}
                className="w-full bg-raised border border-field text-xs font-mono text-signal-400 px-2.5 py-1.5 rounded focus:border-signal-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setSkillName(s)}
                className="text-micro bg-raised hover:bg-raised-strong border border-line hover:border-signal-500/50 text-muted px-1.5 py-0.5 rounded font-mono cursor-pointer transition-all"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={addSkill}
              disabled={!skillName.trim()}
              className="px-3 py-1.5 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 text-black font-black text-micro uppercase rounded transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 bg-surface hover:bg-signal-950/60 border border-dashed border-signal-700/60 text-signal-400 hover:text-signal-300 font-bold text-mini uppercase rounded transition-all cursor-pointer relative z-10"
        >
          + Adicionar Perícia
        </button>
      )}
    </div>
  );
};
