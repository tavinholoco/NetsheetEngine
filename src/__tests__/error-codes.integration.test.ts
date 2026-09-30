/**
 * Fase E (E.01 → E.3c) — TODO ERRO COM `code`, E O STATUS SAI DO `code`
 * ====================================================================
 * Até aqui conviviam três jeitos de classificar erro: o `respondWithResult`
 * decidia 404 × 403 procurando "não encontrad" no TEXTO da mensagem; o
 * `respondToCombat`, por `startsWith`; e a R.1 estreou o `code` estável em
 * quatro respostas. Renomear uma mensagem mudava o status da API em silêncio.
 * Reproduzido em 30/09:
 *  - `join` com código que não existe → `404 "Room not found"` — em inglês, e
 *    a tela do lobby mostra o texto do servidor (errar o convite é o erro mais
 *    comum do produto desde a R.11);
 *  - chat vazio → 403; iniciativa que não é lista → 403;
 *  - GM gera ficha com a mesa cheia → 403, e o `join` responde 409 `room_full`
 *    para a mesma condição.
 *
 * Agora todo erro sai com um `code` de um conjunto fechado (server/errors.ts),
 * o status sai do `code` por uma tabela só, e a mensagem muda à vontade. Uma
 * linha por caminho de erro, e uma trava no código-fonte para rota nova não
 * voltar a escrever status à mão.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import { app, attachRealtime } from "../../server";
import { STATUS_BY_CODE } from "../../server/errors";
import { generateRoomPlayerEdgerunner, getRoom, updateNpcWoundLevel } from "../../server/roomManager";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 }
};

let code = "";
let gm = "";
let pj = "";
let npcId = "";

beforeAll(async () => {
  code = `EC-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const c = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  gm = c.body.sessionToken;
  const j = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
  pj = j.body.sessionToken;
  const n = await request(app).post(`/api/rooms/${code}/npcs/generate`).send({ sessionToken: gm });
  npcId = Object.keys(n.body.npcs)[0];
});

/** O erro esperado: status, `code`, e mensagem em português, sem o inglês de antes. */
function confere(r: request.Response, status: number, errCode: string) {
  expect({ status: r.status, code: r.body.code }).toEqual({ status, code: errCode });
  expect(STATUS_BY_CODE[errCode as keyof typeof STATUS_BY_CODE]).toBe(status);
  expect(typeof r.body.error).toBe("string");
  expect(r.body.error).not.toMatch(/not found|Room or player/i);
}

const post = (rota: string, body: object) => request(app).post(rota).send(body);

describe("E.3c — sala e sessão", () => {
  it("join com código que não existe → 404 room_not_found, em português", async () => {
    confere(await post("/api/rooms/join", { code: "NAO-EXISTE", peerId: "p1", handle: "x", sheet: SHEET }), 404, "room_not_found");
  });
  it("GET da sala que não existe → 404 room_not_found", async () => {
    confere(await request(app).get("/api/rooms/NAO-EXISTE"), 404, "room_not_found");
  });
  it("stream da sala que não existe → 404 room_not_found", async () => {
    confere(await request(app).get("/api/rooms/NAO-EXISTE/stream"), 404, "room_not_found");
  });
  it("create com código inválido → 400 invalid_input", async () => {
    confere(await post("/api/rooms/create", { code: "!", name: "x", gmHandle: "x" }), 400, "invalid_input");
  });
  it("join sem peerId → 400 invalid_input", async () => {
    confere(await post("/api/rooms/join", { code, handle: "x", sheet: SHEET }), 400, "invalid_input");
  });
  it("join sem ficha → 400 invalid_input", async () => {
    confere(await post("/api/rooms/join", { code, peerId: "p2", handle: "x", sheet: [] }), 400, "invalid_input");
  });
  it("ação sem sessão → 401 session_invalid", async () => {
    confere(await post(`/api/rooms/${code}/message`, { text: "oi" }), 401, "session_invalid");
  });
  it("leitura com token inválido → 401 session_invalid", async () => {
    confere(await request(app).get(`/api/rooms/${code}`).set("X-Session-Token", "falso"), 401, "session_invalid");
  });
});

describe("E.3c — entrada inválida é 400, não 403", () => {
  it("chat vazio → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/message`, { sessionToken: pj, text: "   " }), 400, "invalid_input");
  });
  it("iniciativa que não é lista → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/initiative`, { sessionToken: gm, initiativeList: "x" }), 400, "invalid_input");
  });
  it("iniciativa sem action nem lista → 400 invalid_input (antes, reenviava a sala a todos, sem conferir o GM)", async () => {
    confere(await post(`/api/rooms/${code}/initiative`, { sessionToken: pj }), 400, "invalid_input");
  });
  it("rolagem de tipo inválido → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/roll`, { sessionToken: pj, kind: "nada" }), 400, "invalid_input");
  });
  it("rolagem de perícia que a ficha não tem → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/roll`, { sessionToken: pj, kind: "skill", skillName: "Tricô" }), 400, "invalid_input");
  });
  it("dano negativo → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/damage`, { sessionToken: gm, targetId: "peer_vex", raw: -3, location: "Torso" }), 400, "invalid_input");
  });
  it("ferimento sem os campos → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/player-health`, { sessionToken: gm }), 400, "invalid_input");
  });
  it("ataque de um jogador pela rota do NPC → 400 invalid_input", async () => {
    confere(await post(`/api/rooms/${code}/attack`, { sessionToken: gm, attackerId: "peer_vex", targetId: npcId, range: "close" }), 400, "invalid_input");
  });
});

describe("E.3c — permissão, alvo e estado", () => {
  it("jogador numa ação do GM → 403 gm_only", async () => {
    confere(await post(`/api/rooms/${code}/settings`, { sessionToken: pj, combatModifier: 2 }), 403, "gm_only");
  });
  it("o GM tentando remover a si mesmo → 403 not_allowed", async () => {
    confere(await post(`/api/rooms/${code}/players/peer_dono/delete`, { sessionToken: gm }), 403, "not_allowed");
  });
  it("ferimento de jogador que não está na mesa → 404 target_not_found", async () => {
    confere(await post(`/api/rooms/${code}/player-health`, { sessionToken: gm, targetPeerId: "ninguem", woundLevel: 2 }), 404, "target_not_found");
  });
  it("ferimento de NPC que não existe → 404 target_not_found", async () => {
    confere(await post(`/api/rooms/${code}/npcs/ninguem/health`, { sessionToken: gm, woundLevel: 2 }), 404, "target_not_found");
  });
  it("dano num alvo que não existe → 404 target_not_found", async () => {
    confere(await post(`/api/rooms/${code}/damage`, { sessionToken: gm, targetId: "ninguem", raw: 5, location: "Torso" }), 404, "target_not_found");
  });
  it("estabilizar quem não está em Mortal → 409 invalid_state", async () => {
    confere(await post(`/api/rooms/${code}/stabilize`, { sessionToken: gm, targetId: "peer_vex", stabilized: true }), 409, "invalid_state");
  });
  it("NPC morto não ataca → 409 invalid_state", async () => {
    const npc = getRoom(code)!.npcs![npcId];
    npc.sheet.isDead = true;
    confere(await post(`/api/rooms/${code}/attack`, { sessionToken: gm, attackerId: npcId, targetId: "peer_vex", range: "close" }), 409, "invalid_state");
    npc.sheet.isDead = false;
    updateNpcWoundLevel(code, "peer_dono", npcId, 0);
  });
  it("GM gera ficha com a mesa cheia → 409 room_full, como o join", async () => {
    const cheia = `EC-CHEIA-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const c = await post("/api/rooms/create", { code: cheia, name: "x", gmHandle: "x", gmPeerId: "peer_c" });
    for (let i = 0; i < 15; i++) generateRoomPlayerEdgerunner(cheia, "peer_c");
    confere(await post(`/api/rooms/${cheia}/players/generate`, { sessionToken: c.body.sessionToken }), 409, "room_full");
  });
});

describe("E.3c — o resto da API", () => {
  it("rota /api que não existe → 404 route_not_found, em JSON", async () => {
    confere(await post("/api/nao-existe", {}), 404, "route_not_found");
  });
  it("JSON quebrado → 400 invalid_json", async () => {
    const r = await request(app).post("/api/rooms/join").set("Content-Type", "application/json").send("{quebrado");
    confere(r, 400, "invalid_json");
  });
  it("corpo acima de 1 MB → 413 payload_too_large", async () => {
    const r = await post("/api/rooms/join", { code, peerId: "p3", handle: "x", sheet: { notes: "x".repeat(1.2 * 1024 * 1024) } });
    confere(r, 413, "payload_too_large");
  });
  it("IA sem login → 401 login_required; com token mas sem verificação configurada → 503 ai_unavailable", async () => {
    confere(await post("/api/gemini", { prompt: "oi" }), 401, "login_required");
    confere(await request(app).post("/api/gemini").set("Authorization", "Bearer x").send({ prompt: "oi" }), 503, "ai_unavailable");
  });
  it("estourar o limitador → 429 rate_limited", async () => {
    let ultima: request.Response | undefined;
    for (let i = 0; i < 12; i++) ultima = await post("/api/gemini", { prompt: "oi" });
    confere(ultima!, 429, "rate_limited");
  });
});

describe("E.3c — o erro pelo WebSocket também leva o code", () => {
  it("chat vazio pelo WS → { type: \"error\", code: \"invalid_input\" } só para o autor", async () => {
    const server = http.createServer(app);
    attachRealtime(server);
    server.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    const port = (server.address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${pj}`);
    ws.on("error", () => {});
    const erro = new Promise<Record<string, unknown>>((resolve) => {
      ws.on("message", (raw, isBinary) => {
        if (isBinary) return;
        const msg = JSON.parse(String(raw));
        if (msg.type === "error") resolve(msg);
      });
    });
    await new Promise<void>((r) => ws.once("open", () => r()));
    ws.send(JSON.stringify({ type: "message", text: "   " }));
    expect(await erro).toMatchObject({ type: "error", code: "invalid_input" });
    ws.terminate();
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
  });
});

describe("E.3c — a trava: status e erro só pela tabela", () => {
  it("o server.ts não escreve mais `status(4xx).json({ error` à mão", () => {
    const fonte = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf8");
    const aMao = fonte.match(/\.status\(\d{3}\)\.json\(\{\s*error/g) ?? [];
    expect(aMao).toEqual([]);
  });
  it("o roomManager não devolve erro sem `code`", () => {
    const fonte = fs.readFileSync(path.resolve(__dirname, "../../server/roomManager.ts"), "utf8");
    const semCode = fonte.match(/\{\s*room:\s*null,\s*error:/g) ?? [];
    expect(semCode).toEqual([]);
  });
});
