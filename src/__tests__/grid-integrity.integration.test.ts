/**
 * Fase E (E.02 — SEC-14) — UM GRID MALFORMADO DERRUBAVA O SERVIDOR INTEIRO
 * ========================================================================
 * O grid da sala tem duas portas de escrita: a rota REST (o fallback do GM) e
 * o doc Yjs (o caminho ao vivo, de todo jogador). Nenhuma das duas conferia a
 * FORMA do que entrava — a R.6 conferiu quem pode mudar o quê, não o que é um
 * token. E o reenvio da sala espelha o JSON no doc Yjs a cada mutação: um grid
 * que o espelho não entende faz o `broadcastRoomUpdate` lançar.
 *
 * Reproduzido em 30/09/2026, antes do conserto:
 *  - REST: `tokens: 5` → 500, e daí em diante chat e rolagem da sala → 500;
 *  - Yjs: um jogador comum empurra um item que não é token → a mesma trava;
 *  - e o vigia de presença chama o mesmo reenvio dentro de um `setInterval`,
 *    sem `try`: quando alguém da sala cai para offline, o PROCESSO cai (exit 1,
 *    visto com o `npm run dev`). Todas as mesas juntas. Criar sala não exige
 *    login no servidor — qualquer visitante é GM da própria sala.
 *
 * O conserto tem duas camadas, e cada uma tem teste aqui: (1) a forma do grid
 * é validada nas duas portas; (2) o reenvio nunca deixa um erro de espelho
 * escapar — nem para a rota, nem para o vigia.
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
import { app, attachRealtime, runPresenceSweep } from "../../server";
import { getRoom } from "../../server/roomManager";
import { MAX_GRID_TOKENS, deriveGridFromDoc, writeGridToDoc } from "../lib/gridDoc";

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

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperarPor(cond: () => boolean, tetoMs = 3000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await esperar(10);
  }
  return cond();
}

/** GM e um jogador numa sala nova. */
async function mesa() {
  const code = `GI-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const gm = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  const pj = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  return { code, gmToken: gm.body.sessionToken as string, pjToken: pj.body.sessionToken as string };
}

/** Abre o WebSocket com um Y.Doc local sincronizado — como o navegador faz. O
 *  syncStep1 é o que cria o doc da sala no servidor. */
async function conectarComGrid(code: string, token: string) {
  const doc = new Y.Doc();
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${token}`);
  abertos.push(ws);
  ws.on("error", () => {});
  ws.on("message", (raw, isBinary) => {
    if (!isBinary) return;
    const decoder = decoding.createDecoder(new Uint8Array(raw as Buffer));
    if (decoding.readVarUint(decoder) !== 0) return;
    const reply = encoding.createEncoder();
    encoding.writeVarUint(reply, 0);
    syncProtocol.readSyncMessage(decoder, reply, doc, "remote");
  });
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
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
  await esperarPor(() => doc.getArray("tokens").length > 0);
  return doc;
}

const chat = (code: string, token: string, text = "alguém aí?") =>
  request(app).post(`/api/rooms/${code}/message`).send({ sessionToken: token, text });

const grid = (code: string, token: string, gridState: unknown) =>
  request(app).post(`/api/rooms/${code}/tactical-grid`).send({ sessionToken: token, gridState });

describe("E.02 (SEC-14) — a porta REST do grid confere a forma", () => {
  it("tokens que não são lista → 400 invalid_grid, e a sala segue viva", async () => {
    const { code, gmToken } = await mesa();
    await conectarComGrid(code, gmToken);

    const r = await grid(code, gmToken, { rows: 8, cols: 10, theme: "alley", tokens: 5 });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("invalid_grid");
    expect((await chat(code, gmToken)).status).toBe(200);
  });

  it("um item nulo na lista de tokens → 400, e o grid da sala não muda", async () => {
    const { code, gmToken } = await mesa();
    const antes = JSON.stringify(getRoom(code)!.tacticalGrid);
    const r = await grid(code, gmToken, { rows: 8, cols: 10, theme: "alley", tokens: [null] });
    expect(r.status).toBe(400);
    expect(JSON.stringify(getRoom(code)!.tacticalGrid)).toBe(antes);
  });

  it(`mais de ${MAX_GRID_TOKENS} tokens → 400`, async () => {
    const { code, gmToken } = await mesa();
    const tokens = Array.from({ length: MAX_GRID_TOKENS + 1 }, (_, i) => ({ id: `t${i}`, name: "x", type: "cover", x: 0, y: 0 }));
    const r = await grid(code, gmToken, { rows: 8, cols: 10, theme: "alley", tokens });
    expect(r.status).toBe(400);
  });

  it("campo que não é de token não entra no estado da sala", async () => {
    const { code, gmToken } = await mesa();
    const r = await grid(code, gmToken, {
      rows: 8,
      cols: 10,
      theme: "alley",
      extra: "x".repeat(1000),
      tokens: [{ id: "c1", name: "Muro", type: "cover", x: 1, y: 1, spCover: 10, lixo: "y".repeat(1000) }]
    });
    expect(r.status).toBe(200);
    const salvo = getRoom(code)!.tacticalGrid as unknown as Record<string, unknown>;
    expect(salvo.extra).toBeUndefined();
    expect((salvo.tokens as Record<string, unknown>[])[0].lixo).toBeUndefined();
  });

  it("o mapa legítimo do GM continua passando", async () => {
    const { code, gmToken } = await mesa();
    const atual = getRoom(code)!.tacticalGrid!;
    const r = await grid(code, gmToken, {
      ...atual,
      cols: 12,
      tokens: [...atual.tokens, { id: "token_novo", name: "Barril", type: "hazard", x: 3, y: 3, status: "Normal", color: "#f59e0b" }]
    });
    expect(r.status).toBe(200);
    expect(r.body.tacticalGrid.cols).toBe(12);
    expect(r.body.tacticalGrid.tokens.some((t: { id: string }) => t.id === "token_novo")).toBe(true);
  });
});

describe("E.02 (SEC-14) — a porta Yjs do grid confere a forma", () => {
  it("um jogador comum empurra um item que não é token: é revertido e a sala segue viva", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const doc = await conectarComGrid(code, pjToken);
    const antes = JSON.stringify(getRoom(code)!.tacticalGrid);

    doc.getArray("tokens").push(["não sou token"]);
    await esperar(300);

    expect(JSON.stringify(getRoom(code)!.tacticalGrid)).toBe(antes);
    expect((await chat(code, pjToken)).status).toBe(200);
    expect((await chat(code, gmToken)).status).toBe(200);
    // O doc do servidor não ficou envenenado: o movimento legítimo seguinte passa.
    const atual = deriveGridFromDoc(doc);
    writeGridToDoc(doc, { ...atual, tokens: atual.tokens.map((t) => (t.id === "token_peer_vex" ? { ...t, x: 4, y: 4 } : t)) }, "local");
    expect(await esperarPor(() => getRoom(code)!.tacticalGrid!.tokens.find((t) => t.id === "token_peer_vex")?.x === 4)).toBe(true);
  });

  it("o GM também não grava lixo pelo Yjs (validar forma não é autorização)", async () => {
    const { code, gmToken } = await mesa();
    const doc = await conectarComGrid(code, gmToken);
    const m = new Y.Map<unknown>();
    m.set("id", "t_lixo");
    m.set("type", "cover");
    m.set("name", "x".repeat(10_000));
    m.set("x", 0);
    m.set("y", 0);
    doc.getArray("tokens").push([m]);
    await esperar(300);

    expect(getRoom(code)!.tacticalGrid!.tokens.some((t) => t.id === "t_lixo")).toBe(false);
    expect((await chat(code, gmToken)).status).toBe(200);
  });
});

describe("E.02 (SEC-14) — o reenvio nunca deixa um erro de espelho escapar", () => {
  it("grid malformado já no estado da sala (banco antigo, caminho futuro): a mutação responde 200", async () => {
    const { code, gmToken } = await mesa();
    await conectarComGrid(code, gmToken);
    // Simula um grid que entrou por fora das portas validadas.
    (getRoom(code)!.tacticalGrid as unknown as { tokens: unknown }).tokens = 5;
    expect((await chat(code, gmToken)).status).toBe(200);
  });

  it("o vigia de presença não lança com uma sala assim — antes, isso derrubava o processo", async () => {
    const { code, gmToken } = await mesa();
    await conectarComGrid(code, gmToken);
    (getRoom(code)!.tacticalGrid as unknown as { tokens: unknown }).tokens = 5;
    // O GM parou de mandar heartbeat: o vigia vai marcá-lo offline e reenviar a sala.
    getRoom(code)!.players["peer_dono"].lastActiveAt = new Date(0).toISOString();
    expect(() => runPresenceSweep()).not.toThrow();
    expect(getRoom(code)!.players["peer_dono"].isOnline).toBe(false);
  });
});
