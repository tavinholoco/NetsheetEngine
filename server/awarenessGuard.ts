/**
 * Fase J (J.1d — SEC-17) — O AWARENESS DO YJS É ENTRADA DE USUÁRIO
 * ================================================================
 * O awareness é o canal do cursor do GM no grid (T5.3). O servidor o repassava
 * à mesa como vinha: a R.4 deu teto de tamanho (4 KiB) e de ritmo, e ninguém
 * conferia QUEM escrevia nem O QUE vinha dentro. O cliente põe `user.name` no
 * JSX, e um nome que não era texto derrubava o app inteiro de quem estava no
 * grid (o ErrorBoundary é global); e qualquer jogador publicava um cursor
 * "👁 Mestre", na cor do GM.
 *
 * As regras, conferidas antes de aplicar o update — e um update que falha em
 * qualquer uma é descartado inteiro, como o grid malformado da E.02:
 *  1. Um cliente por quadro, e por socket: o primeiro `clientID` que o socket
 *     usar é o dele, e nenhum que já seja de outro socket da sala. O cliente do
 *     app tem um doc — um `clientID` — por conexão (H.02).
 *  2. O estado tem a forma do cliente do app: `null` (saiu), ou
 *     `{ user?: { name?, peerId? }, cursor?: { x, y } | null }`, com texto onde
 *     é texto e o cursor dentro do grid (0 a 1 — o cliente já grampeia).
 *  3. Cursor, só do GM: é o único que o app emite e o único que ele desenha.
 */
import * as decoding from "lib0/decoding";

/** O `handle` do app tem até 30; a ficha aceita 120 — folga para o que o cliente mandar. */
export const MAX_AWARENESS_NAME = 120;
/** O formato do `peerId` (SEC-16) tem até 64. */
export const MAX_AWARENESS_PEER_ID = 64;

export interface AwarenessEntry {
  clientID: number;
  clock: number;
  state: unknown;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** As entradas de um update de awareness, ou `null` se o binário não é um. */
export function readAwarenessUpdate(update: Uint8Array): AwarenessEntry[] | null {
  try {
    const d = decoding.createDecoder(update);
    const len = decoding.readVarUint(d);
    const out: AwarenessEntry[] = [];
    for (let i = 0; i < len; i++) {
      const clientID = decoding.readVarUint(d);
      const clock = decoding.readVarUint(d);
      out.push({ clientID, clock, state: JSON.parse(decoding.readVarString(d)) });
    }
    return decoding.hasContent(d) ? null : out;
  } catch {
    return null;
  }
}

/** O que há de errado com o estado, ou `null`. */
export function awarenessStateProblem(state: unknown, isGm: boolean): string | null {
  if (state === null) return null;
  if (!isPlainObject(state)) return "o estado não é objeto";
  for (const key of Object.keys(state)) {
    if (key !== "user" && key !== "cursor") return `campo ${key} desconhecido`;
  }
  const { user, cursor } = state;
  if (user !== undefined) {
    if (!isPlainObject(user)) return "user não é objeto";
    for (const key of Object.keys(user)) {
      if (key !== "name" && key !== "peerId") return `user.${key} desconhecido`;
    }
    if (user.name !== undefined && (typeof user.name !== "string" || user.name.length > MAX_AWARENESS_NAME)) {
      return "user.name não é texto, ou é longo demais";
    }
    if (user.peerId !== undefined && (typeof user.peerId !== "string" || user.peerId.length > MAX_AWARENESS_PEER_ID)) {
      return "user.peerId não é texto, ou é longo demais";
    }
  }
  if (cursor !== undefined && cursor !== null) {
    if (!isGm) return "cursor é só do GM";
    if (!isPlainObject(cursor)) return "cursor não é objeto";
    for (const key of Object.keys(cursor)) {
      if (key !== "x" && key !== "y") return `cursor.${key} desconhecido`;
    }
    for (const v of [cursor.x, cursor.y]) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return "cursor fora do grid";
    }
  }
  return null;
}

/**
 * O veredito sobre um update vindo de um socket: o `clientID` dele (para o
 * servidor lembrar de quem é), ou o problema.
 */
export function checkAwarenessUpdate(
  update: Uint8Array,
  socket: { own: number | undefined; takenByOther: (clientID: number) => boolean; isGm: boolean }
): { clientID: number } | { problem: string } {
  const entries = readAwarenessUpdate(update);
  if (!entries) return { problem: "não é um update de awareness" };
  if (entries.length !== 1) return { problem: `${entries.length} clientes num quadro (o app manda 1)` };
  const [{ clientID, state }] = entries;
  if (socket.own !== undefined && clientID !== socket.own) return { problem: "clientID de outro cliente" };
  if (socket.own === undefined && socket.takenByOther(clientID)) return { problem: "clientID de outro socket da sala" };
  const problem = awarenessStateProblem(state, socket.isGm);
  return problem ? { problem } : { clientID };
}
