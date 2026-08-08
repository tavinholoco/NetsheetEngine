import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TacticalGridState, TacticalToken, RoomPlayer } from '../types/multiplayer';
import { RemoteCursor } from '../lib/yjsConnection';
import { WOUND_LEVEL_NAMES } from './CharacterSheet/HealthTracker';
import { 
  Plus, 
  Trash2, 
  User, 
  Flame, 
  Shield, 
  Grid,
  Eye,
  Crosshair,
  Loader2,
  X,
  Palette,
  HelpCircle
} from 'lucide-react';

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
}

interface ThemeConfig {
  bg: string;
  border: string;
  gridColor: string;
  colorDot: string;
  name: string;
}

const THEME_STYLES: Record<string, ThemeConfig> = {
  alley: {
    bg: 'bg-slate-950',
    border: 'border-cyan-500/40',
    gridColor: 'border-slate-800/80',
    colorDot: 'bg-cyan-500',
    name: 'Beco Neon (Escuro / Cyan)'
  },
  corpo: {
    bg: 'bg-slate-900',
    border: 'border-sky-500/50',
    gridColor: 'border-sky-900/60',
    colorDot: 'bg-sky-400',
    name: 'Praça Arasaka (Azul)'
  },
  netrunner: {
    bg: 'bg-emerald-950',
    border: 'border-emerald-500/50',
    gridColor: 'border-emerald-900/60',
    colorDot: 'bg-emerald-400',
    name: 'Net Matrix (Verde)'
  },
  industrial: {
    bg: 'bg-amber-950',
    border: 'border-amber-500/50',
    gridColor: 'border-amber-900/60',
    colorDot: 'bg-amber-500',
    name: 'Zona Industrial (Amarelo)'
  },
  club: {
    bg: 'bg-purple-950',
    border: 'border-purple-500/50',
    gridColor: 'border-purple-900/60',
    colorDot: 'bg-purple-400',
    name: 'Boate Totentanz (Roxo)'
  },
  redalert: {
    bg: 'bg-red-950',
    border: 'border-red-500/50',
    gridColor: 'border-red-900/60',
    colorDot: 'bg-red-500',
    name: 'Alerta de Combate (Vermelho)'
  }
};

const ROWS_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

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
  onCursorMove
}) => {
  const gridCanvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenType, setNewTokenType] = useState<'npc' | 'cover' | 'hazard'>('npc');
  const [newTokenSp, setNewTokenSp] = useState(15);
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
  const isRightHalf = selectedToken ? selectedToken.x >= Math.floor(gridState.cols / 2) : false;
  const isBottomHalf = selectedToken ? selectedToken.y >= Math.floor(gridState.rows / 2) : false;

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

  // Helper to calculate col/row from mouse position on the grid canvas
  const getSectorFromEvent = (e: React.DragEvent | React.MouseEvent): { x: number; y: number } | null => {
    if (!gridCanvasRef.current) return null;
    const rect = gridCanvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const relX = Math.min(Math.max(0, e.clientX - rect.left), rect.width - 1);
    const relY = Math.min(Math.max(0, e.clientY - rect.top), rect.height - 1);

    const x = Math.floor((relX / rect.width) * gridState.cols);
    const y = Math.floor((relY / rect.height) * gridState.rows);

    return {
      x: Math.min(gridState.cols - 1, Math.max(0, x)),
      y: Math.min(gridState.rows - 1, Math.max(0, y))
    };
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
  // (o servidor T5.3 valida a permissão do dono). Zero latency drop.
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSector(null);
    isDraggingRef.current = false;

    const sector = getSectorFromEvent(e);
    if (!sector) return;

    try {
      const dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);

      if (data.type === 'token_drag') {
        // Dragging an existing token already placed on the tactical grid
        const { tokenId } = data;
        const draggedToken = gridState.tokens.find(t => t.id === tokenId);
        // Jogador só move o próprio token; GM move qualquer um.
        if (!draggedToken) return;
        if (roleMode !== 'gm' && draggedToken.peerId !== peerId) return;
        const updatedTokens = gridState.tokens.map(t => {
          if (t.id === tokenId) {
            return { ...t, x: sector.x, y: sector.y };
          }
          return t;
        });

        onUpdateGrid({
          ...gridState,
          tokens: updatedTokens
        });
      } else if (data.type === 'character_drag') {
        // Arrastar ficha da barra lateral (criar token) é poder exclusivo do GM
        if (roleMode !== 'gm') return;
        // Dragging a character sheet or NPC card from the sidebar
        const { peerId: charPeerId, handle, role, isNpc, hp } = data;

        const existingTokenIndex = gridState.tokens.findIndex(
          t => t.peerId === charPeerId || t.id === `token_${charPeerId}` || t.id === `npc_token_${charPeerId}`
        );

        let updatedTokens = [...gridState.tokens];

        if (existingTokenIndex >= 0) {
          updatedTokens[existingTokenIndex] = {
            ...updatedTokens[existingTokenIndex],
            x: sector.x,
            y: sector.y
          };
        } else {
          const newTokenId = isNpc ? `npc_token_${charPeerId}` : `token_${charPeerId}`;
          const newToken: TacticalToken = {
            id: newTokenId,
            name: handle,
            type: isNpc ? 'npc' : 'player',
            x: sector.x,
            y: sector.y,
            peerId: charPeerId,
            role: role || 'Solo',
            hp: hp || 0,
            color: isNpc ? '#ef4444' : '#06b6d4'
          };
          updatedTokens.push(newToken);
        }

        onUpdateGrid({
          ...gridState,
          tokens: updatedTokens
        });
      }
    } catch (err) {
      console.error('Failed to handle drop on canvas', err);
    }
  };

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
    setIsAddingToken(false);
    setSelectedTokenId(newToken.id);
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

  // GM: Clear all tokens
  const handleClearAllTokens = () => {
    if (roleMode !== 'gm') return;
    if (!confirm('Deseja realmente remover TODOS os tokens e elementos do Grid Tático?')) return;
    onUpdateGrid({
      ...gridState,
      tokens: []
    });
    setSelectedTokenId(null);
  };

  // GM: Change theme background color
  const handleChangeTheme = (themeKey: string) => {
    if (roleMode !== 'gm') return;
    onUpdateGrid({
      ...gridState,
      theme: themeKey
    });
  };

  // GM: Change grid dimensions
  const handleChangeDimensions = (deltaCols: number, deltaRows: number) => {
    if (roleMode !== 'gm') return;
    const newCols = Math.min(16, Math.max(4, gridState.cols + deltaCols));
    const newRows = Math.min(12, Math.max(4, gridState.rows + deltaRows));

    onUpdateGrid({
      ...gridState,
      cols: newCols,
      rows: newRows
    });
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* Grid Top Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2">
          <Grid className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
            GRID TÁTICO DE COMBATE
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
            {gridState.cols}x{gridState.rows} SETORES
          </span>
        </div>

        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wide flex items-center space-x-1">
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>Mapeamento Visual // {roleMode === 'gm' ? 'Controles no Painel da Mesa' : 'Somente Mestre move fichas'}</span>
        </span>
      </div>

      {/* GM Form: Add Element (NPC / Cover / Hazard) */}
      {roleMode === 'gm' && isAddingToken && (
        <div className="bg-slate-900 border border-cyan-800 p-4 rounded-lg space-y-3 animate-fadeIn shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>ADICIONAR ELEMENTO AO GRID TÁTICO</span>
            </h3>
            <button onClick={() => setIsAddingToken(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nome do Elemento</label>
              <input
                type="text"
                placeholder="Ex: Barricada, Inimigo A, Fogo..."
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Tipo de Elemento</label>
              <select
                value={newTokenType}
                onChange={(e) => setNewTokenType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="npc">👾 Inimigo / NPC</option>
                <option value="cover">🛡️ Cobertura (Blindagem/Barricada)</option>
                <option value="hazard">🔥 Perigo Ambiental (Fogo/Gás/Acid)</option>
              </select>
            </div>

            {newTokenType === 'cover' ? (
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Pontos de Blindagem (SP)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newTokenSp}
                  onChange={(e) => setNewTokenSp(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div className="flex items-end">
                <button
                  onClick={handleAddToken}
                  disabled={!newTokenName.trim()}
                  className="w-full py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase transition-all cursor-pointer"
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
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase transition-all cursor-pointer"
              >
                Confirmar e Posicionar
              </button>
            </div>
          )}
        </div>
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
          className="relative w-full border border-slate-800/80 rounded min-h-[420px] sm:min-h-[500px]"
        >
          {/* CURSO RES REMOTOS DO GM (awareness Yjs — Fase 5 T5.3) */}
          {remoteCursors.map((c) => (
            <div
              key={c.clientID}
              className="absolute z-40 pointer-events-none select-none"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2 relative">
                <div className="w-4 h-4 rounded-full bg-yellow-300 border-2 border-black shadow-[0_0_10px_rgba(250,204,21,0.9)]" />
                <span className="absolute top-3.5 left-3 whitespace-nowrap text-[8px] px-1.5 py-0.5 rounded bg-yellow-400 text-black font-black font-mono border border-black">
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
                      isHighlighted ? 'bg-cyan-500/30 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]' : ''
                    }`}
                  >
                    {/* Sector Coordinate Code (Visual Label) */}
                    <span className="absolute top-0.5 left-1 text-[8px] font-mono text-slate-500/70 select-none">
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
                        ? 'hover:bg-cyan-500/10 cursor-pointer'
                        : ''
                    }`}
                  >
                    {cellTokens.map((token) => {
                      const isSelected = selectedTokenId === token.id;
                      // Fase 5 (T5.3) — jogador arrasta o PRÓPRIO token (CRDT);
                      // o servidor valida a permissão do dono.
                      const canDragToken = roleMode === 'gm' || token.peerId === peerId;

                      let badgeBg = 'bg-cyan-950/95 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]';
                      if (token.type === 'npc') badgeBg = 'bg-red-950/95 text-red-300 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
                      if (token.type === 'cover') badgeBg = 'bg-slate-900/95 text-slate-200 border-slate-500 shadow-[0_0_6px_rgba(148,163,184,0.4)]';
                      if (token.type === 'hazard') badgeBg = 'bg-amber-950/95 text-amber-300 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';

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
                              ? 'ring-2 ring-yellow-400 scale-125 z-40 shadow-[0_0_20px_rgba(250,204,21,1)]'
                              : ''
                          }`}
                        >
                          {/* ONLY ICON INSIDE GRID CELL */}
                          {token.type === 'player' && <User className="w-4 h-4 text-cyan-300" />}
                          {token.type === 'npc' && <Crosshair className="w-4 h-4 text-red-300" />}
                          {token.type === 'cover' && <Shield className="w-4 h-4 text-slate-200" />}
                          {token.type === 'hazard' && <Flame className="w-4 h-4 text-amber-300 animate-pulse" />}

                          {/* SP cover overlay badge */}
                          {token.type === 'cover' && token.spCover !== undefined && (
                            <span className="absolute -bottom-1 -left-1 text-[7px] font-mono font-black bg-slate-950 text-slate-200 px-1 rounded border border-slate-600">
                              {token.spCover}
                            </span>
                          )}

                          {/* Wounded status indicator dot */}
                          {token.hp !== undefined && token.hp > 0 && (
                            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-black animate-ping" />
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
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-[9px] font-mono flex items-center justify-center border border-black shadow-[0_0_8px_rgba(250,204,21,0.9)] z-30 transition-transform hover:scale-130 cursor-pointer"
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
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute z-50 w-64 sm:w-72 bg-slate-950/95 border-2 border-yellow-400 rounded-xl p-3.5 shadow-[0_0_25px_rgba(250,204,21,0.4)] space-y-3 font-mono text-left animate-fadeIn backdrop-blur-md"
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
                onClick={() => setSelectedTokenId(null)}
                className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded transition-all cursor-pointer"
                title="Fechar Janela"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-2.5 pr-6">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                  selectedToken.type === 'player'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                    : selectedToken.type === 'npc'
                    ? 'bg-red-950 border-red-500 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                    : selectedToken.type === 'cover'
                    ? 'bg-slate-900 border-slate-400 text-slate-200'
                    : 'bg-amber-950 border-amber-500 text-amber-300'
                }`}>
                  {selectedToken.type === 'player' && <User className="w-4 h-4 text-cyan-400" />}
                  {selectedToken.type === 'npc' && <Crosshair className="w-4 h-4 text-red-400" />}
                  {selectedToken.type === 'cover' && <Shield className="w-4 h-4 text-slate-300" />}
                  {selectedToken.type === 'hazard' && <Flame className="w-4 h-4 text-amber-400 animate-pulse" />}
                </div>

                <div className="overflow-hidden">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider truncate">
                    {selectedToken.name}
                  </h4>
                  <div className="flex items-center space-x-1.5 pt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400 text-black font-extrabold uppercase shrink-0">
                      SETOR {ROWS_LABELS[selectedToken.y] || selectedToken.y}{selectedToken.x + 1}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800 font-bold uppercase shrink-0">
                      {selectedToken.type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Setor:</span>
                  <span className="font-bold text-yellow-400">
                    {ROWS_LABELS[selectedToken.y] || selectedToken.y}{selectedToken.x + 1}
                  </span>
                </div>

                {selectedToken.spCover !== undefined && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Blindagem (SP):</span>
                    <span className="font-bold text-cyan-400">{selectedToken.spCover} SP</span>
                  </div>
                )}

                {selectedToken.hp !== undefined && (selectedToken.type === 'player' || selectedToken.type === 'npc') && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Bio-Monitor:</span>
                    <span className={`font-bold ${WOUND_LEVEL_NAMES[selectedToken.hp]?.color || 'text-emerald-400'}`}>
                      {WOUND_LEVEL_NAMES[selectedToken.hp]?.name || 'Normal'} ({selectedToken.hp}/10)
                    </span>
                  </div>
                )}

                {selectedToken.role && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Função:</span>
                    <span className="font-bold text-purple-400">{selectedToken.role}</span>
                  </div>
                )}

                {selectedToken.peerId && players[selectedToken.peerId] && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-400">Edgerunner:</span>
                    <span className="font-bold text-cyan-300 truncate max-w-[120px]">{players[selectedToken.peerId].handle}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                {selectedToken.peerId && players[selectedToken.peerId] && onInspectPlayer && (
                  <button
                    onClick={() => {
                      onInspectPlayer(players[selectedToken.peerId!]);
                      setSelectedTokenId(null);
                    }}
                    className="w-full py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-extrabold text-[11px] uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inspecionar Ficha</span>
                  </button>
                )}

                {roleMode === 'gm' && selectedToken.peerId && players[selectedToken.peerId] && onSelectPlayerForHealthEdit && (
                  <button
                    onClick={() => {
                      onSelectPlayerForHealthEdit(players[selectedToken.peerId!]);
                      setSelectedTokenId(null);
                    }}
                    className="w-full py-1.5 rounded bg-pink-950 hover:bg-pink-900 border border-pink-700 text-pink-300 font-extrabold text-[11px] uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-pink-400" />
                    <span>Editar Saúde</span>
                  </button>
                )}

                {roleMode === 'gm' && (
                  <button
                    onClick={() => {
                      handleRemoveToken(selectedToken.id);
                      setSelectedTokenId(null);
                    }}
                    className="w-full py-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-extrabold text-[11px] uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Remover do Grid</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend & Instructions Footer */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span className="text-slate-300">Jogador</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-slate-300">Inimigo / NPC</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span className="text-slate-300">Cobertura (SP)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-300">Perigo</span>
          </span>
        </div>

        <span className="text-[10px] text-slate-500 font-mono">
          {roleMode === 'gm'
            ? '💡 Dica Mestre: Arraste a ficha da barra lateral diretamente para qualquer lugar no Grid.'
            : '💡 Dica Jogador: Clique no token para inspecionar os detalhes.'}
        </span>
      </div>
    </div>
  );
};
