import React from 'react';
import { CharacterSheet, SkillItem, WeaponItem } from '../types/cyberpunk';
import type { Modifier } from '../rules/dice';
import { CharacterHeader } from '../features/sheet/CharacterSheet/CharacterHeader';
import { HealthTracker } from '../features/sheet/CharacterSheet/HealthTracker';
import { StatBlock } from '../features/sheet/CharacterSheet/StatBlock';
import { CyberwareManager } from '../features/sheet/CharacterSheet/CyberwareManager';
import { WeaponsArmor } from '../features/sheet/CharacterSheet/WeaponsArmor';
import { SkillsSection } from '../features/sheet/CharacterSheet/SkillsSection';
import { LifepathGenerator } from '../features/sheet/CharacterSheet/LifepathGenerator';
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
  onRollStunSave: () => void;
  onRollWeaponAttack: (weapon: WeaponItem) => void;
  onRollDamageOnly: (weaponName: string, damageFormula: string) => void;
  onRollSkill: (skill: SkillItem) => void;
  /** Teste com parcelas prontas (C.8 — a habilidade especial usa este). */
  onRollCheck: (label: string, modifiers: Modifier[]) => void;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  isSavingSheet: boolean;
  onSave: () => void;
  onSaveAndReset: () => void;
}

export const SheetPage: React.FC<SheetPageProps> = ({
  sheet,
  onChange,
  onRollDeathSave,
  onRollStunSave,
  onRollWeaponAttack,
  onRollDamageOnly,
  onRollSkill,
  onRollCheck,
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
      <HealthTracker sheet={sheet} onChange={onChange} onRollDeathSave={onRollDeathSave} onRollStunSave={onRollStunSave} />

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
      <SkillsSection sheet={sheet} onChange={onChange} onRollSkill={onRollSkill} onRollCheck={onRollCheck} />

      {/* Lifepath Narrative */}
      <LifepathGenerator sheet={sheet} onChange={onChange} />

      {/* BOTTOM ACTION BAR: SAVE SHEET & OPTIONS */}
      <div className="bg-surface border-2 border-accent-500/60 rounded-xl p-6 shadow-glow-25 shadow-accent-500/20 flex flex-col lg:flex-row items-center justify-between gap-6 font-mono">
        <div className="space-y-1.5 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start space-x-2">
            <Save className="w-5 h-5 text-accent-400" />
            <h3 className="text-base font-bold text-accent-400 uppercase tracking-wider">
              Gerenciamento da Ficha // {user ? (sheet.handle || 'Edgerunner') : 'Modo Visitante'}
            </h3>
          </div>
          <p className="text-xs text-fg-soft max-w-xl">
            {user ? (
              <>Edição em andamento da ficha de <strong className="text-signal-400">{sheet.handle || 'Edgerunner'}</strong> ({sheet.role}). Sincronizada com seu perfil na nuvem.</>
            ) : (
              <>Você está visualizando o criador de ficha no <strong>Modo Visitante</strong>. Crie uma conta ou faça login para salvar permanentemente suas fichas na nuvem.</>
            )}
          </p>
          <div className="text-[10px] text-subtle font-mono">
            ID: <span className="text-accent-500">{sheet.id}</span> • Status: <span className="text-ok-400 font-bold">{user ? 'Auto-Sincronização Ativa' : 'Modo Visitante'}</span>
          </div>
        </div>

        {user ? (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Main Update/Save Button */}
            <button
              onClick={onSave}
              disabled={isSavingSheet}
              className="w-full sm:w-auto px-6 py-3 bg-accent-500 hover:bg-accent-400 text-black font-extrabold text-xs uppercase rounded tracking-wider shadow-glow-18 shadow-accent-500/40 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>{isSavingSheet ? 'Salvando...' : 'Salvar Alterações da Ficha'}</span>
            </button>

            {/* Optional Save & Reset for New Character */}
            <button
              onClick={onSaveAndReset}
              disabled={isSavingSheet}
              className="w-full sm:w-auto px-5 py-3 bg-raised hover:bg-raised-strong border border-line-strong text-fg-soft hover:text-signal-400 font-bold text-xs uppercase rounded transition-all flex items-center justify-center space-x-2 cursor-pointer"
              title="Salva a ficha atual e inicia uma nova ficha em branco"
            >
              <Plus className="w-4 h-4 text-signal-400" />
              <span>Nova Ficha em Branco</span>
            </button>
          </div>
        ) : (
          <div className="bg-signal-950/60 border border-signal-500/60 p-3.5 rounded-lg text-xs font-mono text-signal-300 flex items-center space-x-3">
            <Lock className="w-5 h-5 text-signal-400 shrink-0" />
            <div>
              <span className="font-bold block uppercase text-signal-400">Modo Visitante</span>
              <span className="text-fg-soft">Acesse sua conta para salvar suas fichas permanentemente na nuvem.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
