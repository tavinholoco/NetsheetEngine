/**
 * Revisão pós-D (R.11 — DOC-07) — A SALA SAI DO LOBBY
 * ====================================================
 * A decisão 3 diz que o público são os convidados do dono, e o produto não
 * impunha isso: `GET /api/rooms` listava o código de toda sala a qualquer
 * visitante, e com o código qualquer um entrava. O dono decidiu (29/09): a sala
 * sai do lobby, e se entra pelo código ou pelo link que o GM manda — com um
 * sufixo aleatório no código, para ninguém adivinhar (ver `src/lib/roomCode.ts`).
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import { isValidRoomCode } from "../../server/roomManager";

let n = 0;
function code(): string {
  n += 1;
  return `R11-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

describe("R.11 — o lobby não lista salas", () => {
  it("um visitante não recebe a lista de salas (antes: todo código, a qualquer um)", async () => {
    const c = code();
    await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa secreta", gmHandle: "Dono", gmPeerId: "peer_dono" });

    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body ?? "")).not.toContain(c);
  });

  it("o /api/health segue só com contagens — nenhum código", async () => {
    const c = code();
    await request(app).post("/api/rooms/create").send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    const res = await request(app).get("/api/health");
    expect(typeof res.body.rooms.active).toBe("number");
    expect(JSON.stringify(res.body)).not.toContain(c);
  });
});

describe("R.11 — códigos de convite", () => {
  it("o código com sufixo aleatório (até 24 caracteres) é aceito", async () => {
    expect(isValidRoomCode("NC-2020-K7Q9XD")).toBe(true);
    expect(isValidRoomCode("ABCDEFGHIJKL-K7Q9XD")).toBe(true); // prefixo de 12 + sufixo
    const res = await request(app)
      .post("/api/rooms/create")
      .send({ code: `NC-${Date.now().toString(36).slice(-4)}-K7Q9XD`, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    expect(res.status).toBe(200);
  });

  it("continua recusando o que não é código: longo demais, curto demais, caractere estranho", () => {
    expect(isValidRoomCode("A".repeat(25))).toBe(false);
    expect(isValidRoomCode("A")).toBe(false);
    expect(isValidRoomCode("NC 2020")).toBe(false);
    expect(isValidRoomCode("NC_2020")).toBe(false);
  });
});
