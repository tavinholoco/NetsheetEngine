import React, { useState } from 'react';
import { CharacterSheet, WeaponItem } from '../../../types/cyberpunk';
import { ArmorPanel } from './ArmorPanel';
import { DEFAULT_WEAPONS } from '../../../data/cyberpunkData';
import { Plus, Trash2, Dice5, Crosshair } from 'lucide-react';

interface WeaponsArmorProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollWeaponAttack: (weapon: WeaponItem) => void;
  onRollDamageOnly: (weaponName: string, damageFormula: string) => void;
}

export const WeaponsArmor: React.FC<WeaponsArmorProps> = ({
  sheet,
  onChange,
  onRollWeaponAttack,
  onRollDamageOnly
}) => {
  const [activeTab, setActiveTab] = useState<'weapons' | 'armor'>('weapons');

  // Weapons handlers
  const handleShotFired = (weaponId: string) => {
    const updated = sheet.weapons.map((w) => {
      if (w.id === weaponId) {
        return { ...w, currentShots: Math.max(0, w.currentShots - 1) };
      }
      return w;
    });
    onChange({ weapons: updated });
  };

  const handleReloadWeapon = (weaponId: string) => {
    const updated = sheet.weapons.map((w) => {
      if (w.id === weaponId) {
        return { ...w, currentShots: w.shots };
      }
      return w;
    });
    onChange({ weapons: updated });
  };

  const handleRemoveWeapon = (weaponId: string) => {
    const updated = sheet.weapons.filter(w => w.id !== weaponId);
    onChange({ weapons: updated });
  };

  const handleAddDefaultWeapon = (w: WeaponItem) => {
    const newWp: WeaponItem = {
      ...w,
      id: 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    };
    onChange({ weapons: [...sheet.weapons, newWp] });
  };


  return (
    <div className="bg-raised/70 border-l-4 border-l-signal-500 border-y border-r border-line rounded-lg p-5 shadow-glow-20 shadow-signal-500/10 space-y-4 relative overflow-hidden">
      {/* Background HUD Accent */}
      <div aria-hidden="true" className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none print:hidden font-display text-[50px] font-black text-signal-500 select-none">
        COMBAT_KIT
      </div>

      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-line pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Crosshair className="w-5 h-5 text-signal-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-signal-400 uppercase tracking-display">
            Arsenal & Proteção SP // Combat Systems
          </h2>
        </div>

        <div className="flex items-center space-x-1 text-xs">
          <button
            onClick={() => setActiveTab('weapons')}
            className={`px-3 py-1.5 rounded transition-all font-bold uppercase tracking-caps ${
              activeTab === 'weapons'
                ? 'bg-roll-600 text-white shadow-glow-10 shadow-roll-500/50'
                : 'bg-surface text-muted hover:text-white'
            }`}
          >
            🔫 Armas ({sheet.weapons.length})
          </button>
          <button
            onClick={() => setActiveTab('armor')}
            className={`px-3 py-1.5 rounded transition-all font-bold uppercase tracking-caps ${
              activeTab === 'armor'
                ? 'bg-accent-500 text-black shadow-glow-10 shadow-accent-500/50'
                : 'bg-surface text-muted hover:text-white'
            }`}
          >
            🛡️ Proteção SP por Localização
          </button>
        </div>
      </div>

      {/* WEAPONS TAB — as duas abas ficam no DOM: na impressão, as duas aparecem (K.1c) */}
      <div className={`space-y-4 relative z-10 ${activeTab === 'weapons' ? '' : 'hidden print:block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sheet.weapons.map((w) => (
            <div key={w.id} className="bg-surface/80 p-4 rounded-lg border-l-2 border-l-roll-500 border-y border-r border-line hover:border-roll-500/50 transition-all space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-bold text-white block uppercase">{w.name}</span>
                  <span className="text-micro font-mono text-muted">
                    Tipo: {w.type} • WA: {w.wa >= 0 ? `+${w.wa}` : w.wa} • Alcance: {w.rangeMeters}m
                  </span>
                </div>

                <button
                  onClick={() => handleRemoveWeapon(w.id)}
                  className="p-1 rounded bg-raised hover:bg-fault-950 text-subtle hover:text-fault-400 border border-line transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-raised p-2 rounded border border-line">
                <div>
                  <span className="text-micro text-muted block uppercase">Dano:</span>
                  <span className="font-mono text-signal-400">{w.damage}</span>
                </div>
                <div>
                  <span className="text-micro text-muted block uppercase">Cadência (RoF):</span>
                  <span className="font-mono text-accent-400">{w.rof} tiros/turno</span>
                </div>
              </div>

              {/* Ammo Counter & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between pt-2 gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-muted uppercase text-micro">Munição:</span>
                  <span
                    className={`font-mono ${
                      w.currentShots === 0 ? 'text-caution-400 animate-pulse' : 'text-ok-400'
                    }`}
                  >
                    {w.currentShots} / {w.shots}
                  </span>
                  <button
                    onClick={() => handleShotFired(w.id)}
                    disabled={w.currentShots <= 0}
                    className="px-2 py-0.5 rounded bg-roll-950/80 border border-roll-800 text-roll-300 font-bold hover:bg-roll-900 disabled:opacity-40 uppercase text-micro"
                  >
                    Atirar
                  </button>
                  <button
                    onClick={() => handleReloadWeapon(w.id)}
                    className="px-2 py-0.5 rounded bg-raised-strong text-fg-soft hover:bg-night-700 uppercase text-micro"
                  >
                    Recarregar
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onRollWeaponAttack(w)}
                    className="px-2 py-1 bg-roll-600 hover:bg-roll-700 text-white rounded font-bold text-micro flex items-center space-x-1 uppercase tracking-caps shadow-glow-8 shadow-roll-500/40"
                  >
                    <Dice5 className="w-3 h-3" />
                    <span>Atacar</span>
                  </button>

                  <button
                    onClick={() => onRollDamageOnly(w.name, w.damage)}
                    className="px-2 py-1 bg-signal-500 hover:bg-signal-400 text-black rounded font-bold text-micro uppercase tracking-caps"
                  >
                    Dano
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Add Presets */}
        <div className="print:hidden bg-surface/80 p-3 rounded border border-line space-y-2">
          <span className="text-xs font-bold text-muted block uppercase tracking-caps">
            Adicionar Armas Padrão de Night City:
          </span>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WEAPONS.map((w) => (
              <button
                key={w.id}
                onClick={() => handleAddDefaultWeapon(w)}
                className="px-2.5 py-1 rounded bg-raised hover:bg-raised-strong border border-line-strong hover:border-accent-500/50 text-xs text-accent-300 flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>{w.name} ({w.damage})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ARMOR TAB — a armadura por peça (K.2b) */}
      <div className={`relative z-10 ${activeTab === 'armor' ? '' : 'hidden print:block'}`}>
        <ArmorPanel sheet={sheet} onChange={onChange} />
      </div>
    </div>
  );
};
