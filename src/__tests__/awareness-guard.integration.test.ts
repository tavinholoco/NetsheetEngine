/**
 * Fase J (J.1d — SEC-17) — O AWARENESS DO YJS ENTRAVA CRU NA TELA DOS OUTROS
 * ===========================================================================
 * O awareness é o canal do cursor do GM no grid (T5.3). O servidor o repassava
 * à mesa como vinha: a R.4 deu teto de tamanho (4 KiB) e de ritmo, e ninguém
 * conferia QUEM escrevia nem O QUE vinha dentro. Reproduzido em 17/10/2026 no
 * build de produção local, com o GM no navegador e um convidado num script:
 *
 *  - o convidado publica um cursor com o nome "Mestre": na tela do GM aparece
 *    "👁 Mestre", na cor do GM — o servidor não conferia quem tem cursor;
 *  - com um nome que não é texto (um objeto), o React lança ao desenhar o
 *    grid, e o ErrorBoundary global troca o APP INTEIRO de quem está na aba do
 *    grid pela tela de erro. Recarregar não adianta: a página nova pede o
 *    awareness da mesa e cai de novo, enquanto o convidado renovar o estado.
 *
 * As regras, no limite do servidor e antes de aplicar o update: um socket
 * escreve um cliente só (o primeiro `clientID` que usar, e nenhum que já seja
 * de outro socket); o estado tem a forma do cliente do app; cursor, só do GM;
 * e o estado de quem fecha o socket sai da mesa na hora.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { app, attachRealtime } from "../../server";

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

let n = 0;
const novoCodigo = () => `AW-${Date.now().toString(36).slice(-4)}-${++n}`.toUpperCase();

async function mesa() {
  const code = novoCodigo();
  const gm = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  const pj = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  return { code, gmToken: gm.body.sessionToken as string, pjToken: pj.body.sessionToken as string };
}

type Entrada = { clientID: number; clock: number; state: unknown };

/** Um quadro y-websocket de awareness com as entradas dadas, montado à mão. */
function quadro(entradas: Entrada[]): Uint8Array {
  const update = encoding.createEncoder();
  encoding.writeVarUint(update, entradas.length);
  for (const e of entradas) {
    encoding.writeVarUint(update, e.clientID);
    encoding.writeVarUint(update, e.clock);
    encoding.writeVarString(update, JSON.stringify(e.state));
  }
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 1); // messageAwareness
  encoding.writeVarUint8Array(enc, encoding.toUint8Array(update));
  return encoding.toUint8Array(enc);
}

/** Socket aberto, guardando cada entrada de awareness que o servidor repassa. */
async function conectar(code: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${token}`);
  abertos.push(ws);
  const recebido: Entrada[] = [];
  ws.on("message", (raw: Buffer, isBinary) => {
    if (!isBinary) return;
    const d = decoding.createDecoder(new Uint8Array(raw));
    if (decoding.readVarUint(d) !== 1) return;
    const u = decoding.createDecoder(decoding.readVarUint8Array(d));
    const len = decoding.readVarUint(u);
    for (let i = 0; i < len; i++) {
      const clientID = decoding.readVarUint(u);
      const clock = decoding.readVarUint(u);
      recebido.push({ clientID, clock, state: JSON.parse(decoding.readVarString(u)) });
    }
  });
  ws.on("error", () => {});
  await new Promise<void>((r, j) => {
    ws.once("open", () => r());
    ws.once("error", j);
  });
  return { ws, recebido, de: (clientID: number) => recebido.filter((e) => e.clientID === clientID) };
}

async function esperarPor(cond: () => boolean, tetoMs = 3000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GM_ID = 1001;
const PJ_ID = 2002;
const cursorDoGm = { user: { name: "Dono", peerId: "peer_dono" }, cursor: { x: 0.25, y: 0.75 } };

describe("J.1d (SEC-17) — o awareness que o servidor repassa", () => {
  it("o cursor do GM, na forma do app, chega aos jogadores (controle)", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    gm.ws.send(quadro([{ clientID: GM_ID, clock: 1, state: cursorDoGm }]));
    expect(await esperarPor(() => pj.de(GM_ID).length > 0)).toBe(true);
    expect(pj.de(GM_ID)[0].state).toEqual(cursorDoGm);
  });

  it("um jogador não publica cursor: só o GM tem cursor na tela (o '👁 Mestre' do convidado)", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    pj.ws.send(quadro([{ clientID: PJ_ID, clock: 1, state: { user: { name: "Mestre", peerId: "peer_vex" }, cursor: { x: 0.5, y: 0.5 } } }]));
    await pausa(400);
    expect(gm.de(PJ_ID)).toEqual([]);
  });

  it("estado fora da forma não passa — nem do GM: o nome tem de ser texto", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    gm.ws.send(quadro([{ clientID: GM_ID, clock: 1, state: { user: { name: { nao: "é texto" } }, cursor: { x: 0.5, y: 0.5 } } }]));
    gm.ws.send(quadro([{ clientID: GM_ID, clock: 2, state: { user: { name: "Dono" }, cursor: { x: 5, y: 0.5 } } }]));
    gm.ws.send(quadro([{ clientID: GM_ID, clock: 3, state: { user: { name: "Dono" }, lixo: "x" } }]));
    await pausa(400);
    expect(pj.de(GM_ID)).toEqual([]);
  });

  it("um socket não escreve o estado de outro cliente da mesa", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    gm.ws.send(quadro([{ clientID: GM_ID, clock: 1, state: cursorDoGm }]));
    expect(await esperarPor(() => pj.de(GM_ID).length > 0)).toBe(true);

    // O jogador reescreve o cliente do GM, com relógio maior.
    pj.ws.send(quadro([{ clientID: GM_ID, clock: 50, state: { user: { name: "Vex", peerId: "peer_vex" } } }]));
    await pausa(400);
    expect(gm.de(GM_ID)).toEqual([]);
  });

  it("um quadro com mais de um cliente é recusado inteiro", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    const presenca = { user: { name: "Vex", peerId: "peer_vex" } };
    pj.ws.send(quadro([
      { clientID: PJ_ID, clock: 1, state: presenca },
      { clientID: 3003, clock: 1, state: presenca }
    ]));
    await pausa(400);
    expect(gm.de(PJ_ID)).toEqual([]);
    expect(gm.de(3003)).toEqual([]);
  });

  it("quem fecha o socket sai da mesa na hora — não 30 s depois", async () => {
    const { code, gmToken, pjToken } = await mesa();
    const gm = await conectar(code, gmToken);
    const pj = await conectar(code, pjToken);

    gm.ws.send(quadro([{ clientID: GM_ID, clock: 1, state: cursorDoGm }]));
    expect(await esperarPor(() => pj.de(GM_ID).length > 0)).toBe(true);

    gm.ws.close();
    expect(await esperarPor(() => pj.de(GM_ID).some((e) => e.state === null), 2000)).toBe(true);
  });
});
