/**
 * Revisão pós-D (R.6 — SEC-12) — POSSE DE TOKEN NO GRID YJS
 * ==========================================================
 * O grid é um documento CRDT que o cliente escreve inteiro; o servidor confere
 * depois (`mirrorDocToJson`) e reverte o que o jogador não podia mudar: ele só
 * move o PRÓPRIO token. A conferência comparava o dono do token DEPOIS da
 * mudança — e o campo `peerId` (o dono) não estava na lista do que o jogador
 * não pode alterar. Reescrevendo o dono e movendo no mesmo update, um jogador
 * moveria qualquer token: o NPC, a cobertura, o token de outro jogador.
 *
 * Achado pela leitura na revisão de 29/09; este teste é a reprodução, com um
 * cliente Yjs de verdade sobre o WebSocket da mesa.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { app, attachRealtime } from "../../server";
import { getRoom } from "../../server/roomManager";
import { deriveGridFromDoc, writeGridToDoc } from "../lib/gridDoc";
import type { TacticalGridState, TacticalToken } from "../types/multiplayer";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let server: http.Server;
let port: number;
const abertos: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

async function esperarPor(cond: () => boolean, tetoMs = 3000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}

/** Um jogador na mesa, com o grid sincronizado num Y.Doc local — como o navegador faz. */
async function jogadorComGrid() {
  const c = `R6-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  await request(app).post("/api/rooms/join").send({ code: c, peerId: "peer_kaze", handle: "Kaze", sheet: { ...SHEET, handle: "Kaze" } });
  const pj = await request(app).post("/api/rooms/join").send({ code: c, peerId: "peer_vex", handle: "Vex", sheet: SHEET });

  const doc = new Y.Doc();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${c}?token=${pj.body.sessionToken}`);
  abertos.push(ws);
  ws.on("error", () => {});
  ws.on("message", (raw, isBinary) => {
    if (!isBinary) return;
    const decoder = decoding.createDecoder(new Uint8Array(raw as Buffer));
    if (decoding.readVarUint(decoder) !== 0) return; // só sync
    const reply = encoding.createEncoder();
    encoding.writeVarUint(reply, 0);
    syncProtocol.readSyncMessage(decoder, reply, doc, "remote");
  });
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== "local") return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 0);
    syncProtocol.writeUpdate(enc, update);
    ws.send(encoding.toUint8Array(enc));
  });
  await new Promise<void>((r) => ws.once("open", () => r()));
  const step1 = encoding.createEncoder();
  encoding.writeVarUint(step1, 0);
  syncProtocol.writeSyncStep1(step1, doc);
  ws.send(encoding.toUint8Array(step1));
  await esperarPor(() => deriveGridFromDoc(doc).tokens.length > 0);

  /** Muda um token no doc local e manda — o que um cliente adulterado faria. */
  const mudar = (id: string, patch: Partial<TacticalToken>) => {
    const atual = deriveGridFromDoc(doc);
    const proximo: TacticalGridState = {
      ...atual,
      tokens: atual.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t))
    };
    writeGridToDoc(doc, proximo, "local");
  };
  const noServidor = (id: string) => getRoom(c)!.tacticalGrid!.tokens.find((t) => t.id === id)!;
  return { mudar, noServidor, doc };
}

describe("R.6 — SEC-12: o jogador só move o próprio token", () => {
  it("reescrever o dono de um NPC e movê-lo no mesmo update é revertido", async () => {
    const { mudar, noServidor } = await jogadorComGrid();
    const antes = { ...noServidor("npc_booster") };

    mudar("npc_booster", { peerId: "peer_vex", x: 0, y: 0 });
    await new Promise((r) => setTimeout(r, 300));

    const depois = noServidor("npc_booster");
    expect({ x: depois.x, y: depois.y, peerId: depois.peerId }).toEqual({ x: antes.x, y: antes.y, peerId: antes.peerId });
  });

  it("o token de OUTRO jogador também não se move assim", async () => {
    const { mudar, noServidor } = await jogadorComGrid();
    const antes = { ...noServidor("token_peer_kaze") };

    mudar("token_peer_kaze", { peerId: "peer_vex", x: 9, y: 7 });
    await new Promise((r) => setTimeout(r, 300));

    const depois = noServidor("token_peer_kaze");
    expect(depois.peerId).toBe("peer_kaze");
    expect({ x: depois.x, y: depois.y }).toEqual({ x: antes.x, y: antes.y });
  });

  it("nem só trocar o dono (sem mover) passa — senão o próximo update moveria", async () => {
    const { mudar, noServidor } = await jogadorComGrid();
    mudar("cover_1", { peerId: "peer_vex" });
    await new Promise((r) => setTimeout(r, 300));
    expect(noServidor("cover_1").peerId).toBeUndefined();
  });

  it("nem o ícone de um token alheio", async () => {
    const { mudar, noServidor } = await jogadorComGrid();
    mudar("npc_booster", { icon: "💀" });
    await new Promise((r) => setTimeout(r, 300));
    expect(noServidor("npc_booster").icon).toBeUndefined();
  });

  it("mover o próprio token continua funcionando", async () => {
    const { mudar, noServidor } = await jogadorComGrid();
    mudar("token_peer_vex", { x: 5, y: 5 });
    expect(await esperarPor(() => noServidor("token_peer_vex").x === 5 && noServidor("token_peer_vex").y === 5)).toBe(true);
  });
});
