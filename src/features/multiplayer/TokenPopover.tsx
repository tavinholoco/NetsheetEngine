import React from 'react';
import type { TacticalGridState, TacticalToken, RoomPlayer } from '../../types/multiplayer';
import { woundLevelColor } from '../../utils/injuryRules';
import { woundRow } from '../../rules/character';
import { ROWS_LABELS } from './gridTheme';
import { Trash2, User, Flame, Shield, Eye, Crosshair, X } from 'lucide-react';

interface TokenPopoverProps {
  selectedToken: TacticalToken;
  gridState: TacticalGridState;
  players: Record<string, RoomPlayer>;
  roleMode: 'gm' | 'player';
  onClose: () => void;
  onInspectPlayer?: (player: RoomPlayer) => void;
  onSelectPlayerForHealthEdit?: (player: RoomPlayer) => void;
  /** Fase D (D.3) — as ações de combate do GM. */
  renderTokenCombat?: (token: TacticalToken) => React.ReactNode;
  onRemoveToken: (tokenId: string) => void;
}

/**
 * L.3c (G.21) — o cartão do token, ao lado dele no grid (sem fundo escuro): o
 * setor, a blindagem, o ferimento e a ficha; e, para o GM, a saúde, o combate e
 * remover do grid.
 */
export const TokenPopover: React.FC<TokenPopoverProps> = ({
  selectedToken,
  gridState,
  players,
  roleMode,
  onClose,
  onInspectPlayer,
  onSelectPlayerForHealthEdit,
  renderTokenCombat,
  onRemoveToken
}) => {
  const isRightHalf = selectedToken.x >= Math.floor(gridState.cols / 2);
  const isBottomHalf = selectedToken.y >= Math.floor(gridState.rows / 2);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 w-64 sm:w-72 bg-surface/95 border-2 border-signal-400 rounded-xl p-3.5 shadow-glow-25 shadow-signal-400/40 space-y-3 text-left animate-fadeIn backdrop-blur-md"
      style={{
        top: isBottomHalf
          ? 'auto'
          : `${Math.min(55, Math.max(3, (selectedToken.y / gridState.rows) * 100))}%`,
        bottom: isBottomHalf
          ? `${Math.min(55, Math.max(3, 100 - ((selectedToken.y + 1) / gridState.rows) * 100))}%`
          : 'auto',
        left: isRightHalf
          ? 'auto'
          : `${Math.min(55, Math.max(2, ((selectedToken.x + 1) / gridState.cols) * 100 + 1))}%`,
        right: isRightHalf
          ? `${Math.min(55, Math.max(2, 100 - (selectedToken.x / gridState.cols) * 100 + 1))}%`
          : 'auto',
      }}
    >
      {/* Close Button */}
      <button
        onClick={() => onClose()}
        className="absolute top-2.5 right-2.5 text-muted hover:text-white p-1 rounded transition-all cursor-pointer"
        title="Fechar Janela"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="flex items-center space-x-2.5 border-b border-line pb-2.5 pr-6">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
          selectedToken.type === 'player'
            ? 'bg-accent-950 border-accent-400 text-accent-300 shadow-glow-10 shadow-accent-500/60'
            : selectedToken.type === 'npc'
            ? 'bg-fault-950 border-fault-500 text-fault-300 shadow-glow-10 shadow-fault-500/60'
            : selectedToken.type === 'cover'
            ? 'bg-raised border-night-400 text-fg'
            : 'bg-caution-950 border-caution-500 text-caution-300'
        }`}>
          {selectedToken.type === 'player' && <User className="w-4 h-4 text-accent-400" />}
          {selectedToken.type === 'npc' && <Crosshair className="w-4 h-4 text-fault-400" />}
          {selectedToken.type === 'cover' && <Shield className="w-4 h-4 text-fg-soft" />}
          {selectedToken.type === 'hazard' && <Flame className="w-4 h-4 text-caution-400 animate-pulse" />}
        </div>

        <div className="overflow-hidden">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-caps truncate">
            {selectedToken.name}
          </h4>
          <div className="flex items-center space-x-1.5 pt-0.5">
            <span className="font-mono text-micro px-1.5 py-0.5 rounded bg-signal-400 text-black uppercase shrink-0">
              SETOR {ROWS_LABELS[selectedToken.y] || selectedToken.y}{selectedToken.x + 1}
            </span>
            <span className="text-micro px-1.5 py-0.5 rounded bg-raised text-accent-300 border border-line font-bold uppercase shrink-0">
              {selectedToken.type.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 bg-raised/90 p-2.5 rounded-lg border border-line text-mini text-fg-soft">
        <div className="flex justify-between items-center py-0.5 border-b border-line/60">
          <span className="text-muted">Setor:</span>
          <span className="font-mono text-signal-400">
            {ROWS_LABELS[selectedToken.y] || selectedToken.y}{selectedToken.x + 1}
          </span>
        </div>

        {selectedToken.spCover !== undefined && (
          <div className="flex justify-between items-center py-0.5 border-b border-line/60">
            <span className="text-muted">Blindagem (SP):</span>
            <span className="font-mono text-accent-400">{selectedToken.spCover} SP</span>
          </div>
        )}

        {selectedToken.hp !== undefined && (selectedToken.type === 'player' || selectedToken.type === 'npc') && (
          <div className="flex justify-between items-center py-0.5 border-b border-line/60">
            <span className="text-muted">Bio-Monitor:</span>
            {/* K.3a — o nome da trilha do livro, como na ficha. O "(2/10)"
                saiu: era o índice do nível, e o painel de combate logo
                abaixo conta os pontos do livro (8/40). */}
            <span className={`font-mono ${woundLevelColor(selectedToken.hp)}`}>
              {woundRow(selectedToken.hp).name}
            </span>
          </div>
        )}

        {selectedToken.role && (
          <div className="flex justify-between items-center py-0.5 border-b border-line/60">
            <span className="text-muted">Função:</span>
            <span className="font-bold text-cyber-400">{selectedToken.role}</span>
          </div>
        )}

        {selectedToken.peerId && players[selectedToken.peerId] && (
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted">Edgerunner:</span>
            <span className="font-bold text-accent-300 truncate max-w-[120px]">{players[selectedToken.peerId].handle}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        {selectedToken.peerId && players[selectedToken.peerId] && onInspectPlayer && (
          <button
            onClick={() => {
              onInspectPlayer(players[selectedToken.peerId!]);
              onClose();
            }}
            className="w-full py-1.5 rounded bg-accent-950 hover:bg-accent-900 border border-accent-700 text-accent-300 font-extrabold text-mini uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-accent-400" />
            <span>Inspecionar Ficha</span>
          </button>
        )}

        {roleMode === 'gm' && selectedToken.peerId && players[selectedToken.peerId] && onSelectPlayerForHealthEdit && (
          <button
            onClick={() => {
              onSelectPlayerForHealthEdit(players[selectedToken.peerId!]);
              onClose();
            }}
            className="w-full py-1.5 rounded bg-danger-950 hover:bg-danger-900 border border-danger-700 text-danger-300 font-extrabold text-mini uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-danger-400" />
            <span>Editar Saúde</span>
          </button>
        )}

        {roleMode === 'gm' && renderTokenCombat?.(selectedToken)}

        {roleMode === 'gm' && (
          <button
            onClick={() => {
              onRemoveToken(selectedToken.id);
              onClose();
            }}
            className="w-full py-1.5 rounded bg-fault-950 hover:bg-fault-900 border border-fault-800 text-fault-300 font-extrabold text-mini uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-fault-400" />
            <span>Remover do Grid</span>
          </button>
        )}
      </div>
    </div>
  );
};
