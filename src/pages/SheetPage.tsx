import React from 'react';
import { CharacterSheet, StatName } from '../types/cyberpunk';
import { CharacterHeader } from '../components/CharacterSheet/CharacterHeader';
import { HealthTracker } from '../components/CharacterSheet/HealthTracker';
import { StatBlock } from '../components/CharacterSheet/StatBlock';
import { CyberwareManager } from '../components/CharacterSheet/CyberwareManager';
import { WeaponsArmor } from '../components/CharacterSheet/WeaponsArmor';
import { SkillsSection } from '../components/CharacterSheet/SkillsSection';
import { LifepathGenerator } from '../components/CharacterSheet/LifepathGenerator';
import { Save, CheckCircle2, Plus, Lock } from 'lucide-react';

/**
 * Fase 7 (T7.1) — PÁGINA DE FICHA (/sheet)
 * Composite do criador de ficha + barra de ações de salvamento, extraído do
 * App.tsx para lazy loading. Os handlers continuam vindo do App (props).
 */
export interface SheetPageProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollDeathSave: () => void;
  onRollWeaponAttack: (weaponName: string, wa: number, damageStr: string) => void;
  onRollDamageOnly: (weaponName: string, damageFormula: string) => void;
  onRollSkill: (skillName: string, statName: StatName, statVal: number, skillRank: number) => void;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  isSavingSheet: boolean;
  onSave: () => void;
  onSaveAndReset: () => void;
}

export const SheetPage: React.FC<SheetPageProps> = ({
  sheet,
  onChange,
  onRollDeathSave,
  onRollWeaponAttack,
  onRollDamageOnly,
  onRollSkill,
  user,
  isSavingSheet,
  onSave,
  onSaveAndReset
}) => {
  return (
    <div className="space-y-6">
      {/* Header / Identity */}
      <CharacterHeader sheet={sheet} onChange={onChange} />

      {/* Health & Wound Tracker */}
      <HealthTracker sheet={sheet} onChange={onChange} onRollDeathSave={onRollDeathSave} />

      {/* Primary & Derived Stats */}
      <StatBlock sheet={sheet} onChange={onChange} />

      {/* Cyberware & Humanity */}
      <CyberwareManager sheet={sheet} onChange={onChange} />

      {/* Weapons & Armor SP */}
      <WeaponsArmor
        sheet={sheet}
        onChange={onChange}
        onRollWeaponAttack={onRollWeaponAttack}
        onRollDamageOnly={onRollDamageOnly}
      />

      {/* Skills Tree */}
      <SkillsSection sheet={sheet} onChange={onChange} onRollSkill={onRollSkill} />

      {/* Lifepath Narrative */}
      <LifepathGenerator sheet={sheet} onChange={onChange} />

      {/* BOTTOM ACTION BAR: SAVE SHEET & OPTIONS */}
      <div className="bg-slate-950 border-2 border-cyan-500/60 rounded-xl p-6 shadow-[0_0_25px_rgba(6,182,212,0.2)] flex flex-col lg:flex-row items-center justify-between gap-6 font-mono">
        <div className="space-y-1.5 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start space-x-2">
            <Save className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-cyan-400 uppercase tracking-wider">
              Gerenciamento da Ficha // {user ? (sheet.handle || 'Edgerunner') : 'Modo Visitante'}
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            {user ? (
              <>Edição em andamento da ficha de <strong className="text-yellow-400">{sheet.handle || 'Edgerunner'}</strong> ({sheet.role}). Sincronizada com seu perfil na nuvem.</>
            ) : (
              <>Você está visualizando o criador de ficha no <strong>Modo Visitante</strong>. Crie uma conta ou faça login para salvar permanentemente suas fichas na nuvem.</>
            )}
          </p>
          <div className="text-[10px] text-slate-500 font-mono">
            ID: <span className="text-cyan-500">{sheet.id}</span> • Status: <span className="text-emerald-400 font-bold">{user ? 'Auto-Sincronização Ativa' : 'Modo Visitante'}</span>
          </div>
        </div>

        {user ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Main Update/Save Button */}
            <button
              onClick={onSave}
              disabled={isSavingSheet}
              className="w-full sm:w-auto px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase rounded tracking-wider shadow-[0_0_18px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>{isSavingSheet ? 'Salvando...' : 'Salvar Alterações da Ficha'}</span>
            </button>

            {/* Optional Save & Reset for New Character */}
            <button
              onClick={onSaveAndReset}
              disabled={isSavingSheet}
              className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-yellow-400 font-bold text-xs uppercase rounded transition-all flex items-center justify-center space-x-2 cursor-pointer"
              title="Salva a ficha atual e inicia uma nova ficha em branco"
            >
              <Plus className="w-4 h-4 text-yellow-400" />
              <span>Nova Ficha em Branco</span>
            </button>
          </div>
        ) : (
          <div className="bg-yellow-950/60 border border-yellow-500/60 p-3.5 rounded-lg text-xs font-mono text-yellow-300 flex items-center space-x-3">
            <Lock className="w-5 h-5 text-yellow-400 shrink-0" />
            <div>
              <span className="font-bold block uppercase text-yellow-400">Modo Visitante</span>
              <span className="text-slate-300">Acesse sua conta para salvar suas fichas permanentemente na nuvem.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
