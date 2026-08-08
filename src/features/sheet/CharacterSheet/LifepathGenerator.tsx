import React, { useState } from 'react';
import { CharacterSheet } from '../../../types/cyberpunk';
import { LIFEPATH_TABLES } from '../../../data/cyberpunkData';
import { BookOpen, Dices, Plus, Trash2 } from 'lucide-react';

interface LifepathGeneratorProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
}

export const LifepathGenerator: React.FC<LifepathGeneratorProps> = ({ sheet, onChange }) => {
  const [showGenerator, setShowGenerator] = useState(false);
  const lifepath = sheet.lifepath || {
    familyBackground: '',
    parentStatus: '',
    familyTragedy: '',
    childhoodEnvironment: '',
    motivationStyle: '',
    valuedPerson: '',
    valuedPossession: '',
    lifeEvents: []
  };

  const setField = (key: keyof typeof lifepath, value: string) => {
    onChange({ lifepath: { ...lifepath, [key]: value } });
  };

  const roll1d10 = () => Math.min(10, Math.max(1, Math.floor(Math.random() * 10) + 1));

  const generateLifepath = () => {
    onChange({
      lifepath: {
        ...lifepath,
        familyBackground: LIFEPATH_TABLES.familyBackground[roll1d10() - 1] || lifepath.familyBackground,
        parentStatus: LIFEPATH_TABLES.parentStatus[roll1d10() - 1] || lifepath.parentStatus,
        familyTragedy: LIFEPATH_TABLES.familyTragedy[roll1d10() - 1] || lifepath.familyTragedy,
        childhoodEnvironment: LIFEPATH_TABLES.childhoodEnvironment[roll1d10() - 1] || lifepath.childhoodEnvironment,
        motivationStyle: LIFEPATH_TABLES.motivations[roll1d10() - 1] || lifepath.motivationStyle,
        lifeEvents: [
          LIFEPATH_TABLES.lifeEvents[roll1d10() - 1] || '',
          ...lifepath.lifeEvents
        ].filter(Boolean)
      }
    });
  };

  const addLifeEvent = () => {
    onChange({ lifepath: { ...lifepath, lifeEvents: [...lifepath.lifeEvents, ''] } });
  };

  const updateLifeEvent = (idx: number, value: string) => {
    const next = [...lifepath.lifeEvents];
    next[idx] = value;
    onChange({ lifepath: { ...lifepath, lifeEvents: next } });
  };

  const removeLifeEvent = (idx: number) => {
    onChange({ lifepath: { ...lifepath, lifeEvents: lifepath.lifeEvents.filter((_, i) => i !== idx) } });
  };

  const fields: { key: keyof typeof lifepath; label: string }[] = [
    { key: 'familyBackground', label: 'Histórico Familiar' },
    { key: 'parentStatus', label: 'Situação dos Pais' },
    { key: 'familyTragedy', label: 'Tragédia Familiar' },
    { key: 'childhoodEnvironment', label: 'Ambiente na Infância' },
    { key: 'motivationStyle', label: 'Motivação / Estilo' },
    { key: 'valuedPerson', label: 'Pessoa Importante' },
    { key: 'valuedPossession', label: 'Possessão de Valor' }
  ];

  return (
    <div className="bg-slate-900/70 border-l-4 border-emerald-500 border-y border-r border-slate-800 rounded-lg p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)] space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-emerald-500 select-none">
        LIFEPATH
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-mono font-bold text-emerald-400 uppercase tracking-widest">
            Lifepath // História do Personagem
          </h2>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-bold text-[10px] uppercase flex items-center space-x-1 transition-all cursor-pointer font-mono shadow-[0_0_10px_rgba(16,185,129,0.4)]"
        >
          <Dices className="w-3.5 h-3.5" />
          <span>{showGenerator ? 'Ocultar Gerador' : 'Gerar 1D10'}</span>
        </button>
      </div>

      {/* Gerador rápido de lifepath */}
      {showGenerator && (
        <div className="bg-slate-950/90 border border-emerald-500/40 rounded-lg p-3 relative z-10 animate-fadeIn">
          <p className="text-[10px] font-mono text-slate-400 mb-2">
            Role 1D10 em cada tabela CP2020 para montar uma história rápida. Depois refine os campos abaixo.
          </p>
          <button
            onClick={generateLifepath}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase rounded transition-all cursor-pointer font-mono"
          >
            🎲 Rolagem Automática de Lifepath (5×1D10)
          </button>
        </div>
      )}

      {/* Campos editáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase">{label}:</label>
            <input
              type="text"
              value={lifepath[key] || ''}
              onChange={(e) => setField(key, e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-200 px-2.5 py-1.5 rounded focus:border-emerald-400 focus:outline-none"
            />
          </div>
        ))}

        {/* Eventos de vida */}
        <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Eventos de Vida:</span>
            <button
              onClick={addLifeEvent}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer font-mono"
            >
              <Plus className="w-3 h-3" />
              <span>Adicionar evento</span>
            </button>
          </div>
          {lifepath.lifeEvents.map((ev, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <input
                type="text"
                value={ev}
                onChange={(e) => updateLifeEvent(idx, e.target.value)}
                placeholder={`Evento ${idx + 1}`}
                className="w-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100 px-2.5 py-1.5 rounded focus:border-emerald-400 focus:outline-none"
              />
              <button
                onClick={() => removeLifeEvent(idx)}
                className="p-1.5 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {lifepath.lifeEvents.length === 0 && (
            <p className="text-[10px] font-mono text-slate-600">Nenhum evento de vida registrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};
