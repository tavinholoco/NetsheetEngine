/**
 * Fase H (H.3d — H.13) — A PASSAGEM DE BASTÃO ENTRE INSTÂNCIAS
 * ===========================================================
 * Num deploy, o Render liga a instância nova enquanto a velha ainda serve a
 * mesa. A nova lia o banco ao ligar e as duas seguiam separadas até a velha
 * morrer: o que chegava à velha pelo WebSocket nesse meio-tempo se perdia
 * (H.1j, medido no ar em 14/10/2026; reproduzido no ensaio local em 15/10).
 *
 * O conserto: uma instância manda na mesa por vez. A nova pede o bastão e
 * espera, de porta fechada; a velha, que renova a marca de vida a cada 2 s, vê
 * o pedido, entrega (para de aceitar ações, fecha os sockets, grava tudo) e
 * marca que entregou; só então a nova lê o banco e abre a porta.
 *
 * Os testes rodam a lógica contra um banco falso em memória, com o relógio
 * falso do Vitest — duas instâncias no mesmo processo, dividindo a linha.
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInstanceLease, type LeaseRow, type LeaseStore, type InstanceLease } from "../../server/instanceLease";

const EMPTY: LeaseRow = { holder: null, holder_beat: null, claimant: null, claimed_at: null, released_by: null, released_at: null };

/** O banco falso: a linha única, as mesmas condições da `supabaseLeaseStore`. */
function fakeStore() {
  let row: LeaseRow = { ...EMPTY };
  const calls: string[] = [];
  const failing = new Set<string>();
  const failOnce = new Set<string>();
  const gate = (op: string, me: string) => {
    calls.push(`${op}:${me}`);
    if (failing.has(op) || failOnce.delete(op)) throw new Error(`rede caiu (${op})`);
  };
  const store: LeaseStore = {
    async read() {
      gate("read", "-");
      return { ...row };
    },
    async claim(me, at) {
      gate("claim", me);
      row = { ...row, claimant: me, claimed_at: at };
      return { ...row };
    },
    async take(me, at, force) {
      gate(force ? "force" : "take", me);
      if (!force && row.claimant !== me) return false;
      row = { holder: me, holder_beat: at, claimant: null, claimed_at: null, released_by: null, released_at: null };
      return true;
    },
    async beat(me, at) {
      gate("beat", me);
      if (row.holder !== me) return null;
      row = { ...row, holder_beat: at };
      return { ...row };
    },
    async release(me, at) {
      gate("release", me);
      if (row.holder !== me) return false;
      row = { ...row, released_by: me, released_at: at };
      return true;
    }
  };
  return {
    store,
    calls,
    get row() {
      return row;
    },
    set(next: Partial<LeaseRow>) {
      row = { ...row, ...next };
    },
    fail: (op: string) => failing.add(op),
    heal: (op: string) => failing.delete(op),
    failOnce: (op: string) => failOnce.add(op)
  };
}

function hooks() {
  const events: string[] = [];
  return {
    events,
    onHandoff: vi.fn(async (reason: string) => {
      events.push(`handoff:${reason}`);
    }),
    onLost: vi.fn(() => {
      events.push("lost");
    }),
    onOrphaned: vi.fn(() => {
      events.push("orphaned");
    })
  };
}

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const leases: InstanceLease[] = [];
function lease(store: LeaseStore | null, id: string, h = hooks()) {
  const l = createInstanceLease(store, { id, ...h, log: () => {} });
  leases.push(l);
  return { l, h };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T22:34:47Z"));
});
afterEach(() => {
  for (const l of leases.splice(0)) l.stop();
  vi.useRealTimers();
});

describe("acquire — a instância nova, de porta fechada", () => {
  it("sem ninguém no bastão (o primeiro boot), assume na hora", async () => {
    const db = fakeStore();
    const { l } = lease(db.store, "nova");
    await expect(l.acquire()).resolves.toBe("free");
    expect(l.state()).toBe("holding");
    expect(db.row.holder).toBe("nova");
    expect(db.row.claimant).toBeNull();
  });

  it("com a marca de vida velha (a velha morreu), assume na hora — sem esperar o prazo", async () => {
    const db = fakeStore();
    db.set({ holder: "velha", holder_beat: iso(60_000) });
    const { l } = lease(db.store, "nova");
    const done = l.acquire();
    await vi.advanceTimersByTimeAsync(0);
    await expect(done).resolves.toBe("free");
    expect(db.row.holder).toBe("nova");
  });

  it("a velha entregou no SIGTERM (a hibernação): assume na hora", async () => {
    const db = fakeStore();
    db.set({ holder: "velha", holder_beat: iso(500), released_by: "velha", released_at: iso(400) });
    const { l } = lease(db.store, "nova");
    const done = l.acquire();
    await vi.advanceTimersByTimeAsync(0);
    await expect(done).resolves.toBe("handed-over");
  });

  it("com a velha viva, espera a entrega — e só assume depois de a velha gravar e marcar", async () => {
    const db = fakeStore();
    const velha = lease(db.store, "velha");
    await velha.l.acquire();
    velha.l.start();

    const order: string[] = [];
    velha.h.onHandoff.mockImplementation(async () => {
      order.push("velha: fecha os sockets e grava");
      await new Promise((r) => setTimeout(r, 300)); // a gravação leva tempo
      order.push("velha: gravou");
    });
    const nova = lease(db.store, "nova");
    let assumiu = false;
    const done = nova.l.acquire().then((how) => {
      order.push("nova: assume e lê o banco");
      assumiu = true;
      return how;
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(assumiu).toBe(false); // a velha ainda não renovou: não viu o pedido
    expect(db.row.claimant).toBe("nova");

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(done).resolves.toBe("handed-over");
    expect(order).toEqual(["velha: fecha os sockets e grava", "velha: gravou", "nova: assume e lê o banco"]);
    expect(velha.h.onHandoff).toHaveBeenCalledWith("claimed");
    expect(velha.l.state()).toBe("released");
    expect(nova.l.state()).toBe("holding");
    expect(db.row.holder).toBe("nova");
  });

  it("a velha viva que não entrega (sem o código do bastão, ou travada): a nova força depois do prazo", async () => {
    const db = fakeStore();
    db.set({ holder: "teimosa", holder_beat: iso(0) });
    const vivo = setInterval(() => db.set({ holder_beat: iso(0) }), 2_000); // renova, nunca entrega
    const { l } = lease(db.store, "nova");
    const done = l.acquire();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(l.state()).toBe("waiting");
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(done).resolves.toBe("forced");
    expect(db.row.holder).toBe("nova");
    clearInterval(vivo);
  });

  it("banco fora do ar no boot: sobe sem bastão em 5 s, como antes da H.3d — o despertar não espera os 30 s", async () => {
    const db = fakeStore();
    db.fail("claim");
    db.fail("read");
    db.fail("force");
    const { l } = lease(db.store, "nova");
    const done = l.acquire();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(l.state()).toBe("waiting");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(done).resolves.toBe("unavailable");
    expect(l.state()).toBe("disabled");
  });

  it("banco que cai DEPOIS do pedido (a velha viva): espera o prazo inteiro e força, ou sobe sem bastão", async () => {
    const db = fakeStore();
    db.set({ holder: "velha", holder_beat: iso(0) });
    const { l } = lease(db.store, "nova");
    const done = l.acquire();
    await vi.advanceTimersByTimeAsync(600);
    db.fail("read");
    db.fail("force");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(l.state()).toBe("waiting"); // pediu: a velha pode estar entregando
    await vi.advanceTimersByTimeAsync(21_000);
    await expect(done).resolves.toBe("unavailable");
  });

  it("sem banco (dev sem Supabase, os testes): desligado, sobe na hora", async () => {
    const { l } = lease(null, "nova");
    await expect(l.acquire()).resolves.toBe("disabled");
    expect(l.state()).toBe("disabled");
  });
});

describe("start — a velha, que renova a marca de vida", () => {
  it("renova a cada 2 s enquanto ninguém pede", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    await vi.advanceTimersByTimeAsync(6_100);
    expect(db.calls.filter((c) => c === "beat:velha")).toHaveLength(3);
    expect(h.onHandoff).not.toHaveBeenCalled();
    expect(db.row.holder_beat).toBe(iso(100));
  });

  it("vê o pedido na renovação e entrega: grava, e SÓ DEPOIS marca que entregou", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    let releasedDuringHandoff: string | null = "?";
    h.onHandoff.mockImplementation(async () => {
      releasedDuringHandoff = db.row.released_by;
    });
    db.set({ claimant: "nova", claimed_at: iso(0) });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(h.onHandoff).toHaveBeenCalledTimes(1);
    expect(releasedDuringHandoff).toBeNull();
    expect(db.row.released_by).toBe("velha");
    expect(l.state()).toBe("released");
  });

  it("um erro de rede na renovação NÃO é troca: segue servindo", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    db.failOnce("beat");
    await vi.advanceTimersByTimeAsync(2_100);
    expect(h.onHandoff).not.toHaveBeenCalled();
    expect(h.onLost).not.toHaveBeenCalled();
    expect(l.state()).toBe("holding");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(db.row.holder_beat).toBe(iso(100)); // a renovação seguinte (aos 4 s) passou
  });

  it("depois de entregar, a velha não escreve mais nada no bastão", async () => {
    const db = fakeStore();
    const { l } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    db.set({ claimant: "nova" });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(l.state()).toBe("released");
    const depois = db.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(db.calls.slice(depois).filter((c) => !c.startsWith("read"))).toEqual([]);
  });

  it("perdeu o bastão (uma nova forçou): para SEM gravar", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    db.set({ holder: "nova", holder_beat: iso(0) });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(h.onLost).toHaveBeenCalledTimes(1);
    expect(h.onHandoff).not.toHaveBeenCalled();
    expect(l.state()).toBe("lost");
    expect(db.calls).not.toContain("release:velha");
  });

  it("entregou e ninguém assumiu (a nova morreu no boot): avisa, para o processo sair e o Render o religar", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    db.set({ claimant: "nova" });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(l.state()).toBe("released");
    await vi.advanceTimersByTimeAsync(59_000);
    expect(h.onOrphaned).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.onOrphaned).toHaveBeenCalledTimes(1);
  });

  it("entregou e a nova assumiu: não sai sozinha (o SIGTERM do Render é que vem)", async () => {
    const db = fakeStore();
    const velha = lease(db.store, "velha");
    await velha.l.acquire();
    velha.l.start();
    const nova = lease(db.store, "nova");
    const done = nova.l.acquire();
    await vi.advanceTimersByTimeAsync(3_000);
    await done;
    await vi.advanceTimersByTimeAsync(90_000);
    expect(velha.h.onOrphaned).not.toHaveBeenCalled();
  });
});

describe("shutdown — o SIGTERM", () => {
  it("com o bastão (a hibernação): entrega — grava e marca, para a próxima assumir na hora", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    await l.shutdown();
    expect(h.onHandoff).toHaveBeenCalledWith("shutdown");
    expect(db.row.released_by).toBe("velha");
  });

  it("depois de entregar (o deploy): sai sem gravar nada — o banco já é da nova", async () => {
    const db = fakeStore();
    const { l, h } = lease(db.store, "velha");
    await l.acquire();
    l.start();
    db.set({ claimant: "nova" });
    await vi.advanceTimersByTimeAsync(2_100);
    db.set({ holder: "nova", released_by: null });
    const antes = db.calls.length;
    await l.shutdown();
    expect(h.onHandoff).toHaveBeenCalledTimes(1);
    expect(db.calls.slice(antes)).toEqual([]);
  });

  it("sem banco: o desligamento ainda grava (o flush de sempre)", async () => {
    const { l, h } = lease(null, "única");
    await l.acquire();
    await l.shutdown();
    expect(h.onHandoff).toHaveBeenCalledWith("shutdown");
  });
});
