import React, { useState } from 'react';
import { CharacterSheet } from '../types/cyberpunk';
import { generateRandomNpc } from '../utils/npcGenerator';
import { SheetMeta } from '../lib/firebase';
import { Swords, Copy, Trash2, Upload, Download, Plus, User, Lock } from 'lucide-react';

interface PresetsManagerProps {
  currentSheet: CharacterSheet;
  onLoadSheet: (id: string) => void;
  onLoadPresetAsNewSheet: (preset: CharacterSheet) => void;
  onCreateNew: () => void;
  roster: SheetMeta[];
  onDeleteSheet: (id: string) => void;
  user: { uid: string; displayName?: string | null } | null;
  onOpenAuthModal: () => void;
}

export const PresetsManager: React.FC<PresetsManagerProps> = ({
  currentSheet,
  onLoadSheet,
  onLoadPresetAsNewSheet,
  onCreateNew,
  roster,
  onDeleteSheet,
  user,
  onOpenAuthModal
}) => {
  const [presets, setPresets] = useState<CharacterSheet[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cyberpunk_presets_v1') || '[]');
    } catch {
      return [];
    }
  });

  const [showGenerator, setShowGenerator] = useState(false);

  const persistPresets = (next: CharacterSheet[]) => {
    setPresets(next);
    try {
      localStorage.setItem('cyberpunk_presets_v1', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const generatePreset = () => {
    const npc = generateRandomNpc();
    persistPresets([npc, ...presets]);
  };

  const clonePreset = (preset: CharacterSheet) => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    onLoadPresetAsNewSheet(preset);
  };

  const removePreset = (id: string) => {
    persistPresets(presets.filter((p) => p.id !== id));
  };

  const exportCurrent = () => {
    const blob = new Blob([JSON.stringify(currentSheet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha_${currentSheet.handle || 'edgerunner'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as CharacterSheet;
        if (parsed && parsed.id && parsed.stats) {
          persistPresets([parsed, ...presets]);
        }
      } catch {
        alert('Arquivo de ficha inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 font-mono animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-950/90 border-l-4 border-yellow-500 border-y border-r border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-yellow-500 select-none">
          LEGENDS
        </div>
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-11 h-11 rounded-lg bg-yellow-950 border border-yellow-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.4)]">
            <Swords className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-yellow-400 uppercase tracking-widest">Lendas de Night City</h2>
            <p className="text-[10px] text-slate-500">Presets, NPCs e fichas importáveis</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative z-10">
          <button
            onClick={exportCurrent}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded font-bold text-[10px] uppercase flex items-center space-x-1 transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Exportar Atual</span>
          </button>
          <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded font-bold text-[10px] uppercase flex items-center space-x-1 transition-all cursor-pointer">
            <Upload className="w-3 h-3" />
            <span>Importar</span>
            <input type="file" accept=".json" className="hidden" onChange={importSheet} />
          </label>
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-black text-[10px] uppercase flex items-center space-x-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(234,179,8,0.4)]"
          >
            <Plus className="w-3 h-3" />
            <span>Gerar Lenda</span>
          </button>
        </div>
      </div>

      {/* Gerador */}
      {showGenerator && (
        <div className="bg-slate-950/80 border border-yellow-500/40 rounded-xl p-4 space-y-2 animate-fadeIn">
          <p className="text-[10px] font-mono text-slate-400">
            Gera uma ficha completa de NPC/edgerunner aleatória com atributos, perícias, cromo, armas e lifepath.
          </p>
          <button
            onClick={() => {
              generatePreset();
              setShowGenerator(false);
            }}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[11px] uppercase rounded transition-all cursor-pointer"
          >
            🎲 Gerar NPC Aleatório
          </button>
        </div>
      )}

      {/* Presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => (
          <div key={preset.id} className="bg-slate-950/80 border border-slate-800 hover:border-yellow-500/50 rounded-xl p-4 space-y-2 transition-all">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded bg-slate-900 border border-yellow-500/40 flex items-center justify-center overflow-hidden shrink-0">
                {preset.avatarUrl ? (
                  <img src={preset.avatarUrl} alt={preset.handle} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-yellow-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-black text-yellow-300 uppercase block truncate">{preset.handle || 'Sem nome'}</span>
                <span className="text-[10px] text-cyan-400 font-bold">{preset.role} • REF {preset.stats.REF}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-2">
              {preset.lifepath?.familyBackground || 'Lenda sem histórico registrado.'}
            </p>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => clonePreset(preset)}
                title={user ? 'Clonar como nova ficha' : 'Requer login'}
                className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-bold text-[10px] uppercase flex items-center space-x-1 transition-all cursor-pointer"
              >
                {user ? <Copy className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>Clonar</span>
              </button>
              <button
                onClick={() => removePreset(preset.id)}
                className="p-1.5 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {presets.length === 0 && (
          <div className="col-span-full text-center py-10 text-xs font-mono text-slate-500 bg-slate-950/60 rounded border border-dashed border-slate-700">
            Biblioteca vazia. Gere uma lenda ou importe uma ficha JSON.
          </div>
        )}
      </div>

      {/* Roster salvo */}
      {user && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-800">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Fichas Salvas ({roster.length})</span>
            <button
              onClick={onCreateNew}
              className="px-2.5 py-1 text-[10px] text-cyan-300 hover:text-white bg-slate-900 border border-slate-700 rounded uppercase flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Nova</span>
            </button>
          </div>
          <div className="divide-y divide-slate-900">
            {roster.map((meta) => (
              <div key={meta.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-900/50 transition-colors">
                <button
                  onClick={() => onLoadSheet(meta.id)}
                  className="flex items-center space-x-2 text-left min-w-0 flex-1 cursor-pointer"
                >
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-yellow-400 font-bold shrink-0">
                    {meta.role}
                  </span>
                  <span className="text-xs font-bold text-white truncate">{meta.handle || 'Sem nome'}</span>
                </button>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[9px] text-slate-600">{new Date(meta.updatedAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => onDeleteSheet(meta.id)}
                    className="p-1.5 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {roster.length === 0 && (
              <div className="text-center py-6 text-[10px] text-slate-500">Nenhuma ficha salva na nuvem ainda.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
