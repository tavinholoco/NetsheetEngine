import { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterSheet } from '../../types/cyberpunk';
import type { RoomFullMessage, RoomPatchMessage, TacticalGridState } from '../../types/multiplayer';
import type { RoomView } from '../../stores/useRoomStore';
import { applyRoomPatch } from '../../lib/roomPatch';
import { YjsGridConnection, RemoteCursor } from '../../lib/yjsConnection';
import { useRoomStore } from '../../stores/useRoomStore';
import * as roomsApi from '../../api/rooms';
import { apiUrl, wsUrl } from '../../api/base';

interface RoomTransportInput {
  view: RoomView;
  roomCode: string;
  sessionToken: string;
  peerId: string;
  handle: string;
  sheet: CharacterSheet;
}

/**
 * L.3c (G.21) — o transporte da mesa, fora da tela: o WebSocket com o SSE de
 * reserva, a sala inteira e a diferença (o `rev` da L.1), o Yjs do grid, o
 * heartbeat e a sincronia da ficha. Devolve o grid do Yjs, os cursores do GM, a
 * conexão Yjs (para o grid e o cursor escreverem nela) e o envio pelo socket.
 */
export function useRoomTransport({ view, roomCode, sessionToken, peerId, handle, sheet }: RoomTransportInput) {
  // Fase 5 (T5.3) — grid vindo do doc CRDT (Yjs) e cursores remotos do GM
  const [yjsGrid, setYjsGrid] = useState<TacticalGridState | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const yjsConnRef = useRef<YjsGridConnection | null>(null);
  const yjsActiveRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Fase 5 (T5.2) — contador para retry do WebSocket após queda (backoff simples)
  const [wsAttempt, setWsAttempt] = useState(0);
  // H.09 — "já conectou nesta mesa" vive fora da rodada do efeito. Era uma
  // variável de cada rodada: uma queda breve seguida de uma tentativa que
  // falhava levava ao SSE para sempre — sem arrastar o próprio token, com o
  // grid congelado, e com um `sse_fallback` no log que era queda de rede.
  const wsEverOpenRef = useRef(false);
  const wsRetriesRef = useRef(0);
  // H.3d — até quando vale a reconexão curta depois de o servidor trocar de
  // instância (o fechamento 1012).
  const wsRestartUntilRef = useRef(0);

  // Fase 5 (T5.3) — refs correntes de peerId/handle para o effect de transporte
  // (não reconectar o WS quando a ficha muda de nome)
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Fase 5 (T5.2) — TRANSPORTE UNIFICADO: tenta WebSocket; se não conectar
  // (bloqueado/falhou), cai automaticamente para o SSE (EventSource). Ambos
  // entregam o MESMO payload — desde a L.1, a sala inteira na entrada e depois
  // só a diferença (`delta=1`).
  // Fase 5 (T5.3) — sobre o WS também trafega o protocolo binário do Yjs
  // (grid CRDT + awareness): binário → YjsGridConnection; texto → JSON.
  useEffect(() => {
    if (view !== 'active' || !roomCode) {
      wsEverOpenRef.current = false;
      wsRetriesRef.current = 0;
      return;
    }
    let disposed = false;
    // L.1 (ARQ-01) — o rev da sala que esta conexão tem; -1 até a sala inteira
    // chegar. Uma diferença que parte de outro rev é uma que não vimos: pede a
    // sala inteira e ignora as diferenças até ela chegar.
    let rev = -1;
    let awaitingFull = false;
    const requestFull = () => {
      if (awaitingFull) return;
      awaitingFull = true;
      if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'resync' }));
        } catch {
          /* o onclose reconecta, e a entrada é a sala inteira */
        }
      } else if (sse) {
        // O SSE não tem volta: reabrir o stream é pedir a sala inteira.
        sse.close();
        sse = connectSse();
      }
    };

    /** Devolve `'restart'` quando o servidor avisa que vai trocar de instância (H.3d.4). */
    const handlePayload = (raw: string): 'restart' | void => {
      if (disposed) return;
      try {
        const parsed = JSON.parse(raw);
        // Fase 5 (T5.4) — respostas de erro do servidor (roll-error / error)
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string' &&
            (parsed.type === 'roll-error' || parsed.type === 'error')) {
          // H.3d.4 — o aviso da troca de instância não é erro de quem joga.
          if (parsed.code === 'server_restarting') return 'restart';
          useRoomStore.getState().setErrorMsg(String(parsed.error || 'Ação rejeitada pelo servidor.'));
          return;
        }
        if (parsed?.type === 'room:full') {
          const m = parsed as RoomFullMessage;
          rev = m.rev;
          awaitingFull = false;
          useRoomStore.getState().setRoom(m.room);
          return;
        }
        if (parsed?.type === 'room:patch') {
          const m = parsed as RoomPatchMessage;
          const current = useRoomStore.getState().room;
          if (awaitingFull) return;
          if (!current || m.base !== rev) {
            requestFull();
            return;
          }
          rev = m.rev;
          useRoomStore.getState().setRoom(applyRoomPatch(current, m));
          return;
        }
        // A sala inteira sem `type` — a de antes da L.1.
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
        apiUrl(`/api/rooms/${roomCode}/stream?token=${encodeURIComponent(sessionToken)}&delta=1`)
      );
      eventSourceRef.current = es;
      es.onmessage = (ev) => handlePayload(ev.data);
      es.onerror = () => {
        // EventSource reconecta automaticamente
      };
      return es;
    };

    let sse: EventSource | null = null;
    const socketUrl = wsUrl(`/ws/rooms/${roomCode}?token=${encodeURIComponent(sessionToken)}&delta=1`);
    const ws = new WebSocket(socketUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      wsEverOpenRef.current = true;
      wsRetriesRef.current = 0;
      wsRestartUntilRef.current = 0;
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
        if (handlePayload(ev.data) === 'restart') leaveForRestart();
      } else if (yjsConnRef.current) {
        // Binário → protocolo Yjs (grid CRDT / awareness)
        yjsConnRef.current.handleBinary(ev.data as ArrayBuffer);
      }
    };
    ws.onerror = () => {
      // Sem conexão → o onclose decide o fallback SSE
    };
    // H.3d.4 — o servidor avisou que vai trocar de instância. No ar, o proxy do
    // Render segurou o fechamento que o servidor manda por 13–16 s, e a tela mandou
    // uma mensagem pelo socket morto. Então o cliente fecha o próprio socket na
    // hora — daqui em diante, as ações vão por REST, que repete o 503 — e volta pelo
    // caminho do 1012, sem esperar o `onclose`.
    const leaveForRestart = () => {
      if (disposed || wsRef.current !== ws) return;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* já fechando */
      }
      socketGone(1012);
    };
    ws.onclose = (ev) => socketGone(ev?.code);
    function socketGone(code: number | undefined) {
      if (disposed) return;
      wsRef.current = null;
      // H.02 — a conexão Yjs deste socket morre com ele. Só o ref era zerado, e
      // o efeito seguinte não achava o que destruir: os timers dela (o refresh
      // de 25 s e o do awareness) e o doc seguiam vivos, um par por queda.
      yjsConnRef.current?.destroy();
      yjsConnRef.current = null;
      yjsActiveRef.current = false;
      // H.09 — sem Yjs, a tela volta ao grid da sala (o JSON que o servidor
      // espelha); o do Yjs ficaria parado na última posição.
      setYjsGrid(null);
      if (!wsEverOpenRef.current) {
        // Nunca conectou nesta mesa → SSE (o proxy que bloqueia o WebSocket)
        if (!sse) sse = connectSse();
      } else {
        // H.3d — 1012 (Service Restart): o servidor entregou a mesa à instância
        // nova, no deploy. A velha recusa o WebSocket até o Render trocar o
        // tráfego (~7–9 s, H.3d.0): tentar a cada 1,5 s por até 1 min, sem a
        // espera crescente — que, na terceira recusa, já esperaria 12 s.
        if (code === 1012) wsRestartUntilRef.current = Date.now() + 60_000;
        const restarting = Date.now() < wsRestartUntilRef.current;
        // Caiu depois de conectar → tenta o WebSocket de novo, com espera
        // crescente: 3 s, 6 s, 12 s… até 30 s (token pode ter mudado via T3.3;
        // o effect re-roda quando o token novo chega).
        const delay = restarting ? 1500 : Math.min(3000 * 2 ** wsRetriesRef.current, 30_000);
        if (!restarting) wsRetriesRef.current += 1;
        setTimeout(() => {
          if (!disposed) setWsAttempt((a) => a + 1);
        }, delay);
      }
    }

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

  return { yjsGrid, remoteCursors, yjsConnRef, wsSend };
}
