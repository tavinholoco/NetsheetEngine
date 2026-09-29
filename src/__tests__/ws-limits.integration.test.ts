/**
 * Revisão pós-D (R.4 — SEC-10) — O WEBSOCKET GANHA OS TETOS DO REST
 * ==================================================================
 * Cada mensagem aceita na mesa reenvia a sala inteira a todas as conexões
 * (ARQ-01): ~48 KB × 5 conexões ≈ 250 KB por mensagem, pela medição de 26/09.
 * O WebSocket não tinha limitador nem teto de quadro, então 10 mensagens/s de
 * um script gastavam os 5 GB do workspace do Render em ~35 min — e a cota
 * estourada desliga este serviço e o Newra News até o mês seguinte.
 *
 * O que estes testes medem é a propriedade do contrato de custo: mensagens
 * acima do teto NÃO geram reenvio da sala. Com um socket de verdade, porque é
 * o transporte que a mesa usa.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import { app, attachRealtime } from "../../server";
import { getRoom } from "../../server/roomManager";
import { WS_LIMITS, WsRateLimiter } from "../../server/wsLimits";

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

/** Todo socket aberto nos testes — encerrado no fim mesmo se um teste falhar no meio. */
const abertos: WebSocket[] = [];

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

let n = 0;
function code(): string {
  n += 1;
  return `R4-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function mesa() {
  const c = code();
  const gm = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  const pj = await request(app).post("/api/rooms/join").send({ code: c, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  return { code: c, gmToken: gm.body.sessionToken as string, pjToken: pj.body.sessionToken as string };
}

/** Socket aberto, com o estado inicial já recebido, contando o que chega. */
async function conectar(c: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${c}?token=${token}`);
  abertos.push(ws);
  const recebido = { salas: 0, erros: [] as string[], binarios: 0, fechou: null as number | null };
  ws.on("message", (raw, isBinary) => {
    if (isBinary) { recebido.binarios += 1; return; }
    const msg = JSON.parse(raw.toString());
    if (msg && msg.type === "error") recebido.erros.push(String(msg.error));
    else if (msg && msg.code) recebido.salas += 1;
  });
  ws.on("close", (codigo) => { recebido.fechou = codigo; });
  ws.on("error", () => {});
  await new Promise<void>((r, j) => { ws.once("open", () => r()); ws.once("error", j); });
  await esperarPor(() => recebido.salas >= 1);
  return { ws, recebido };
}

async function esperarPor(cond: () => boolean, tetoMs = 4000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}

/** Espera o fluxo parar: nenhuma novidade por `quietoMs`. */
async function esperarSilencio(ler: () => number, quietoMs = 300, tetoMs = 5000): Promise<void> {
  const limite = Date.now() + tetoMs;
  let ultimo = ler();
  let desde = Date.now();
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 25));
    const agora = ler();
    if (agora !== ultimo) { ultimo = agora; desde = Date.now(); }
    else if (Date.now() - desde >= quietoMs) return;
  }
}

describe("R.4 — SEC-10: flood pelo WebSocket", () => {
  it("100 mensagens de chat não viram 100 reenvios da sala — só o teto do chat do REST (30)", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const gm = await conectar(c, gmToken);
    const hostil = await conectar(c, pjToken);
    const antes = getRoom(c)!.chatMessages.length;
    const salasAntes = gm.recebido.salas;

    for (let i = 0; i < 100; i++) hostil.ws.send(JSON.stringify({ type: "message", text: `flood ${i}` }));
    await esperarSilencio(() => gm.recebido.salas);

    const reenvios = gm.recebido.salas - salasAntes;
    expect(reenvios).toBeLessThanOrEqual(WS_LIMITS.perWindow.chat);
    expect(getRoom(c)!.chatMessages.length - antes).toBeLessThanOrEqual(WS_LIMITS.perWindow.chat);
    // O autor fica sabendo uma vez só (o aviso também é banda):
    expect(hostil.recebido.erros.length).toBe(1);

    gm.ws.close();
    hostil.ws.close();
  });

  it("um quadro maior que o teto (1 MiB) derruba o socket com 1009, sem chegar à sala", async () => {
    const { code: c, pjToken } = await mesa();
    const hostil = await conectar(c, pjToken);
    const antes = getRoom(c)!.chatMessages.length;

    hostil.ws.send(JSON.stringify({ type: "message", text: "x".repeat(WS_LIMITS.maxPayloadBytes + 1024) }));
    expect(await esperarPor(() => hostil.recebido.fechou !== null)).toBe(true);
    expect(hostil.recebido.fechou).toBe(1009);
    expect(getRoom(c)!.chatMessages.length).toBe(antes);
  });

  it("awareness inchado (maior que 4 KiB) não é repassado à mesa", async () => {
    const { code: c, gmToken, pjToken } = await mesa();
    const gm = await conectar(c, gmToken);
    const hostil = await conectar(c, pjToken);
    await esperarSilencio(() => gm.recebido.binarios);
    const binAntes = gm.recebido.binarios;

    const awareness = new awarenessProtocol.Awareness(new Y.Doc());
    awareness.setLocalState({ lixo: "x".repeat(10_000) });
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 1); // messageAwareness
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]));
    hostil.ws.send(encoding.toUint8Array(enc));

    await esperarSilencio(() => gm.recebido.binarios, 400);
    expect(gm.recebido.binarios).toBe(binAntes);
    awareness.destroy();
    gm.ws.close();
    hostil.ws.close();
  });

  it("abrir sockets demais com o mesmo token fecha os mais antigos (cada um recebe cada reenvio)", async () => {
    const { code: c, pjToken } = await mesa();
    const sockets: Awaited<ReturnType<typeof conectar>>[] = [];
    for (let i = 0; i < WS_LIMITS.maxSocketsPerPeer + 2; i++) sockets.push(await conectar(c, pjToken));
    await esperarPor(() => sockets.filter((s) => s.recebido.fechou !== null).length >= 2);
    const abertos = sockets.filter((s) => s.recebido.fechou === null);
    expect(abertos.length).toBe(WS_LIMITS.maxSocketsPerPeer);
    // Fecham os primeiros, não os novos:
    expect(sockets[0].recebido.fechou).not.toBeNull();
    expect(sockets[sockets.length - 1].recebido.fechou).toBeNull();
    for (const s of sockets) s.ws.close();
  });
});

describe("R.4 — as contas do limitador", () => {
  it("são por jogador, e reconectar não zera a cota dentro da janela", () => {
    let agora = 1_000_000;
    const lim = new WsRateLimiter(() => agora);
    for (let i = 0; i < WS_LIMITS.perWindow.chat; i++) expect(lim.allow("S", "p1", "chat")).toBe(true);
    expect(lim.allow("S", "p1", "chat")).toBe(false);
    expect(lim.justExceeded("S", "p1", "chat")).toBe(true);
    expect(lim.allow("S", "p1", "chat")).toBe(false);
    expect(lim.justExceeded("S", "p1", "chat")).toBe(false); // o aviso sai uma vez
    // Outro jogador e outro orçamento têm conta própria:
    expect(lim.allow("S", "p2", "chat")).toBe(true);
    expect(lim.allow("S", "p1", "action")).toBe(true);
    // A janela vence, a cota volta:
    agora += WS_LIMITS.windowMs;
    expect(lim.allow("S", "p1", "chat")).toBe(true);
  });
});
