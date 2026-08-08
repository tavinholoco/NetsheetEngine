import { CharacterSheet, RollResult } from './cyberpunk';

export type UserRole = 'gm' | 'player';

export interface RoomPlayer {
  socketId?: string;
  peerId: string;
  handle: string;
  role: string; // Cyberpunk role like Solo, Netrunner
  sheet: CharacterSheet;
  isOnline: boolean;
  joinedAt: string;
  initiative?: number;
  /** Fase 3 (T3.4) — último heartbeat/atividade; usado pelo timeout de isOnline. */
  lastActiveAt?: string;
}

export interface ChatMessage {
  id: string;
  senderHandle: string;
  senderRole: 'gm' | 'player';
  text: string;
  timestamp: string;
  isDiceRoll?: boolean;
  rollResult?: RollResult;
}

export interface InitiativeEntry {
  playerId: string;
  handle: string;
  role: string;
  score: number;
  isCurrentTurn: boolean;
}

export interface TacticalToken {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'cover' | 'hazard';
  x: number; // 0 to cols-1
  y: number; // 0 to rows-1
  peerId?: string;
  role?: string;
  hp?: number; // wound level or HP
  maxHp?: number;
  spCover?: number;
  status?: string;
  color?: string;
  icon?: string;
}

export interface TacticalGridState {
  rows: number;
  cols: number;
  theme: 'alley' | 'corpo' | 'netrunner' | 'industrial' | 'club' | 'redalert' | string;
  tokens: TacticalToken[];
}

/**
 * Fase 5 (T5.4) — pedido de rolagem da mesa (RNG server-authoritative).
 * O cliente NUNCA envia o resultado — só o tipo + parâmetros de contexto; o
 * servidor rola os dados com `crypto.randomInt` e monta o RollResult usando a
 * ficha que ELE possui (bônus derivados do servidor, anti-forjamento).
 */
export type TableRollKind = "attack" | "damage" | "save" | "skill";

export interface TableRollRequest {
  kind: TableRollKind;
  /** Apenas para `skill`: nome da perícia (o servidor valida na ficha). */
  skillName?: string;
}

export interface GameRoom {
  code: string;
  name: string;
  gmHandle: string;
  gmPeerId?: string;
  locationName: string;
  combatModifier: number; // e.g., -2 darkness, +1 laser sight
  modifierReason: string;
  players: Record<string, RoomPlayer>; // peerId -> RoomPlayer
  npcs?: Record<string, RoomPlayer>; // npcId -> RoomPlayer / NPC sheet
  chatMessages: ChatMessage[];
  initiativeList: InitiativeEntry[];
  activeTurnIndex: number;
  tacticalGrid?: TacticalGridState;
  createdAt: string;
}

