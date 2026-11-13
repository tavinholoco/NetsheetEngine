import React, { useState } from 'react';
import { errorMessage } from '../../lib/errorMessage';
import { useRoomStore } from '../../stores/useRoomStore';
import { useSheetStore } from '../../stores/useSheetStore';
import { useInFlight } from '../../hooks/useInFlight';
import * as roomsApi from '../../api/rooms';
import { Radio, Users, Plus, Lock } from 'lucide-react';

interface RoomLobbyProps {
  onOpenAuthModal: () => void;
  /** O nome de quem joga na mesa: o da conta, o da ficha ou "Edgerunner". */
  handle: string;
}

/** L.3c (G.21) — o lobby da mesa: criar uma sala como GM ou entrar pelo código. */
export const RoomLobby: React.FC<RoomLobbyProps> = ({ onOpenAuthModal, handle }) => {
  const roomCode = useRoomStore((s) => s.roomCode);
  const setRoomCode = useRoomStore((s) => s.setRoomCode);
  const errorMsg = useRoomStore((s) => s.errorMsg);
  const setErrorMsg = useRoomStore((s) => s.setErrorMsg);
  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);
  const [roomName, setRoomName] = useState('Mesa de Night City');

  // R.11 — o lobby não lista salas (entra-se pelo código ou pelo link do GM).
  // Aqui havia uma consulta a /api/rooms a cada 8 s, com a aba do lobby
  // aberta: além de mostrar a sala de todo mundo a qualquer visitante, era uma
  // das duas coisas que mantinham o Render acordado (risco 1 do custo zero).

  // G.06 — criar e entrar: uma por vez, com o botão desligado enquanto a
  // requisição não volta.
  const { run, isBusy } = useInFlight();

  const createRoom = () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!roomCode.trim()) {
      setErrorMsg('Informe um código de sala (ex.: NC-2020).');
      return;
    }
    setErrorMsg('');
    run('create', async () => {
      try {
        await roomsApi.createRoom({ code: roomCode.trim(), name: roomName, gmHandle: handle });
        useRoomStore.getState().setView('active');
      } catch (e) {
        setErrorMsg(errorMessage(e, 'Erro ao criar sala.'));
      }
    });
  };

  const joinRoom = (code?: string) => {
    const targetCode = (code || roomCode).trim();
    if (!targetCode) return;
    setErrorMsg('');
    run('join', async () => {
      try {
        await roomsApi.joinRoom({ code: targetCode, handle, sheet });
        useRoomStore.getState().setView('active');
      } catch (e) {
        setErrorMsg(errorMessage(e, 'Sala não encontrada.'));
      }
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-surface/90 border-l-4 border-l-ok-500 border-y border-r border-line rounded-2xl p-6 relative overflow-hidden">
        <div aria-hidden="true" className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-ok-500 select-none">
          NET_LOBBY
        </div>
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-12 h-12 rounded-lg bg-ok-950 border border-ok-500/60 flex items-center justify-center shadow-glow-15 shadow-ok-500/40">
            <Radio className="w-6 h-6 text-ok-400" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-ok-400 uppercase tracking-display">Mesa Multiplayer</h2>
            <p className="text-micro text-subtle">Crie ou entre em uma sala em tempo real</p>
          </div>
        </div>
      </div>

      {!user && (
        <div className="bg-signal-950/40 border border-signal-500/50 p-4 rounded-xl text-xs text-signal-300 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-signal-400 shrink-0" />
          <span>Você está no modo visitante. Faça login para criar salas como GM.</span>
          <button onClick={onOpenAuthModal} className="ml-auto px-3 py-1.5 bg-signal-400 hover:bg-signal-300 text-black font-black text-micro uppercase rounded cursor-pointer transition-all shrink-0">
            Acessar Conta
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Criar sala */}
        <div className="bg-surface/80 border border-line rounded-xl p-5 space-y-3">
          <span className="text-xs font-black text-ok-400 uppercase tracking-caps flex items-center space-x-1.5">
            <Plus className="w-4 h-4" /> Criar Nova Sala
          </span>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Prefixo do código (ex.: NC-2020)"
            className="w-full bg-raised border border-field text-sm text-accent-300 font-mono px-3 py-2 rounded focus:border-ok-400 focus:outline-none uppercase"
          />
          <p className="text-micro text-subtle leading-relaxed">
            O código ganha um final aleatório (ex.: NC-2020-K7Q9XD) — é ele o convite, e ninguém o adivinha.
          </p>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Nome da mesa"
            className="w-full bg-raised border border-field text-xs text-fg-strong px-3 py-2 rounded focus:border-ok-400 focus:outline-none"
          />
          <button
            onClick={createRoom}
            disabled={!user || isBusy('create')}
            className="w-full py-2.5 bg-ok-500 hover:bg-ok-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-ok-500/40 transition-all cursor-pointer"
          >
            {isBusy('create') ? 'Criando…' : '🌐 Criar Mesa como GM'}
          </button>
        </div>

        {/* Entrar em sala */}
        <div className="bg-surface/80 border border-line rounded-xl p-5 space-y-3">
          <span className="text-xs font-black text-accent-400 uppercase tracking-caps flex items-center space-x-1.5">
            <Users className="w-4 h-4" /> Entrar em Sala
          </span>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Digite o código da sala"
            className="w-full bg-raised border border-field text-sm text-accent-300 font-mono px-3 py-2 rounded focus:border-accent-400 focus:outline-none uppercase"
          />
          <button
            onClick={() => joinRoom()}
            disabled={isBusy('join')}
            className="w-full py-2.5 bg-accent-500 hover:bg-accent-400 disabled:opacity-40 disabled:cursor-wait text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-accent-500/40 transition-all cursor-pointer"
          >
            {isBusy('join') ? 'Entrando…' : '🎮 Entrar na Mesa'}
          </button>
          <p className="text-micro text-subtle leading-relaxed">
            As mesas não aparecem numa lista: peça ao Mestre o código ou o link do convite.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-fault-950/60 border border-fault-500/50 p-3 rounded text-mini text-fault-300">{errorMsg}</div>
      )}
    </div>
  );
};
