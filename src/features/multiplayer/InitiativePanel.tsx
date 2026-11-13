import React, { useState } from 'react';
import type { InitiativeEntry } from '../../types/multiplayer';
import * as roomsApi from '../../api/rooms';

interface InitiativePanelProps {
  initiative: InitiativeEntry[];
  roomCode: string;
  isGm: boolean;
  /** A ação do GM pela API, com o erro no banner da mesa. */
  roomAction: (p: Promise<unknown>) => Promise<void>;
  onNextTurn: () => void;
  /** G.06 — o próximo turno em voo: o botão fica desligado. */
  nextTurnBusy: boolean;
}

/** L.3c (G.21) — a ordem de iniciativa, o próximo turno e o combatente posto à mão. */
export const InitiativePanel: React.FC<InitiativePanelProps> = ({
  initiative,
  roomCode,
  isGm,
  roomAction,
  onNextTurn,
  nextTurnBusy
}) => {
  const [initiativeName, setInitiativeName] = useState('');
  const [initiativeScore, setInitiativeScore] = useState(10);

  const addInitiative = () => {
    if (!initiativeName.trim()) return;
    const list: InitiativeEntry[] = [
      ...initiative,
      {
        playerId: 'init_' + Date.now(),
        handle: initiativeName.trim(),
        role: '—',
        score: initiativeScore,
        isCurrentTurn: false
      }
    ].sort((a, b) => b.score - a.score);
    roomAction(roomsApi.setInitiativeList(roomCode, list));
    setInitiativeName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-surface/80 border border-line rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-line">
          <span className="text-xs font-black text-signal-400 uppercase tracking-caps">Ordem de Iniciativa</span>
          <div className="flex items-center gap-2">
            <span className="text-micro text-subtle">{initiative.length} entradas</span>
            {isGm && (
              <button
                onClick={() => roomAction(roomsApi.rollInitiative(roomCode))}
                title="1d10 + REF (+ Combat Sense do Solo) para cada combatente com ficha. Quem você pôs à mão continua."
                className="px-2.5 py-1 bg-signal-500 hover:bg-signal-400 text-black font-black text-micro uppercase rounded cursor-pointer transition-all"
              >
                🎲 Rolar iniciativa
              </button>
            )}
          </div>
        </div>
        <div className="divide-y divide-line-soft">
          {initiative.map((entry, idx) => (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between px-4 py-2.5 ${
                entry.isCurrentTurn ? 'bg-signal-950/40 border-l-4 border-l-signal-400' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="font-mono text-micro text-subtle w-6">{idx + 1}º</span>
                <span className={`text-xs font-bold ${entry.isCurrentTurn ? 'text-signal-300' : 'text-white'}`}>
                  {entry.handle}
                </span>
                {entry.isCurrentTurn && (
                  <span className="text-micro px-1.5 py-0.5 bg-signal-400 text-black rounded font-black uppercase">Vez</span>
                )}
              </div>
              <span className="text-xs font-mono text-accent-300">{entry.score}</span>
            </div>
          ))}
          {initiative.length === 0 && (
            <div className="text-center py-10 text-micro text-faint">Role a iniciativa ou adicione combatentes para iniciar a rodada.</div>
          )}
        </div>
        {initiative.length > 0 && (
          <div className="p-3 border-t border-line">
            <button
              onClick={onNextTurn}
              disabled={nextTurnBusy}
              className="w-full py-2.5 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 disabled:cursor-wait text-black font-black text-xs uppercase rounded cursor-pointer transition-all"
            >
              ⚔️ Próximo Turno
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface/80 border border-line rounded-xl p-4 space-y-2.5">
        <span className="text-xs font-black text-signal-400 uppercase tracking-caps">Adicionar Combatente</span>
        <input
          type="text"
          value={initiativeName}
          onChange={(e) => setInitiativeName(e.target.value)}
          placeholder="Nome / handle"
          className="w-full bg-raised border border-field text-xs text-fg-strong px-3 py-2 rounded focus:border-signal-400 focus:outline-none"
        />
        <input
          type="number"
          value={initiativeScore}
          onChange={(e) => setInitiativeScore(parseInt(e.target.value) || 0)}
          className="font-mono w-full bg-raised border border-field text-xs text-signal-400 px-3 py-2 rounded focus:border-signal-400 focus:outline-none"
        />
        <button
          onClick={addInitiative}
          disabled={!initiativeName.trim()}
          className="w-full py-2 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 text-black font-black text-micro uppercase rounded cursor-pointer transition-all"
        >
          + Adicionar
        </button>
      </div>
    </div>
  );
};
