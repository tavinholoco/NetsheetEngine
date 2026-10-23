import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TacticalGridState, TacticalToken, RoomPlayer } from '../../types/multiplayer';
import { RemoteCursor } from '../../lib/yjsConnection';
import { THEME_STYLES, ROWS_LABELS } from './gridTheme';
import { gridAfterDrop, sectorFromPoint } from './gridDrop';
import { TokenPopover } from './TokenPopover';
import { AddTokenForm } from './AddTokenForm';
import { User, Flame, Shield, Grid, Eye, Crosshair } from 'lucide-react';

interface TacticalGridProps {
  gridState?: TacticalGridState;
  roleMode: 'gm' | 'player';
  peerId: string;
  players: Record<string, RoomPlayer>;
  onUpdateGrid: (newGrid: TacticalGridState) => void;
  onSelectPlayerForHealthEdit?: (player: RoomPlayer) => void;
  onInspectPlayer?: (player: RoomPlayer) => void;
  /** Fase 5 (T5.3) — cursores remotos (awareness Yjs) renderizados no grid. */
  remoteCursors?: RemoteCursor[];
  /** GM: notifica a posição do cursor (percentuais 0..1) para o awareness. */
  onCursorMove?: (x: number | null, y: number | null) => void;
  /** Fase D (D.3) — ações de combate do GM no cartão do token selecionado. */
  renderTokenCombat?: (token: TacticalToken) => React.ReactNode;
}

export const TacticalGrid: React.FC<TacticalGridProps> = ({
  gridState = {
    rows: 8,
    cols: 10,
    theme: 'alley',
    tokens: []
  },
  roleMode,
  peerId,
  players,
  onUpdateGrid,
  onSelectPlayerForHealthEdit,
  onInspectPlayer,
  remoteCursors = [],
  onCursorMove,
  renderTokenCombat
}) => {
  const gridCanvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [dragOverSector, setDragOverSector] = useState<{ x: number; y: number } | null>(null);

  // Global reset for drag state when mouse or drag completes anywhere in document
  useEffect(() => {
    const resetDrag = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('dragend', resetDrag);
    window.addEventListener('mouseup', resetDrag);
    return () => {
      window.removeEventListener('dragend', resetDrag);
      window.removeEventListener('mouseup', resetDrag);
    };
  }, []);

  const themeConfig = THEME_STYLES[gridState.theme] || THEME_STYLES.alley;
  const selectedToken = gridState.tokens.find(t => String(t.id) === String(selectedTokenId));

  // GM cursor tracking (Fase 5 T5.3) — publica a posição do mouse no grid
  // via awareness (percentuais relativos ao canvas). Só o GM emite.
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (roleMode !== 'gm' || !onCursorMove || !gridCanvasRef.current) return;
    const rect = gridCanvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onCursorMove(x, y);
  }, [roleMode, onCursorMove]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (roleMode === 'gm' && onCursorMove) onCursorMove(null, null);
  }, [roleMode, onCursorMove]);

  // Helper to calculate col/row from mouse position on the grid canvas (a conta, no gridDrop)
  const getSectorFromEvent = (e: React.DragEvent | React.MouseEvent): { x: number; y: number } | null => {
    if (!gridCanvasRef.current) return null;
    return sectorFromPoint(gridCanvasRef.current.getBoundingClientRect(), e.clientX, e.clientY, gridState.cols, gridState.rows);
  };

  // Canvas Drag Over — GM e jogador (mover o próprio token, Fase 5 T5.3)
  const handleCanvasDragOver = (e: React.DragEvent) => {
    // Permite soltar o próprio token: o drop handler valida o dono.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (roleMode !== 'gm') return;

    const sector = getSectorFromEvent(e);
    if (sector && (!dragOverSector || dragOverSector.x !== sector.x || dragOverSector.y !== sector.y)) {
      setDragOverSector(sector);
    }
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    if (roleMode !== 'gm') return;
    // Clear drag indicator if leaving grid container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverSector(null);
  };

  // Canvas Drop Handler — GM pode tudo; jogador move o PRÓPRIO token
  // (o servidor T5.3 valida a permissão do dono). Zero latency drop. A conta, no gridDrop.
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSector(null);
    isDraggingRef.current = false;

    const sector = getSectorFromEvent(e);
    if (!sector) return;

    try {
      const dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      const next = gridAfterDrop(gridState, dataStr, sector, roleMode, peerId);
      if (next) onUpdateGrid(next);
    } catch {
      // O que o drop não entende não muda o grid.
    }
  };

  // GM: Remove token from grid
  const handleRemoveToken = (tokenId: string) => {
    if (roleMode !== 'gm') return;
    onUpdateGrid({
      ...gridState,
      tokens: gridState.tokens.filter(t => t.id !== tokenId)
    });
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Grid Top Title Bar */}
      <div className="bg-raised/90 border border-line p-3 rounded-lg flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2">
          <Grid className="w-5 h-5 text-accent-400" />
          <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-display">
            GRID TÁTICO DE COMBATE
          </h2>
          <span className="text-micro px-2 py-0.5 rounded bg-raised-strong text-fg-soft font-bold border border-line-strong">
            {gridState.cols}x{gridState.rows} SETORES
          </span>
        </div>

        <span className="text-micro text-accent-400 font-bold uppercase tracking-caps flex items-center space-x-1">
          <Eye className="w-3.5 h-3.5 text-accent-400" />
          <span>Mapeamento Visual // {roleMode === 'gm' ? 'Controles no Painel da Mesa' : 'Somente Mestre move fichas'}</span>
        </span>
      </div>

      {/* GM Form: Add Element (NPC / Cover / Hazard) */}
      {roleMode === 'gm' && isAddingToken && (
        <AddTokenForm
          gridState={gridState}
          onUpdateGrid={onUpdateGrid}
          onClose={() => setIsAddingToken(false)}
          onAdded={setSelectedTokenId}
        />
      )}

      {/* 
        GRID CANVAS CONTAINER 
        Entire canvas handles onDragOver and onDrop for GM.
        The sector grid cells are purely visual non-interactive background overlays (pointer-events-none).
      */}
      <div className={`p-3 rounded-xl border ${themeConfig.border} ${themeConfig.bg} transition-colors duration-300 shadow-2xl relative`}>
        
        {/* Visual Canvas Container */}
        <div
          ref={gridCanvasRef}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
          onClick={() => setSelectedTokenId(null)}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="relative w-full border border-line/80 rounded min-h-[420px] sm:min-h-[500px]"
        >
          {/* CURSO RES REMOTOS DO GM (awareness Yjs — Fase 5 T5.3) */}
          {remoteCursors.map((c) => (
            <div
              key={c.clientID}
              className="absolute z-40 pointer-events-none select-none"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2 relative">
                <div className="w-4 h-4 rounded-full bg-signal-300 border-2 border-black shadow-glow-10 shadow-signal-400/90" />
                <span className="absolute top-3.5 left-3 whitespace-nowrap text-micro px-1.5 py-0.5 rounded bg-signal-400 text-black font-black border border-black">
                  👁 {c.name}
                </span>
              </div>
            </div>
          ))}
          {/* VISUAL SECTOR GRID OVERLAY (Pointer-events: NONE - purely visual sectors) */}
          <div
            className="absolute inset-0 grid gap-[1px] pointer-events-none overflow-hidden rounded"
            style={{
              gridTemplateColumns: `repeat(${gridState.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridState.rows}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: gridState.rows }).map((_, r) =>
              Array.from({ length: gridState.cols }).map((_, c) => {
                const isHighlighted = roleMode === 'gm' && dragOverSector?.x === c && dragOverSector?.y === r;
                return (
                  <div
                    key={`sector_${r}_${c}`}
                    className={`relative border ${themeConfig.gridColor} transition-colors ${
                      isHighlighted ? 'bg-accent-500/30 border-accent-400 shadow-glow-15 shadow-accent-500/80' : ''
                    }`}
                  >
                    {/* Sector Coordinate Code (Visual Label) */}
                    <span className="absolute top-0.5 left-1 text-micro font-mono text-subtle/70 select-none">
                      {ROWS_LABELS[r] || r}{c + 1}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* TOKEN RENDER LAYER ON THE GRID - COMPACT ICON-ONLY TOKENS */}
          <div
            className="absolute inset-0 grid gap-[1px]"
            style={{
              gridTemplateColumns: `repeat(${gridState.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridState.rows}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: gridState.rows }).map((_, r) =>
              Array.from({ length: gridState.cols }).map((_, c) => {
                const cellTokens = gridState.tokens.filter(t => t.x === c && t.y === r);

                return (
                  <div
                    key={`token_layer_${r}_${c}`}
                    onClick={(e) => {
                      if (roleMode === 'gm' && selectedTokenId && cellTokens.length === 0) {
                        e.stopPropagation();
                        // Click-to-move selected token instantly to this cell
                        const updatedTokens = gridState.tokens.map(t =>
                          t.id === selectedTokenId ? { ...t, x: c, y: r } : t
                        );
                        onUpdateGrid({
                          ...gridState,
                          tokens: updatedTokens
                        });
                      }
                    }}
                    className={`w-full h-full p-0.5 flex flex-wrap items-center justify-center gap-1 overflow-hidden transition-colors ${
                      roleMode === 'gm' && selectedTokenId && cellTokens.length === 0
                        ? 'hover:bg-accent-500/10 cursor-pointer'
                        : ''
                    }`}
                  >
                    {cellTokens.map((token) => {
                      const isSelected = selectedTokenId === token.id;
                      // Fase 5 (T5.3) — jogador arrasta o PRÓPRIO token (CRDT);
                      // o servidor valida a permissão do dono.
                      const canDragToken = roleMode === 'gm' || token.peerId === peerId;

                      let badgeBg = 'bg-accent-950/95 text-accent-300 border-accent-400 shadow-glow-8 shadow-accent-500/60';
                      if (token.type === 'npc') badgeBg = 'bg-fault-950/95 text-fault-300 border-fault-500 shadow-glow-8 shadow-fault-500/60';
                      if (token.type === 'cover') badgeBg = 'bg-raised/95 text-fg border-night-500 shadow-glow-6 shadow-night-400/40';
                      if (token.type === 'hazard') badgeBg = 'bg-caution-950/95 text-caution-300 border-caution-500 shadow-glow-8 shadow-caution-500/60';

                      return (
                        <div
                          key={token.id}
                          draggable={canDragToken}
                          onDragStart={(e) => {
                            if (!canDragToken) return;
                            isDraggingRef.current = true;
                            const payload = JSON.stringify({
                              type: 'token_drag',
                              tokenId: token.id
                            });
                            e.dataTransfer.setData('application/json', payload);
                            e.dataTransfer.setData('text/plain', payload);
                          }}
                          onDragEnd={() => {
                            setTimeout(() => {
                              isDraggingRef.current = false;
                            }, 100);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDraggingRef.current) return;
                            setSelectedTokenId(prev => prev === token.id ? null : token.id);
                          }}
                          title={`${token.name} (${token.type.toUpperCase()}) - Setor ${ROWS_LABELS[token.y] || token.y}${token.x + 1}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-lg select-none relative group ${
                            canDragToken
                              ? 'cursor-grab active:cursor-grabbing hover:scale-125 hover:z-40'
                              : 'cursor-pointer hover:scale-115 hover:z-40'
                          } ${badgeBg} ${
                            isSelected
                              ? 'ring-2 ring-signal-400 scale-125 z-40 shadow-glow-20 shadow-signal-400'
                              : ''
                          }`}
                        >
                          {/* ONLY ICON INSIDE GRID CELL */}
                          {token.type === 'player' && <User className="w-4 h-4 text-accent-300" />}
                          {token.type === 'npc' && <Crosshair className="w-4 h-4 text-fault-300" />}
                          {token.type === 'cover' && <Shield className="w-4 h-4 text-fg" />}
                          {token.type === 'hazard' && <Flame className="w-4 h-4 text-caution-300 animate-pulse" />}

                          {/* SP cover overlay badge */}
                          {token.type === 'cover' && token.spCover !== undefined && (
                            <span className="absolute -bottom-1 -left-1 text-micro font-mono bg-surface text-fg px-1 rounded border border-night-600">
                              {token.spCover}
                            </span>
                          )}

                          {/* Wounded status indicator dot */}
                          {token.hp !== undefined && token.hp > 0 && (
                            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger-500 border border-black animate-ping" />
                          )}

                          {/* "?" Icon Button to explicitly toggle Element Status Window */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              isDraggingRef.current = false;
                              setSelectedTokenId(prev => String(prev) === String(token.id) ? null : token.id);
                            }}
                            title={`Abrir status de ${token.name}`}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-signal-400 hover:bg-signal-300 text-black font-extrabold text-micro flex items-center justify-center border border-black shadow-glow-8 shadow-signal-400/90 z-30 transition-transform hover:scale-130 cursor-pointer"
                          >
                            ?
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* SIDE POPOVER STATUS WINDOW (Anchored alongside clicked token, no backdrop overlay) */}
          {selectedToken && (
            <TokenPopover
              selectedToken={selectedToken}
              gridState={gridState}
              players={players}
              roleMode={roleMode}
              onClose={() => setSelectedTokenId(null)}
              onInspectPlayer={onInspectPlayer}
              onSelectPlayerForHealthEdit={onSelectPlayerForHealthEdit}
              renderTokenCombat={renderTokenCombat}
              onRemoveToken={handleRemoveToken}
            />
          )}
        </div>
      </div>

      {/* Legend & Instructions Footer */}
      <div className="flex flex-wrap items-center justify-between text-mini text-muted bg-raised/60 p-2.5 rounded border border-line gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-500"></span>
            <span className="text-fg-soft">Jogador</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-fault-500"></span>
            <span className="text-fg-soft">Inimigo / NPC</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-night-400"></span>
            <span className="text-fg-soft">Cobertura (SP)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-caution-500"></span>
            <span className="text-fg-soft">Perigo</span>
          </span>
        </div>

        <span className="text-micro text-subtle">
          {roleMode === 'gm'
            ? '💡 Dica Mestre: Arraste a ficha da barra lateral diretamente para qualquer lugar no Grid.'
            : '💡 Dica Jogador: Clique no token para inspecionar os detalhes.'}
        </span>
      </div>
    </div>
  );
};
