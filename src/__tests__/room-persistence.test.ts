/**
 * Fase H (H.3d) — A GRAVAÇÃO DA MESA, PARA A PASSAGEM DE BASTÃO
 * ============================================================
 * A instância que entrega o bastão grava tudo e, depois, não grava mais nada:
 * o banco passa a ser da nova. Três coisas que a persistência não fazia:
 *   - o `flushAllPending` só gravava o que tinha timer; uma gravação já em voo
 *     podia chegar ao banco DEPOIS de a nova ler — e a nova lia a mesa velha;
 *   - nada impedia uma gravação depois da entrega (um timer, o vigia de presença);
 *   - um erro de rede na gravação final perdia a janela.
 * E, de carona, dois ADIAR cujo gatilho a H.3d disparou (mexer na persistência):
 *   - H.10: o debounce reiniciava a cada mutação — numa rajada de uma ação por
 *     segundo, a sala não era gravada NENHUMA vez (H.1d, reproduzido em 14/10);
 *   - H.11: o token novo de um `join` só ia ao banco pelo mesmo debounce — quem
 *     dava F5 logo antes de uma queda voltava como outro jogador.
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { app } from "../../server";
import { createRoom, getRoom, postChatMessage } from "../../server/roomManager";
import {
  flushAllPending,
  freezePersistence,
  persistRoomNow,
  queueRoomPersist,
  setPersistenceClientForTests
} from "../../server/roomPersistence";

interface Write {
  code: string;
  chat: number;
  sessions: Record<string, string>;
  at: number;
}

/** Um cliente do Supabase de mentira: guarda cada `upsert`, com atraso e falha sob encomenda. */
function fakeDb() {
  const writes: Write[] = [];
  const started: string[] = [];
  let delayMs = 0;
  const nextDelays: number[] = [];
  let failNext = 0;
  const client = {
    from: () => ({
      upsert: (row: { code: string; room_state: { chatMessages?: unknown[] }; sessions: Record<string, string> }) => {
        // O retrato é tirado na hora do pedido, como o JSON que vai pela rede.
        const snap: Write = {
          code: row.code,
          chat: row.room_state.chatMessages?.length ?? 0,
          sessions: { ...row.sessions },
          at: Date.now()
        };
        started.push(row.code);
        const fail = failNext > 0;
        if (fail) failNext -= 1;
        return new Promise((resolve) =>
          setTimeout(() => {
            if (!fail) writes.push(snap);
            resolve({ error: fail ? { message: "rede caiu" } : null });
          }, nextDelays.shift() ?? delayMs)
        );
      },
      delete: () => ({ eq: async () => ({ error: null }) })
    })
  };
  return {
    client,
    writes,
    started,
    slow: (ms: number) => (delayMs = ms),
    /** O atraso de cada uma das próximas gravações, em ordem. */
    delays: (...ms: number[]) => nextDelays.push(...ms),
    failOnce: () => (failNext += 1)
  };
}

let n = 0;
const newCode = () => `PERS-${Date.now().toString(36).slice(-4)}-${++n}`.toUpperCase();

let db: ReturnType<typeof fakeDb>;
beforeEach(() => {
  db = fakeDb();
  setPersistenceClientForTests(db.client as never);
});
afterEach(() => {
  vi.useRealTimers();
  setPersistenceClientForTests(null);
});

describe("H.10 — a rajada também é gravada", () => {
  it("uma mutação por segundo, por 15 s: grava pelo menos a cada 10 s", async () => {
    vi.useFakeTimers();
    const code = newCode();
    const c0 = createRoom(code, "Mesa", "GM", "gm_h10").room.chatMessages.length;
    for (let s = 0; s < 15; s++) {
      postChatMessage(code, "gm_h10", `msg ${s}`);
      queueRoomPersist(code);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    const desta = db.writes.filter((w) => w.code === code);
    // A primeira gravação saiu NO MEIO da rajada (~10 mensagens), não 2 s depois do fim dela.
    expect(desta.length).toBeGreaterThanOrEqual(1);
    expect(desta[0].chat - c0).toBeGreaterThanOrEqual(9);
    expect(desta[0].chat - c0).toBeLessThanOrEqual(11);
  });

  it("a mutação isolada segue no debounce de 2 s", async () => {
    vi.useFakeTimers();
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_h10b");
    queueRoomPersist(code);
    await vi.advanceTimersByTimeAsync(1_900);
    expect(db.writes.filter((w) => w.code === code)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(db.writes.filter((w) => w.code === code)).toHaveLength(1);
  });
});

describe("a entrega do bastão — gravar tudo, e depois nada", () => {
  it("o flush espera a gravação que já estava em voo", async () => {
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_voo");
    db.slow(300);
    void persistRoomNow(code); // o timer do debounce já disparou: está em voo
    await flushAllPending();
    expect(db.writes.filter((w) => w.code === code)).toHaveLength(1);
  });

  it("duas gravações da mesma sala vão em fila: a última a chegar ao banco é a mais nova", async () => {
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_fila");
    db.delays(300, 50); // a primeira demora mais na rede que a segunda
    const primeira = persistRoomNow(code);
    postChatMessage(code, "gm_fila", "a mais nova");
    const segunda = persistRoomNow(code);
    await Promise.all([primeira, segunda]);
    const desta = db.writes.filter((w) => w.code === code);
    // Sem a fila, a primeira (mais velha, mais lenta) chegava por último e ficava no banco.
    expect(desta.at(-1)!.chat).toBe(getRoom(code)!.chatMessages.length);
  });

  it("o flush tenta de novo a gravação que falhou", async () => {
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_retry");
    queueRoomPersist(code);
    db.failOnce();
    await expect(flushAllPending(3)).resolves.toBe(true);
    expect(db.writes.filter((w) => w.code === code)).toHaveLength(1);
  });

  it("depois de congelar, nenhuma gravação sai — nem a que estava agendada", async () => {
    vi.useFakeTimers();
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_gelo");
    queueRoomPersist(code);
    freezePersistence();
    queueRoomPersist(code);
    await persistRoomNow(code);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.started.filter((c) => c === code)).toEqual([]);
  });
});

describe("H.11 — o token novo do `join` vai ao banco na hora", () => {
  it("o assento e o token do join estão no banco antes do debounce", async () => {
    const code = newCode();
    createRoom(code, "Mesa", "GM", "gm_h11");
    const res = await request(app)
      .post("/api/rooms/join")
      .send({ code, peerId: "ana_h11", handle: "Ana", sheet: { handle: "Ana", stats: {} } });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 200)); // bem antes dos 2 s do debounce
    const hash = crypto.createHash("sha256").update(res.body.sessionToken).digest("hex");
    const desta = db.writes.filter((w) => w.code === code);
    expect(desta.length).toBeGreaterThanOrEqual(1);
    expect(desta.at(-1)!.sessions[hash]).toBe("ana_h11");
  });
});
