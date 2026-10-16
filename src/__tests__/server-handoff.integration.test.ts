/**
 * Fase H (H.3d — H.13) — A INSTÂNCIA QUE ENTREGA O BASTÃO
 * ======================================================
 * Quando a instância nova pede o bastão, a velha para de aceitar ações, fecha
 * os sockets, grava tudo e só então marca que entregou (o módulo e os tempos
 * estão em instance-lease.test.ts). Aqui, o que o servidor faz nessa entrega,
 * com sockets de verdade:
 *   - toda rota da mesa responde `503 server_restarting` — o cliente tenta de
 *     novo sozinho, e a ação cai na instância nova quando o Render trocar;
 *   - o health segue 200 (o Render reinicia instância que para de responder);
 *   - o WebSocket aberto fecha com 1012 (Service Restart), o stream SSE acaba,
 *     e um WebSocket novo é recusado;
 *   - a mesa vai ao banco ANTES de a entrega terminar, e nada depois dela.
 *
 * Um arquivo só para isto: depois da entrega, este processo de teste não serve
 * mais mesa nenhuma — como a instância velha.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import { app, attachRealtime, drainForHandoff } from "../../server";
import { STATUS_BY_CODE } from "../../server/errors";
import { postChatMessage } from "../../server/roomManager";
import { queueRoomPersist, setPersistenceClientForTests } from "../../server/roomPersistence";

const SHEET = { handle: "Ana", role: "Solo", stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 } };

let server: http.Server;
let port: number;
const abertos: WebSocket[] = [];
const gravadas: { code: string; chat: number }[] = [];

beforeAll(async () => {
  setPersistenceClientForTests({
    from: () => ({
      upsert: async (row: { code: string; room_state: { chatMessages: unknown[] } }) => {
        gravadas.push({ code: row.code, chat: row.room_state.chatMessages.length });
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) })
    })
  } as never);
  server = http.createServer(app);
  attachRealtime(server);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  setPersistenceClientForTests(null);
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

async function esperarPor(cond: () => boolean, ms = 3000): Promise<boolean> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return cond();
}

describe("a entrega do bastão (drainForHandoff)", () => {
  const code = `H3D-${Date.now().toString(36).slice(-5)}`.toUpperCase();
  let gmToken = "";
  let anaToken = "";

  it("server_restarting é 503 na tabela dos códigos", () => {
    expect(STATUS_BY_CODE.server_restarting).toBe(503);
  });

  it("entrega: avisa, aceita ações na carência, fecha o WebSocket com 1012, acaba o stream, grava a mesa — e só então resolve", async () => {
    const gm = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "GM", gmPeerId: "peer_gm_h3d" });
    gmToken = gm.body.sessionToken;
    const ana = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_ana_h3d", handle: "Ana", sheet: SHEET });
    anaToken = ana.body.sessionToken;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${anaToken}`);
    abertos.push(ws);
    let fechou: number | null = null;
    const textos: string[] = [];
    ws.on("close", (c) => (fechou = c));
    ws.on("message", (raw, bin) => { if (!bin) textos.push(raw.toString()); });
    ws.on("error", () => {});
    await new Promise<void>((r, j) => { ws.once("open", () => r()); ws.once("error", j); });

    let streamAcabou = false;
    let streamComecou = false;
    let streamTexto = "";
    const sse = http.get(`http://127.0.0.1:${port}/api/rooms/${code}/stream?token=${gmToken}`, (res) => {
      res.on("data", (chunk) => {
        streamComecou = true;
        streamTexto += chunk.toString();
      });
      res.on("end", () => (streamAcabou = true));
      res.on("close", () => (streamAcabou = true));
    });
    sse.on("error", () => (streamAcabou = true));
    expect(await esperarPor(() => streamComecou)).toBe(true);

    // A última ação antes do pedido: ainda no debounce, sem gravar.
    postChatMessage(code, "peer_gm_h3d", "a última antes da troca");
    queueRoomPersist(code);
    const chatAntes = (await request(app).get(`/api/rooms/${code}`).set("X-Session-Token", gmToken)).body.chatMessages.length;

    // H.3d.4 — no ar, o proxy do Render segurou o FECHAMENTO do socket por 13–16 s, e a
    // tela mandou uma mensagem pelo socket morto. Por isso a entrega AVISA primeiro, por
    // um quadro de dados (que chega na hora), e segue aceitando ações por uma carência.
    const entrega = drainForHandoff("claimed", { graceMs: 600 });
    expect(await esperarPor(() => textos.some((t) => t.includes('"server_restarting"')))).toBe(true);
    const aviso = JSON.parse(textos.find((t) => t.includes('"server_restarting"'))!);
    // `type: error`: o navegador com o bundle de antes só mostra o texto, não quebra a sala.
    expect(aviso).toMatchObject({ type: "error", code: "server_restarting" });

    // Na carência: a mensagem que já vinha pelo socket ainda é executada…
    ws.send(JSON.stringify({ type: "message", text: "pelo socket, na carência" }));
    // …o REST também…
    const rest = await request(app).post(`/api/rooms/${code}/message`).send({ sessionToken: gmToken, text: "pelo REST, na carência" });
    expect(rest.status).toBe(200);
    // …mas conexão nova não: ela ficaria presa à velha, que vai fechar.
    const upgradeNaCarencia = await new Promise<number>((resolve) => {
      const w2 = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${gmToken}`);
      abertos.push(w2);
      w2.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      w2.on("open", () => resolve(101));
      w2.on("error", () => {});
    });
    expect(upgradeNaCarencia).toBe(503);

    await entrega;

    // O banco tem a mesa com as duas da carência.
    expect(gravadas.filter((g) => g.code === code).at(-1)?.chat).toBe(chatAntes + 2);
    expect(await esperarPor(() => fechou !== null)).toBe(true);
    expect(fechou).toBe(1012);
    expect(await esperarPor(() => streamAcabou)).toBe(true);
    // O EventSource reconecta sozinho de um stream que ACABA — e o `retry` diz quando.
    expect(streamTexto).toMatch(/retry: 1500\n\n$/);
    sse.destroy();
  });

  it("o stream SSE pedido depois da entrega: 200, 'tente de novo em 1,5 s', e fim — nunca um 503", async () => {
    // O EventSource desiste PARA SEMPRE de uma resposta que não é 200: quem está
    // no SSE ficaria sem a mesa depois de todo deploy.
    const res = await request(app).get(`/api/rooms/${code}/stream?token=${gmToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.text).toBe("retry: 1500\n\n");
  });

  it("depois da entrega, as rotas da mesa respondem 503 server_restarting — sem executar nada", async () => {
    const gravadasAntes = gravadas.length;
    const chat = await request(app).post(`/api/rooms/${code}/message`).send({ sessionToken: gmToken, text: "depois da troca" });
    expect(chat.status).toBe(503);
    expect(chat.body.code).toBe("server_restarting");
    const join = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_beto_h3d", handle: "Beto", sheet: SHEET });
    expect(join.status).toBe(503);
    const create = await request(app).post("/api/rooms/create").send({ code: "OUTRA-H3D", name: "M", gmHandle: "G", gmPeerId: "g" });
    expect(create.status).toBe(503);
    const leitura = await request(app).get(`/api/rooms/${code}`).set("X-Session-Token", gmToken);
    expect(leitura.status).toBe(503);
    await new Promise((r) => setTimeout(r, 2_500)); // o debounce, se alguma ação tivesse passado
    expect(gravadas.length).toBe(gravadasAntes);
  });

  it("o health segue 200 — o Render reinicia a instância que para de responder", async () => {
    const h = await request(app).get("/api/health");
    expect(h.status).toBe(200);
  });

  it("um WebSocket novo é recusado com 503", async () => {
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${anaToken}`);
      abertos.push(ws);
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => resolve(101));
      ws.on("error", () => {});
    });
    expect(status).toBe(503);
  });
});
