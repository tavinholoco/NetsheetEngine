import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
 * reconhece o peerId e restaura a ficha persistida, e o WebSocket reconecta
 * sem nenhum clique. Visitante sem sessão cai no lobby com o código preenchido.
 */
export interface RoomPageProps {
  onOpenAuthModal: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onOpenAuthModal }) => {
  const { code } = useParams<{ code: string }>();
  // Guard: re-join apenas UMA vez por código (o StrictMode roda effects 2× no
  // dev; navegar de /room/A para /room/B precisa re-tentar com o código novo).
  const lastJoinCodeRef = useRef<string>('');

  useEffect(() => {
    if (!code) return;
    const roomCode = code.trim().toUpperCase();
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

  return <MultiplayerRoom onOpenAuthModal={onOpenAuthModal} />;
};
