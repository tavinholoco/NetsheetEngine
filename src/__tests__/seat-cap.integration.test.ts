/**
 * Revisão pós-D (R.16 — SEC-13) — A SALA TEM UM NÚMERO DE LUGARES
 * ===============================================================
 * Achado do portão das R.1–R.6. Cada `join` com um `peerId` novo criava um
 * assento, sem teto; cada assento abre até 3 sockets (R.4), e cada socket
 * recebe cada reenvio da sala (~48 KB). Dezenas de assentos multiplicavam a
 * banda do workspace — o mesmo amplificador do SEC-10, por outra porta.
 *
 * O teto conta TODO assento da sala — GM, jogadores e fichas geradas pelo GM.
 * Contar só "humanos" pelo prefixo do peerId seria contornável: o peerId vem
 * do cliente, e bastaria entrar como `edgerunner_x`.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import {
  createRoom,
  joinRoom,
  getRoom,
  deleteGeneratedPlayer,
  generateRoomPlayerEdgerunner,
  MAX_SEATS_PER_ROOM
} from "../../server/roomManager";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let n = 0;
function code(): string {
  n += 1;
  return `R16-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

/** Enche a sala até o teto; devolve o token do último que entrou. */
function encher(c: string): string {
  let ultimo = "";
  for (let i = 0; Object.keys(getRoom(c)!.players).length < MAX_SEATS_PER_ROOM; i++) {
    ultimo = joinRoom(c, `peer_${i}`, `J${i}`, SHEET as any)!.sessionToken;
  }
  return ultimo;
}

describe("R.16 — SEC-13: teto de assentos", () => {
  it("o teto é de uma mesa de verdade, com folga — e existe", () => {
    expect(MAX_SEATS_PER_ROOM).toBeGreaterThanOrEqual(12);
    expect(MAX_SEATS_PER_ROOM).toBeLessThanOrEqual(20);
  });

  it("100 joins de peerIds novos não criam 100 assentos (o flood do portão)", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    for (let i = 0; i < 100; i++) joinRoom(c, `flood_${i}`, `F${i}`, SHEET as any);
    expect(Object.keys(getRoom(c)!.players).length).toBe(MAX_SEATS_PER_ROOM);
  });

  it("com a sala cheia: assento novo é recusado, mas quem está volta ao próprio", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    const token = encher(c);
    const ultimo = `peer_${MAX_SEATS_PER_ROOM - 2}`;

    expect(joinRoom(c, "peer_atrasado", "Atrasado", SHEET as any)).toBeNull();
    expect(joinRoom(c, ultimo, "J", SHEET as any, token)).not.toBeNull();
  });

  it("quando o GM remove alguém, abre um lugar", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    encher(c);
    deleteGeneratedPlayer(c, "peer_dono", "peer_0");
    expect(joinRoom(c, "peer_novo", "Novo", SHEET as any)).not.toBeNull();
  });

  it("fichas geradas pelo GM ocupam lugar — e param no teto", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    for (let i = 0; i < 40; i++) generateRoomPlayerEdgerunner(c, "peer_dono");
    expect(Object.keys(getRoom(c)!.players).length).toBe(MAX_SEATS_PER_ROOM);
    const r = generateRoomPlayerEdgerunner(c, "peer_dono");
    expect(r.room).toBeNull();
    expect(r.error).toMatch(/cheia/);
  });

  it("POST /join numa sala cheia → 409 room_full, com mensagem para o jogador", async () => {
    const c = code();
    const gm = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    expect(gm.status).toBe(200);
    encher(c);
    const res = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_atrasado_http", handle: "Atrasado", sheet: SHEET });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("room_full");
    expect(res.body.error).toMatch(/cheia/);
  });
});
