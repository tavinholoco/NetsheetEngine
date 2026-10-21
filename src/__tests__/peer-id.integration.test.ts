/**
 * Fase I (I.03 — SEC-16) — O `peerId` TEM FORMATO
 * ================================================
 * O `peerId` é escolhido por quem entra (`POST /join`, e o `gmPeerId` do
 * `create`), e o servidor só tirava dele controle e espaço. O cliente monta
 * com ele o caminho do "Remover" do GM (`/players/:targetPeerId/delete`): um
 * convidado hostil que entrasse com `peer/x` ficava impossível de remover pela
 * tela (404), e com `a/../../players/<outro>/delete?` o clique do GM em
 * "Remover <hostil>" removia OUTRO jogador — o fetch normaliza o `..`. O mesmo
 * truque levava o clique a qualquer ação de GM da sala.
 *
 * O servidor é a fronteira: `peerId` fora de `[A-Za-z0-9_-]{1,64}` é recusado
 * na entrada, com 400 `invalid_input`. O cliente gera `peer_<base36>_<base36>`;
 * o servidor, `gm_…` e `edgerunner_…` — todos cabem.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import { createRoom, getRoom, isValidPeerId, joinRoom } from "../../server/roomManager";
import type { CharacterSheet } from "../types/cyberpunk";

const SHEET = {
  handle: "Hostil",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let n = 0;
function code(): string {
  n += 1;
  return `PID-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function mesa(gmPeerId = "peer_dono") {
  const c = code();
  const res = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId });
  expect(res.status).toBe(200);
  return c;
}

/** Os que o reproduziram em 16/10, e os vizinhos: o que quebra um caminho de URL. */
const HOSTIS = [
  "peer_h/x",
  "a/../../players/peer_vitima/delete?",
  "a/../../npcs/generate?",
  "peer?x",
  "peer#x",
  "peer%2Fx",
  "peer x",
  "peer.x",
  "..",
  "a".repeat(65)
];

describe("I.03 — SEC-16: o join recusa peerId fora do formato", () => {
  it.each(HOSTIS)("%s → 400 invalid_input, e nenhum assento", async (peerId) => {
    const c = await mesa();
    const antes = Object.keys(getRoom(c)!.players).length;
    const res = await request(app).post("/api/rooms/join").send({ code: c, peerId, handle: "Hostil", sheet: SHEET });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_input");
    expect(Object.keys(getRoom(c)!.players)).toHaveLength(antes);
  });

  it("o ataque de 16/10 não começa: o hostil não senta, e a vítima fica", async () => {
    const c = await mesa();
    const vitima = await request(app).post("/api/rooms/join").send({ code: c, peerId: "peer_vitima", handle: "Vitima", sheet: SHEET });
    expect(vitima.status).toBe(200);
    const hostil = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "a/../../players/peer_vitima/delete?", handle: "Hostil", sheet: SHEET });
    expect(hostil.status).toBe(400);
    expect(getRoom(c)!.players["peer_vitima"]).toBeDefined();
  });
});

describe("I.03 — SEC-16: o create recusa gmPeerId fora do formato", () => {
  it.each(["gm/x", "gm/../../x", "gm x"])("%s → 400 invalid_input, e nenhuma sala", async (gmPeerId) => {
    const c = code();
    const res = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_input");
    expect(getRoom(c)).toBeUndefined();
  });

  it("sem gmPeerId, o servidor gera um — e ele cabe no formato", async () => {
    const c = code();
    const res = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono" });
    expect(res.status).toBe(200);
    expect(isValidPeerId(res.body.room.gmPeerId)).toBe(true);
  });
});

describe("I.03 — a defesa no roomManager, para todo caminho que não passe pela rota", () => {
  it("o joinRoom não senta peerId fora do formato", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    expect(joinRoom(c, "peer/x", "Hostil", SHEET as unknown as CharacterSheet)).toBeNull();
    expect(getRoom(c)!.players["peer/x"]).toBeUndefined();
  });

  it("o createRoom troca o gmPeerId fora do formato por um gerado", () => {
    const c = code();
    const { room } = createRoom(c, "Mesa", "Dono", "gm/../x");
    expect(isValidPeerId(room.gmPeerId)).toBe(true);
  });
});

describe("I.03 — os formatos que o app gera continuam passando", () => {
  it.each([
    "peer_lz9k3a_4f7q2x", // o cliente (generatePeerId)
    "gm_peer",
    "peer_ci-gm",
    "a".repeat(64)
  ])("%s → 200", async (peerId) => {
    const c = await mesa();
    const res = await request(app).post("/api/rooms/join").send({ code: c, peerId, handle: "Ana", sheet: SHEET });
    expect(res.status).toBe(200);
    expect(res.body.room.players[peerId]).toBeDefined();
  });

  it("a ficha que o GM gera ocupa um assento com peerId no formato", async () => {
    const c = code();
    const criada = await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    const res = await request(app).post(`/api/rooms/${c}/players/generate`).send({ sessionToken: criada.body.sessionToken });
    expect(res.status).toBe(200);
    for (const id of Object.keys(res.body.players)) expect(isValidPeerId(id)).toBe(true);
  });
});
