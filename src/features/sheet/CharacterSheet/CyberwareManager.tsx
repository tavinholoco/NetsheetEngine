import React, { useState } from 'react';
import { CharacterSheet, CyberwareItem } from '../../../types/cyberpunk';
import { humanityFromEmp, humanityRemaining } from '../../../utils/derivedStats';
import { Cpu, Plus, Trash2, Power, AlertTriangle } from 'lucide-react';

interface CyberwareManagerProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

const CATEGORIES = ['Neuralware', 'Implants', 'Bioware', 'Cyberoptics', 'Cyberaudio', 'Subdermal Armor', 'Weapons', 'Fashionware', 'Linear Frame', 'Other'];

export const CyberwareManager: React.FC<CyberwareManagerProps> = ({ sheet, onChange }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [costEb, setCostEb] = useState(500);
  const [humanityLoss, setHumanityLoss] = useState('1d6');
  const [installed, setInstalled] = useState(true);

  const cyberware = sheet.cyberware || [];

  const maxHumanity = humanityFromEmp(sheet.stats.EMP);
  const humanityLeft = humanityRemaining(sheet.stats.EMP, cyberware);

  const addCyberware = () => {
    if (!name.trim()) return;
    const item: CyberwareItem = {
      id: 'cw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      category,
      costEb,
      humanityLoss,
      actualHL: Math.round(Math.random() * 6) + 2,
      installed,
      notes: ''
    };
    onChange({ cyberware: [...cyberware, item] });
    setName('');
    setShowAdd(false);
  };

  const removeCyberware = (id: string) => {
    onChange({ cyberware: cyberware.filter((cw) => cw.id !== id) });
  };

  const toggleInstalled = (id: string) => {
    onChange({
      cyberware: cyberware.map((cw) => (cw.id === id ? { ...cw, installed: !cw.installed } : cw))
    });
  };

  return (
    <div className="bg-slate-900/70 border-l-4 border-purple-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(168,85,247,0.1)] space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-purple-500 select-none">
        CHROME
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-mono font-bold text-purple-400 uppercase tracking-widest">
            Cyberware & Humanidade
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300">
            Empatia: <strong className="text-purple-400">{maxHumanity}</strong>
          </span>
          <span className={`px-2 py-1 rounded border ${humanityLeft < 3 ? 'bg-red-950 border-red-500 text-red-300 animate-pulse' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>
            Restante: <strong>{humanityLeft}</strong>
          </span>
        </div>
      </div>

      {/* Lista de cyberware */}
      <div className="space-y-2 relative z-10">
        {cyberware.length === 0 ? (
          <div className="text-center py-6 text-xs font-mono text-slate-500 bg-slate-950/60 rounded border border-dashed border-slate-700">
            Nenhum cromo instalado. Adicione ciberimplantes para melhorar seu edgerunner.
          </div>
        ) : (
          cyberware.map((cw) => (
            <div
              key={cw.id}
              className={`bg-slate-950/80 p-3 rounded-lg border-l-2 border-l-purple-500 border-y border-r border-slate-800 flex items-center justify-between gap-3 hover:border-purple-500/50 transition-all ${
                !cw.installed ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-mono font-bold text-white truncate">{cw.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300 uppercase font-bold shrink-0">
                    {cw.category}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5 space-x-3">
                  <span>🩸 {cw.humanityLoss} HL</span>
                  <span>€$ {cw.costEb.toLocaleString()}</span>
                  <span className="text-yellow-400">Perda real: {cw.actualHL} HL</span>
                  {cw.notes && <span>{cw.notes}</span>}
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => toggleInstalled(cw.id)}
                  title={cw.installed ? 'Desinstalar' : 'Instalar'}
                  className={`p-2 rounded border transition-all cursor-pointer ${
                    cw.installed
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-400 hover:bg-emerald-900'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeCyberware(cw.id)}
                  className="p-2 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Aviso de humanidade */}
      {humanityLeft <= 0 && (
        <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/50 p-2.5 rounded text-[11px] font-mono text-red-300 relative z-10">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            Perda de humanidade total: você pode estar sofrendo de cyberpsychose! (EMP zerado)
          </span>
        </div>
      )}

      {/* Form de adição */}
      {showAdd ? (
        <div className="bg-slate-950/90 border border-purple-500/40 rounded-lg p-3 space-y-2.5 relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black text-purple-400 uppercase tracking-widest">
              Novo Ciberimplante
            </span>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Kerenzikov Speedware (+2 REF)"
              className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 px-2.5 py-1.5 rounded focus:border-purple-400 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-purple-300 px-2.5 py-1.5 rounded focus:border-purple-400 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-[10px] text-slate-400 shrink-0">Custo (€$):</label>
              <input
                type="number"
                value={costEb}
                onChange={(e) => setCostEb(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400 px-2.5 py-1.5 rounded focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-[10px] text-slate-400 shrink-0">Perda HL:</label>
              <input
                type="text"
                value={humanityLoss}
                onChange={(e) => setHumanityLoss(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-yellow-400 px-2.5 py-1.5 rounded focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={installed}
                onChange={(e) => setInstalled(e.target.checked)}
                className="accent-purple-500"
              />
              Instalado agora
            </label>
            <button
              onClick={addCyberware}
              disabled={!name.trim()}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-black font-black text-[10px] uppercase rounded transition-all cursor-pointer font-mono"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Instalar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 bg-slate-950 hover:bg-purple-950/60 border border-dashed border-purple-700/60 text-purple-400 hover:text-purple-300 font-mono font-bold text-[11px] uppercase rounded transition-all cursor-pointer relative z-10"
        >
          + Adicionar Ciberimplante
        </button>
      )}
    </div>
  );
};
