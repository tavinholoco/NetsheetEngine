/**
 * Fase 9 (T9.3) — TESTES DE INTEGRAÇÃO DO roomManager (núcleo da mesa)
 * ====================================================================
 * Camada direta (sem HTTP) sobre server/roomManager.ts — cobre o que a
 * API HTTP não expõe diretamente: handshake de sessão (T1.7), reconexão
 * com ficha last-write-wins (T3.3), transferência de GM ao sair (T1.8),
 * timeout de isOnline (T3.4) e regras de validação/sanitização.
 */
// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  restoreRoom,
  verifySession,
  updatePlayerWoundLevel,
  updateTacticalGrid,
  updateInitiative,
  nextTurn,
  updateRoomSettings,
  markStalePlayersOffline,
  touchPlayer,
  generateRoomNpc,
  deleteRoomNpc,
  updateNpcWoundLevel,
  generateRoomPlayerEdgerunner,
  deleteGeneratedPlayer,
  rollDiceForPlayer,
  sanitizeText,
  isValidRoomCode,
  getAllActiveRooms
} from "../../server/roomManager";
import type { GameRoom } from "../../src/types/multiplayer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
function uniqueCode(): string {
  seq += 1;
  // O manager normaliza códigos para MAIÚSCULAS (e markStalePlayersOffline
  // retorna room.code já normalizado) — geramos em caixa alta desde o início.
  return `T9M-${Date.now().toString(36).slice(-4)}-${seq}`.toUpperCase();
}

const stats = { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 };

function sheet(handle: string, updatedAt = "2026-08-01T00:00:00.000Z"): any {
  return {
    id: `sheet_${handle}`,
    handle,
    realName: handle,
    role: "Solo",
    stats,
    currentStats: { ...stats },
    woundLevel: 0,
    weapons: [],
    skills: [{ id: "s1", name: "Handgun", stat: "REF", level: 4 }],
    cyberware: [],
    armor: [],
    updatedAt
  };
}

/** Esvazia a sala no final do teste (remove da memória global do manager). */
function teardownRoom(code: string): void {
  for (const peerId of Object.keys(getRoom(code)?.players ?? {})) {
    leaveRoom(code, peerId);
  }
}

// Limpeza global após CADA teste: rooms vazias são removidas pelo leaveRoom, e
// o scan de presença (markStalePlayersOffline) varre TODAS as salas — testes
// que falham (assertion) não podem vazar salas para os próximos.
afterEach(() => {
  for (const r of getAllActiveRooms()) {
    for (const peerId of Object.keys(getRoom(r.code)?.players ?? {})) {
      leaveRoom(r.code, peerId);
    }
  }
});

// ---------------------------------------------------------------------------
// Sessões (T1.7)
// ---------------------------------------------------------------------------
describe("roomManager — sessões (T1.7)", () => {
  it("createRoom emite token que verifica para o GM na sala", () => {
    const code = uniqueCode();
    const { room, sessionToken } = createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    expect(verifySession(code, sessionToken)).toBe("gm_1");
    expect(verifySession("OUTRA-SALA", sessionToken)).toBeNull(); // token é por sala
    expect(verifySession(code, "token_fake")).toBeNull();
    teardownRoom(code);
  });

  it("cada jogador tem sessão própria (tokens distintos)", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    const a = joinRoom(code, "peer_a", "Alice", sheet("Alice"))!;
    const b = joinRoom(code, "peer_b", "Bob", sheet("Bob"))!;
    expect(a.sessionToken).not.toBe(b.sessionToken);
    expect(verifySession(code, a.sessionToken)).toBe("peer_a");
    expect(verifySession(code, b.sessionToken)).toBe("peer_b");
    teardownRoom(code);
  });
});

// ---------------------------------------------------------------------------
// Reconexão (T3.3) — mesmo peerId não duplica jogador; ficha LWW
// ---------------------------------------------------------------------------
describe("roomManager — reconexão (T3.3)", () => {
  it("re-join com o mesmo peerId atualiza o jogador existente (sem duplicar)", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    const first = joinRoom(code, "peer_x", "X", sheet("X"))!;
    expect(Object.keys(first.room.players)).toHaveLength(2);

    const second = joinRoom(code, "peer_x", "X", sheet("X"))!;
    expect(Object.keys(second.room.players)).toHaveLength(2); // não duplica
    expect(second.room.players["peer_x"].joinedAt).toBe(first.room.players["peer_x"].joinedAt);

    // Reconexão é silenciosa (sem nova mensagem "conectou-se")
    const joinMsgs = second.room.chatMessages.filter((m) => m.text.includes("conectou-se"));
    expect(joinMsgs).toHaveLength(1);
    teardownRoom(code);
  });

  it("ficha persistida (updatedAt mais novo) vence na reconexão — LWW", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    // O servidor "persistiu" a ficha mais nova (primeiro join com ela)
    const newer = sheet("X", "2026-08-05T00:00:00.000Z");
    newer.woundLevel = 7; // estado avançado no servidor
    joinRoom(code, "peer_x", "X", newer);

    // reconexão manda ficha "estale" (mais antiga) → a do servidor vence
    const stale = sheet("X", "2026-08-02T00:00:00.000Z");
    stale.woundLevel = 1;
    const re = joinRoom(code, "peer_x", "X", stale)!;
    expect(re.room.players["peer_x"].sheet.woundLevel).toBe(7);

    // e ficha mais NOVA que a do servidor sobrescreve
    const fresher = sheet("X", "2026-08-09T00:00:00.000Z");
    fresher.woundLevel = 3;
    const re2 = joinRoom(code, "peer_x", "X", fresher)!;
    expect(re2.room.players["peer_x"].sheet.woundLevel).toBe(3);
    teardownRoom(code);
  });

  it("reconexão reutiliza o token do grid (sem token duplicado)", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_x", "X", sheet("X"));
    const re = joinRoom(code, "peer_x", "X", sheet("X"))!;
    const tokens = re.room.tacticalGrid!.tokens.filter((t) => t.peerId === "peer_x");
    expect(tokens).toHaveLength(1);
    teardownRoom(code);
  });

  it("join sem sala → null; join com peerId vazio → null", () => {
    expect(joinRoom("NAO-EXISTE", "p", "H", sheet("H"))).toBeNull();
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    expect(joinRoom(code, "   ", "H", sheet("H"))).toBeNull();
    teardownRoom(code);
  });
});

// ---------------------------------------------------------------------------
// Reivindicação de GM pelo handle (checkIsGm) e transferência ao sair (T1.8)
// ---------------------------------------------------------------------------
describe("roomManager — GM: claim pelo handle e transferência (T1.8)", () => {
  it("quem reivindica o gmHandle (gmPeerId indefinido) assume a mesa", () => {
    const code = uniqueCode();
    // Sala restaurada do banco sem gmPeerId definido
    const room = createRoom(code, "Mesa de Teste", "DonaMesa", "gm_1").room;
    // createRoom setou gmPeerId — simula snapshot antigo removendo
    delete (room as Partial<GameRoom>).gmPeerId;
    expect(getRoom(code)!.gmPeerId).toBeUndefined();

    const j = joinRoom(code, "peer_claim", "Donamesa", sheet("Claim"))!;
    expect(j.room.gmPeerId).toBe("peer_claim"); // assumiu pelo handle (case-insensitive)
    expect(verifySession(code, j.sessionToken)).toBe("peer_claim");
    teardownRoom(code);
  });

  it("GM sai com jogadores online → cargo é transferido (T1.8)", () => {
    const code = uniqueCode();
    const { room, sessionToken } = createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    const r = leaveRoom(code, "gm_1");
    expect(r.room).toBeTruthy();
    expect(r.room!.gmPeerId).toBe("peer_a"); // Alice assumiu
    expect(r.room!.gmHandle).toBe("Alice");
    expect(r.room!.chatMessages.some((m) => m.text.includes("assumiu como novo Mestre"))).toBe(true);
    // Token do GM antigo revogado
    expect(verifySession(code, sessionToken)).toBeNull();
    teardownRoom(code);
  });

  it("último jogador sai → sala encerrada e removida da memória", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    const r1 = leaveRoom(code, "gm_1");
    expect(r1.room).toBeNull();
    expect(r1.error).toContain("Sala encerrada");
    expect(getRoom(code)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GM permissions no núcleo — Bio-Monitor, grid, settings, NPCs, edgerunner
// ---------------------------------------------------------------------------
describe("roomManager — GM permissions (núcleo)", () => {
  it("updatePlayerWoundLevel: GM ok (clamp), jogador → erro", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    const { sessionToken: playerTok } = joinRoom(code, "peer_a", "Alice", sheet("Alice"))!;

    const denied = updatePlayerWoundLevel(code, "peer_a", "peer_a", 5);
    expect(denied.error).toContain("Acesso Negado");
    expect(denied.room).toBeNull();

    const ok = updatePlayerWoundLevel(code, "gm_1", "peer_a", 11);
    expect(ok.room!.players["peer_a"].sheet.woundLevel).toBe(10); // clamp
    expect(ok.room!.tacticalGrid!.tokens.find((t) => t.peerId === "peer_a")!.hp).toBe(10);
    expect(verifySession(code, playerTok)).toBe("peer_a");
    teardownRoom(code);
  });

  it("updateTacticalGrid: GM ok; jogador → erro", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    const denied = updateTacticalGrid(code, "peer_a", { rows: 3, cols: 3, theme: "alley", tokens: [] });
    expect(denied.error).toContain("Acesso Negado");
    const ok = updateTacticalGrid(code, "gm_1", { rows: 3, cols: 3, theme: "alley", tokens: [] });
    expect(ok.room!.tacticalGrid!.rows).toBe(3);
    teardownRoom(code);
  });

  it("updateRoomSettings: clamp do modifier −10..10; jogador → erro", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    expect(updateRoomSettings(code, "peer_a", "X", 1).error).toContain("Acesso Negado");
    const ok = updateRoomSettings(code, "gm_1", "Rua Escura", 42, "Power outage");
    expect(ok.room!.combatModifier).toBe(10);
    expect(ok.room!.locationName).toBe("Rua Escura");
    teardownRoom(code);
  });

  it("NPCs: gerar/atualizar health/remover — só GM; delete limpa token e iniciativa", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));

    expect(generateRoomNpc(code, "peer_a").error).toContain("Acesso Negado");
    const gen = generateRoomNpc(code, "gm_1", "boostergang");
    expect(gen.npcPlayer).toBeTruthy();
    const npcId = gen.npcPlayer!.peerId;
    expect(gen.room!.tacticalGrid!.tokens.some((t) => t.id === `npc_token_${npcId}`)).toBe(true);

    expect(updateNpcWoundLevel(code, "peer_a", npcId, 9).error).toContain("Acesso Negado");
    const hp = updateNpcWoundLevel(code, "gm_1", npcId, 9);
    expect(hp.room!.npcs![npcId].sheet.woundLevel).toBe(9);

    updateInitiative(code, "gm_1", [{ playerId: npcId, handle: "Booster", role: "NPC", score: 15, isCurrentTurn: true }]);
    expect(deleteRoomNpc(code, "peer_a", npcId).error).toContain("Acesso Negado");
    const del = deleteRoomNpc(code, "gm_1", npcId);
    expect(del.room!.npcs).not.toHaveProperty(npcId);
    expect(del.room!.tacticalGrid!.tokens.some((t) => t.id === `npc_token_${npcId}`)).toBe(false);
    expect(del.room!.initiativeList).toHaveLength(0);
    teardownRoom(code);
  });

  it("edgerunner gerado pelo GM entra na mesa com token; delete remove", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    expect(generateRoomPlayerEdgerunner(code, "peer_a").error).toContain("Acesso Negado");
    const gen = generateRoomPlayerEdgerunner(code, "gm_1")!;
    const pid = gen.player!.peerId;
    expect(gen.room!.players[pid]).toBeTruthy();
    expect(gen.room!.tacticalGrid!.tokens.some((t) => t.peerId === pid)).toBe(true);

    const del = deleteGeneratedPlayer(code, "gm_1", pid);
    expect(del.room!.players).not.toHaveProperty(pid);
    expect(del.room!.tacticalGrid!.tokens.some((t) => t.peerId === pid)).toBe(false);
    teardownRoom(code);
  });
});

// ---------------------------------------------------------------------------
// Iniciativa — sanitização, clamp e wrap do turno
// ---------------------------------------------------------------------------
describe("roomManager — iniciativa", () => {
  it("updateInitiative sanitiza handle e clampa score 0..999", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    const ok = updateInitiative(code, "gm_1", [
      { playerId: "p1", handle: "  Alice\nChoom ", role: "Solo", score: -5, isCurrentTurn: false },
      { playerId: "p2", handle: "Bob", role: "Solo", score: 5000, isCurrentTurn: false }
    ]);
    expect(ok.room!.initiativeList[0].handle).toBe("Alice Choom");
    expect(ok.room!.initiativeList[0].score).toBe(0); // clamp baixo
    expect(ok.room!.initiativeList[1].score).toBe(999); // clamp alto
    expect(ok.room!.activeTurnIndex).toBe(0);
    teardownRoom(code);
  });

  it("nextTurn dá a volta (wrap) e marca isCurrentTurn", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    updateInitiative(code, "gm_1", [
      { playerId: "a", handle: "A", role: "Solo", score: 20, isCurrentTurn: true },
      { playerId: "b", handle: "B", role: "Solo", score: 10, isCurrentTurn: false }
    ]);
    nextTurn(code, "gm_1");
    expect(getRoom(code)!.activeTurnIndex).toBe(1);
    nextTurn(code, "gm_1");
    expect(getRoom(code)!.activeTurnIndex).toBe(0); // wrap
    expect(getRoom(code)!.initiativeList[0].isCurrentTurn).toBe(true);
    teardownRoom(code);
  });

  it("jogador não pode editar nem avançar iniciativa", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    expect(updateInitiative(code, "peer_a", []).error).toContain("Acesso Negado");
    expect(nextTurn(code, "peer_a").error).toContain("Acesso Negado");
    teardownRoom(code);
  });
});

// ---------------------------------------------------------------------------
// Presença (T3.4) — timeout de isOnline
// ---------------------------------------------------------------------------
describe("roomManager — presença (T3.4)", () => {
  it("touchPlayer mantém online e renova lastActiveAt", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    const before = getRoom(code)!.players["peer_a"].lastActiveAt;
    expect(touchPlayer(code, "peer_a")).toBe(true);
    const after = getRoom(code)!.players["peer_a"].lastActiveAt!;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before!).getTime());
    expect(getRoom(code)!.players["peer_a"].isOnline).toBe(true);
    teardownRoom(code);
  });

  it("markStalePlayersOffline marca OFFLINE quem passou do timeout (não o ativo)", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    joinRoom(code, "peer_b", "Bob", sheet("Bob"));

    // Simula inatividade: Alice não faz heartbeat há muito tempo
    getRoom(code)!.players["peer_a"].lastActiveAt = new Date(Date.now() - 120_000).toISOString();

    const changed = markStalePlayersOffline();
    expect(changed).toContain(code);
    const room = getRoom(code)!;
    expect(room.players["peer_a"].isOnline).toBe(false);
    expect(room.players["peer_b"].isOnline).toBe(true); // ativo permanece
    teardownRoom(code);
  });
});

// ---------------------------------------------------------------------------
// Rolagem server-authoritative (T5.4) e utilitários de validação
// ---------------------------------------------------------------------------
describe("roomManager — rolagens e validação", () => {
  it("rollDiceForPlayer: save publica RollResult no chat; tipo inválido → erro", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    const r = rollDiceForPlayer(code, "peer_a", { kind: "save" });
    expect(r.room).toBeTruthy();
    expect(r.roll!.rollType).toBe("SAVE");
    const last = r.room!.chatMessages[r.room!.chatMessages.length - 1];
    expect(last.isDiceRoll).toBe(true);
    expect(last.rollResult!.id).toBe(r.roll!.id);

    expect(rollDiceForPlayer(code, "peer_a", { kind: "hack" }).error).toContain("Tipo de rolagem inválido");
    expect(rollDiceForPlayer(code, "peer_a", { kind: "skill", skillName: "Inexistente" }).error).toContain("Perícia não encontrada");
    teardownRoom(code);
  });

  it("sanitizeText remove caracteres de controle e trunca", () => {
    expect(sanitizeText("  Olá\nMundo\t!  ", 20)).toBe("Olá Mundo !");
    expect(sanitizeText("x".repeat(100), 10)).toBe("xxxxxxxxxx");
    expect(sanitizeText(null, 10)).toBe("");
  });

  it("isValidRoomCode aceita 2–12 alfanuméricos/hífen", () => {
    expect(isValidRoomCode("NC-2020")).toBe(true);
    expect(isValidRoomCode("ab")).toBe(true);
    expect(isValidRoomCode("A")).toBe(false); // mínimo 2
    expect(isValidRoomCode("1234567890123")).toBe(false); // máximo 12
    expect(isValidRoomCode("sala!x")).toBe(false);
    expect(isValidRoomCode("sala x")).toBe(false);
  });

  it("getAllActiveRooms lista apenas resumos com contagem de jogadores", () => {
    const code = uniqueCode();
    createRoom(code, "Mesa de Teste", "Mestre", "gm_1");
    joinRoom(code, "peer_a", "Alice", sheet("Alice"));
    const list = getAllActiveRooms();
    const entry = list.find((r) => r.code === code);
    expect(entry).toBeDefined();
    expect(entry!.playersCount).toBe(2);
    expect(Object.keys(entry!)).toEqual(["code", "name", "gmHandle", "playersCount"]);
    teardownRoom(code);
  });
});
