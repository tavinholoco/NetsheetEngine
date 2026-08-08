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

const TOKEN_KEYS: (keyof TacticalToken)[] = [
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

/** Lê o estado atual do grid a partir do doc CRDT. */
export function deriveGridFromDoc(doc: Y.Doc): TacticalGridState {
  const meta = doc.getMap(META);
  const tokensArr = doc.getArray(TOKENS);

  const tokens: TacticalToken[] = tokensArr.toArray().map((entry) => {
    const m = entry as Y.Map<unknown>;
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
      const m = entry as Y.Map<unknown>;
      const id = String(m.get("id") ?? "");
      if (id) byId.set(id, m);
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

    // Remove tokens que sumiram do grid (do fim para o início)
    const stale: number[] = [];
    tokensArr.toArray().forEach((entry, i) => {
      const id = String((entry as Y.Map<unknown>).get("id") ?? "");
      if (id && !seen.has(id)) stale.push(i);
    });
    for (const i of stale.sort((a, b) => b - a)) tokensArr.delete(i);
  }, origin);
}
