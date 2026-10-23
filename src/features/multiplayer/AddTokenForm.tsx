import React, { useState } from 'react';
import type { TacticalGridState, TacticalToken } from '../../types/multiplayer';
import { Plus, X } from 'lucide-react';

/** O que o GM põe no grid pelo formulário (o token do jogador entra com a ficha). */
type NewTokenType = Exclude<TacticalToken['type'], 'player'>;

interface AddTokenFormProps {
  gridState: TacticalGridState;
  onUpdateGrid: (newGrid: TacticalGridState) => void;
  onClose: () => void;
  /** O token novo entra selecionado: o cartão dele abre. */
  onAdded: (tokenId: string) => void;
}

/** L.3c (G.21) — o GM põe no grid um NPC, uma cobertura (com SP) ou um perigo. */
export const AddTokenForm: React.FC<AddTokenFormProps> = ({ gridState, onUpdateGrid, onClose, onAdded }) => {
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenType, setNewTokenType] = useState<NewTokenType>('npc');
  const [newTokenSp, setNewTokenSp] = useState(15);

  // GM: Add new Custom Token / Cover / Hazard to grid
  const handleAddToken = () => {
    if (!newTokenName.trim()) return;

    const newToken: TacticalToken = {
      id: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      name: newTokenName.trim(),
      type: newTokenType,
      x: Math.floor(gridState.cols / 2),
      y: Math.floor(gridState.rows / 2),
      spCover: newTokenType === 'cover' ? newTokenSp : undefined,
      hp: newTokenType === 'npc' ? 0 : undefined,
      status: 'Normal',
      color: newTokenType === 'npc' ? '#ef4444' : newTokenType === 'cover' ? '#64748b' : '#f59e0b'
    };

    onUpdateGrid({
      ...gridState,
      tokens: [...gridState.tokens, newToken]
    });

    setNewTokenName('');
    onClose();
    onAdded(newToken.id);
  };

  return (
    <div className="bg-raised border border-accent-800 p-4 rounded-lg space-y-3 animate-fadeIn shadow-xl">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h3 className="text-xs font-bold text-accent-400 uppercase tracking-caps flex items-center space-x-2">
          <Plus className="w-4 h-4 text-accent-400" />
          <span>ADICIONAR ELEMENTO AO GRID TÁTICO</span>
        </h3>
        <button onClick={() => onClose()} className="text-muted hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-micro text-muted uppercase font-bold block mb-1">Nome do Elemento</label>
          <input
            type="text"
            placeholder="Ex: Barricada, Inimigo A, Fogo..."
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            className="w-full bg-surface border border-field rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent-500"
          />
        </div>

        <div>
          <label className="text-micro text-muted uppercase font-bold block mb-1">Tipo de Elemento</label>
          <select
            value={newTokenType}
            onChange={(e) => setNewTokenType(e.target.value as NewTokenType)}
            className="w-full bg-surface border border-field rounded px-2.5 py-1 text-xs text-accent-300 focus:outline-none focus:border-accent-500"
          >
            <option value="npc">👾 Inimigo / NPC</option>
            <option value="cover">🛡️ Cobertura (Blindagem/Barricada)</option>
            <option value="hazard">🔥 Perigo Ambiental (Fogo/Gás/Acid)</option>
          </select>
        </div>

        {newTokenType === 'cover' ? (
          <div>
            <label className="text-micro text-muted uppercase font-bold block mb-1">Pontos de Blindagem (SP)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={newTokenSp}
              onChange={(e) => setNewTokenSp(Number(e.target.value))}
              className="font-mono w-full bg-surface border border-field rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent-500"
            />
          </div>
        ) : (
          <div className="flex items-end">
            <button
              onClick={handleAddToken}
              disabled={!newTokenName.trim()}
              className="w-full py-1.5 rounded bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase transition-all cursor-pointer"
            >
              Confirmar e Posicionar
            </button>
          </div>
        )}
      </div>

      {newTokenType === 'cover' && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleAddToken}
            disabled={!newTokenName.trim()}
            className="px-4 py-1.5 rounded bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase transition-all cursor-pointer"
          >
            Confirmar e Posicionar
          </button>
        </div>
      )}
    </div>
  );
};
