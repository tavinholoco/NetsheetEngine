import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MultiplayerRoom } from '../components/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';

/**
 * Fase 7 (T7.1) — PÁGINA DE SALA (/room/:code)
 * Deep link para uma mesa: injeta o código da URL na useRoomStore e renderiza
 * o MultiplayerRoom (que mostra o lobby com o código preenchido). O auto-join/
 * reconexão do deep link é a T7.4.
 */
export interface RoomPageProps {
  onOpenAuthModal: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onOpenAuthModal }) => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) {
      useRoomStore.setState({ roomCode: code.trim().toUpperCase() });
    }
  }, [code]);

  return <MultiplayerRoom onOpenAuthModal={onOpenAuthModal} />;
};
