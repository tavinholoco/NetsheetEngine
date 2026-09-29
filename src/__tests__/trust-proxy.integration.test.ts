/**
 * Revisão pós-D (R.5 — SEC-11) — O LIMITADOR PRECISA VER O IP DE QUEM JOGA
 * ========================================================================
 * Os três limitadores do REST contam por `req.ip`. Atrás do proxy do Render,
 * sem `trust proxy`, o Express ignora o `X-Forwarded-For` e o `req.ip` é o do
 * próprio proxy — para TODO mundo. Os limitadores viravam um balde só: o chat
 * de uma mesa (30/min) derrubava o chat de todas, e um abusador gastava a cota
 * dos outros em vez da própria.
 *
 * Aqui o supertest faz o papel do proxy (a conexão vem de 127.0.0.1) e o
 * `X-Forwarded-For` diz quem é o jogador — como no Render.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;
let resolveTrustProxy: (env: NodeJS.ProcessEnv) => boolean | number | string;

beforeAll(async () => {
  // A produção liga o trust proxy; o teste liga pela mesma porta de entrada, a env.
  process.env.TRUST_PROXY = "1";
  const server = await import("../../server");
  app = server.app as unknown as Express;
  resolveTrustProxy = server.resolveTrustProxy;
});

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

describe("R.5 — SEC-11: quem o proxy diz que é o jogador", () => {
  it("o chat de um jogador no limite não derruba o chat de outro", async () => {
    const c = `R5-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    const A = "203.0.113.10";
    const B = "198.51.100.20";
    const gm = await request(app)
      .post("/api/rooms/create")
      .set("X-Forwarded-For", A)
      .send({ code: c, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    const pj = await request(app)
      .post("/api/rooms/join")
      .set("X-Forwarded-For", B)
      .send({ code: c, peerId: "peer_vex", handle: "Vex", sheet: SHEET });

    // O GM gasta a cota inteira do chat (30/min) e passa dela:
    let ultimo = 0;
    for (let i = 0; i < 31; i++) {
      const r = await request(app)
        .post(`/api/rooms/${c}/message`)
        .set("X-Forwarded-For", A)
        .send({ sessionToken: gm.body.sessionToken, text: `msg ${i}` });
      ultimo = r.status;
    }
    expect(ultimo).toBe(429);

    // O jogador, de outro IP, continua falando:
    const r = await request(app)
      .post(`/api/rooms/${c}/message`)
      .set("X-Forwarded-For", B)
      .send({ sessionToken: pj.body.sessionToken, text: "ainda estou aqui" });
    expect(r.status).toBe(200);
  });

  it("o /api/health mostra ao chamador o IP que o servidor enxerga — a verificação no ar", async () => {
    const r = await request(app).get("/api/health").set("X-Forwarded-For", "192.0.2.33");
    expect(r.body.clientIp).toBe("192.0.2.33");
  });
});

describe("R.5 — resolveTrustProxy", () => {
  it("produção confia em um salto (o proxy do Render); fora dela, em nenhum", () => {
    expect(resolveTrustProxy({ NODE_ENV: "production" })).toBe(1);
    expect(resolveTrustProxy({ NODE_ENV: "development" })).toBe(false);
    expect(resolveTrustProxy({ NODE_ENV: "test" })).toBe(false);
  });

  it("TRUST_PROXY corrige o número de saltos sem deploy de código", () => {
    expect(resolveTrustProxy({ NODE_ENV: "production", TRUST_PROXY: "2" })).toBe(2);
    expect(resolveTrustProxy({ NODE_ENV: "production", TRUST_PROXY: "false" })).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY: "loopback, 10.0.0.0/8" })).toBe("loopback, 10.0.0.0/8");
  });

  it('"true" não é aceito: confiaria em qualquer X-Forwarded-For, e o IP viraria escolha do cliente', () => {
    expect(resolveTrustProxy({ NODE_ENV: "production", TRUST_PROXY: "true" })).toBe(1);
    expect(resolveTrustProxy({ NODE_ENV: "test", TRUST_PROXY: "true" })).toBe(false);
  });
});
