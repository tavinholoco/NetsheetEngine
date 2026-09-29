/**
 * Revisão pós-D (R.1 — SEC-07) — RECLAMAR UM ASSENTO EXIGE PROVA DE POSSE
 * =======================================================================
 * Desde a T3.3, um `join` com um `peerId` que já está na sala era tratado como
 * reconexão: o servidor emitia um token novo e revogava o do dono ("1 sessão
 * por jogador"). Nada provava que quem chamava ERA o dono do assento — e todo
 * `peerId`, inclusive o `gmPeerId`, vai no estado transmitido à mesa. Um
 * convidado lia o `gmPeerId`, fazia `join` com ele e virava o Mestre; o GM
 * verdadeiro ficava com um token que não valia mais.
 *
 * Emitir sessão também é autorização (a segunda metade da pergunta 3 do
 * portão). Agora, reivindicar um assento ocupado exige o token vigente dele.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import {
  createRoom,
  joinRoom,
  getRoom,
  verifySession,
  updateRoomSettings,
  deleteGeneratedPlayer,
  seatClaimRefusal
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
  return `R1-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

describe("R.1 — SEC-07: o convidado não toma o GM", () => {
  it("join com o gmPeerId, sem o token do GM, é recusado — e o GM continua GM", () => {
    const c = code();
    const gm = createRoom(c, "Mesa do dono", "Dono", "peer_dono");
    const convidado = joinRoom(c, "peer_hostil", "Hostil", SHEET as any)!;

    // O convidado recebe o gmPeerId legitimamente, no estado da sala:
    const gmPeerId = convidado.room.gmPeerId!;
    expect(gmPeerId).toBe("peer_dono");

    // ...e tenta o assento dele sem prova (o ataque reproduzido em 29/09):
    expect(joinRoom(c, gmPeerId, "Dono", SHEET as any)).toBeNull();
    // ...nem com o próprio token, que prova outro assento:
    expect(joinRoom(c, gmPeerId, "Dono", SHEET as any, convidado.sessionToken)).toBeNull();

    // O GM verdadeiro segue com sessão e com o cargo:
    expect(verifySession(c, gm.sessionToken)).toBe("peer_dono");
    expect(getRoom(c)!.gmPeerId).toBe("peer_dono");
    const r = updateRoomSettings(c, verifySession(c, gm.sessionToken)!, "Afterlife", -2, "chuva");
    expect(r.room).toBeTruthy();
  });

  it("assento de jogador também: sem o token dele, ninguém o reivindica", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    const vex = joinRoom(c, "peer_vex", "Vex", SHEET as any)!;
    joinRoom(c, "peer_hostil", "Hostil", SHEET as any);

    expect(joinRoom(c, "peer_vex", "Vex", SHEET as any)).toBeNull();
    expect(verifySession(c, vex.sessionToken)).toBe("peer_vex");
  });

  it("token válido de OUTRA sala não serve de prova", () => {
    const a = code();
    const b = code();
    createRoom(a, "Mesa A", "Dono", "peer_dono");
    const outro = createRoom(b, "Mesa B", "Outro", "peer_dono");
    // Mesmo peerId nas duas salas, mas o token é da sala B:
    expect(seatClaimRefusal(a, "peer_dono", outro.sessionToken)).not.toBeNull();
  });

  it("o gmPeerId sem assento (snapshot antigo) também exige prova", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    // Desde a R.3 o GM não pode remover a si mesmo; o estado vem de snapshot:
    delete getRoom(c)!.players["peer_dono"];
    expect(getRoom(c)!.gmPeerId).toBe("peer_dono");
    expect(joinRoom(c, "peer_dono", "Dono", SHEET as any)).toBeNull();
  });

  it("o GM não remove a si mesmo (ficaria trancado fora da própria mesa)", () => {
    const c = code();
    const gm = createRoom(c, "Mesa", "Dono", "peer_dono");
    const r = deleteGeneratedPlayer(c, "peer_dono", "peer_dono");
    expect(r.room).toBeNull();
    expect(getRoom(c)!.players["peer_dono"]).toBeTruthy();
    expect(verifySession(c, gm.sessionToken)).toBe("peer_dono");
  });
});

describe("R.1 — a reconexão legítima continua funcionando", () => {
  it("com o token vigente, o dono reentra no próprio assento: token novo, o antigo revogado", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    const vex = joinRoom(c, "peer_vex", "Vex", SHEET as any)!;

    const re = joinRoom(c, "peer_vex", "Vex", SHEET as any, vex.sessionToken)!;
    expect(re).toBeTruthy();
    expect(Object.keys(re.room.players)).toHaveLength(2); // não duplica
    expect(verifySession(c, re.sessionToken)).toBe("peer_vex");
    expect(verifySession(c, vex.sessionToken)).toBeNull(); // 1 sessão por jogador
  });

  it("peerId novo não precisa de prova (é um assento novo)", () => {
    const c = code();
    createRoom(c, "Mesa", "Dono", "peer_dono");
    expect(seatClaimRefusal(c, "peer_novo")).toBeNull();
    expect(joinRoom(c, "peer_novo", "Novo", SHEET as any)).toBeTruthy();
  });
});

describe("R.1 — POST /api/rooms/join", () => {
  async function makeRoom() {
    const c = code();
    const res = await request(app)
      .post("/api/rooms/create")
      .send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono_http" });
    return { code: c, gmToken: res.body.sessionToken as string };
  }

  it("reivindicar o assento do GM sem o token dele → 409 com código estável", async () => {
    const { code: c, gmToken } = await makeRoom();
    const res = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_dono_http", handle: "Dono", sheet: SHEET });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("seat_taken");
    expect(res.body.sessionToken).toBeUndefined();
    expect(verifySession(c, gmToken)).toBe("peer_dono_http");
  });

  it("com o token vigente no header X-Session-Token → 200 e sessão nova", async () => {
    const { code: c, gmToken } = await makeRoom();
    const res = await request(app)
      .post("/api/rooms/join")
      .set("X-Session-Token", gmToken)
      .send({ code: c, peerId: "peer_dono_http", handle: "Dono", sheet: SHEET });
    expect(res.status).toBe(200);
    expect(verifySession(c, res.body.sessionToken)).toBe("peer_dono_http");
  });

  it("assento novo continua entrando sem header", async () => {
    const { code: c } = await makeRoom();
    const res = await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "peer_novo_http", handle: "Novo", sheet: SHEET });
    expect(res.status).toBe(200);
  });
});
