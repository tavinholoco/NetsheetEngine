/**
 * Fase B (B.5 — SEC-04) — COLETOR DE SALAS ABANDONADAS
 * ====================================================
 * Salas, sessões e buckets do rate limiter nunca expiravam. O
 * `markStalePlayersOffline` marcava o jogador como offline, mas a sala ficava
 * na memória e no banco para sempre — e as sessões dela junto.
 *
 * É a transição `Ociosa → Encerrada` que o diagrama de ciclo de vida em
 * docs/ARQUITETURA.md especificava e o código não tinha.
 *
 * Metade destes testes cobre o que o coletor NÃO pode fazer. Recolher cedo
 * demais apaga a mesa de alguém e o delete no banco é irreversível — o risco
 * não é simétrico, então os casos negativos importam tanto quanto os
 * positivos.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ROOM_ABANDONED_TIMEOUT_MS,
  collectAbandonedRooms,
  createRoom,
  getRoom,
  joinRoom,
  verifySession
} from "../../server/roomManager";
import { pruneExpiredBuckets } from "../../server";

const SHEET = {
  handle: "Rex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
} as never;

let n = 0;
function code(): string {
  n += 1;
  return `SEC4-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

/** Envelhece todos os jogadores da sala, como se o tempo tivesse passado. */
function ageRoom(c: string, ms: number): void {
  const room = getRoom(c)!;
  const past = new Date(Date.now() - ms).toISOString();
  for (const p of Object.values(room.players)) p.lastActiveAt = past;
  room.createdAt = past;
}

describe("collectAbandonedRooms — recolhe", () => {
  it("recolhe sala sem atividade além da janela", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    ageRoom(c, ROOM_ABANDONED_TIMEOUT_MS + 60_000);

    expect(collectAbandonedRooms()).toContain(c);
    expect(getRoom(c)).toBeUndefined();
  });

  it("revoga as sessões da sala recolhida", () => {
    const c = code();
    const { sessionToken } = createRoom(c, "Mesa", "GM", "gm1");
    expect(verifySession(c, sessionToken)).toBe("gm1");

    ageRoom(c, ROOM_ABANDONED_TIMEOUT_MS + 60_000);
    collectAbandonedRooms();

    // Sem isto, o token de uma mesa que não existe mais continuaria válido.
    expect(verifySession(c, sessionToken)).toBeNull();
  });

  it("recolhe sala cujos timestamps são ilegíveis (linha lixo)", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    const room = getRoom(c)!;
    for (const p of Object.values(room.players)) {
      (p as { lastActiveAt?: string }).lastActiveAt = "não é data";
    }
    room.createdAt = "também não";

    expect(collectAbandonedRooms()).toContain(c);
  });

  it("usa o jogador MAIS recente, não o mais antigo", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    joinRoom(c, "p_ativo", "Ativo", SHEET);
    const room = getRoom(c)!;
    // Um jogador sumido há dias, outro ativo agora: a mesa está viva.
    room.players["gm1"].lastActiveAt = new Date(Date.now() - ROOM_ABANDONED_TIMEOUT_MS * 3).toISOString();
    room.players["p_ativo"].lastActiveAt = new Date().toISOString();

    expect(collectAbandonedRooms()).not.toContain(c);
    expect(getRoom(c)).toBeDefined();
  });
});

describe("collectAbandonedRooms — NÃO recolhe", () => {
  it("não recolhe sala recém-criada", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    expect(collectAbandonedRooms()).not.toContain(c);
    expect(getRoom(c)).toBeDefined();
  });

  it("não recolhe sala logo abaixo do limite (nem um minuto antes)", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    ageRoom(c, ROOM_ABANDONED_TIMEOUT_MS - 60_000);
    expect(collectAbandonedRooms()).not.toContain(c);
  });

  it("não recolhe mesa em pausa longa mas dentro da janela", () => {
    // O caso real que a janela de 24 h protege: todos desconectam no
    // intervalo e voltam horas depois.
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    ageRoom(c, 6 * 60 * 60 * 1000);
    expect(collectAbandonedRooms()).not.toContain(c);
    expect(getRoom(c)).toBeDefined();
  });

  it("não toca nas sessões de outras salas ao recolher uma", () => {
    const morta = code();
    const viva = code();
    createRoom(morta, "Morta", "GM", "gm1");
    const vivaRoom = createRoom(viva, "Viva", "GM", "gm2");
    ageRoom(morta, ROOM_ABANDONED_TIMEOUT_MS + 60_000);

    collectAbandonedRooms();

    expect(getRoom(viva)).toBeDefined();
    expect(verifySession(viva, vivaRoom.sessionToken)).toBe("gm2");
  });
});

describe("collectAbandonedRooms — janela configurável", () => {
  it("respeita a janela passada por argumento", () => {
    const c = code();
    createRoom(c, "Mesa", "GM", "gm1");
    ageRoom(c, 5_000);

    expect(collectAbandonedRooms(60_000)).not.toContain(c);
    expect(collectAbandonedRooms(1_000)).toContain(c);
  });
});

describe("pruneExpiredBuckets — o terceiro vazamento do SEC-04", () => {
  it("remove os vencidos e preserva os vigentes", () => {
    const now = Date.now();
    const buckets = new Map([
      ["1.1.1.1", { count: 3, resetAt: now - 1 }],       // vencido
      ["2.2.2.2", { count: 1, resetAt: now + 60_000 }],  // vigente
      ["3.3.3.3", { count: 9, resetAt: now - 60_000 }]   // vencido
    ]);

    expect(pruneExpiredBuckets(buckets, now)).toBe(2);
    expect([...buckets.keys()]).toEqual(["2.2.2.2"]);
  });

  it("trata resetAt exatamente no limite como vencido", () => {
    const now = Date.now();
    const buckets = new Map([["1.1.1.1", { count: 1, resetAt: now }]]);
    expect(pruneExpiredBuckets(buckets, now)).toBe(1);
    expect(buckets.size).toBe(0);
  });

  it("não remove nada quando todos estão vigentes", () => {
    const now = Date.now();
    const buckets = new Map([
      ["a", { count: 1, resetAt: now + 1000 }],
      ["b", { count: 1, resetAt: now + 2000 }]
    ]);
    expect(pruneExpiredBuckets(buckets, now)).toBe(0);
    expect(buckets.size).toBe(2);
  });

  it("mantém o mapa limitado: 1.000 IPs vencidos somem numa passada", () => {
    // Era o vazamento: uma entrada por IP distinto, removida nunca.
    const now = Date.now();
    const buckets = new Map<string, { count: number; resetAt: number }>();
    for (let i = 0; i < 1000; i += 1) {
      buckets.set(`10.0.${Math.floor(i / 256)}.${i % 256}`, { count: 1, resetAt: now - 1 });
    }
    buckets.set("ativo", { count: 1, resetAt: now + 60_000 });

    expect(pruneExpiredBuckets(buckets, now)).toBe(1000);
    expect(buckets.size).toBe(1);
  });
});
