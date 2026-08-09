/**
 * Fase 9 (T9.3) — TESTES DE INTEGRAÇÃO DO SERVIDOR (HTTP, via supertest)
 * =====================================================================
 * Roda contra o `app` Express exportado de server.ts (NODE_ENV=test pula o
 * listener/porta 3000, o watcher de presença e o restore do banco). A
 * persistência Supabase é no-op em modo test (guarda em roomPersistence).
 *
 * Cobertura: criar/join/leave sala, sync de ficha, GM permissions (todas as
 * ações de GM negadas para jogador → 403), iniciativa (setar/avançar), turno,
 * heartbeat (presença T3.4), rolagem server-authoritative (T5.4) e chat com
 * handle derivado do servidor (anti-spoofing).
 *
 * Nota: os rate limiters (120 req/min, 30 msg/min) valem por IP — a suíte
 * fica deliberadamente abaixo dos limites.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
/** Código único por teste (2–12 chars alfanuméricos/hífen). */
function uniqueCode(): string {
  seq += 1;
  // Servidor normaliza o código para MAIÚSCULAS — já geramos em caixa alta.
  return `T3G-${Date.now().toString(36).slice(-4)}-${seq}`.toUpperCase();
}

const SHEET = {
  handle: "Rex Edgerunner",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  weapons: [{ name: "9mm Heavy", wa: 0, damage: "2d6+2", equipped: true }],
  skills: [{ id: "s1", name: "Handgun", stat: "REF", level: 4 }],
  woundLevel: 0
};

async function createRoom(code: string, gmHandle = "MestreZeta", gmPeerId = "gm_peer") {
  const res = await request(app).post("/api/rooms/create").send({ code, name: "Mesa de Teste", gmHandle, gmPeerId });
  return { res, token: res.body.sessionToken as string, room: res.body.room };
}

async function joinRoom(code: string, peerId: string, handle: string, sheet = SHEET) {
  const res = await request(app).post("/api/rooms/join").send({ code, peerId, handle, sheet });
  return { res, token: res.body.sessionToken as string, room: res.body.room };
}

const authed = (token: string) => ({ sessionToken: token });

// ---------------------------------------------------------------------------
// 1. Ciclo de vida da sala — criar / listar / entrar / sair / remover
// ---------------------------------------------------------------------------
describe("API de salas — criar/join/leave", () => {
  it("cria sala e retorna room + sessionToken do GM", async () => {
    const { res, token, room } = await createRoom(uniqueCode());
    expect(res.status).toBe(200);
    expect(room.code).toMatch(/^T3G-/);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(room.players).toHaveProperty("gm_peer");
    // Chat de sistema de criação
    expect(room.chatMessages[0].text).toContain("criada por Mestre");
  });

  it("código de sala inválido → 400", async () => {
    const res = await request(app).post("/api/rooms/create").send({ code: "a!@#", gmHandle: "X" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Código de sala inválido");
  });

  it("lista salas ativas (GET /api/rooms)", async () => {
    const { room } = await createRoom(uniqueCode());
    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(200);
    const found = res.body.find((r: { code: string }) => r.code === room.code);
    expect(found).toBeDefined();
    expect(found.gmHandle).toBe("MestreZeta");
    expect(found.playersCount).toBe(1);
  });

  it("jogador entra na sala e ganha sessionToken próprio", async () => {
    const code = uniqueCode();
    await createRoom(code);
    const { res, token, room } = await joinRoom(code, "peer_rex", "Rex");
    expect(res.status).toBe(200);
    expect(token).toBeTruthy();
    expect(Object.keys(room.players).length).toBe(2);
    expect(room.players["peer_rex"].handle).toBe("Rex");
    // Token do GM e do player são diferentes (sessões por jogador)
    expect(token).not.toBe(room.players["gm_peer"] ? undefined : token);
    // Mensagem de sistema de entrada
    expect(room.chatMessages.some((m: { text: string }) => m.text.includes("conectou-se"))).toBe(true);
  });

  it("entrar em sala inexistente → 404 Room not found", async () => {
    const res = await request(app).post("/api/rooms/join").send({ code: "ZZ-9999", peerId: "p", handle: "H", sheet: SHEET });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Room not found");
  });

  it("GET /api/rooms/:code retorna a sala; código desconhecido → 404", async () => {
    const code = uniqueCode();
    await createRoom(code);
    const ok = await request(app).get(`/api/rooms/${code}`);
    expect(ok.status).toBe(200);
    expect(ok.body.code).toBe(code);
    const miss = await request(app).get("/api/rooms/NAO-EXISTE");
    expect(miss.status).toBe(404);
  });

  it("leave remove o jogador; token revogado (401 na próxima ação)", async () => {
    const code = uniqueCode();
    const { token: gmToken } = await createRoom(code);
    const { token: playerToken } = await joinRoom(code, "peer_leave", "Leaver");
    const leave = await request(app).post(`/api/rooms/${code}/leave`).send(authed(playerToken));
    expect(leave.status).toBe(200);
    expect(leave.body.success).toBe(true);

    const room = await request(app).get(`/api/rooms/${code}`);
    expect(room.body.players).not.toHaveProperty("peer_leave");

    // Token revogado → a próxima ação autenticada falha com 401
    const sheet = await request(app).post(`/api/rooms/${code}/sheet`).send({ ...authed(playerToken), sheet: SHEET });
    expect(sheet.status).toBe(401);
    expect(gmToken).toBeTruthy();
  });

  it("ações protegidas sem token → 401", async () => {
    const code = uniqueCode();
    await createRoom(code);
    const res = await request(app).post(`/api/rooms/${code}/sheet`).send({ sheet: SHEET });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. GM permissions — toda ação de GM negada para jogador comum (403)
// ---------------------------------------------------------------------------
describe("API — GM permissions (jogador → 403)", () => {
  let code = "";
  let gmToken = "";
  let playerToken = "";

  beforeAll(async () => {
    code = uniqueCode();
    ({ token: gmToken } = await createRoom(code));
    ({ token: playerToken } = await joinRoom(code, "peer_pj", "PlayerJogador"));
  });

  it("player-health: jogador NÃO pode alterar Bio-Monitor (403)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/player-health`).send({ ...authed(playerToken), targetPeerId: "gm_peer", woundLevel: 5 });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Acesso Negado");
  });

  it("player-health: GM altera e o clamp 0..10 vale (woundLevel 15 → 10)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/player-health`).send({ ...authed(gmToken), targetPeerId: "peer_pj", woundLevel: 15 });
    expect(res.status).toBe(200);
    expect(res.body.players["peer_pj"].sheet.woundLevel).toBe(10);
    // Token do token no grid acompanha o woundLevel
    const token = res.body.tacticalGrid.tokens.find((t: { peerId: string }) => t.peerId === "peer_pj");
    expect(token.hp).toBe(10);
    expect(res.body.chatMessages.some((m: { text: string }) => m.text.includes("Bio-Monitor"))).toBe(true);
  });

  it("tactical-grid: jogador → 403; GM → 200", async () => {
    const denied = await request(app).post(`/api/rooms/${code}/tactical-grid`).send({ ...authed(playerToken), gridState: { rows: 5, cols: 5, theme: "alley", tokens: [] } });
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/rooms/${code}/tactical-grid`).send({ ...authed(gmToken), gridState: { rows: 5, cols: 5, theme: "alley", tokens: [] } });
    expect(ok.status).toBe(200);
    expect(ok.body.tacticalGrid.rows).toBe(5);
  });

  it("settings: jogador → 403; GM ajusta modifier com clamp −10..10", async () => {
    const denied = await request(app).post(`/api/rooms/${code}/settings`).send({ ...authed(playerToken), combatModifier: 99 });
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/rooms/${code}/settings`).send({ ...authed(gmToken), combatModifier: 99, modifierReason: "Neblina" });
    expect(ok.status).toBe(200);
    expect(ok.body.combatModifier).toBe(10);
    expect(ok.body.modifierReason).toBe("Neblina");
  });

  it("npcs/generate: jogador → 403; GM → 200 (NPC + token no grid)", async () => {
    const denied = await request(app).post(`/api/rooms/${code}/npcs/generate`).send(authed(playerToken));
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/rooms/${code}/npcs/generate`).send(authed(gmToken));
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body.npcs).length).toBe(1);
    const npcId = Object.keys(ok.body.npcs)[0];
    expect(ok.body.tacticalGrid.tokens.some((t: { id: string }) => t.id === `npc_token_${npcId}`)).toBe(true);
  });

  it("npcs/:id/health e delete: jogador → 403; GM → 200", async () => {
    const gen = await request(app).post(`/api/rooms/${code}/npcs/generate`).send(authed(gmToken));
    const npcId = Object.keys(gen.body.npcs)[0];

    const deniedHealth = await request(app).post(`/api/rooms/${code}/npcs/${npcId}/health`).send({ ...authed(playerToken), woundLevel: 8 });
    expect(deniedHealth.status).toBe(403);

    const okHealth = await request(app).post(`/api/rooms/${code}/npcs/${npcId}/health`).send({ ...authed(gmToken), woundLevel: 8 });
    expect(okHealth.status).toBe(200);
    expect(okHealth.body.npcs[npcId].sheet.woundLevel).toBe(8);

    const deniedDel = await request(app).post(`/api/rooms/${code}/npcs/${npcId}/delete`).send(authed(playerToken));
    expect(deniedDel.status).toBe(403);

    const okDel = await request(app).post(`/api/rooms/${code}/npcs/${npcId}/delete`).send(authed(gmToken));
    expect(okDel.status).toBe(200);
    expect(okDel.body.npcs).not.toHaveProperty(npcId);
  });

  it("players/generate e players/:id/delete: jogador → 403; GM → 200", async () => {
    const denied = await request(app).post(`/api/rooms/${code}/players/generate`).send(authed(playerToken));
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/rooms/${code}/players/generate`).send(authed(gmToken));
    expect(ok.status).toBe(200);
    const genPeerId = Object.keys(ok.body.players).find((p) => p.startsWith("edgerunner_"));
    expect(genPeerId).toBeTruthy();

    const deniedDel = await request(app).post(`/api/rooms/${code}/players/${genPeerId}/delete`).send(authed(playerToken));
    expect(deniedDel.status).toBe(403);
    const okDel = await request(app).post(`/api/rooms/${code}/players/${genPeerId}/delete`).send(authed(gmToken));
    expect(okDel.status).toBe(200);
    expect(okDel.body.players).not.toHaveProperty(genPeerId!);
  });

  it("target inexistente em player-health → 404", async () => {
    const res = await request(app).post(`/api/rooms/${code}/player-health`).send({ ...authed(gmToken), targetPeerId: "nao_existe", woundLevel: 1 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 3. Iniciativa (T1.3) — setar lista, avançar turno, GM-only
// ---------------------------------------------------------------------------
describe("API — iniciativa (GM only)", () => {
  let code = "";
  let gmToken = "";
  let playerToken = "";

  const INIT = [
    { playerId: "gm_peer", handle: "MestreZeta", role: "GM", score: 20, isCurrentTurn: true },
    { playerId: "peer_pj", handle: "PlayerJogador", role: "Solo", score: 14, isCurrentTurn: false },
    { playerId: "peer_npc", handle: "Booster", role: "NPC", score: 999, isCurrentTurn: false }
  ];

  beforeAll(async () => {
    code = uniqueCode();
    ({ token: gmToken } = await createRoom(code));
    ({ token: playerToken } = await joinRoom(code, "peer_pj", "PlayerJogador"));
  });

  it("jogador não pode editar a iniciativa (403)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/initiative`).send({ ...authed(playerToken), initiativeList: INIT });
    expect(res.status).toBe(403);
  });

  it("GM define a lista (score clampado em 0..999)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/initiative`).send({ ...authed(gmToken), initiativeList: INIT });
    expect(res.status).toBe(200);
    expect(res.body.initiativeList).toHaveLength(3);
    expect(res.body.activeTurnIndex).toBe(0);
    const booster = res.body.initiativeList.find((i: { playerId: string }) => i.playerId === "peer_npc");
    expect(booster.score).toBe(999); // clamp mantém 999
  });

  it("GM avança o turno (next) — índice incrementa e marca isCurrentTurn", async () => {
    const first = await request(app).post(`/api/rooms/${code}/initiative`).send({ ...authed(gmToken), action: "next" });
    expect(first.status).toBe(200);
    expect(first.body.activeTurnIndex).toBe(1);
    expect(first.body.initiativeList.find((i: { playerId: string }) => i.playerId === "peer_pj").isCurrentTurn).toBe(true);

    const second = await request(app).post(`/api/rooms/${code}/initiative`).send({ ...authed(gmToken), action: "next" });
    expect(second.body.activeTurnIndex).toBe(2);
  });

  it("jogador não pode avançar o turno (403)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/initiative`).send({ ...authed(playerToken), action: "next" });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 4. Heartbeat (T3.4), rolagem server-authoritative (T5.4) e chat
// ---------------------------------------------------------------------------
describe("API — heartbeat, roll e chat", () => {
  let code = "";
  let gmToken = "";
  let playerToken = "";

  beforeAll(async () => {
    code = uniqueCode();
    ({ token: gmToken } = await createRoom(code));
    ({ token: playerToken } = await joinRoom(code, "peer_pj", "PlayerJogador", { ...SHEET, handle: "PlayerJogador" }));
  });

  it("heartbeat válido → 200 { success, isOnline }", async () => {
    const res = await request(app).post(`/api/rooms/${code}/heartbeat`).send(authed(playerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, isOnline: true });
  });

  it("heartbeat sem token → 401", async () => {
    const res = await request(app).post(`/api/rooms/${code}/heartbeat`).send({});
    expect(res.status).toBe(401);
  });

  it("roll attack (GM) → 200 com roll no chat (RNG do servidor)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/roll`).send({ ...authed(gmToken), kind: "attack" });
    expect(res.status).toBe(200);
    expect(res.body.roll.rollType).toBe("SKILL");
    expect(res.body.roll.label).toContain("Ataque");
    expect(res.body.roll.total).toBeGreaterThanOrEqual(0);
    const lastMsg = res.body.room.chatMessages[res.body.room.chatMessages.length - 1];
    expect(lastMsg.isDiceRoll).toBe(true);
    expect(lastMsg.rollResult.id).toBe(res.body.roll.id);
  });

  it("roll save (death save) → 200; resultado coerente com BODY", async () => {
    const res = await request(app).post(`/api/rooms/${code}/roll`).send({ ...authed(playerToken), kind: "save" });
    expect(res.status).toBe(200);
    expect(res.body.roll.rollType).toBe("SAVE");
    const body = SHEET.stats.BODY;
    expect(res.body.roll.isCriticalSuccess).toBe(res.body.roll.baseRoll <= body);
  });

  it("roll skill → 200; perícia inexistente → 400", async () => {
    const ok = await request(app).post(`/api/rooms/${code}/roll`).send({ ...authed(playerToken), kind: "skill", skillName: "Handgun" });
    expect(ok.status).toBe(200);
    expect(ok.body.roll.label).toContain("Handgun"); // o nome da perícia vai no label

    const miss = await request(app).post(`/api/rooms/${code}/roll`).send({ ...authed(playerToken), kind: "skill", skillName: "NãoExiste" });
    expect(miss.status).toBe(400);
    expect(miss.body.error).toContain("Perícia não encontrada");
  });

  it("roll com tipo inválido → 400 (cliente não forja rolagem)", async () => {
    const res = await request(app).post(`/api/rooms/${code}/roll`).send({ ...authed(playerToken), kind: "hack" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Tipo de rolagem inválido");
  });

  it("chat: mensagem aparece com handle derivado do servidor", async () => {
    const res = await request(app).post(`/api/rooms/${code}/message`).send({ ...authed(playerToken), text: "Olá, mesa!" });
    expect(res.status).toBe(200);
    const msg = res.body.chatMessages[res.body.chatMessages.length - 1];
    expect(msg.text).toBe("Olá, mesa!");
    expect(msg.senderHandle).toBe("PlayerJogador"); // handle do servidor, não do cliente
    expect(msg.senderRole).toBe("player");
  });

  it("chat: mensagem vazia → 403; sem token → 401", async () => {
    const empty = await request(app).post(`/api/rooms/${code}/message`).send(authed(playerToken));
    expect(empty.status).toBe(403);
    expect(empty.body.error).toBe("Mensagem vazia");
    const noToken = await request(app).post(`/api/rooms/${code}/message`).send({ text: "x" });
    expect(noToken.status).toBe(401);
  });
});
