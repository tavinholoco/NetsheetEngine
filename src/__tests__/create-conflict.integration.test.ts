/**
 * Revisão pós-D (R.2 — SEC-08) — CRIAR NÃO SOBRESCREVE UMA MESA QUE EXISTE
 * ========================================================================
 * `POST /api/rooms/create` fazia `rooms[code] = novaSala` sem olhar se o
 * código já existia. Qualquer pessoa, sem sessão, com um código tirado do
 * lobby público, apagava a mesa de alguém — fichas, chat, grid — e virava GM
 * dela; a persistência gravava por cima da linha no Supabase. Até o próprio GM
 * perdia a mesa se clicasse "criar" de novo com o mesmo código.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import { createRoom, joinRoom, getRoom, verifySession } from "../../server/roomManager";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let n = 0;
function code(): string {
  n += 1;
  return `R2-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

describe("R.2 — SEC-08: create com código em uso", () => {
  it("POST /create com o código de uma mesa viva → 409, e a mesa fica intacta", async () => {
    const c = code();
    const dono = await request(app)
      .post("/api/rooms/create")
      .send({ code: c, name: "Mesa do dono", gmHandle: "Dono", gmPeerId: "peer_dono" });
    expect(dono.status).toBe(200);
    await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_vex", handle: "Vex", sheet: SHEET });

    // O ataque de 29/09: mesmo código, outro "GM", sem sessão nenhuma.
    const tomada = await request(app)
      .post("/api/rooms/create")
      .send({ code: c, name: "Tomada", gmHandle: "Hostil", gmPeerId: "peer_hostil" });
    expect(tomada.status).toBe(409);
    expect(tomada.body.code).toBe("room_exists");
    expect(tomada.body.sessionToken).toBeUndefined();

    const sala = getRoom(c)!;
    expect(sala.name).toBe("Mesa do dono");
    expect(sala.gmPeerId).toBe("peer_dono");
    expect(Object.keys(sala.players).sort()).toEqual(["peer_dono", "peer_vex"]);
    expect(verifySession(c, dono.body.sessionToken)).toBe("peer_dono");
  });

  it("o código é comparado já normalizado (caixa e espaços não abrem brecha)", async () => {
    const c = code();
    await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    const res = await request(app)
      .post("/api/rooms/create")
      .send({ code: `  ${c.toLowerCase()} `, name: "Tomada", gmHandle: "Hostil", gmPeerId: "peer_hostil" });
    expect(res.status).toBe(409);
    expect(getRoom(c)!.gmPeerId).toBe("peer_dono");
  });

  it("código livre continua criando normalmente", async () => {
    const res = await request(app)
      .post("/api/rooms/create")
      .send({ code: code(), name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    expect(res.status).toBe(200);
    expect(typeof res.body.sessionToken).toBe("string");
  });

  it("o roomManager também se recusa — defesa para qualquer caminho futuro", () => {
    const c = code();
    createRoom(c, "Mesa do dono", "Dono", "peer_dono");
    joinRoom(c, "peer_vex", "Vex", SHEET as any);
    expect(() => createRoom(c, "Tomada", "Hostil", "peer_hostil")).toThrow(/já existe/);
    expect(getRoom(c)!.gmPeerId).toBe("peer_dono");
    expect(getRoom(c)!.players.peer_vex).toBeTruthy();
  });
});
