// ==========================================================================
// L.1 (ARQ-01) — O REENVIO POR DIFERENÇA
// ==========================================================================
// Até a L.1, cada ação na mesa reenviava a sala inteira a cada conexão — a mesa
// de 6 veteranos da L.0 pesava 142 KB por reenvio, ~1 MB por ação, ~0,57 GB numa
// sessão de 4 h, numa cota de 5 GB por mês dividida com outro projeto. A ficha
// editada e o token movido, que mais pesam, saíam pelo mesmo reenvio.
//
// A diferença nasce num ponto só, o reenvio do `server.ts`: as rotas continuam
// mudando a sala e chamando o `broadcastRoomUpdate`. Aqui ficam duas peças puras:
//   - `roomViewFor` — o que cada papel recebe. O E.20: a ficha do NPC é segredo
//     do Mestre, e o jogador não a recebe. O `lastActiveAt` não vai a ninguém: o
//     heartbeat o muda sem reenvio, a tela não o lê, e numa diferença ele faria
//     a ficha de todos ir a cada ação.
//   - `RoomFeed` — o texto de cada parte que já foi mandada a um papel, e o `rev`.
//     `advance` compara a vista nova com esse texto e devolve só o que mudou.
// O lado do cliente é o `src/lib/roomPatch.ts`; o `room-delta.test` confere a
// ida e volta.
import type { ChatMessage, GameRoom, RoomPatchMessage, RoomPlayer } from "../src/types/multiplayer.js";

export type RoomAudience = "gm" | "player";

/**
 * O papel de quem recebe. Sem mutar a sala: o `checkIsGm` do `roomManager`
 * promove a GM quem tem o handle do Mestre quando a sala não tem `gmPeerId`
 * (o vão da J.1g), e ver a sala não pode promover ninguém. Sem `gmPeerId`,
 * todos recebem a vista do jogador.
 */
export function audienceOf(room: GameRoom, peerId: string | undefined): RoomAudience {
  return !!peerId && !!room.gmPeerId && room.gmPeerId === peerId ? "gm" : "player";
}

function semPresenca(p: RoomPlayer): RoomPlayer {
  const { lastActiveAt: _presenca, ...resto } = p;
  return resto;
}

function npcParaJogador(p: RoomPlayer): RoomPlayer {
  const { lastActiveAt: _presenca, sheet: _ficha, ...resto } = p;
  // O tipo pede a ficha; a tela do jogador não lê a do NPC (a lista é do GM).
  return resto as RoomPlayer;
}

/** A sala como o papel a recebe. Não mexe na sala, que é o que vai para o banco. */
export function roomViewFor(room: GameRoom, audience: RoomAudience): GameRoom {
  const players: Record<string, RoomPlayer> = {};
  for (const [id, p] of Object.entries(room.players)) players[id] = semPresenca(p);
  const npcs: Record<string, RoomPlayer> = {};
  for (const [id, n] of Object.entries(room.npcs ?? {})) npcs[id] = audience === "gm" ? semPresenca(n) : npcParaJogador(n);
  return { ...room, players, npcs };
}

const ENTRIES = ["players", "npcs"] as const;

interface Snapshot {
  /** Os campos do topo (tudo menos jogadores, NPCs e chat), em texto. */
  top: Map<string, string>;
  players: Map<string, string>;
  npcs: Map<string, string>;
  /** O chat: os ids na ordem, e o texto de cada mensagem. */
  chatIds: string[];
  chat: Map<string, string>;
}

function snapshotOf(view: GameRoom): Snapshot {
  const top = new Map<string, string>();
  for (const [key, value] of Object.entries(view)) {
    if (key === "players" || key === "npcs" || key === "chatMessages" || value === undefined) continue;
    top.set(key, JSON.stringify(value));
  }
  const entries = (record: Record<string, RoomPlayer> | undefined) =>
    new Map(Object.entries(record ?? {}).map(([id, p]) => [id, JSON.stringify(p)]));
  const chat = new Map<string, string>();
  for (const m of view.chatMessages) chat.set(m.id, JSON.stringify(m));
  return { top, players: entries(view.players), npcs: entries(view.npcs), chatIds: view.chatMessages.map((m) => m.id), chat };
}

function diffEntries(prev: Map<string, string>, next: Map<string, string>, view: Record<string, RoomPlayer> | undefined) {
  const changes: Record<string, RoomPlayer | null> = {};
  let any = false;
  for (const [id, text] of next) {
    if (prev.get(id) !== text) {
      changes[id] = view![id];
      any = true;
    }
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) {
      changes[id] = null;
      any = true;
    }
  }
  return any ? changes : undefined;
}

/**
 * O chat muda quase sempre pela ponta: mensagens novas no fim e, no teto (E.03),
 * as mais antigas saindo do começo. Isso vai como `drop` + `append`. Qualquer
 * outra coisa — uma mensagem do meio que mudou, uma ordem diferente — reenvia o
 * chat inteiro, que é raro e sempre certo.
 */
function diffChat(prev: Snapshot, next: Snapshot, messages: ChatMessage[]): RoomPatchMessage["chat"] {
  const a = prev.chatIds;
  const b = next.chatIds;
  if (a.length === b.length && a.every((id, i) => id === b[i]) && b.every((id) => prev.chat.get(id) === next.chat.get(id))) {
    return undefined;
  }
  if (a.length === 0) return { drop: 0, append: messages };
  // Até sobrar uma: tirar todas e pôr outras é trocar o chat.
  for (let drop = 0; drop < a.length; drop++) {
    const kept = a.length - drop;
    if (kept > b.length) continue;
    let ok = true;
    for (let i = 0; i < kept; i++) {
      const id = a[drop + i];
      if (b[i] !== id || prev.chat.get(id) !== next.chat.get(id)) {
        ok = false;
        break;
      }
    }
    if (ok) return { drop, append: messages.slice(kept) };
  }
  return { replace: messages };
}

/** O que já foi mandado a um papel de uma sala, e o rev. */
export class RoomFeed {
  private snapshot: Snapshot | null = null;
  rev = 0;

  /**
   * Leva o texto guardado até `view` e devolve a diferença — ou `null` se nada
   * mudou, ou se é a primeira vista (quem chega recebe a sala inteira, com o
   * `rev`). O `rev` só anda quando há diferença: um buraco no rev é, sempre, uma
   * diferença que o cliente não viu.
   */
  advance(view: GameRoom): RoomPatchMessage | null {
    const next = snapshotOf(view);
    const prev = this.snapshot;
    this.snapshot = next;
    if (!prev) {
      this.rev += 1;
      return null;
    }

    const patch: RoomPatchMessage = { type: "room:patch", base: this.rev, rev: this.rev + 1 };
    let changed = false;

    const set: Partial<GameRoom> = {};
    const unset: string[] = [];
    for (const [key, text] of next.top) {
      if (prev.top.get(key) !== text) {
        (set as Record<string, unknown>)[key] = (view as unknown as Record<string, unknown>)[key];
        changed = true;
      }
    }
    for (const key of prev.top.keys()) {
      if (!next.top.has(key)) {
        unset.push(key);
        changed = true;
      }
    }
    if (Object.keys(set).length) patch.set = set;
    if (unset.length) patch.unset = unset;

    for (const kind of ENTRIES) {
      const changes = diffEntries(prev[kind], next[kind], view[kind]);
      if (changes) {
        patch[kind] = changes;
        changed = true;
      }
    }

    const chat = diffChat(prev, next, view.chatMessages);
    if (chat) {
      patch.chat = chat;
      changed = true;
    }

    if (!changed) return null;
    this.rev += 1;
    return patch;
  }
}
