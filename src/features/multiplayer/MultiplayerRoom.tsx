import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CharacterSheet } from '../../types/cyberpunk';
import {
  RoomPlayer,
  ChatMessage,
  InitiativeEntry,
  TableRollKind,
  TacticalGridState,
  TacticalToken
} from '../../types/multiplayer';
import { TacticalGrid } from './TacticalGrid';
import { CombatPanel } from './CombatPanel';
import { YjsGridConnection, RemoteCursor } from '../../lib/yjsConnection';
import { trailingThrottle } from '../../lib/throttle';
import { useRoomStore } from '../../stores/useRoomStore';
import { useSheetStore } from '../../stores/useSheetStore';
import { woundStateOf } from '../../rules/damage';
import { mortalLevel, woundRow } from '../../rules/character';
import { useUiStore } from '../../stores/useUiStore';
// Fase 7 (T7.3) — camada HTTP centralizada (sem fetch cru no componente)
import * as roomsApi from '../../api/rooms';
import { apiUrl, wsUrl } from '../../api/base';
import {
  Radio,
  Users,
  MessageSquare,
  Send,
  Plus,
  LogOut,
  Skull,
  UserPlus,
  Crosshair,
  Eye,
  Lock,
  Link2,
  Target,
  Zap,
  HeartPulse
} from 'lucide-react';

interface MultiplayerRoomProps {
  onOpenAuthModal: () => void;
}

interface RoomTab {
  id: 'chat' | 'grid' | 'initiative';
  label: string;
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
  const errorMsg = useRoomStore((s) => s.errorMsg);
  const setErrorMsg = useRoomStore((s) => s.setErrorMsg);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  // Fase 4 — dados da ficha/user/rolagem via stores (sem props)
  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);
  const updateSheet = useSheetStore((s) => s.updateSheet);

  // D.1 (decisão 7a) — na mesa, o ferimento é do servidor: quando o GM aplica
  // dano ou ajusta o Bio-Monitor, a ficha local acompanha (e é salva com ele).
  // Sem loop: a sincronia da ficha não leva o ferimento de volta.
  const tableSheet = view === 'active' && peerId ? room?.players?.[peerId]?.sheet : undefined;
  // D.5 — a estabilização também é do servidor, e vem junto.
  const serverWound = tableSheet ? { ...woundStateOf(tableSheet), isStabilized: tableSheet.isStabilized === true } : null;
  const localWound = woundStateOf(sheet);
  const woundDiffers =
    !!serverWound &&
    (serverWound.damagePoints !== localWound.damagePoints ||
      serverWound.isDead !== localWound.isDead ||
      serverWound.isStabilized !== (sheet.isStabilized === true) ||
      sheet.damagePoints === undefined);
  useEffect(() => {
    if (woundDiffers && serverWound) updateSheet(serverWound);
    // O gatilho é a divergência e os valores do servidor, não o objeto (novo a cada render).
  }, [woundDiffers, serverWound?.damagePoints, serverWound?.isDead, serverWound?.isStabilized]);

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
  // R.11 — o convite que o GM copia (o link /room/CÓDIGO). Se o navegador não
  // deixar copiar, o link aparece para seleção manual.
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Fase 5 (T5.2) — contador para retry do WebSocket após queda (backoff simples)
  const [wsAttempt, setWsAttempt] = useState(0);


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

  const ensurePeerId = roomsApi.getPeerId;

  // R.11 — o lobby não lista salas (entra-se pelo código ou pelo link do GM).
  // Aqui havia uma consulta a /api/rooms a cada 8 s, com a aba do lobby
  // aberta: além de mostrar a sala de todo mundo a qualquer visitante, era uma
  // das duas coisas que mantinham o Render acordado (risco 1 do custo zero).

  // Fase 5 (T5.2) — TRANSPORTE UNIFICADO: tenta WebSocket; se não conectar
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
        const parsed = JSON.parse(raw);
        // Fase 5 (T5.4) — respostas de erro do servidor (roll-error / error)
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string' &&
            (parsed.type === 'roll-error' || parsed.type === 'error')) {
          useRoomStore.getState().setErrorMsg(String(parsed.error || 'Ação rejeitada pelo servidor.'));
          return;
        }
        useRoomStore.getState().setRoom(parsed);
      } catch {
        /* ignore */
      }
    };

    // Fallback SSE (comportamento original — auto-reconecta via EventSource)
    const connectSse = () => {
      // T10.2 — frontend estático: base do backend vem de VITE_API_URL
      // Fase B (B.3 — SEC-02): o stream passou a exigir sessão. O token vai na
      // query porque `EventSource` não aceita header customizado — mesma
      // limitação que o WebSocket já contorna do mesmo jeito, logo abaixo.
      const es = new EventSource(
        apiUrl(`/api/rooms/${roomCode}/stream?token=${encodeURIComponent(sessionToken)}`)
      );
      eventSourceRef.current = es;
      es.onmessage = (ev) => handlePayload(ev.data);
      es.onerror = () => {
        // EventSource reconecta automaticamente
      };
      return es;
    };

    let sse: EventSource | null = null;
    let wsEverOpen = false;
    const socketUrl = wsUrl(`/ws/rooms/${roomCode}?token=${encodeURIComponent(sessionToken)}`);
    const ws = new WebSocket(socketUrl);
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
      roomsApi.postHeartbeat(roomCode).catch(() => {});
    };
    beat();
    const iv = setInterval(beat, 20_000); // 20s < timeout default de 60s
    return () => clearInterval(iv);
  }, [view, roomCode, peerId, sessionToken, wsSend]);

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
      roomsApi.syncSheet(roomCode, sheet).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [view, peerId, sessionToken, sheet, roomCode]);

  const createRoom = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!roomCode.trim()) {
      setErrorMsg('Informe um código de sala (ex.: NC-2020).');
      return;
    }
    setErrorMsg('');
    try {
      await roomsApi.createRoom({ code: roomCode.trim(), name: roomName, gmHandle: handle });
      useRoomStore.getState().setView('active');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao criar sala.');
    }
  };

  const joinRoom = async (code?: string) => {
    const targetCode = (code || roomCode).trim();
    if (!targetCode) return;
    setErrorMsg('');
    try {
      await roomsApi.joinRoom({ code: targetCode, handle, sheet });
      useRoomStore.getState().setView('active');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Sala não encontrada.');
    }
  };

  const sendChat = async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;
    if (text === undefined) setChatInput('');
    // Fase 5 (T5.2) — WebSocket quando disponível; fallback: POST autenticado.
    // T5.4 — sem rollResult: rolagens só existem via { type: 'roll' }.
    if (wsSend({ type: 'message', text: content })) return;
    try {
      await roomsApi.postMessage(roomCode, content);
    } catch {
      /* ignore */
    }
  };

  // Fase 5 (T5.4) — RNG SERVER-AUTHORITATIVE: o cliente só pede o tipo de
  // rolagem; o servidor rola os dados (crypto.randomInt) usando a ficha que
  // ELE possui e o resultado volta no broadcast do chat. WS-first, fallback
  // POST /roll (clientes SSE).
  const requestTableRoll = (kind: TableRollKind, skillName?: string) => {
    if (wsSend({ type: 'roll', kind, skillName })) return;
    roomsApi.postRoll(roomCode, kind, skillName).catch(() => {});
  };

  const rollAttack = () => requestTableRoll('attack');
  const rollTableDamage = () => requestTableRoll('damage');
  const rollTableSave = () => requestTableRoll('save');
  const rollTableStun = () => requestTableRoll('stun');

  // Helper: ação autenticada fire-and-forget (T7.3 — camada api). A api lança
  // ApiError com a mensagem do servidor; o banner mostra o motivo.
  const roomAction = (p: Promise<unknown>) => {
    p.catch((e: any) => setErrorMsg(e?.message || 'Ação negada pelo servidor.'));
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
    roomAction(roomsApi.updateTacticalGrid(roomCode, gridState));
  };

  // GM: publica o cursor no grid via awareness Yjs (T5.3). R.4 — no máximo um
  // envio a cada 60 ms, sempre a última posição: ia a cada mousemove (~60/s),
  // e o servidor passou a aceitar ~20/s de awareness por jogador.
  const sendCursor = useMemo(
    () =>
      trailingThrottle((x: number | null, y: number | null) => {
        const conn = yjsConnRef.current;
        if (!conn) return;
        if (x === null || y === null) conn.clearCursor();
        else conn.setCursor(x, y);
      }, 60),
    []
  );
  useEffect(() => () => sendCursor.cancel(), [sendCursor]);
  const handleGmCursorMove = (x: number | null, y: number | null) => {
    if (!isGm) return;
    sendCursor(x, y);
  };

  const generateNpc = (archetypeId?: string) => {
    roomAction(roomsApi.generateNpc(roomCode, archetypeId));
  };

  const generatePlayerEdgerunner = () => {
    roomAction(roomsApi.generatePlayers(roomCode));
  };

  const updatePlayerHealth = (targetPeerId: string, woundLevel: number) => {
    roomAction(roomsApi.setPlayerHealth(roomCode, targetPeerId, woundLevel));
  };

  const updateNpcHealth = (npcId: string, woundLevel: number) => {
    roomAction(roomsApi.setNpcHealth(roomCode, npcId, woundLevel));
  };

  // Fase D (D.3) — combate no cartão do token. O servidor faz toda a conta;
  // aqui só se escolhe quem, onde e de onde. Token sem ficha não recebe dano
  // (D.2), então o painel nem aparece para ele.
  const renderTokenCombat = (token: TacticalToken) => {
    const ownerId = token.peerId;
    const owner = ownerId ? room?.players?.[ownerId] ?? room?.npcs?.[ownerId] : undefined;
    if (!owner) {
      return <p className="text-[10px] text-subtle border-t border-line pt-2">Token sem ficha: não recebe dano.</p>;
    }
    const attackers = Object.values(room?.npcs ?? {}).filter((n) => n.peerId !== ownerId && !n.sheet?.isDead);
    const wound = woundStateOf(owner.sheet ?? {});
    // Só dano rolado por JOGADOR: o do ataque de NPC (mensagem do sistema) o
    // servidor já aplicou, e oferecê-lo aqui convidaria a aplicar duas vezes.
    const lastDamageRoll = [...(room?.chatMessages ?? [])]
      .reverse()
      .find((m) => m.senderHandle !== 'SISTEMA_NET' && m.rollResult?.rollType === 'DAMAGE' && m.rollResult.hitLocation)?.rollResult;
    return (
      <CombatPanel
        key={token.id}
        targetId={token.id}
        targetName={owner.handle}
        attackers={attackers}
        lastDamageRoll={lastDamageRoll}
        onAttack={(input) => roomAction(roomsApi.gmAttack(roomCode, input))}
        onApplyDamage={(targetId, raw, location) => roomAction(roomsApi.applyDamage(roomCode, targetId, raw, location))}
        status={{
          label: woundRow(wound.woundLevel).name,
          points: wound.damagePoints,
          isMortal: mortalLevel(wound.woundLevel) !== null,
          isDead: wound.isDead,
          isStabilized: owner.sheet?.isStabilized === true
        }}
        onToggleStabilized={(targetId, value) => roomAction(roomsApi.setStabilized(roomCode, targetId, value))}
      />
    );
  };

  const deleteNpc = (npcId: string) => {
    roomAction(roomsApi.deleteNpc(roomCode, npcId));
  };

  const deletePlayer = (targetPeerId: string) => {
    roomAction(roomsApi.deletePlayer(roomCode, targetPeerId));
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
    roomAction(roomsApi.setInitiativeList(roomCode, list));
    setInitiativeName('');
  };

  const nextTurn = () => {
    roomAction(roomsApi.nextTurn(roomCode));
  };

  // R.11 — sem a lista do lobby, o convite é o link /room/CÓDIGO.
  const inviteLink = `${window.location.origin}/room/${roomCode}`;
  const copyInvite = () => {
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => setInviteState('copied'))
      .catch(() => setInviteState('manual'));
  };

  const leaveRoom = async () => {
    const { roomCode: code, sessionToken: token } = useRoomStore.getState();
    if (code && token) {
      // T3.3 — authedFetch: após restart, "Sair" reconecta (token novo) e
      // então sai de fato — evita deixar player fantasma online na sala.
      await roomsApi.leaveRoom(code).catch(() => {});
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
        <div className="bg-surface/90 border-l-4 border-y border-r border-line rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-ok-500 select-none">
            NET_LOBBY
          </div>
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-12 h-12 rounded-lg bg-ok-950 border border-ok-500/60 flex items-center justify-center shadow-glow-15 shadow-ok-500/40">
              <Radio className="w-6 h-6 text-ok-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ok-400 uppercase tracking-widest">Mesa Multiplayer</h2>
              <p className="text-[10px] text-subtle">Crie ou entre em uma sala em tempo real</p>
            </div>
          </div>
        </div>

        {!user && (
          <div className="bg-signal-950/40 border border-signal-500/50 p-4 rounded-xl text-xs font-mono text-signal-300 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-signal-400 shrink-0" />
            <span>Você está no modo visitante. Faça login para criar salas como GM.</span>
            <button onClick={onOpenAuthModal} className="ml-auto px-3 py-1.5 bg-signal-400 hover:bg-signal-300 text-black font-black text-[10px] uppercase rounded cursor-pointer transition-all shrink-0">
              Acessar Conta
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Criar sala */}
          <div className="bg-surface/80 border border-line rounded-xl p-5 space-y-3">
            <span className="text-xs font-black text-ok-400 uppercase tracking-widest flex items-center space-x-1.5">
              <Plus className="w-4 h-4" /> Criar Nova Sala
            </span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Prefixo do código (ex.: NC-2020)"
              className="w-full bg-raised border border-line-strong text-sm text-accent-300 font-mono px-3 py-2 rounded focus:border-ok-400 focus:outline-none uppercase"
            />
            <p className="text-[10px] text-subtle leading-relaxed">
              O código ganha um final aleatório (ex.: NC-2020-K7Q9XD) — é ele o convite, e ninguém o adivinha.
            </p>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nome da mesa"
              className="w-full bg-raised border border-line-strong text-xs text-fg-strong px-3 py-2 rounded focus:border-ok-400 focus:outline-none"
            />
            <button
              onClick={createRoom}
              disabled={!user}
              className="w-full py-2.5 bg-ok-500 hover:bg-ok-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-ok-500/40 transition-all cursor-pointer"
            >
              🌐 Criar Mesa como GM
            </button>
          </div>

          {/* Entrar em sala */}
          <div className="bg-surface/80 border border-line rounded-xl p-5 space-y-3">
            <span className="text-xs font-black text-accent-400 uppercase tracking-widest flex items-center space-x-1.5">
              <Users className="w-4 h-4" /> Entrar em Sala
            </span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Digite o código da sala"
              className="w-full bg-raised border border-line-strong text-sm text-accent-300 font-mono px-3 py-2 rounded focus:border-accent-400 focus:outline-none uppercase"
            />
            <button
              onClick={() => joinRoom()}
              className="w-full py-2.5 bg-accent-500 hover:bg-accent-400 text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-accent-500/40 transition-all cursor-pointer"
            >
              🎮 Entrar na Mesa
            </button>
            <p className="text-[10px] text-subtle leading-relaxed">
              As mesas não aparecem numa lista: peça ao Mestre o código ou o link do convite.
            </p>
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
      <div className="bg-surface/90 border-l-4 border-y border-r border-line rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-ok-950 border border-ok-500/60 flex items-center justify-center">
            <Radio className="w-5 h-5 text-ok-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white uppercase tracking-wider">{room?.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-raised border border-line-strong text-accent-300 font-bold font-mono select-all">
                {roomCode}
              </span>
              {isGm && (
                <button
                  onClick={copyInvite}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-raised border border-accent-700/60 text-accent-300 hover:border-accent-400 font-bold uppercase flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Link2 className="w-3 h-3" />
                  <span>{inviteState === 'copied' ? 'Link copiado' : 'Copiar convite'}</span>
                </button>
              )}
              {isGm && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 border border-red-500/60 text-red-300 font-black uppercase">
                  GM
                </span>
              )}
            </div>
            <p className="text-[10px] text-subtle">{room?.locationName || 'Night City'}</p>
            {isGm && inviteState === 'manual' && (
              <p className="text-[10px] text-accent-300 font-mono select-all break-all">{inviteLink}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-muted flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-accent-400" />
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
                ? 'bg-ok-600 text-white border-ok-400 shadow-glow-12 shadow-ok-500/50'
                : 'bg-surface text-muted border-line hover:border-ok-500/50 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CHAT */}
      {tab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface/80 border border-line rounded-xl overflow-hidden flex flex-col h-[540px]">
            <div className="flex items-center justify-between p-3 border-b border-line">
              <span className="text-xs font-black text-accent-400 uppercase tracking-widest flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4" /> Chat da Mesa
              </span>
              <span className="text-[9px] text-subtle">{chatMessages.length} mensagens</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderHandle === 'SISTEMA_NET' ? 'justify-center' : ''}`}>
                  {msg.senderHandle === 'SISTEMA_NET' ? (
                    <div className="bg-raised/60 border border-line rounded px-3 py-1.5 text-[9px] text-muted text-center font-mono max-w-[90%]">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-[85%] space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-[9px] font-mono">
                        <span className={msg.senderRole === 'gm' ? 'text-red-400 font-black' : 'text-accent-300 font-bold'}>
                          {msg.senderRole === 'gm' ? '👑' : '🔹'} {msg.senderHandle}
                        </span>
                        <span className="text-faint">{msg.timestamp}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed font-sans ${
                        msg.senderRole === 'gm'
                          ? 'bg-red-950/50 border border-red-800/60 text-red-100'
                          : 'bg-raised border border-line-strong text-fg'
                      }`}>
                        {msg.isDiceRoll && msg.rollResult ? (
                          <div>
                            <span className="font-mono font-black text-signal-400">
                              🎲 {msg.rollResult.label}: {msg.rollResult.total}
                            </span>
                            <p className="text-[10px] text-muted mt-1">{msg.rollResult.details}</p>
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
                <div className="text-center py-10 text-[10px] text-faint">A mesa está em silêncio... Quebre o gelo!</div>
              )}
            </div>
            <div className="border-t border-line p-3 flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Mensagem para a mesa..."
                className="flex-1 bg-raised border border-line-strong text-fg-strong text-xs px-3 py-2.5 rounded focus:border-accent-400 focus:outline-none placeholder:text-faint"
              />
              <button
                onClick={() => sendChat()}
                className="px-3.5 py-2.5 bg-accent-500 hover:bg-accent-400 text-black rounded font-black uppercase cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={rollAttack}
                title="🎯 Ataque — d10 + REF + perícia da arma + WA (RNG no servidor)"
                className="px-3 py-2.5 bg-signal-500 hover:bg-signal-400 text-black rounded font-black uppercase cursor-pointer transition-all"
              >
                <Target className="w-4 h-4" />
              </button>
              <button
                onClick={rollTableDamage}
                title="💥 Dano da arma + local de impacto (RNG no servidor)"
                className="px-3 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded font-black uppercase cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                onClick={rollTableStun}
                title="💫 Stun Save — 1d10 ≤ BODY − 0 a 9 pelo ferimento (RNG no servidor)"
                aria-label="Stun Save"
                className="px-3 py-2.5 bg-caution-500 hover:bg-caution-400 text-black rounded font-black uppercase cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={rollTableSave}
                title="🩸 Death Save — 1d10 ≤ BODY − nível Mortal (RNG no servidor)"
                className="px-3 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded font-black uppercase cursor-pointer transition-all"
              >
                <HeartPulse className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lateral: jogadores & NPCs */}
          <div className="space-y-4">
            <div className="bg-surface/80 border border-line rounded-xl p-3">
              <span className="text-[10px] font-black text-accent-400 uppercase tracking-widest block mb-2">
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
                      <span className="text-[8px] px-1 py-0.5 rounded bg-surface border border-line-strong text-signal-400 shrink-0">
                        {p.role}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => setInspectedPlayer(p)}
                        title="Inspecionar ficha"
                        className="p-1 rounded bg-surface border border-line-strong text-muted hover:text-accent-400 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      {isGm && p.peerId !== peerId && (
                        <button
                          onClick={() => setSelectedHealthPlayer(p)}
                          title="Editar bio-monitor"
                          className="p-1 rounded bg-surface border border-line-strong text-muted hover:text-red-400 cursor-pointer"
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
              <div className="bg-surface/80 border border-red-500/40 rounded-xl p-3 space-y-2">
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
                    className="px-2 py-1.5 bg-accent-950/80 hover:bg-accent-900 border border-accent-700/60 text-accent-300 rounded font-bold text-[9px] uppercase flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Gerar Jogador</span>
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  <span className="text-[9px] text-subtle uppercase">NPCs ({Object.keys(npcs).length})</span>
                  {Object.values(npcs).map((n) => (
                    <div key={n.peerId} className="bg-raised/70 border border-line rounded px-2 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-red-200 font-bold truncate">{n.handle}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => updateNpcHealth(n.peerId, Math.min(10, n.sheet.woundLevel + 1))}
                          className="text-[9px] px-1 py-0.5 rounded bg-surface border border-line-strong text-red-400 cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          onClick={() => deleteNpc(n.peerId)}
                          className="text-[9px] px-1 py-0.5 rounded bg-surface border border-line-strong text-muted cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(npcs).length === 0 && (
                    <div className="text-center py-2 text-[9px] text-faint">Sem NPCs na mesa.</div>
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
            <div className="bg-surface/60 border border-line rounded p-2.5 text-[10px] text-muted font-mono">
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
            renderTokenCombat={isGm ? renderTokenCombat : undefined}
          />
        </div>
      )}

      {/* INICIATIVA */}
      {tab === 'initiative' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface/80 border border-line rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-line">
              <span className="text-xs font-black text-signal-400 uppercase tracking-widest">Ordem de Iniciativa</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-subtle">{initiative.length} entradas</span>
                {isGm && (
                  <button
                    onClick={() => roomAction(roomsApi.rollInitiative(roomCode))}
                    title="1d10 + REF (+ Combat Sense do Solo) para cada combatente com ficha. Quem você pôs à mão continua."
                    className="px-2.5 py-1 bg-signal-500 hover:bg-signal-400 text-black font-black text-[10px] uppercase rounded cursor-pointer transition-all"
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
                    <span className="text-[9px] text-subtle w-6">{idx + 1}º</span>
                    <span className={`text-xs font-bold ${entry.isCurrentTurn ? 'text-signal-300' : 'text-white'}`}>
                      {entry.handle}
                    </span>
                    {entry.isCurrentTurn && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-signal-400 text-black rounded font-black uppercase">Vez</span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-black text-accent-300">{entry.score}</span>
                </div>
              ))}
              {initiative.length === 0 && (
                <div className="text-center py-10 text-[10px] text-faint">Role a iniciativa ou adicione combatentes para iniciar a rodada.</div>
              )}
            </div>
            {initiative.length > 0 && (
              <div className="p-3 border-t border-line">
                <button
                  onClick={nextTurn}
                  className="w-full py-2.5 bg-signal-500 hover:bg-signal-400 text-black font-black text-xs uppercase rounded cursor-pointer transition-all"
                >
                  ⚔️ Próximo Turno
                </button>
              </div>
            )}
          </div>

          <div className="bg-surface/80 border border-line rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-black text-signal-400 uppercase tracking-widest">Adicionar Combatente</span>
            <input
              type="text"
              value={initiativeName}
              onChange={(e) => setInitiativeName(e.target.value)}
              placeholder="Nome / handle"
              className="w-full bg-raised border border-line-strong text-xs text-fg-strong px-3 py-2 rounded focus:border-signal-400 focus:outline-none"
            />
            <input
              type="number"
              value={initiativeScore}
              onChange={(e) => setInitiativeScore(parseInt(e.target.value) || 0)}
              className="w-full bg-raised border border-line-strong text-xs text-signal-400 px-3 py-2 rounded focus:border-signal-400 focus:outline-none"
            />
            <button
              onClick={addInitiative}
              disabled={!initiativeName.trim()}
              className="w-full py-2 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 text-black font-black text-[10px] uppercase rounded cursor-pointer transition-all"
            >
              + Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Modal: editar saúde (GM) */}
      {selectedHealthPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedHealthPlayer(null)}>
          <div className="bg-surface border-2 border-red-500/60 rounded-2xl p-6 w-full max-w-sm font-mono shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
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
                      : 'border-line bg-raised text-subtle hover:border-red-500/50'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedHealthPlayer(null)}
              className="w-full py-2 bg-raised border border-line-strong text-fg-soft rounded text-[10px] uppercase cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal: inspecionar ficha */}
      {inspectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setInspectedPlayer(null)}>
          <div className="bg-surface border-2 border-accent-500/60 rounded-2xl p-6 w-full max-w-md font-mono shadow-glow-30 shadow-accent-500/30 max-h-[80vh] overflow-y-auto custom-scrollbar animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-accent-400 uppercase tracking-widest">{inspectedPlayer.handle}</h3>
              <span className="text-[9px] px-2 py-0.5 rounded bg-raised border border-line-strong text-signal-400">{inspectedPlayer.role}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {(Object.keys(inspectedPlayer.sheet.stats) as (keyof typeof inspectedPlayer.sheet.stats)[]).map((k) => (
                <div key={k} className="bg-raised border border-line rounded p-1.5 text-center">
                  <span className="text-[8px] text-subtle block">{k}</span>
                  <span className="text-xs font-black text-signal-400">{inspectedPlayer.sheet.stats[k]}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted space-y-1">
              <p>💥 Ferimento: <span className="text-red-300 font-bold">{inspectedPlayer.sheet.woundLevel}/10</span></p>
              <p>💰 €$ {inspectedPlayer.sheet.eurodollars.toLocaleString()}</p>
              <p>🔫 Armas: {inspectedPlayer.sheet.weapons.map(w => w.name).join(', ') || 'nenhuma'}</p>
              <p>🦾 Ciberware: {inspectedPlayer.sheet.cyberware.length} itens</p>
            </div>
            <button
              onClick={() => setInspectedPlayer(null)}
              className="w-full mt-4 py-2 bg-raised border border-line-strong text-fg-soft rounded text-[10px] uppercase cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
