/**
 * Fase J (J.1e — SEC-18) — A MEMÓRIA DO SERVIDOR SEM TETO POR DOIS CAMINHOS
 * ==========================================================================
 * A E.03 (SEC-15) derrubou o socket que não lê — mas só no reenvio da SALA. Os
 * outros envios iam direto ao `ws.send`, e o SSE não tinha o teto de conexões
 * por jogador que a R.4 deu ao WebSocket. Medido em 17/10/2026, com o `app` e o
 * `attachRealtime` num servidor local:
 *
 *  - REPASSE DO AWARENESS: oito jogadores mandando o awareness que a R.4 deixa
 *    (1.200 quadros de ~4 KB por minuto, cada um) a 3 sockets que não leem: o
 *    buffer de cada socket chegou a 33 MB (o teto da E.03 é 1 MiB), linear, e só
 *    um reenvio da sala o derrubou. Na sala do próprio atacante — criar sala não
 *    exige login no servidor —, não há reenvio nenhum;
 *  - SSE: 150 streams abertos com o token de UM assento, todos aceitos, e cada
 *    um recebe a sala inteira a cada mudança — o processo subiu ~135 MB num só
 *    reenvio de uma sala de 882 KB. O limitador global (600/min por IP) abre
 *    ~450 em 45 s: o bastante para a instância de 512 MB.
 *
 * Os dois testes abaixo usam outros caminhos que o mesmo defeito deixava sem
 * teto: o doc do grid devolvido a quem pede (`syncStep2`) e o número de streams.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import { app, attachRealtime } from "../../server";
import { WS_LIMITS } from "../../server/wsLimits";
import { MAX_GRID_SIDE, MAX_GRID_TOKENS } from "../lib/gridDoc";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let server: http.Server;
let port: number;
const abertos: WebSocket[] = [];
const pedidos: http.ClientRequest[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  for (const p of pedidos) p.destroy();
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

let n = 0;
const novoCodigo = (p: string) => `${p}-${Date.now().toString(36).slice(-4)}-${++n}`.toUpperCase();

async function mesa(prefixo: string) {
  const code = novoCodigo(prefixo);
  const gm = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  const pj = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  return { code, gmToken: gm.body.sessionToken as string, pjToken: pj.body.sessionToken as string };
}

async function esperarPor(cond: () => boolean, tetoMs = 4000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return cond();
}

/** O maior grid que a forma deixa (SEC-14): o doc dele passa de 100 KB. */
function gridGrande() {
  return {
    rows: MAX_GRID_SIDE,
    cols: MAX_GRID_SIDE,
    theme: "alley",
    tokens: Array.from({ length: MAX_GRID_TOKENS }, (_, i) => ({
      id: `t${i}_${"i".repeat(100)}`,
      name: "n".repeat(120),
      type: "npc",
      x: i % MAX_GRID_SIDE,
      y: Math.floor(i / MAX_GRID_SIDE),
      peerId: "p".repeat(128),
      role: "r".repeat(120),
      status: "s".repeat(60),
      color: "#ffffff",
      icon: "c".repeat(120)
    }))
  };
}

describe("J.1e (SEC-18) — o teto do socket lento vale em todo envio, não só no reenvio da sala", () => {
  it("o socket que pede o doc do grid e não lê é derrubado", async () => {
    const { code, gmToken, pjToken } = await mesa("BP");
    const grid = await request(app).post(`/api/rooms/${code}/tactical-grid`).send({ sessionToken: gmToken, gridState: gridGrande() });
    expect(grid.status).toBe(200);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${pjToken}`, { perMessageDeflate: false });
    abertos.push(ws);
    ws.on("error", () => {});
    await new Promise<void>((r) => ws.once("open", () => r()));
    let fechou = false;
    ws.once("close", () => (fechou = true));
    const tcp = (ws as unknown as { _socket: { pause(): void; resume(): void } })._socket;
    tcp.pause();

    // syncStep1 com o vetor de estado vazio: o servidor responde o doc inteiro.
    // 100 cabem no orçamento de sync da R.4 (120 por janela).
    const syncStep1 = Buffer.from([0, 0, 1, 0]);
    for (let i = 0; i < 100; i++) ws.send(syncStep1);
    await new Promise((r) => setTimeout(r, 1500));

    // Volta a ler: se o servidor derrubou o socket, o cliente vê o fechamento
    // depois de esvaziar o que já tinha chegado; se não, o socket segue aberto.
    tcp.resume();
    expect(await esperarPor(() => fechou, 8000)).toBe(true);
  }, 30_000);
});

describe("J.1e (SEC-18) — streams SSE por jogador", () => {
  /** Abre o stream e devolve quando ele termina (ou nunca). */
  function abrirStream(code: string, token: string): Promise<{ acabou: () => boolean }> {
    return new Promise((resolve, reject) => {
      let fim = false;
      const req = http.get(`http://127.0.0.1:${port}/api/rooms/${code}/stream?token=${token}`, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`stream ${res.statusCode}`));
        res.on("data", () => {});
        res.on("end", () => (fim = true));
        res.on("close", () => (fim = true));
        resolve({ acabou: () => fim });
      });
      req.on("error", () => (fim = true));
      pedidos.push(req);
    });
  }

  it(`mais de ${WS_LIMITS.maxSocketsPerPeer} streams com o mesmo token fecham os mais antigos, como no WebSocket (R.4)`, async () => {
    const { code, pjToken } = await mesa("SSE");
    const streams: { acabou: () => boolean }[] = [];
    for (let i = 0; i < WS_LIMITS.maxSocketsPerPeer + 2; i++) streams.push(await abrirStream(code, pjToken));

    expect(await esperarPor(() => streams.filter((s) => s.acabou()).length >= 2, 2000)).toBe(true);
    expect(streams.filter((s) => !s.acabou()).length).toBe(WS_LIMITS.maxSocketsPerPeer);
    // Fecham os primeiros, não os novos:
    expect(streams[0].acabou()).toBe(true);
    expect(streams[streams.length - 1].acabou()).toBe(false);
  });
});
