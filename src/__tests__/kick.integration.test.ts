/**
 * Revisão pós-D (R.3 — SEC-09) — EXPULSAR TIRA O ACESSO, NÃO SÓ O ASSENTO
 * =======================================================================
 * O `deleteGeneratedPlayer` (o "remover" do GM) apagava o jogador da sala, mas
 * não revogava a sessão nem fechava o socket: o expulso reabria o WebSocket
 * com o mesmo token e seguia recebendo a sala inteira — fichas e chat. A saída
 * voluntária (`leaveRoom`) sempre revogou; a expulsão não.
 *
 * Revogar sozinho criaria outro problema: no primeiro 401, a reconexão
 * automática do cliente (T3.3) faria um `join` novo com o mesmo peerId — e o
 * expulso estaria de volta em segundos. Por isso a sala guarda quem o GM
 * removeu, e o `join` por esse peerId responde 403 `removed_by_gm`. Não é
 * banimento (sem conta, uma aba nova é outro jogador — R.11): é o que faz a
 * expulsão valer contra a reconexão automática.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { app } from "../../server";
import {
  createRoom,
  joinRoom,
  getRoom,
  verifySession,
  deleteGeneratedPlayer,
  restoreRoom
} from "../../server/roomManager";

const SHEET = {
  handle: "Intruso",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let n = 0;
function code(): string {
  n += 1;
  return `R3-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function esperarPor(cond: () => boolean, tetoMs = 3000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}

describe("R.3 — SEC-09: a expulsão revoga", () => {
  it("o token do expulso deixa de valer; o do GM e o dos outros, não", () => {
    const c = code();
    const gm = createRoom(c, "Mesa", "Dono", "peer_dono");
    const intruso = joinRoom(c, "peer_intruso", "Intruso", SHEET as any)!;
    const vex = joinRoom(c, "peer_vex", "Vex", { ...SHEET, handle: "Vex" } as any)!;

    deleteGeneratedPlayer(c, "peer_dono", "peer_intruso");

    expect(getRoom(c)!.players.peer_intruso).toBeUndefined();
    expect(verifySession(c, intruso.sessionToken)).toBeNull(); // o sintoma de 29/09
    expect(verifySession(c, gm.sessionToken)).toBe("peer_dono");
    expect(verifySession(c, vex.sessionToken)).toBe("peer_vex");
  });

  it("a reconexão automática não traz o expulso de volta pelo mesmo peerId", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    joinRoom(c, "peer_intruso", "Intruso", SHEET as any);
    deleteGeneratedPlayer(c, "peer_dono", "peer_intruso");

    expect(joinRoom(c, "peer_intruso", "Intruso", SHEET as any)).toBeNull();
    expect(getRoom(c)!.players.peer_intruso).toBeUndefined();
  });

  it("a lista de removidos sobrevive ao restart (vai no estado da sala) e tem teto", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    for (let i = 0; i < 60; i++) {
      joinRoom(c, `peer_${i}`, `J${i}`, SHEET as any);
      deleteGeneratedPlayer(c, "peer_dono", `peer_${i}`);
    }
    const removidos = getRoom(c)!.removedPeerIds!;
    expect(removidos.length).toBe(50);
    expect(removidos).toContain("peer_59");
    expect(removidos).not.toContain("peer_0"); // o mais antigo sai primeiro

    // Snapshot do banco, restaurado num processo novo:
    const snapshot = JSON.parse(JSON.stringify(getRoom(c)));
    expect(restoreRoom(snapshot)).toBe(true);
    expect(joinRoom(c, "peer_59", "J59", SHEET as any)).toBeNull();
  });

  it("remover NPC gerado não entra na lista (não é gente)", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    deleteGeneratedPlayer(c, "peer_dono", "nao_existe");
    expect(getRoom(c)!.removedPeerIds ?? []).toEqual([]);
  });
});

describe("R.3 — pela API", () => {
  let server: http.Server;
  let port: number;
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  async function mesaComIntruso() {
    const c = code();
    const gm = await request(app)
      .post("/api/rooms/create")
      .send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono_api" });
    const intruso = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_intruso_api", handle: "Intruso", sheet: SHEET });
    return { code: c, gmToken: gm.body.sessionToken as string, intrusoToken: intruso.body.sessionToken as string };
  }

  it("o stream SSE aberto do expulso é encerrado", async () => {
    const { code: c, gmToken, intrusoToken } = await mesaComIntruso();

    let recebeuEstado = false;
    let encerrou = false;
    const req = http.get(`http://127.0.0.1:${port}/api/rooms/${c}/stream?token=${intrusoToken}`, (res) => {
      res.on("data", () => { recebeuEstado = true; });
      res.on("end", () => { encerrou = true; });
      res.on("close", () => { encerrou = true; });
    });
    req.on("error", () => { encerrou = true; });
    expect(await esperarPor(() => recebeuEstado)).toBe(true);

    const kick = await request(app)
      .post(`/api/rooms/${c}/players/peer_intruso_api/delete`)
      .send({ sessionToken: gmToken });
    expect(kick.status).toBe(200);

    const fechou = await esperarPor(() => encerrou);
    req.destroy();
    expect(fechou, "o stream do expulso continuou aberto").toBe(true);
  });

  it("depois da expulsão: stream novo 401, e o join pelo mesmo peerId 403 removed_by_gm", async () => {
    const { code: c, gmToken, intrusoToken } = await mesaComIntruso();
    await request(app).post(`/api/rooms/${c}/players/peer_intruso_api/delete`).send({ sessionToken: gmToken });

    const stream = await request(app).get(`/api/rooms/${c}/stream?token=${intrusoToken}`);
    expect(stream.status).toBe(401);

    const volta = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_intruso_api", handle: "Intruso", sheet: SHEET });
    expect(volta.status).toBe(403);
    expect(volta.body.code).toBe("removed_by_gm");
  });
});
