import React from 'react';
import type { GameRoom, RoomPlayer } from '../../types/multiplayer';
import { SceneConditions } from './SceneConditions';
import { CreationBudgetMark } from './CreationBudget';
import * as roomsApi from '../../api/rooms';
import { Skull, UserPlus, UserX, Crosshair, Eye } from 'lucide-react';

interface RoomSidebarProps {
  room: GameRoom | null;
  roomCode: string;
  peerId: string;
  isGm: boolean;
  players: Record<string, RoomPlayer>;
  npcs: Record<string, RoomPlayer>;
  /** A ação do GM pela API, com o erro no banner da mesa. */
  roomAction: (p: Promise<unknown>) => Promise<void>;
  onInspectPlayer: (player: RoomPlayer) => void;
  onSelectPlayerForHealthEdit: (player: RoomPlayer) => void;
}

/** L.3c (G.21) — a barra ao lado do chat: os jogadores, os poderes do GM e a cena. */
export const RoomSidebar: React.FC<RoomSidebarProps> = ({
  room,
  roomCode,
  peerId,
  isGm,
  players,
  npcs,
  roomAction,
  onInspectPlayer,
  onSelectPlayerForHealthEdit
}) => {
  const generateNpc = (archetypeId?: string) => {
    roomAction(roomsApi.generateNpc(roomCode, archetypeId));
  };

  const generatePlayerEdgerunner = () => {
    roomAction(roomsApi.generatePlayers(roomCode));
  };

  const updateNpcHealth = (npcId: string, woundLevel: number) => {
    roomAction(roomsApi.setNpcHealth(roomCode, npcId, woundLevel));
  };

  const deleteNpc = (npcId: string) => {
    roomAction(roomsApi.deleteNpc(roomCode, npcId));
  };

  // G.07 — o GM tira alguém da mesa (assento órfão, mesa cheia, convidado que
  // não devia estar ali). O servidor revoga a sessão, fecha o socket e recusa a
  // volta daquele assento (R.3, `removed_by_gm`): a pessoa só volta por uma aba
  // nova — o GM precisa saber disso antes de tirar um amigo que só caiu.
  const deletePlayer = (p: RoomPlayer) => {
    if (!confirm(`Remover ${p.handle} da mesa? A sessão é encerrada, e ${p.handle} só volta abrindo o convite numa aba nova.`)) return;
    roomAction(roomsApi.deletePlayer(roomCode, p.peerId));
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface/80 border border-line rounded-xl p-3">
        <span className="text-micro font-black text-accent-400 uppercase tracking-caps block mb-2">
          Jogadores ({Object.keys(players).length})
        </span>
        <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
          {Object.values(players).map((p) => (
            <div
              key={p.peerId}
              draggable={isGm}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/json',
                  JSON.stringify({ type: 'character_drag', peerId: p.peerId, handle: p.handle, role: p.role, isNpc: false, hp: p.sheet.woundLevel })
                );
              }}
              className="bg-raised/70 border border-line rounded-lg px-2.5 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-accent-500/40 transition-all"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.isOnline ? 'bg-ok-400 animate-pulse' : 'bg-night-600'}`} />
                <span className="text-xs font-bold text-white truncate">{p.handle}</span>
                <span className="text-micro px-1 py-0.5 rounded bg-surface border border-line-strong text-signal-400 shrink-0">
                  {p.role}
                </span>
                {/* K.6c — o orçamento da criação, à vista do GM */}
                {isGm && <CreationBudgetMark handle={p.handle} sheet={p.sheet} />}
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => onInspectPlayer(p)}
                  title="Inspecionar ficha"
                  className="p-1 rounded bg-surface border border-line-strong text-muted hover:text-accent-400 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                </button>
                {isGm && p.peerId !== peerId && (
                  <button
                    onClick={() => onSelectPlayerForHealthEdit(p)}
                    title="Editar bio-monitor"
                    className="p-1 rounded bg-surface border border-line-strong text-muted hover:text-danger-400 cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3" />
                  </button>
                )}
                {isGm && p.peerId !== peerId && (
                  <button
                    onClick={() => deletePlayer(p)}
                    title="Remover da mesa"
                    aria-label={`Remover ${p.handle} da mesa`}
                    className="p-1 rounded bg-surface border border-line-strong text-muted hover:text-fault-400 cursor-pointer"
                  >
                    <UserX className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isGm && (
        <div className="bg-surface/80 border border-signal-500/40 rounded-xl p-3 space-y-2">
          <span className="text-micro font-black text-signal-400 uppercase tracking-caps block">Poderes do GM</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => generateNpc()}
              className="px-2 py-1.5 bg-fault-950/80 hover:bg-fault-900 border border-fault-700/60 text-fault-300 rounded font-bold text-micro uppercase flex items-center justify-center space-x-1 cursor-pointer transition-all"
            >
              <Skull className="w-3 h-3" />
              <span>Gerar NPC</span>
            </button>
            <button
              onClick={generatePlayerEdgerunner}
              className="px-2 py-1.5 bg-accent-950/80 hover:bg-accent-900 border border-accent-700/60 text-accent-300 rounded font-bold text-micro uppercase flex items-center justify-center space-x-1 cursor-pointer transition-all"
            >
              <UserPlus className="w-3 h-3" />
              <span>Gerar Jogador</span>
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            <span className="text-micro text-subtle uppercase">NPCs ({Object.keys(npcs).length})</span>
            {Object.values(npcs).map((n) => (
              <div key={n.peerId} className="bg-raised/70 border border-line rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-micro text-fault-200 font-bold truncate">{n.handle}</span>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => updateNpcHealth(n.peerId, Math.min(10, n.sheet.woundLevel + 1))}
                    className="text-micro px-1 py-0.5 rounded bg-surface border border-line-strong text-danger-400 cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    onClick={() => deleteNpc(n.peerId)}
                    className="text-micro px-1 py-0.5 rounded bg-surface border border-line-strong text-muted cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {Object.keys(npcs).length === 0 && (
              <div className="text-center py-2 text-micro text-faint">Sem NPCs na mesa.</div>
            )}
          </div>
        </div>
      )}

      {isGm && room && (
        <SceneConditions
          locationName={room.locationName}
          combatModifier={room.combatModifier}
          modifierReason={room.modifierReason}
          onApply={(settings) => roomAction(roomsApi.updateSettings(roomCode, settings))}
        />
      )}
    </div>
  );
};
