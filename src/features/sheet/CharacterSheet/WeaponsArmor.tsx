import React, { useState } from 'react';
import { ArmorPiece, CharacterSheet, WeaponItem } from '../../../types/cyberpunk';
import { armorSpAt } from '../../../utils/derivedStats';
import { DEFAULT_ARMOR, DEFAULT_WEAPONS } from '../../../data/cyberpunkData';
import { Shield, Target, Plus, Trash2, Dice5, Crosshair } from 'lucide-react';

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

  // Armor SP handlers
  const handleUpdateArmorSp = (location: ArmorPiece['location'], newSp: number) => {
    const updated = sheet.armor.map((a) => {
      if (a.location === location) {
        return { ...a, sp: Math.max(0, newSp) };
      }
      return a;
    });
    onChange({ armor: updated });
  };

  // SP por localização vem da regra pura em src/utils/derivedStats.ts

  return (
    <div className="bg-raised/70 border-l-4 border-signal-500 border-y border-r rounded-lg p-5 shadow-glow-20 shadow-signal-500/10 space-y-4 relative overflow-hidden">
      {/* Background HUD Accent */}
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-signal-500 select-none">
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
                ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]'
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

      {/* WEAPONS TAB */}
      {activeTab === 'weapons' && (
        <div className="space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sheet.weapons.map((w) => (
              <div key={w.id} className="bg-surface/80 p-4 rounded-lg border-l-2 border-l-pink-500 border-y border-r border-line hover:border-pink-500/50 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-bold text-white block uppercase">{w.name}</span>
                    <span className="text-micro font-mono text-muted">
                      Tipo: {w.type} • WA: {w.wa >= 0 ? `+${w.wa}` : w.wa} • Alcance: {w.rangeMeters}m
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveWeapon(w.id)}
                    className="p-1 rounded bg-raised hover:bg-pink-950 text-subtle hover:text-pink-400 border border-line transition-all"
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
                        w.currentShots === 0 ? 'text-pink-500 animate-pulse' : 'text-ok-400'
                      }`}
                    >
                      {w.currentShots} / {w.shots}
                    </span>
                    <button
                      onClick={() => handleShotFired(w.id)}
                      disabled={w.currentShots <= 0}
                      className="px-2 py-0.5 rounded bg-pink-950/80 border border-pink-800 text-pink-300 font-bold hover:bg-pink-900 disabled:opacity-40 uppercase text-micro"
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
                      className="px-2 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded font-bold text-micro flex items-center space-x-1 uppercase tracking-caps shadow-[0_0_8px_rgba(236,72,153,0.4)]"
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
          <div className="bg-surface/80 p-3 rounded border border-line space-y-2">
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
      )}

      {/* ARMOR TAB */}
      {activeTab === 'armor' && (
        <div className="space-y-4 relative z-10">
          <div className="bg-surface/80 p-4 rounded-lg border border-line space-y-3">
            <span className="text-xs font-bold text-accent-400 uppercase tracking-caps block">
              Pontos de Parada (Stopping Power - SP) por Localização Corporal
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { loc: 'Head' as const, label: 'Cabeça (1)', icon: '🧠' },
                { loc: 'Torso' as const, label: 'Tronco (2-4)', icon: '🎽' },
                { loc: 'Right Arm' as const, label: 'Braço Dir (5)', icon: '🦾' },
                { loc: 'Left Arm' as const, label: 'Braço Esq (6)', icon: '🦾' },
                { loc: 'Right Leg' as const, label: 'Perna Dir (7-8)', icon: '🦿' },
                { loc: 'Left Leg' as const, label: 'Perna Esq (9-0)', icon: '🦿' }
              ].map(({ loc, label, icon }) => {
                const spVal = armorSpAt(sheet.armor, loc);

                return (
                  <div key={loc} className="bg-raised/90 p-3 rounded border border-line text-center space-y-2 hover:border-accent-500/50 transition-all">
                    <span className="text-xl block">{icon}</span>
                    <span className="text-micro text-muted block uppercase">{label}</span>
                    <div className="text-lg font-mono text-signal-400">
                      SP {spVal}
                    </div>
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleUpdateArmorSp(loc, spVal - 1)}
                        className="w-5 h-5 rounded bg-surface border border-line-strong text-xs font-bold text-fg-soft hover:bg-raised-strong"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleUpdateArmorSp(loc, spVal + 1)}
                        className="w-5 h-5 rounded bg-surface border border-line-strong text-xs font-bold text-fg-soft hover:bg-raised-strong"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
