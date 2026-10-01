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
    <div className="bg-raised/70 border-l-4 border-l-cyber-500 border-y border-r border-line rounded-lg p-5 shadow-glow-20 shadow-cyber-500/10 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-cyber-500 select-none">
        CHROME
      </div>

      <div className="flex items-center justify-between border-b border-line pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-cyber-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-cyber-400 uppercase tracking-display">
            Cyberware & Humanidade
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2 py-1 rounded bg-surface border border-line-strong text-fg-soft">
            Empatia: <strong className="font-mono font-normal text-cyber-400">{maxHumanity}</strong>
          </span>
          <span className={`px-2 py-1 rounded border ${humanityLeft < 3 ? 'bg-fault-950 border-fault-500 text-fault-300 animate-pulse' : 'bg-surface border-line-strong text-fg-soft'}`}>
            Restante: <strong className="font-mono font-normal">{humanityLeft}</strong>
          </span>
        </div>
      </div>

      {/* Lista de cyberware */}
      <div className="space-y-2 relative z-10">
        {cyberware.length === 0 ? (
          <div className="text-center py-6 text-xs text-subtle bg-surface/60 rounded border border-dashed border-line-strong">
            Nenhum cromo instalado. Adicione ciberimplantes para melhorar seu edgerunner.
          </div>
        ) : (
          cyberware.map((cw) => (
            <div
              key={cw.id}
              className={`bg-surface/80 p-3 rounded-lg border-l-2 border-l-cyber-500 border-y border-r border-line flex items-center justify-between gap-3 hover:border-cyber-500/50 transition-all ${
                !cw.installed ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white truncate">{cw.name}</span>
                  <span className="text-micro px-1.5 py-0.5 rounded bg-cyber-950 border border-cyber-700 text-cyber-300 uppercase font-bold shrink-0">
                    {cw.category}
                  </span>
                </div>
                <div className="text-micro font-mono text-muted mt-0.5 space-x-3">
                  <span>🩸 {cw.humanityLoss} HL</span>
                  <span>€$ {cw.costEb.toLocaleString()}</span>
                  <span className="text-signal-400">Perda real: {cw.actualHL} HL</span>
                  {cw.notes && <span>{cw.notes}</span>}
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => toggleInstalled(cw.id)}
                  title={cw.installed ? 'Desinstalar' : 'Instalar'}
                  className={`p-2 rounded border transition-all cursor-pointer ${
                    cw.installed
                      ? 'bg-ok-950/60 border-ok-600 text-ok-400 hover:bg-ok-900'
                      : 'bg-raised border-line-strong text-subtle hover:text-fg-soft'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeCyberware(cw.id)}
                  className="p-2 rounded bg-raised hover:bg-fault-950 border border-line hover:border-fault-500 text-subtle hover:text-fault-400 transition-all cursor-pointer"
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
        <div className="flex items-center space-x-2 bg-fault-950/60 border border-fault-500/50 p-2.5 rounded text-mini text-fault-300 relative z-10">
          <AlertTriangle className="w-4 h-4 text-fault-400 shrink-0" />
          <span>
            Perda de humanidade total: você pode estar sofrendo de cyberpsychose! (EMP zerado)
          </span>
        </div>
      )}

      {/* Form de adição */}
      {showAdd ? (
        <div className="bg-surface/90 border border-cyber-500/40 rounded-lg p-3 space-y-2.5 relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-micro font-black text-cyber-400 uppercase tracking-caps">
              Novo Ciberimplante
            </span>
            <button onClick={() => setShowAdd(false)} className="text-muted hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Kerenzikov Speedware (+2 REF)"
              className="w-full bg-raised border border-field text-xs font-mono text-fg-strong px-2.5 py-1.5 rounded focus:border-cyber-400 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-raised border border-field text-xs font-mono text-cyber-300 px-2.5 py-1.5 rounded focus:border-cyber-400 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-micro text-muted shrink-0">Custo (€$):</label>
              <input
                type="number"
                value={costEb}
                onChange={(e) => setCostEb(parseInt(e.target.value) || 0)}
                className="w-full bg-raised border border-field text-xs font-mono text-ok-400 px-2.5 py-1.5 rounded focus:border-cyber-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-micro text-muted shrink-0">Perda HL:</label>
              <input
                type="text"
                value={humanityLoss}
                onChange={(e) => setHumanityLoss(e.target.value)}
                className="w-full bg-raised border border-field text-xs font-mono text-signal-400 px-2.5 py-1.5 rounded focus:border-cyber-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-1.5 text-micro text-fg-soft cursor-pointer">
              <input
                type="checkbox"
                checked={installed}
                onChange={(e) => setInstalled(e.target.checked)}
                className="accent-cyber-500"
              />
              Instalado agora
            </label>
            <button
              onClick={addCyberware}
              disabled={!name.trim()}
              className="px-3 py-1.5 bg-cyber-500 hover:bg-cyber-400 disabled:opacity-40 text-black font-black text-micro uppercase rounded transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Instalar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 bg-surface hover:bg-cyber-950/60 border border-dashed border-cyber-700/60 text-cyber-400 hover:text-cyber-300 font-bold text-mini uppercase rounded transition-all cursor-pointer relative z-10"
        >
          + Adicionar Ciberimplante
        </button>
      )}
    </div>
  );
};
