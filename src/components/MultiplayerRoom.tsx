import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterSheet, RollResult } from '../types/cyberpunk';
import {
  RoomPlayer,
  ChatMessage,
  InitiativeEntry,
  TacticalGridState
} from '../types/multiplayer';
import { TacticalGrid } from './TacticalGrid';
import { YjsGridConnection, RemoteCursor } from '../lib/yjsConnection';
import { useRoomStore } from '../stores/useRoomStore';
import { useSheetStore } from '../stores/useSheetStore';
import { useRollStore } from '../stores/useRollStore';
import { useUiStore } from '../stores/useUiStore';
import {
  Radio,
  Users,
  MessageSquare,
  Send,
  Plus,
  LogOut,
  Dices,
  Skull,
  UserPlus,
  Crosshair,
  Eye,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MultiplayerRoomProps {
  onOpenAuthModal: () => void;
}

interface RoomTab {
  id: 'chat' | 'grid' | 'initiative';
  label: string;
}

function generatePeerId(): string {
  return 'peer_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

export const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({ onOpenAuthModal }) => {
  // Fase 4 (T4.3) — estado da sala vem da useRoomStore
  const view = useRoomStore((s) => s.view);
  const setView = useRoomStore((s) => s.setView);
  const roomCode = useRoomStore((s) => s.roomCode);
  const setRoomCode = useRoomStore((s) => s.setRoomCode);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const peerId = useRoomStore((s) => s.peerId);
  const setPeerId = useRoomStore((s) => s.setPeerId);
  const sessionToken = useRoomStore((s) => s.sessionToken);
  const setSessionToken = useRoomStore((s) => s.setSessionToken);
  const activeRooms = useRoomStore((s) => s.activeRooms);
  const setActiveRooms = useRoomStore((s) => s.setActiveRooms);
  const errorMsg = useRoomStore((s) => s.errorMsg);
  const setErrorMsg = useRoomStore((s) => s.setErrorMsg);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  // Fase 4 — dados da ficha/user/rolagem via stores (sem props)
  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);
  const addRoll = useRollStore((s) => s.addRoll);

  const [roomName, setRoomName] = useState('Mesa de Night City');
  const [chatInput, setChatInput] = useState('');
  const [tab, setTab] = useState<RoomTab['id']>('chat');
  // Fase 5 (T5.3) — grid vindo do doc CRDT (Yjs) e cursores remotos do GM
  const [yjsGrid, setYjsGrid] = useState<TacticalGridState | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const yjsConnRef = useRef<YjsGridConnection | null>(null);
  const yjsActiveRef = useRef(false);
  const [initiativeName, setInitiativeName] = useState('');
  const [initiativeScore, setInitiativeScore] = useState(10);
  const [selectedHealthPlayer, setSelectedHealthPlayer] = useState<RoomPlayer | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<RoomPlayer | null>(null);
  const [showRoomList, setShowRoomList] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Fase 5 (T5.2) — contador para retry do WebSocket após queda (backoff simples)
  const [wsAttempt, setWsAttempt] = useState(0);

  // Fase 3 (T3.3) — ref com o valor corrente do token para auto-reconexão sem closures stale
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  const reconnectInFlightRef = useRef<Promise<boolean> | null>(null);

  const handle = user?.displayName || sheet.handle || 'Edgerunner';
  // Fase 5 (T5.3) — refs correntes de peerId/handle para o effect de transporte
  // (não reconectar o WS quando a ficha muda de nome)
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;
  const handleRef = useRef(handle);
  handleRef.current = handle;
  const isGm = !!room && room.gmPeerId === peerId;
  const players = room?.players || {};
  const npcs = room?.npcs || {};

  const ensurePeerId = () => {
    const cur = useRoomStore.getState();
    if (!cur.peerId) {
      const id = generatePeerId();
      cur.setPeerId(id);
      sessionStorage.setItem('cyberpunk_peer_id', id);
      return id;
    }
    return cur.peerId;
  };

  // Fase 3 (T3.3) — re-join automático com o MESMO peerId após o servidor
  // reiniciar (token de sessão morre com o processo). O servidor reconhece a
  // reconexão e preserva a ficha persistida; aqui só trocamos o token novo.
  const reconnectSession = useCallback(async (): Promise<boolean> => {
    if (reconnectInFlightRef.current) return reconnectInFlightRef.current;
    const attempt = (async () => {
      try {
        const code = useRoomStore.getState().roomCode;
        const id = ensurePeerId();
        const curSheet = useSheetStore.getState().sheet;
        const curHandle = useSheetStore.getState().user?.displayName || curSheet.handle || 'Edgerunner';
        const res = await fetch('/api/rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, peerId: id, handle: curHandle, sheet: curSheet })
        });
        const data = await res.json();
        if (!res.ok) {
          useRoomStore.getState().setErrorMsg('Sessão expirada e reconexão falhou — a sala pode ter sido encerrada. Saia e entre novamente.');
          return false;
        }
        sessionTokenRef.current = data.sessionToken;
        useRoomStore.getState().setSessionToken(data.sessionToken);
        sessionStorage.setItem('cyberpunk_session_token', data.sessionToken);
        useRoomStore.getState().setRoom(data.room);
        useRoomStore.getState().setErrorMsg('');
        return true;
      } catch {
        useRoomStore.getState().setErrorMsg('Sessão expirada e reconexão falhou. Verifique a conexão com o servidor.');
        return false;
      }
    })();
    reconnectInFlightRef.current = attempt;
    try {
      return await attempt;
    } finally {
      reconnectInFlightRef.current = null;
    }
  }, [peerId, handle, sheet]);

  // POST autenticado com retry: se o servidor reiniciou e o token expirou (401
  // "Sessão inválida"), reconecta automaticamente e re-tenta a ação original.
  const authedFetch = useCallback(async (path: string, body: object): Promise<Response> => {
    const doFetch = () =>
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, sessionToken: sessionTokenRef.current })
      });
    let res = await doFetch();
    if (res.status === 401) {
      const reconnected = await reconnectSession();
      if (reconnected) res = await doFetch();
    }
    return res;
  }, [reconnectSession]);

  // Lista salas públicas no lobby
  useEffect(() => {
    if (view !== 'lobby') return;
    const load = () => {
      fetch('/api/rooms')
        .then((r) => r.json())
        .then((data) => useRoomStore.getState().setActiveRooms(data))
        .catch(() => useRoomStore.getState().setActiveRooms([]));
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [view]);    // Fase 5 (T5.2) — TRANSPORTE UNIFICADO: tenta WebSocket; se não conectar
  // (bloqueado/falhou), cai automaticamente para o SSE (EventSource). Ambos
  // entregam o MESMO payload (room inteiro em JSON).
  // Fase 5 (T5.3) — sobre o WS também trafega o protocolo binário do Yjs
  // (grid CRDT + awareness): binário → YjsGridConnection; texto → JSON.
  useEffect(() => {
    if (view !== 'active' || !roomCode) return;
    let disposed = false;

    const handlePayload = (raw: string) => {
      if (disposed) return;
      try {
        useRoomStore.getState().setRoom(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    };

    // Fallback SSE (comportamento original — auto-reconecta via EventSource)
    const connectSse = () => {
      const es = new EventSource(`/api/rooms/${roomCode}/stream`);
      eventSourceRef.current = es;
      es.onmessage = (ev) => handlePayload(ev.data);
      es.onerror = () => {
        // EventSource reconecta automaticamente
      };
      return es;
    };

    let sse: EventSource | null = null;
    let wsEverOpen = false;
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/rooms/${roomCode}?token=${encodeURIComponent(sessionToken)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      wsEverOpen = true;
      useRoomStore.getState().setErrorMsg('');
      // Fase 5 (T5.3) — ativa a camada CRDT do grid sobre este socket
      if (!yjsConnRef.current) {
        const conn = new YjsGridConnection(
          ws,
          peerIdRef.current,
          handleRef.current,
          {
            onGrid: (g) => {
              if (!disposed) setYjsGrid(g);
            },
            onCursors: (cursors) => {
              if (!disposed) setRemoteCursors(cursors);
            }
          }
        );
        yjsConnRef.current = conn;
        yjsActiveRef.current = true;
        conn.startSync();
      }
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        handlePayload(ev.data);
      } else if (yjsConnRef.current) {
        // Binário → protocolo Yjs (grid CRDT / awareness)
        yjsConnRef.current.handleBinary(ev.data as ArrayBuffer);
      }
    };
    ws.onerror = () => {
      // Sem conexão → o onclose decide o fallback SSE
    };
    ws.onclose = () => {
      if (disposed) return;
      wsRef.current = null;
      yjsConnRef.current = null;
      yjsActiveRef.current = false;
      if (!wsEverOpen && !sse) {
        // Nunca conectou → SSE (fallback automático)
        sse = connectSse();
      } else if (wsEverOpen) {
        // Caiu depois de conectar → reconecta em ~3s (token pode ter mudado
        // via T3.3; o effect re-roda quando o token novo chega).
        setTimeout(() => {
          if (!disposed) setWsAttempt((a) => a + 1);
        }, 3000);
      }
    };

    return () => {
      disposed = true;
      ws.onclose = null;
      yjsConnRef.current?.destroy();
      yjsConnRef.current = null;
      yjsActiveRef.current = false;
      if (wsRef.current === ws) wsRef.current = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      sse?.close();
      eventSourceRef.current = null;
    };
  }, [view, roomCode, sessionToken, wsAttempt]);

  /** Envia uma mensagem JSON pelo WS se conectado; false = usar fallback POST. */
  const wsSend = useCallback((msg: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  // Fase 3 (T3.4) + Fase 5 (T5.2) — heartbeat periódico: mantém isOnline=true
  // enquanto a aba está na mesa. Via WebSocket (baixa latência) ou POST como
  // fallback. O servidor marca offline após o timeout (ROOM_OFFLINE_TIMEOUT_MS).
  useEffect(() => {
    if (view !== 'active' || !roomCode || !peerId || !sessionToken) return;
    const beat = () => {
      if (wsSend({ type: 'heartbeat' })) return;
      authedFetch(`/api/rooms/${roomCode}/heartbeat`, {}).catch(() => {});
    };
    beat();
    const iv = setInterval(beat, 20_000); // 20s < timeout default de 60s
    return () => clearInterval(iv);
  }, [view, roomCode, peerId, sessionToken, authedFetch, wsSend]);

  // Sincroniza a ficha na mesa APENAS quando ela muda de fato.
  // (Antes dependia de `room`, que muda a cada evento SSE, criando um loop
  //  infinito: POST /sheet -> broadcast -> SSE -> POST /sheet...)
  const lastSyncedSheetRef = useRef<string>('');

  useEffect(() => {
    if (view !== 'active' || !peerId || !sessionToken || !roomCode) return;
    const sheetKey = JSON.stringify(sheet);
    if (sheetKey === lastSyncedSheetRef.current) return;
    lastSyncedSheetRef.current = sheetKey;
    const t = setTimeout(() => {
      // Fase 3 (T3.3) — authedFetch: se o token expirou (restart do servidor),
      // reconecta automaticamente e re-tenta o sync da ficha.
      authedFetch(`/api/rooms/${roomCode}/sheet`, { sheet }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [view, peerId, sessionToken, sheet, roomCode, authedFetch]);

  const createRoom = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!roomCode.trim()) {
      setErrorMsg('Informe um código de sala (ex.: NC-2020).');
      return;
    }
    const id = ensurePeerId();
    setErrorMsg('');
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode.trim(), name: roomName, gmHandle: handle, gmPeerId: id })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'Erro ao criar sala.');
        return;
      }
      useRoomStore.getState().setSessionToken(data.sessionToken);
      sessionStorage.setItem('cyberpunk_session_token', data.sessionToken);
      useRoomStore.getState().setRoom(data.room);
      useRoomStore.getState().setView('active');
    } catch (e) {
      setErrorMsg('Falha de conexão com o servidor.');
    }
  };

  const joinRoom = async (code?: string) => {
    const targetCode = (code || roomCode).trim();
    if (!targetCode) return;
    const id = ensurePeerId();
    setErrorMsg('');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode, peerId: id, handle, sheet })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'Sala não encontrada.');
        return;
      }
      useRoomStore.getState().setSessionToken(data.sessionToken);
      sessionStorage.setItem('cyberpunk_session_token', data.sessionToken);
      useRoomStore.getState().setRoomCode(targetCode);
      useRoomStore.getState().setRoom(data.room);
      useRoomStore.getState().setView('active');
    } catch (e) {
      setErrorMsg('Falha de conexão com o servidor.');
    }
  };

  const sendChat = async (text?: string, rollResult?: any) => {
    const content = (text ?? chatInput).trim();
    if (!content && !rollResult) return;
    if (text === undefined) setChatInput('');
    // Fase 5 (T5.2) — WebSocket quando disponível; fallback: POST autenticado
    if (wsSend({ type: 'message', text: content, rollResult })) return;
    try {
      await authedFetch(`/api/rooms/${roomCode}/message`, { text: content, rollResult });
    } catch {
      /* ignore */
    }
  };

  const rollDiceForTable = (diceFn: () => void) => {
    // Dispara a rolagem local e depois transmite o resultado pelo chat
    diceFn();
  };

  const rollAttack = () => {
    const ref = sheet.stats.REF;
    const wa = sheet.weapons[0]?.wa || 0;
    const d10 = Math.floor(Math.random() * 10) + 1;
    const total = d10 + ref + wa;
    const label = `Ataque (${sheet.weapons[0]?.name || 'desarmado'})`;
    const roll: RollResult = {
      id: 'roll_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      characterName: handle,
      rollType: 'SKILL',
      label,
      diceFormula: '1d10',
      baseRoll: d10,
      bonus: ref + wa,
      total,
      isCriticalSuccess: d10 === 10,
      isCriticalFailure: d10 === 1,
      details: `1d10: ${d10} + REF (${ref}) + WA (${wa}) = ${total}`
    };
    addRoll(roll);
    sendChat(undefined, roll);
  };

  // Helper: ações autenticadas por token de sessão (T1.7), com auto-reconexão
  // na Fase 3 (T3.3) via authedFetch (401 → re-join com mesmo peerId → retry).
  const roomAction = (path: string, body: object) => {
    authedFetch(path, body)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          setErrorMsg(data?.error || 'Ação negada pelo servidor.');
        }
      })
      .catch(() => {});
  };

  // Fase 5 (T5.3) — grid editado pelo TacticalGrid:
  // - Yjs ativo → escreve no doc CRDT (latência zero, o servidor espelha e
  //   propaga para a mesa); jogador só move o próprio token (validado lá).
  // - Fallback (SSE/REST) → endpoint antigo /tactical-grid.
  const updateGrid = (gridState: TacticalGridState) => {
    if (yjsConnRef.current) {
      yjsConnRef.current.applyLocalGrid(gridState);
      return;
    }
    roomAction(`/api/rooms/${roomCode}/tactical-grid`, { gridState });
  };

  // GM: publica o cursor no grid via awareness Yjs (T5.3)
  const handleGmCursorMove = (x: number | null, y: number | null) => {
    if (!isGm) return;
    const conn = yjsConnRef.current;
    if (!conn) return;
    if (x === null || y === null) conn.clearCursor();
    else conn.setCursor(x, y);
  };

  const generateNpc = (archetypeId?: string) => {
    roomAction(`/api/rooms/${roomCode}/npcs/generate`, { archetypeId });
  };

  const generatePlayerEdgerunner = () => {
    roomAction(`/api/rooms/${roomCode}/players/generate`, {});
  };

  const updatePlayerHealth = (targetPeerId: string, woundLevel: number) => {
    roomAction(`/api/rooms/${roomCode}/player-health`, { targetPeerId, woundLevel });
  };

  const updateNpcHealth = (npcId: string, woundLevel: number) => {
    roomAction(`/api/rooms/${roomCode}/npcs/${npcId}/health`, { woundLevel });
  };

  const deleteNpc = (npcId: string) => {
    roomAction(`/api/rooms/${roomCode}/npcs/${npcId}/delete`, {});
  };

  const deletePlayer = (targetPeerId: string) => {
    roomAction(`/api/rooms/${roomCode}/players/${targetPeerId}/delete`, {});
  };

  const addInitiative = () => {
    if (!initiativeName.trim()) return;
    const list: InitiativeEntry[] = [
      ...(room?.initiativeList || []),
      {
        playerId: 'init_' + Date.now(),
        handle: initiativeName.trim(),
        role: '—',
        score: initiativeScore,
        isCurrentTurn: false
      }
    ].sort((a, b) => b.score - a.score);
    roomAction(`/api/rooms/${roomCode}/initiative`, { initiativeList: list });
    setInitiativeName('');
  };

  const nextTurn = () => {
    roomAction(`/api/rooms/${roomCode}/initiative`, { action: 'next' });
  };

  const leaveRoom = async () => {
    const { roomCode: code, sessionToken: token } = useRoomStore.getState();
    if (code && token) {
      // T3.3 — authedFetch: após restart, "Sair" reconecta (token novo) e
      // então sai de fato — evita deixar player fantasma online na sala.
      await authedFetch(`/api/rooms/${code}/leave`, {}).catch(() => {});
    }
    sessionStorage.removeItem('cyberpunk_session_token');
    resetRoom();
  };

  /* ============================================================
     LOBBY
     ============================================================ */
  if (view === 'lobby') {
    return (
      <div className="space-y-5 font-mono animate-fadeIn">
        <div className="bg-slate-950/90 border-l-4 border-emerald-500 border-y border-r border-slate-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-emerald-500 select-none">
            NET_LOBBY
          </div>
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-12 h-12 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Radio className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-400 uppercase tracking-widest">Mesa Multiplayer</h2>
              <p className="text-[10px] text-slate-500">Crie ou entre em uma sala em tempo real</p>
            </div>
          </div>
        </div>

        {!user && (
          <div className="bg-yellow-950/40 border border-yellow-500/50 p-4 rounded-xl text-xs font-mono text-yellow-300 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>Você está no modo visitante. Faça login para criar salas como GM.</span>
            <button onClick={onOpenAuthModal} className="ml-auto px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[10px] uppercase rounded cursor-pointer transition-all shrink-0">
              Acessar Conta
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Criar sala */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center space-x-1.5">
              <Plus className="w-4 h-4" /> Criar Nova Sala
            </span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Código da sala (ex.: NC-2020)"
              className="w-full bg-slate-900 border border-slate-700 text-sm text-cyan-300 font-mono px-3 py-2 rounded focus:border-emerald-400 focus:outline-none uppercase"
            />
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nome da mesa"
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 px-3 py-2 rounded focus:border-emerald-400 focus:outline-none"
            />
            <button
              onClick={createRoom}
              disabled={!user}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
            >
              🌐 Criar Mesa como GM
            </button>
          </div>

          {/* Entrar em sala */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center space-x-1.5">
              <Users className="w-4 h-4" /> Entrar em Sala
            </span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Digite o código da sala"
              className="w-full bg-slate-900 border border-slate-700 text-sm text-cyan-300 font-mono px-3 py-2 rounded focus:border-cyan-400 focus:outline-none uppercase"
            />
            <button
              onClick={() => joinRoom()}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
            >
              🎮 Entrar na Mesa
            </button>

            <button
              onClick={() => setShowRoomList(!showRoomList)}
              className="w-full py-1.5 text-[10px] text-slate-400 hover:text-cyan-300 uppercase flex items-center justify-center space-x-1 transition-all cursor-pointer"
            >
              {showRoomList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>Salas ativas ({activeRooms.length})</span>
            </button>

            {showRoomList && (
              <div className="space-y-1.5 animate-fadeIn">
                {activeRooms.map((r) => (
                  <div key={r.code} className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded px-3 py-2">
                    <div>
                      <span className="text-xs font-black text-cyan-300 font-mono">{r.code}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{r.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[9px] text-slate-500">{r.playersCount} jog.</span>
                      <button
                        onClick={() => joinRoom(r.code)}
                        className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[9px] uppercase rounded cursor-pointer transition-all"
                      >
                        Entrar
                      </button>
                    </div>
                  </div>
                ))}
                {activeRooms.length === 0 && (
                  <div className="text-center py-3 text-[10px] text-slate-600">Nenhuma sala ativa no momento.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-500/50 p-3 rounded text-[11px] font-mono text-red-300">{errorMsg}</div>
        )}
      </div>
    );
  }

  /* ============================================================
     SALA ATIVA
     ============================================================ */
  const chatMessages: ChatMessage[] = room?.chatMessages || [];
  const initiative = room?.initiativeList || [];
  const gridState = yjsGrid || room?.tacticalGrid || { rows: 8, cols: 10, theme: 'alley', tokens: [] };

  return (
    <div className="space-y-4 font-mono animate-fadeIn">
      {errorMsg && (
        <div className="bg-red-950/70 border border-red-500/50 p-3 rounded-lg text-[11px] font-mono text-red-300 animate-fadeIn">
          {errorMsg}
        </div>
      )}
      {/* Header da sala */}
      <div className="bg-slate-950/90 border-l-4 border-emerald-500 border-y border-r border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white uppercase tracking-wider">{room?.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold font-mono">
                {roomCode}
              </span>
              {isGm && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 border border-red-500/60 text-red-300 font-black uppercase">
                  GM
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">{room?.locationName || 'Night City'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>{Object.keys(players).length} jogadores</span>
          </span>
          <button
            onClick={leaveRoom}
            className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-600/60 text-red-300 rounded font-bold text-[10px] uppercase flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5">
        {([
          { id: 'chat' as const, label: '💬 Chat' },
          { id: 'grid' as const, label: '🗺️ Grid Tático' },
          { id: 'initiative' as const, label: '⚔️ Iniciativa' }
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-lg border-2 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-emerald-500/50 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CHAT */}
      {tab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[540px]">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4" /> Chat da Mesa
              </span>
              <span className="text-[9px] text-slate-500">{chatMessages.length} mensagens</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderHandle === 'SISTEMA_NET' ? 'justify-center' : ''}`}>
                  {msg.senderHandle === 'SISTEMA_NET' ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded px-3 py-1.5 text-[9px] text-slate-400 text-center font-mono max-w-[90%]">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-[85%] space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-[9px] font-mono">
                        <span className={msg.senderRole === 'gm' ? 'text-red-400 font-black' : 'text-cyan-300 font-bold'}>
                          {msg.senderRole === 'gm' ? '👑' : '🔹'} {msg.senderHandle}
                        </span>
                        <span className="text-slate-600">{msg.timestamp}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed font-sans ${
                        msg.senderRole === 'gm'
                          ? 'bg-red-950/50 border border-red-800/60 text-red-100'
                          : 'bg-slate-900 border border-slate-700 text-slate-200'
                      }`}>
                        {msg.isDiceRoll && msg.rollResult ? (
                          <div>
                            <span className="font-mono font-black text-yellow-400">
                              🎲 {msg.rollResult.label}: {msg.rollResult.total}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">{msg.rollResult.details}</p>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div className="text-center py-10 text-[10px] text-slate-600">A mesa está em silêncio... Quebre o gelo!</div>
              )}
            </div>
            <div className="border-t border-slate-800 p-3 flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Mensagem para a mesa..."
                className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-2.5 rounded focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
              />
              <button
                onClick={() => sendChat()}
                className="px-3.5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded font-black uppercase cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => rollDiceForTable(rollAttack)}
                title="Rolar ataque na mesa"
                className="px-3.5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-black uppercase cursor-pointer transition-all"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lateral: jogadores & NPCs */}
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block mb-2">
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
                    className="bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-cyan-500/40 transition-all"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-xs font-bold text-white truncate">{p.handle}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-yellow-400 shrink-0">
                        {p.role}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => setInspectedPlayer(p)}
                        title="Inspecionar ficha"
                        className="p-1 rounded bg-slate-950 border border-slate-700 text-slate-400 hover:text-cyan-400 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      {isGm && p.peerId !== peerId && (
                        <button
                          onClick={() => setSelectedHealthPlayer(p)}
                          title="Editar bio-monitor"
                          className="p-1 rounded bg-slate-950 border border-slate-700 text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isGm && (
              <div className="bg-slate-950/80 border border-red-500/40 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">Poderes do GM</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => generateNpc()}
                    className="px-2 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 rounded font-bold text-[9px] uppercase flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <Skull className="w-3 h-3" />
                    <span>Gerar NPC</span>
                  </button>
                  <button
                    onClick={generatePlayerEdgerunner}
                    className="px-2 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 rounded font-bold text-[9px] uppercase flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Gerar Jogador</span>
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  <span className="text-[9px] text-slate-500 uppercase">NPCs ({Object.keys(npcs).length})</span>
                  {Object.values(npcs).map((n) => (
                    <div key={n.peerId} className="bg-slate-900/70 border border-slate-800 rounded px-2 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-red-200 font-bold truncate">{n.handle}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => updateNpcHealth(n.peerId, Math.min(10, n.sheet.woundLevel + 1))}
                          className="text-[9px] px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-red-400 cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          onClick={() => deleteNpc(n.peerId)}
                          className="text-[9px] px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-400 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(npcs).length === 0 && (
                    <div className="text-center py-2 text-[9px] text-slate-600">Sem NPCs na mesa.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRID TÁTICO */}
      {tab === 'grid' && (
        <div className="space-y-3">
          {isGm && (
            <div className="bg-slate-950/60 border border-slate-800 rounded p-2.5 text-[10px] text-slate-400 font-mono">
              💡 Arraste as fichas da barra lateral diretamente para o grid, ou use os controles do grid para adicionar NPCs, cobertura e perigos.
            </div>
          )}
          <TacticalGrid
            gridState={gridState}
            roleMode={isGm ? 'gm' : 'player'}
            peerId={peerId}
            players={players}
            onUpdateGrid={updateGrid}
            onSelectPlayerForHealthEdit={isGm ? (p) => setSelectedHealthPlayer(p) : undefined}
            onInspectPlayer={(p) => setInspectedPlayer(p)}
            remoteCursors={remoteCursors}
            onCursorMove={handleGmCursorMove}
          />
        </div>
      )}

      {/* INICIATIVA */}
      {tab === 'initiative' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">Ordem de Iniciativa</span>
              <span className="text-[9px] text-slate-500">{initiative.length} entradas</span>
            </div>
            <div className="divide-y divide-slate-900">
              {initiative.map((entry, idx) => (
                <div
                  key={entry.playerId}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    entry.isCurrentTurn ? 'bg-yellow-950/40 border-l-4 border-l-yellow-400' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-[9px] text-slate-500 w-6">{idx + 1}º</span>
                    <span className={`text-xs font-bold ${entry.isCurrentTurn ? 'text-yellow-300' : 'text-white'}`}>
                      {entry.handle}
                    </span>
                    {entry.isCurrentTurn && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-yellow-400 text-black rounded font-black uppercase">Vez</span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-black text-cyan-300">{entry.score}</span>
                </div>
              ))}
              {initiative.length === 0 && (
                <div className="text-center py-10 text-[10px] text-slate-600">Adicione combatentes para iniciar a rodada.</div>
              )}
            </div>
            {initiative.length > 0 && (
              <div className="p-3 border-t border-slate-800">
                <button
                  onClick={nextTurn}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase rounded cursor-pointer transition-all"
                >
                  ⚔️ Próximo Turno
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">Adicionar Combatente</span>
            <input
              type="text"
              value={initiativeName}
              onChange={(e) => setInitiativeName(e.target.value)}
              placeholder="Nome / handle"
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 px-3 py-2 rounded focus:border-yellow-400 focus:outline-none"
            />
            <input
              type="number"
              value={initiativeScore}
              onChange={(e) => setInitiativeScore(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-yellow-400 px-3 py-2 rounded focus:border-yellow-400 focus:outline-none"
            />
            <button
              onClick={addInitiative}
              disabled={!initiativeName.trim()}
              className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-black text-[10px] uppercase rounded cursor-pointer transition-all"
            >
              + Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Modal: editar saúde (GM) */}
      {selectedHealthPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedHealthPlayer(null)}>
          <div className="bg-slate-950 border-2 border-red-500/60 rounded-2xl p-6 w-full max-w-sm font-mono shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-red-400 uppercase tracking-widest mb-3">
              Bio-Monitor // {selectedHealthPlayer.handle}
            </h3>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {Array.from({ length: 11 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => updatePlayerHealth(selectedHealthPlayer.peerId, i)}
                  className={`aspect-square rounded border-2 text-[10px] font-black font-mono cursor-pointer transition-all ${
                    i <= selectedHealthPlayer.sheet.woundLevel
                      ? 'border-red-500 bg-red-950/80 text-red-300'
                      : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-red-500/50'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedHealthPlayer(null)}
              className="w-full py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded text-[10px] uppercase cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal: inspecionar ficha */}
      {inspectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setInspectedPlayer(null)}>
          <div className="bg-slate-950 border-2 border-cyan-500/60 rounded-2xl p-6 w-full max-w-md font-mono shadow-[0_0_30px_rgba(6,182,212,0.3)] max-h-[80vh] overflow-y-auto custom-scrollbar animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{inspectedPlayer.handle}</h3>
              <span className="text-[9px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-yellow-400">{inspectedPlayer.role}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {(Object.keys(inspectedPlayer.sheet.stats) as (keyof typeof inspectedPlayer.sheet.stats)[]).map((k) => (
                <div key={k} className="bg-slate-900 border border-slate-800 rounded p-1.5 text-center">
                  <span className="text-[8px] text-slate-500 block">{k}</span>
                  <span className="text-xs font-black text-yellow-400">{inspectedPlayer.sheet.stats[k]}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 space-y-1">
              <p>💥 Ferimento: <span className="text-red-300 font-bold">{inspectedPlayer.sheet.woundLevel}/10</span></p>
              <p>💰 €$ {inspectedPlayer.sheet.eurodollars.toLocaleString()}</p>
              <p>🔫 Armas: {inspectedPlayer.sheet.weapons.map(w => w.name).join(', ') || 'nenhuma'}</p>
              <p>🦾 Ciberware: {inspectedPlayer.sheet.cyberware.length} itens</p>
            </div>
            <button
              onClick={() => setInspectedPlayer(null)}
              className="w-full mt-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded text-[10px] uppercase cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
