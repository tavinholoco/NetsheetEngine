/**
 * Fase B (B.4 — SEC-03) — SESSÕES ATRAVESSAM O RESTART
 * ====================================================
 * As sessões viviam só na memória do processo. Qualquer restart — deploy,
 * crash, ou o despertar da hibernação do plano gratuito do Render — derrubava
 * TODAS as mesas: a sala voltava do banco com os jogadores dentro, mas nenhum
 * token valia mais, e cada ação virava 401 no meio do jogo.
 *
 * Duas propriedades importam aqui, e a segunda é tão importante quanto a
 * primeira:
 *   1. a sessão sobrevive ao restart;
 *   2. o token NUNCA é gravado em claro — persistir sessão sem isso trocaria
 *      o SEC-03 por uma exposição pior, já que um dump do banco entregaria
 *      sessões vivas.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../../server";
import {
  createRoom,
  exportRoomSessions,
  restoreRoomSessions,
  verifySession
} from "../../server/roomManager";

let n = 0;
function code(): string {
  n += 1;
  return `SEC3-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("exportRoomSessions — o que vai para o banco", () => {
  it("grava o HASH do token, nunca o token em claro", () => {
    const c = code();
    const { sessionToken } = createRoom(c, "Mesa", "GM", "gm1");

    const exported = exportRoomSessions(c);
    const keys = Object.keys(exported);

    expect(keys).toContain(sha256(sessionToken));
    expect(keys).not.toContain(sessionToken);
    // Nem como chave, nem como valor, nem em qualquer canto do payload.
    expect(JSON.stringify(exported)).not.toContain(sessionToken);
  });

  it("mapeia o hash para o peerId do dono da sessão", () => {
    const c = code();
    const { sessionToken } = createRoom(c, "Mesa", "GM", "gm_dono");
    expect(exportRoomSessions(c)[sha256(sessionToken)]).toBe("gm_dono");
  });

  it("exporta só as sessões da sala pedida", () => {
    const a = code();
    const b = code();
    const ra = createRoom(a, "A", "GM", "gmA");
    const rb = createRoom(b, "B", "GM", "gmB");

    const exportedA = exportRoomSessions(a);
    expect(exportedA).toHaveProperty(sha256(ra.sessionToken));
    expect(exportedA).not.toHaveProperty(sha256(rb.sessionToken));
  });
});

describe("restoreRoomSessions — o boot depois do restart", () => {
  it("um token continua valendo depois de exportar e restaurar", () => {
    const c = code();
    const { sessionToken } = createRoom(c, "Mesa", "GM", "gm1");

    // Isto é o que a linha do banco carrega.
    const persisted = exportRoomSessions(c);

    // Simula o processo novo: repõe a partir do banco.
    const restored = restoreRoomSessions(c, persisted);
    expect(restored).toBeGreaterThan(0);

    // A propriedade que o SEC-03 pedia.
    expect(verifySession(c, sessionToken)).toBe("gm1");
  });

  it("restaura sessão de um token que este processo nunca emitiu", () => {
    // O caso real: processo novo, sessão criada pelo processo anterior.
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    const tokenDoProcessoAnterior = "a".repeat(48);

    restoreRoomSessions(c, { [sha256(tokenDoProcessoAnterior)]: "peer_antigo" });
    expect(verifySession(c, tokenDoProcessoAnterior)).toBe("peer_antigo");
  });

  it("a sessão restaurada continua escopada à sala", () => {
    const a = code();
    const b = code();
    createRoom(a, "A", "GM", "gmA");
    createRoom(b, "B", "GM", "gmB");
    const token = "b".repeat(48);

    restoreRoomSessions(a, { [sha256(token)]: "peer1" });
    expect(verifySession(a, token)).toBe("peer1");
    expect(verifySession(b, token)).toBeNull();
  });

  it("ignora dado corrompido em vez de criar sessão inválida", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    expect(restoreRoomSessions(c, null)).toBe(0);
    expect(restoreRoomSessions(c, "texto")).toBe(0);
    expect(restoreRoomSessions(c, [1, 2, 3])).toBe(0);
    expect(restoreRoomSessions(c, { "": "peer" })).toBe(0);
    expect(restoreRoomSessions(c, { hash: 42 })).toBe(0);
    expect(restoreRoomSessions(c, { hash: "" })).toBe(0);
  });

  it("linha sem a coluna (gravada antes da 0007) não quebra o restore", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    expect(restoreRoomSessions(c, undefined)).toBe(0);
  });
});

describe("verifySession — endurecimento junto com o hash", () => {
  it("rejeita token vazio ou não-string sem explodir", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    expect(verifySession(c, "")).toBeNull();
    expect(verifySession(c, undefined as unknown as string)).toBeNull();
    expect(verifySession(c, null as unknown as string)).toBeNull();
  });

  it("o fluxo HTTP completo continua funcionando com o hash", async () => {
    const c = code();
    const create = await request(app)
      .post("/api/rooms/create")
      .send({ code: c, name: "Mesa", gmHandle: "GM", gmPeerId: "gm1" });
    const token = create.body.sessionToken as string;

    const read = await request(app).get(`/api/rooms/${c}`).set("X-Session-Token", token);
    expect(read.status).toBe(200);
    expect(read.body).toHaveProperty("players");
  });
});
