import React from 'react';
import { CharacterSheet } from '../../../types/cyberpunk';
import { OFFICIAL_ROLES } from '../../../data/cyberpunkData';
import { User, Shield, DollarSign, Image } from 'lucide-react';

interface CharacterHeaderProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

export const CharacterHeader: React.FC<CharacterHeaderProps> = ({ sheet, onChange }) => {
  const currentRoleObj = OFFICIAL_ROLES.find(r => r.name === sheet.role) || OFFICIAL_ROLES[0];

  return (
    <div className="bg-slate-900/70 border-l-4 border-cyan-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(6,182,212,0.1)] space-y-4 relative overflow-hidden">
      {/* Background HUD Grid Accent */}
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[60px] font-black text-cyan-400 select-none">
        EDGERUNNER
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest">
            Identidade do Edgerunner // Bio-Scanner Active
          </h2>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-cyan-500/40 text-yellow-400 font-bold tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          {sheet.handle ? sheet.handle.toUpperCase() : 'SEMANOME'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
        {/* Avatar Image preview and URL */}
        <div className="flex flex-col items-center justify-center space-y-2 bg-slate-950/80 p-3 rounded border border-slate-800">
          <div className="w-28 h-28 rounded border-2 border-cyan-400 overflow-hidden bg-slate-900 flex items-center justify-center relative shadow-[0_0_20px_rgba(6,182,212,0.25)] group">
            {sheet.avatarUrl ? (
              <img src={sheet.avatarUrl} alt={sheet.handle} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-slate-600" />
            )}
            <div className="absolute top-2 left-2 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-[8px] font-mono text-cyan-400 bg-cyan-950/80 px-1 uppercase">LIVE</span>
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-cyan-950/90 text-[9px] font-mono text-cyan-300 text-center py-0.5 border-t border-cyan-500/40 uppercase tracking-widest font-bold">
              CP-2020 BIO-ID
            </div>
          </div>
          <div className="w-full">
            <label className="text-[10px] font-mono text-slate-400 block mb-1">URL da Imagem:</label>
            <input
              type="text"
              value={sheet.avatarUrl}
              onChange={(e) => onChange({ avatarUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono px-2 py-1 rounded focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Inputs Column 1 */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Apelido (Handle / Street Name):</label>
            <input
              type="text"
              value={sheet.handle}
              onChange={(e) => onChange({ handle: e.target.value })}
              className="w-full bg-slate-950 border border-cyan-800/80 text-sm font-mono text-yellow-400 px-3 py-1.5 rounded focus:border-cyan-400 focus:outline-none font-bold shadow-inner"
              placeholder="Ex: Silverhand, V, Spider"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Nome Real:</label>
            <input
              type="text"
              value={sheet.realName}
              onChange={(e) => onChange({ realName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 px-3 py-1.5 rounded focus:border-cyan-400 focus:outline-none"
              placeholder="Ex: Robert John Linder"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Idade:</label>
              <input
                type="number"
                value={sheet.age}
                onChange={(e) => onChange({ age: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 px-2 py-1.5 rounded focus:border-cyan-400 focus:outline-none text-center"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Gênero:</label>
              <input
                type="text"
                value={sheet.sex}
                onChange={(e) => onChange({ sex: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 px-2 py-1.5 rounded focus:border-cyan-400 focus:outline-none text-center"
              />
            </div>
          </div>
        </div>

        {/* Inputs Column 2: Role & Special Ability */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Classe Oficial (Role):</label>
            <select
              value={sheet.role}
              onChange={(e) => {
                const newRole = e.target.value;
                const rObj = OFFICIAL_ROLES.find(r => r.name === newRole);
                onChange({
                  role: newRole,
                  specialAbilityName: rObj ? rObj.specialAbility : sheet.specialAbilityName
                });
              }}
              className="w-full bg-slate-950 border border-cyan-800/80 text-xs font-mono text-cyan-300 font-bold px-3 py-1.5 rounded focus:border-cyan-400 focus:outline-none"
            >
              {OFFICIAL_ROLES.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} ({r.specialAbility})
                </option>
              ))}
            </select>
            <p className="text-[10px] font-mono text-slate-400 mt-1 line-clamp-2">
              {currentRoleObj.description}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-400 block mb-1">Habilidade Especial:</label>
              <span className="text-xs font-mono font-bold text-yellow-400">{sheet.specialAbilityName}</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="10"
                value={sheet.specialAbilityRank}
                onChange={(e) => onChange({ specialAbilityRank: parseInt(e.target.value) || 0 })}
                className="w-full accent-cyan-400"
              />
              <span className="w-8 text-center font-mono font-bold text-xs bg-slate-950 border border-slate-800 text-cyan-400 py-1 rounded">
                +{sheet.specialAbilityRank}
              </span>
            </div>
          </div>
        </div>

        {/* Money & Status */}
        <div className="space-y-3 bg-slate-950/80 p-3 rounded border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">Fundos (Eurodólares eb):</span>
            </div>
            <input
              type="number"
              value={sheet.eurodollars}
              onChange={(e) => onChange({ eurodollars: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-emerald-800/80 text-xl font-mono text-emerald-400 font-bold px-3 py-1.5 rounded focus:border-emerald-400 focus:outline-none text-right shadow-[0_0_10px_rgba(16,185,129,0.1)]"
            />
          </div>

          <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center space-y-1">
            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-widest">Nível da Ficha</span>
            <span className="text-xs font-mono font-bold text-yellow-400 tracking-wider">
              CYBERPUNK 2020 OFICIAL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
