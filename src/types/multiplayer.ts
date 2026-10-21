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
export type TableRollKind = "attack" | "damage" | "save" | "stun" | "skill";

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
  /** R.3 (SEC-09) — peerIds que o GM removeu (os 50 mais recentes). O `join`
   *  por eles responde 403: é o que impede a reconexão automática de trazer o
   *  expulso de volta. Não é banimento — uma aba nova é outro jogador. */
  removedPeerIds?: string[];
}

/**
 * L.1 (ARQ-01) — o reenvio por diferença. Quem abre o socket (ou o SSE) com
 * `delta=1` recebe a sala inteira uma vez (`room:full`) e, depois, só o que
 * mudou (`room:patch`). Cada diferença diz de qual `rev` parte (`base`): se não
 * for o que o cliente tem, ele pede a sala inteira (`{ type: "resync" }`).
 * Quem não pede `delta` — a aba aberta antes do deploy — recebe a sala inteira
 * a cada mudança, como antes. Contrato em docs/PROTOCOLO_MULTIPLAYER.md.
 */
export interface RoomFullMessage {
  type: 'room:full';
  rev: number;
  room: GameRoom;
}

export interface RoomPatchMessage {
  type: 'room:patch';
  /** O rev que o cliente precisa ter para aplicar esta diferença. */
  base: number;
  /** O rev depois de aplicada. */
  rev: number;
  /** Os campos do topo que mudaram (o grid, a iniciativa e as condições da cena moram aqui). */
  set?: Partial<GameRoom>;
  /** Os campos do topo que deixaram de existir. */
  unset?: string[];
  /** Cada jogador que mudou, inteiro; `null` é quem saiu. */
  players?: Record<string, RoomPlayer | null>;
  npcs?: Record<string, RoomPlayer | null>;
  /** `drop` tira as mais antigas (o teto do chat) e `append` põe as novas; `replace` troca tudo. */
  chat?: { drop: number; append: ChatMessage[] } | { replace: ChatMessage[] };
}

