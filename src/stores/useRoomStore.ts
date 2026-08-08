/**
 * ============================================================
 * NETSHEET ENGINE — useRoomStore (Fase 4 · T4.3)
 * Estado global da mesa multiplayer: view (lobby/active), sala
 * (GameRoom vinda do SSE), sessão (peerId + token), listagem de
 * salas ativas e mensagens de erro.
 *
 * O MultiplayerRoom lê/escreve daqui em vez de useState local,
 * permitindo que qualquer componente reaja ao estado da sala sem
 * cascata de props (ex.: futuro HUD de status da mesa no menu).
 * ============================================================
 */
import { create } from 'zustand';
import type { GameRoom } from '../types/multiplayer';

export type RoomView = 'lobby' | 'active';

interface ActiveRoomInfo {
  code: string;
  name: string;
  gmHandle: string;
  playersCount: number;
}

interface RoomState {
  view: RoomView;
  setView: (v: RoomView) => void;

  /** Código da sala atual (lobby ou ativa). */
  roomCode: string;
  setRoomCode: (code: string) => void;

  /** Sala ativa (payload do SSE). */
  room: GameRoom | null;
  setRoom: (room: GameRoom | null) => void;

  /** Identidade do cliente na mesa (persistida em sessionStorage). */
  peerId: string;
  setPeerId: (id: string) => void;

  /** Token de sessão da mesa (T1.7; persistido em sessionStorage). */
  sessionToken: string;
  setSessionToken: (token: string) => void;

  /** Lista de salas públicas do lobby. */
  activeRooms: ActiveRoomInfo[];
  setActiveRooms: (rooms: ActiveRoomInfo[]) => void;

  errorMsg: string;
  setErrorMsg: (msg: string) => void;

  /** Limpa a sessão e volta ao lobby (Sair da mesa). */
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  view: 'lobby',
  setView: (v) => set({ view: v }),

  roomCode: '',
  setRoomCode: (code) => set({ roomCode: code }),

  room: null,
  setRoom: (room) => set({ room }),

  peerId: '',
  setPeerId: (id) => set({ peerId: id }),

  sessionToken: '',
  setSessionToken: (token) => set({ sessionToken: token }),

  activeRooms: [],
  setActiveRooms: (rooms) => set({ activeRooms: rooms }),

  errorMsg: '',
  setErrorMsg: (msg) => set({ errorMsg: msg }),

  resetRoom: () =>
    set({ view: 'lobby', room: null, roomCode: '', sessionToken: '', errorMsg: '' })
}));
