import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import { useSheetStore } from '../stores/useSheetStore';
// Fase 7 (T7.3) — camada HTTP centralizada
import * as roomsApi from '../api/rooms';

/**
 * Fase 7 (T7.1 + T7.4) — PÁGINA DE SALA (/room/:code)
 * Deep link para uma mesa: injeta o código da URL na useRoomStore e renderiza
 * o MultiplayerRoom (que mostra o lobby com o código preenchido).
 *
 * T7.4 — se houver sessão persistida (peerId + token no sessionStorage de uma
 * sessão anterior), faz o RE-JOIN automático ao carregar: o servidor (T3.3)
 * reconhece o assento — pelo token da sessão, que o `postJoin` manda desde a
 * R.1; o peerId sozinho não basta — e restaura a ficha persistida, e o
 * WebSocket reconecta sem nenhum clique. Visitante sem sessão cai no lobby com
 * o código preenchido.
 *
 * H.03 — é também a página do lobby (/multiplayer, sem código): quando a mesa
 * fica ativa ali — criar ou entrar pelo código —, a URL vira /room/CÓDIGO. Só
 * esta URL reabre a sessão: no F5 em /multiplayer, o jogador caía no lobby e
 * entrava de novo como outra pessoa, e o GM que criou a mesa pela tela perdia o
 * cargo.
 */
export interface RoomPageProps {
  onOpenAuthModal: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onOpenAuthModal }) => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const view = useRoomStore((s) => s.view);
  const activeCode = useRoomStore((s) => s.roomCode);
  // Guard: re-join apenas UMA vez por código (o StrictMode roda effects 2× no
  // dev; navegar de /room/A para /room/B precisa re-tentar com o código novo).
  const lastJoinCodeRef = useRef<string>('');

  useEffect(() => {
    if (!code) return;
    const roomCode = code.trim().toUpperCase();
    // H.03 — a mesa já está ativa neste código (veio do lobby, ou voltou de
    // outra aba do menu): a sessão está viva, e outro join só trocaria o token.
    const current = useRoomStore.getState();
    if (current.view === 'active' && current.roomCode === roomCode && current.sessionToken) {
      lastJoinCodeRef.current = roomCode;
      return;
    }
    useRoomStore.setState({ roomCode });

    // T7.4 — deep link com sessão persistida → reconexão automática.
    const { peerId, sessionToken } = roomsApi.hydrateSession();
    if (!peerId || !sessionToken) return; // visitante: lobby com código preenchido
    if (lastJoinCodeRef.current === roomCode) return; // já tentou para este código
    lastJoinCodeRef.current = roomCode;

    const { sheet, user } = useSheetStore.getState();
    const handle = user?.displayName || sheet.handle || 'Edgerunner';
    roomsApi
      .joinRoom({ code: roomCode, handle, sheet })
      .then(() => {
        useRoomStore.getState().setErrorMsg('');
        useRoomStore.getState().setView('active');
      })
      .catch((e: any) => {
        // Sala encerrada/sessão inválida: fica no lobby para re-entrada manual.
        useRoomStore.getState().setErrorMsg(e?.message || 'Sala não encontrada ou expirada.');
      });
  }, [code]);

  // H.03 — no lobby (/multiplayer), a mesa que fica ativa leva a URL junto.
  useEffect(() => {
    if (!code && view === 'active' && activeCode) {
      navigate(`/room/${activeCode}`, { replace: true });
    }
  }, [code, view, activeCode, navigate]);

  return <MultiplayerRoom onOpenAuthModal={onOpenAuthModal} />;
};
