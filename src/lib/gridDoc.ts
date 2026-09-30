import * as Y from "yjs";
import { TacticalGridState, TacticalToken } from "../types/multiplayer";

/**
 * Fase 5 (T5.3) — Grid tático como estado CRDT (Yjs).
 *
 * O grid vive num `Y.Doc`:
 *   doc.getMap("meta")   → { rows, cols, theme }
 *   doc.getArray("tokens") → Y.Map por token (chaves = campos do TacticalToken)
 *
 * Estas funções são PURAS e usadas por cliente (src/lib/yjsConnection.ts) e
 * servidor (server.ts) — a persistência continua JSON (`room.tacticalGrid`),
 * o doc é apenas a camada de sync ao vivo (decisão T5.1/T3.5).
 */

const META = "meta";
const TOKENS = "tokens";

/** Os campos de token que o doc CRDT carrega. Exportado para a autorização do
 *  servidor (R.6) comparar TODOS eles — uma lista à mão esqueceu dois. */
export const TOKEN_KEYS: (keyof TacticalToken)[] = [
  "id",
  "name",
  "type",
  "x",
  "y",
  "peerId",
  "role",
  "hp",
  "maxHp",
  "spCover",
  "status",
  "color",
  "icon"
];

// ============================================================
// Fase E (E.02 — SEC-14) — A FORMA DO GRID
// ============================================================
// O grid tem duas portas de escrita: a rota REST (fallback do GM) e o doc Yjs
// (todo jogador, ao vivo). A R.6 conferiu QUEM pode mudar o quê; ninguém
// conferia O QUE é um token. Um `tokens: 5` pela REST, ou um item que não é
// token empurrado no array pelo Yjs, fazia o espelho doc ↔ JSON lançar — e o
// reenvio da sala, que roda dentro do vigia de presença, derrubava o processo.
//
// Os tetos abaixo são folgados para o que a tela faz (grid de até 16×12; o
// servidor escreve nomes e papéis de até 120 caracteres, o teto da ficha) e
// apertados para lixo.

export const MAX_GRID_TOKENS = 200;
export const MAX_GRID_SIDE = 32;
const MAX_THEME_CHARS = 30;
const TOKEN_TYPES = new Set(["player", "npc", "cover", "hazard"]);
const TOKEN_STRING_CAPS: Partial<Record<keyof TacticalToken, number>> = {
  id: 128,
  name: 120,
  peerId: 128,
  role: 120,
  status: 60,
  color: 32,
  icon: 120
};
const TOKEN_NUMBER_KEYS: (keyof TacticalToken)[] = ["x", "y", "hp", "maxHp", "spCover"];
const MAX_TOKEN_NUMBER = 10_000;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Item do array do doc que é mesmo um token (um Y.Map). */
function isYMap(entry: unknown): entry is Y.Map<unknown> {
  return entry instanceof Y.Map;
}

/** O que há de errado com um token, ou `null`. */
export function tokenProblem(value: unknown): string | null {
  if (!isPlainObject(value)) return "item do grid não é um token";
  if (typeof value.id !== "string" || !value.id) return "token sem id";
  if (typeof value.type !== "string" || !TOKEN_TYPES.has(value.type)) return `token ${value.id}: tipo inválido`;
  if (typeof value.name !== "string") return `token ${value.id}: sem nome`;
  for (const [key, cap] of Object.entries(TOKEN_STRING_CAPS)) {
    const v = value[key];
    if (v === undefined) continue;
    if (typeof v !== "string" || v.length > (cap as number)) return `token ${value.id}: campo ${key} inválido`;
  }
  for (const key of TOKEN_NUMBER_KEYS) {
    const v = value[key];
    if (v === undefined && key !== "x" && key !== "y") continue;
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > MAX_TOKEN_NUMBER) {
      return `token ${value.id}: campo ${key} inválido`;
    }
  }
  return null;
}

/**
 * O que há de errado numa MUDANÇA de grid, ou `null`. Confere só o que mudou:
 * tamanho e tema se mudaram, e cada token novo ou alterado. Um token antigo que
 * ninguém tocou não reprova a mudança de outro — senão um dado velho do banco
 * reverteria todo movimento legítimo da mesa.
 */
export function gridChangeProblem(prev: TacticalGridState, next: TacticalGridState): string | null {
  for (const side of ["rows", "cols"] as const) {
    if (next[side] === prev[side]) continue;
    const v = next[side];
    if (!Number.isInteger(v) || v < 1 || v > MAX_GRID_SIDE) return `${side} inválido`;
  }
  if (next.theme !== prev.theme && (typeof next.theme !== "string" || next.theme.length > MAX_THEME_CHARS)) {
    return "tema inválido";
  }
  if (!Array.isArray(next.tokens)) return "tokens não é uma lista";
  const prevTokens = Array.isArray(prev.tokens) ? prev.tokens.filter(isPlainObject) as TacticalToken[] : [];
  if (next.tokens.length > MAX_GRID_TOKENS && next.tokens.length > prevTokens.length) {
    return `tokens demais (máx. ${MAX_GRID_TOKENS})`;
  }
  const prevById = new Map(prevTokens.map((t) => [t.id, t]));
  const seen = new Set<string>();
  for (const t of next.tokens) {
    const problem = tokenProblem(t);
    const before = isPlainObject(t) ? prevById.get(t.id as string) : undefined;
    const changed = !before || TOKEN_KEYS.some((k) => before[k] !== t[k]);
    if (problem && changed) return problem;
    if (isPlainObject(t)) {
      if (seen.has(t.id)) return `token ${t.id} repetido`;
      seen.add(t.id);
    }
  }
  return null;
}

/**
 * Entrada da porta REST: monta o grid campo a campo — só os campos que o grid
 * tem, como a iniciativa da D.4. `null` se nem a forma básica existe. Item de
 * token que não é objeto passa como veio, para o `gridChangeProblem` recusar.
 */
export function normalizeGridInput(input: unknown): TacticalGridState | null {
  if (!isPlainObject(input) || !Array.isArray(input.tokens)) return null;
  const tokens = input.tokens.map((t) => {
    if (!isPlainObject(t)) return t;
    const token: Record<string, unknown> = {};
    for (const k of TOKEN_KEYS) if (t[k] !== undefined) token[k] = t[k];
    return token;
  }) as TacticalToken[];
  return {
    rows: input.rows as number,
    cols: input.cols as number,
    theme: input.theme as string,
    tokens
  };
}

/** Algum item do array de tokens do doc não é um token (um Y.Map com id)? */
export function docTokensProblem(doc: Y.Doc): string | null {
  for (const entry of doc.getArray(TOKENS).toArray()) {
    if (!isYMap(entry)) return "item do grid não é um token";
    if (typeof entry.get("id") !== "string" || !entry.get("id")) return "token sem id";
  }
  return null;
}

/** Lê o estado atual do grid a partir do doc CRDT. Item que não é token é
 *  ignorado (E.02): ler o doc nunca lança. */
export function deriveGridFromDoc(doc: Y.Doc): TacticalGridState {
  const meta = doc.getMap(META);
  const tokensArr = doc.getArray(TOKENS);

  const tokens: TacticalToken[] = tokensArr.toArray().filter(isYMap).map((entry) => {
    const m = entry;
    const token: Record<string, unknown> = {};
    for (const k of TOKEN_KEYS) {
      if (m.has(k)) token[k] = m.get(k);
    }
    return token as unknown as TacticalToken;
  });

  return {
    rows: Number(meta.get("rows") ?? 8),
    cols: Number(meta.get("cols") ?? 10),
    theme: String(meta.get("theme") ?? "alley"),
    tokens
  };
}

/**
 * Escreve um grid no doc dentro de uma transação.
 * - Reutiliza o Y.Map de cada token por `id` (merge granular por campo).
 * - Remove tokens que não existem mais no grid.
 * @param origin identificador da transação ("local" no cliente, "server"/
 *   "seed" no servidor) — usado para não ecoar o próprio update.
 */
export function writeGridToDoc(doc: Y.Doc, grid: TacticalGridState, origin: unknown): void {
  doc.transact(() => {
    const meta = doc.getMap(META);
    // Só grava quando muda — Y.Map.set gera update mesmo com valor idêntico
    // (evita tráfego redundante a cada drag de token).
    if (meta.get("rows") !== grid.rows) meta.set("rows", grid.rows);
    if (meta.get("cols") !== grid.cols) meta.set("cols", grid.cols);
    if (meta.get("theme") !== grid.theme) meta.set("theme", grid.theme);

    const tokensArr = doc.getArray(TOKENS);
    const byId = new Map<string, Y.Map<unknown>>();
    for (const entry of tokensArr.toArray()) {
      if (!isYMap(entry)) continue;
      const id = String(entry.get("id") ?? "");
      if (id) byId.set(id, entry);
    }

    const seen = new Set<string>();
    for (const t of grid.tokens) {
      let m = byId.get(t.id);
      if (!m) {
        m = new Y.Map<unknown>();
        tokensArr.push([m]);
        byId.set(t.id, m);
      }
      seen.add(t.id);
      for (const k of TOKEN_KEYS) {
        const v = t[k];
        if (v === undefined) {
          if (m.has(k)) m.delete(k);
        } else {
          m.set(k, v);
        }
      }
    }

    // Remove tokens que sumiram do grid (do fim para o início) — e, desde a
    // E.02, todo item que não é token: é assim que o servidor desfaz o lixo.
    const stale: number[] = [];
    tokensArr.toArray().forEach((entry, i) => {
      const id = isYMap(entry) ? String(entry.get("id") ?? "") : "";
      if (!id || !seen.has(id)) stale.push(i);
    });
    for (const i of stale.sort((a, b) => b - a)) tokensArr.delete(i);
  }, origin);
}
