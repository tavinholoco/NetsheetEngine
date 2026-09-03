/**
 * Fase B (B.3 — SEC-02) — LEITURA DE SALA E STREAM EXIGEM SESSÃO
 * ==============================================================
 * A escrita era protegida por token desde a T1.7; a LEITURA não era. Quem
 * soubesse o código da sala lia fichas, chat, grid e iniciativa — e, pelo
 * stream SSE, assinava o estado da mesa continuamente, recebendo tudo de novo
 * a cada mutação.
 *
 * Dos dois, o stream é o pior: não é uma leitura pontual, é uma escuta
 * permanente que ninguém percebe.
 *
 * A suíte de `server-api.integration.test.ts` cobre o `GET /api/rooms/:code`
 * nos três casos (sem token, token válido, token inválido). Aqui fica o
 * stream, que precisa de tratamento próprio: o token vai na query porque o
 * `EventSource` do navegador não permite header customizado.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";

const SHEET = {
  handle: "Rex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

let n = 0;
function code(): string {
  n += 1;
  return `SEC2-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function makeRoom() {
  const c = code();
  const res = await request(app)
    .post("/api/rooms/create")
    .send({ code: c, name: "Mesa", gmHandle: "GM", gmPeerId: "gm1" });
  return { code: c, token: res.body.sessionToken as string };
}

describe("GET /api/rooms/:code/stream — SEC-02", () => {
  it("recusa o stream sem token", async () => {
    const { code: c } = await makeRoom();
    const res = await request(app).get(`/api/rooms/${c}/stream`);
    expect(res.status).toBe(401);
  });

  it("recusa o stream com token forjado", async () => {
    const { code: c } = await makeRoom();
    const res = await request(app).get(`/api/rooms/${c}/stream?token=nao-vale`);
    expect(res.status).toBe(401);
  });

  it("recusa token válido de OUTRA sala (não basta ter um token qualquer)", async () => {
    const a = await makeRoom();
    const b = await makeRoom();
    const res = await request(app).get(`/api/rooms/${b.code}/stream?token=${a.token}`);
    expect(res.status).toBe(401);
  });

  it("não vaza estado da mesa no corpo da recusa", async () => {
    const { code: c } = await makeRoom();
    await request(app)
      .post("/api/rooms/join")
      .send({ code: c, peerId: "p1", handle: "Rex", sheet: SHEET });

    const res = await request(app).get(`/api/rooms/${c}/stream`);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/Rex/);
    expect(body).not.toMatch(/players|chatMessages|tacticalGrid/);
  });

  it("sala inexistente → 404, antes de qualquer questão de sessão", async () => {
    const res = await request(app).get("/api/rooms/NAO-EXISTE/stream");
    expect(res.status).toBe(404);
  });
});

describe("O token da mesa é escopado por sala", () => {
  it("token da sala A não abre a leitura completa da sala B", async () => {
    const a = await makeRoom();
    const b = await makeRoom();
    const res = await request(app).get(`/api/rooms/${b.code}`).set("X-Session-Token", a.token);
    expect(res.status).toBe(401);
  });
});
