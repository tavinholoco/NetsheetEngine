/**
 * L.1 (ARQ-01) — O REENVIO POR DIFERENÇA, COM UM SOCKET DE VERDADE
 * =================================================================
 * Quem abre o WebSocket (ou o SSE) com `delta=1` recebe a sala inteira uma vez
 * e depois só o que mudou, com o `rev`. Quem não pede — a aba aberta antes do
 * deploy, com o JavaScript velho — segue recebendo a sala inteira: o deploy não
 * pode quebrar a mesa que está aberta (a regra de merge da H.3d).
 *
 * E o E.20: a ficha do NPC só vai ao Mestre, em toda porta que entrega a sala
 * — o reenvio, a entrada do socket, o SSE, a leitura e as respostas REST.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import { app, attachRealtime } from "../../server";
import { getRoom } from "../../server/roomManager";
import { applyRoomPatch } from "../lib/roomPatch";
import { roomViewFor } from "../../server/roomDelta";
import type { GameRoom, RoomFullMessage, RoomPatchMessage } from "../types/multiplayer";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

const abertos: WebSocket[] = [];

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

let n = 0;
function code(): string {
  n += 1;
  return `L1-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function mesa() {
  const c = code();
  const gm = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  const pj = await request(app).post("/api/rooms/join").send({ code: c, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  const gmToken = gm.body.sessionToken as string;
  await request(app).post(`/api/rooms/${c}/npcs/generate`).send({ sessionToken: gmToken });
  return { code: c, gmToken, pjToken: pj.body.sessionToken as string };
}

interface Recebido {
  textos: string[];
  salaInteira: number;
  sala: GameRoom | null;
  rev: number;
  buracos: number;
}

/** Socket aberto, com o estado inicial já recebido; aplica a diferença como o cliente. */
async function conectar(c: string, token: string, delta: boolean) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${c}?token=${token}${delta ? "&delta=1" : ""}`);
  abertos.push(ws);
  const r: Recebido = { textos: [], salaInteira: 0, sala: null, rev: -1, buracos: 0 };
  ws.on("message", (raw, isBinary) => {
    if (isBinary) return;
    const texto = raw.toString();
    r.textos.push(texto);
    const msg = JSON.parse(texto);
    if (msg.type === "room:full") {
      const m = msg as RoomFullMessage;
      r.sala = m.room;
      r.rev = m.rev;
      r.salaInteira += 1;
    } else if (msg.type === "room:patch") {
      const m = msg as RoomPatchMessage;
      if (!r.sala || m.base !== r.rev) { r.buracos += 1; return; }
      r.sala = applyRoomPatch(r.sala, m);
      r.rev = m.rev;
    } else if (msg.code && !msg.type) {
      r.sala = msg as GameRoom;
      r.salaInteira += 1;
    }
  });
  ws.on("error", () => {});
  await new Promise<void>((ok, fail) => { ws.once("open", () => ok()); ws.once("error", fail); });
  await esperarPor(() => r.sala !== null);
  return { ws, r };
}

async function esperarPor(cond: () => boolean, tetoMs = 4000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((res) => setTimeout(res, 10));
  }
  return cond();
}

const npcDe = (sala: GameRoom) => Object.values(sala.npcs ?? {})[0];

describe("L.1 — o WebSocket com delta=1", () => {
  it("a entrada é a sala inteira com o rev, e o chat depois chega como diferença, pequena", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const gm = await conectar(c, gmToken, true);
    expect(gm.r.salaInteira).toBe(1);
    expect(gm.r.rev).toBeGreaterThan(0);
    const textosAntes = gm.r.textos.length;

    const pj = await conectar(c, pjToken, true);
    pj.ws.send(JSON.stringify({ type: "message", text: "Quanto de dano?" }));
    await esperarPor(() => gm.r.sala!.chatMessages.some((m) => m.text === "Quanto de dano?"));

    const novos = gm.r.textos.slice(textosAntes).map((t) => JSON.parse(t));
    expect(novos.every((m) => m.type === "room:patch")).toBe(true);
    const doChat = novos.find((m) => m.chat)!;
    expect(doChat.players).toBeUndefined();
    expect(JSON.stringify(doChat).length).toBeLessThan(1024);
    expect(gm.r.buracos).toBe(0);
    // Depois de tudo, a sala do cliente é a vista do servidor:
    expect(gm.r.sala).toEqual(roomViewFor(getRoom(c)!, "gm"));
    gm.ws.close();
    pj.ws.close();
  });

  it("a ficha editada vai só a do jogador, e o cliente termina igual ao servidor", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const gm = await conectar(c, gmToken, true);
    const antes = gm.r.textos.length;
    const res = await request(app).post(`/api/rooms/${c}/sheet`)
      .send({ sessionToken: pjToken, sheet: { ...SHEET, eurodollars: 1234 } });
    expect(res.status).toBe(200);
    await esperarPor(() => gm.r.sala!.players.peer_vex.sheet.eurodollars === 1234);
    const patch = JSON.parse(gm.r.textos[gm.r.textos.length - 1]) as RoomPatchMessage;
    expect(gm.r.textos.length).toBeGreaterThan(antes);
    expect(Object.keys(patch.players ?? {})).toEqual(["peer_vex"]);
    expect(patch.npcs).toBeUndefined();
    expect(gm.r.sala).toEqual(roomViewFor(getRoom(c)!, "gm"));
    gm.ws.close();
  });

  it("o resync devolve a sala inteira com o rev de agora", async () => {
    const { code: c, pjToken } = await mesa();
    const pj = await conectar(c, pjToken, true);
    pj.r.sala = null;
    pj.ws.send(JSON.stringify({ type: "resync" }));
    await esperarPor(() => pj.r.sala !== null);
    expect(pj.r.salaInteira).toBe(2);
    expect(pj.r.sala).toEqual(roomViewFor(getRoom(c)!, "player"));
    pj.ws.close();
  });
});

describe("L.1 — quem não pede delta (a aba de antes do deploy)", () => {
  it("segue recebendo a sala inteira, sem type, a cada mudança", async () => {
    const { code: c, pjToken } = await mesa();
    const velho = await conectar(c, pjToken, false);
    const antes = velho.r.salaInteira;
    await request(app).post(`/api/rooms/${c}/message`).send({ sessionToken: pjToken, text: "oi" });
    await esperarPor(() => velho.r.salaInteira > antes);
    const ultimo = JSON.parse(velho.r.textos[velho.r.textos.length - 1]);
    expect(ultimo.type).toBeUndefined();
    expect(ultimo.chatMessages.some((m: { text: string }) => m.text === "oi")).toBe(true);
    velho.ws.close();
  });
});

describe("L.1 — E.20: a ficha do NPC só vai ao Mestre", () => {
  it("no socket: o jogador vê o NPC sem a ficha, na entrada e na diferença; o Mestre, com", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const gm = await conectar(c, gmToken, true);
    const pj = await conectar(c, pjToken, true);
    const velho = await conectar(c, pjToken, false);
    expect(npcDe(gm.r.sala!).sheet).toBeDefined();
    expect(npcDe(pj.r.sala!).sheet).toBeUndefined();
    expect(npcDe(velho.r.sala!).sheet).toBeUndefined();

    await request(app).post(`/api/rooms/${c}/npcs/generate`).send({ sessionToken: gmToken });
    await esperarPor(() => Object.keys(pj.r.sala!.npcs ?? {}).length === 2 && Object.keys(gm.r.sala!.npcs ?? {}).length === 2);
    expect(Object.values(pj.r.sala!.npcs!).every((n) => n.sheet === undefined)).toBe(true);
    expect(Object.values(gm.r.sala!.npcs!).every((n) => n.sheet !== undefined)).toBe(true);
    // Nenhum texto que chegou ao jogador leva a ficha de NPC (o id da ficha gerada):
    const fichaNpc = JSON.stringify(Object.values(getRoom(c)!.npcs!).map((n) => n.sheet.stats));
    expect(pj.r.textos.join("").includes(fichaNpc)).toBe(false);
    gm.ws.close();
    pj.ws.close();
    velho.ws.close();
  });

  it("na leitura e nas respostas REST: o jogador recebe a sala sem a ficha do NPC", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const leitura = await request(app).get(`/api/rooms/${c}`).set("X-Session-Token", pjToken);
    expect(npcDe(leitura.body).sheet).toBeUndefined();
    const doMestre = await request(app).get(`/api/rooms/${c}`).set("X-Session-Token", gmToken);
    expect(npcDe(doMestre.body).sheet).toBeDefined();
    const chat = await request(app).post(`/api/rooms/${c}/message`).send({ sessionToken: pjToken, text: "oi" });
    expect(npcDe(chat.body).sheet).toBeUndefined();
    const rolagem = await request(app).post(`/api/rooms/${c}/roll`).send({ sessionToken: pjToken, kind: "save" });
    expect(npcDe(rolagem.body.room).sheet).toBeUndefined();
    // A sala do servidor (a que vai para o banco) não perdeu nada:
    expect(npcDe(getRoom(c)!).sheet).toBeDefined();
  });

  it("no SSE com delta=1: a entrada é a sala inteira com o rev, sem a ficha do NPC para o jogador", async () => {
    const { code: c, pjToken } = await mesa();
    const primeiro = await new Promise<string>((ok, fail) => {
      const req = http.get(`http://127.0.0.1:${port}/api/rooms/${c}/stream?token=${pjToken}&delta=1`, (res) => {
        let buf = "";
        res.on("data", (chunk) => {
          buf += chunk.toString();
          const fim = buf.indexOf("\n\n");
          if (fim >= 0) { ok(buf.slice(0, fim)); req.destroy(); }
        });
      });
      req.on("error", fail);
    });
    const msg = JSON.parse(primeiro.replace(/^data: /, "")) as RoomFullMessage;
    expect(msg.type).toBe("room:full");
    expect(msg.rev).toBeGreaterThan(0);
    expect(npcDe(msg.room).sheet).toBeUndefined();
  });
});

describe("L.1 — o /sheet responde sem a sala", () => {
  it("a resposta é { ok: true }, e a ficha chega à mesa pelo reenvio", async () => {
    const { code: c, pjToken } = await mesa();
    const res = await request(app).post(`/api/rooms/${c}/sheet`)
      .send({ sessionToken: pjToken, sheet: { ...SHEET, eurodollars: 99 } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(getRoom(c)!.players.peer_vex.sheet.eurodollars).toBe(99);
  });
});
