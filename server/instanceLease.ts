// ============================================================
// FASE H (H.3d — H.13) — A PASSAGEM DE BASTÃO ENTRE INSTÂNCIAS
// ============================================================
// Num deploy, o Render liga a instância nova enquanto a velha ainda serve a
// mesa, e só manda tráfego à nova quando a porta dela abre (H.3d.0: sem health
// check HTTP no serviço, o teste é a porta TCP). A nova lia o banco ao ligar e
// as duas seguiam separadas até a velha morrer: o que chegava à velha pelo
// WebSocket nesse meio-tempo se perdia (H.1j).
//
// A regra agora: UMA instância manda na mesa por vez, e o bastão é a linha da
// `instance_lease` (migration 0008).
//   - A nova PEDE (`claimant`) e espera, de porta fechada — o `startServer` só
//     restaura e escuta depois do `acquire`. Nunca abrir a porta antes do bastão.
//   - A velha RENOVA a marca de vida a cada 2 s; na renovação vê o pedido e
//     ENTREGA: o servidor para de aceitar ações, fecha os sockets e grava tudo
//     (`onHandoff`), e só então ela marca que entregou (`released_by`).
//   - A nova assume quando a velha entregou, quando a marca de vida está velha
//     (a velha morreu, ou o serviço hibernava) ou quando não há ninguém.
// Desenho, versões descartadas e premissas: o H.13 do ledger da H e a ADR 0007.
//
// O banco é dependência injetada (`LeaseStore`): os testes rodam a lógica
// contra um banco falso, e a `supabaseLeaseStore` é a de verdade.
// ============================================================

import crypto from "node:crypto";
import os from "node:os";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Um id por processo: o host (no Render, o da instância) e um sufixo aleatório. */
export function newInstanceId(): string {
  return `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
}

export interface LeaseRow {
  holder: string | null;
  holder_beat: string | null;
  claimant: string | null;
  claimed_at: string | null;
  released_by: string | null;
  released_at: string | null;
}

/** As cinco operações na linha única. Erro de rede LANÇA; "não era meu" volta falso/null. */
export interface LeaseStore {
  read(): Promise<LeaseRow>;
  /** Anota o pedido da instância nova. */
  claim(me: string, at: string): Promise<LeaseRow>;
  /** Assume o bastão — só se o pedido anotado ainda é o meu, a menos que `force`. */
  take(me: string, at: string, force: boolean): Promise<boolean>;
  /** Renova a marca de vida; `null` = o bastão não é mais meu. */
  beat(me: string, at: string): Promise<LeaseRow | null>;
  /** Marca que entreguei (depois de gravar tudo). */
  release(me: string, at: string): Promise<boolean>;
}

/**
 * idle → waiting → holding → handing-off → released
 *                          ↘ lost (outra forçou: parar sem gravar)
 * `disabled`: sem banco, ou banco fora do ar no boot — serve sozinha, como
 * antes da H.3d.
 */
export type LeaseState = "idle" | "waiting" | "holding" | "handing-off" | "released" | "lost" | "disabled";

/** Como o `acquire` terminou — vai para o log. */
export type AcquireOutcome = "free" | "handed-over" | "forced" | "unavailable" | "disabled";

export interface LeaseOptions {
  id: string;
  /** Renovação da marca de vida. */
  beatMs?: number;
  /** Marca de vida mais velha que isto = a instância morreu (3 renovações perdidas). */
  staleMs?: number;
  /** Com que frequência a nova olha a linha enquanto espera. */
  pollMs?: number;
  /** Quanto a nova espera uma velha viva que não entrega, antes de forçar. */
  maxWaitMs?: number;
  /** Banco que não responde nada no boot: desistir antes — o despertar não pode esperar 30 s. */
  unreachableMs?: number;
  /** Depois de entregar, quanto esperar alguém assumir antes de `onOrphaned`. */
  orphanMs?: number;
  /** Parar de aceitar ações, fechar os sockets e gravar tudo. */
  onHandoff(reason: "claimed" | "shutdown"): Promise<void>;
  /** Outra instância forçou: parar SEM gravar — o banco já é dela. */
  onLost(): void;
  /** Entregou e ninguém assumiu (a nova morreu no boot): sair, para o Render religar. */
  onOrphaned?(): void;
  log?(event: string, data: Record<string, unknown>, level?: "info" | "warn"): void;
}

export interface InstanceLease {
  readonly id: string;
  state(): LeaseState;
  /** A instância nova: pede o bastão e resolve quando pode ler o banco e abrir a porta. */
  acquire(): Promise<AcquireOutcome>;
  /** Começa a renovar a marca de vida (depois de abrir a porta). */
  start(): void;
  /** O SIGTERM: entrega se ainda serve; se já entregou ou perdeu, não escreve nada. */
  shutdown(): Promise<void>;
  /** Para os timers (testes). */
  stop(): void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createInstanceLease(store: LeaseStore | null, opts: LeaseOptions): InstanceLease {
  const me = opts.id;
  const beatMs = opts.beatMs ?? 2_000;
  const staleMs = opts.staleMs ?? 6_000;
  const pollMs = opts.pollMs ?? 500;
  const maxWaitMs = opts.maxWaitMs ?? 30_000;
  const unreachableMs = opts.unreachableMs ?? 5_000;
  const orphanMs = opts.orphanMs ?? 60_000;
  const log = opts.log ?? (() => {});
  const now = () => new Date().toISOString();

  let state: LeaseState = "idle";
  let beatTimer: NodeJS.Timeout | null = null;
  let orphanTimer: NodeJS.Timeout | null = null;
  let beating = false;
  let beatFailures = 0;
  let handoff: Promise<void> | null = null;

  // A marca de vida vem do relógio da outra instância. No Render os relógios são
  // sincronizados; um desvio de segundos só adianta ou atrasa a assunção de quem
  // já morreu — quem está vivo entrega pelo pedido, não pelo relógio.
  const isStale = (beat: string | null) => !beat || Date.now() - Date.parse(beat) > staleMs;

  function stopBeating() {
    if (beatTimer) clearInterval(beatTimer);
    beatTimer = null;
  }

  async function acquire(): Promise<AcquireOutcome> {
    if (!store) {
      state = "disabled";
      return "disabled";
    }
    state = "waiting";
    const t0 = Date.now();
    let claimed = false;
    let lastError = "";
    for (;;) {
      try {
        let row = claimed ? await store.read() : await store.claim(me, now());
        claimed = true;
        // Outra instância assumiu e limpou o pedido: pedir de novo.
        if (row.claimant === null && row.holder !== me) row = await store.claim(me, now());
        const handedOver = !!row.holder && row.released_by === row.holder;
        const free = !row.holder || handedOver || isStale(row.holder_beat);
        if (free && row.claimant === me && (await store.take(me, now(), false))) {
          state = "holding";
          const how = handedOver ? "handed-over" : "free";
          log("lease_acquired", { id: me, how, from: row.holder, waitedMs: Date.now() - t0 });
          return how;
        }
      } catch (e) {
        lastError = (e as Error)?.message || String(e);
      }
      if (!claimed && Date.now() - t0 >= unreachableMs) {
        // O banco não respondeu nem ao pedido: sem banco o restore também falha,
        // e esperar mais só atrasa a mesa (o despertar da hibernação).
        state = "disabled";
        log("lease_unavailable", { id: me, waitedMs: Date.now() - t0, message: lastError }, "warn");
        return "unavailable";
      }
      if (Date.now() - t0 >= maxWaitMs) {
        // A velha viva que não entrega (sem o código do bastão, ou travada): forçar.
        // Ela vê, na renovação seguinte, que o bastão não é mais dela — e para sem gravar.
        try {
          if (await store.take(me, now(), true)) {
            state = "holding";
            log("lease_forced", { id: me, waitedMs: Date.now() - t0 }, "warn");
            return "forced";
          }
        } catch (e) {
          lastError = (e as Error)?.message || String(e);
        }
        // Banco fora do ar: servir sem bastão, como antes da H.3d. Perder o que
        // uma velha viva receber é melhor que não abrir a mesa nenhuma.
        state = "disabled";
        log("lease_unavailable", { id: me, waitedMs: Date.now() - t0, message: lastError }, "warn");
        return "unavailable";
      }
      await sleep(pollMs);
    }
  }

  async function handOff(reason: "claimed" | "shutdown", to?: string | null): Promise<void> {
    if (handoff) return handoff;
    const held = state === "holding";
    if (!held && state !== "disabled") return;
    state = "handing-off";
    stopBeating();
    handoff = (async () => {
      const t0 = Date.now();
      await opts.onHandoff(reason);
      let released = false;
      if (held && store) {
        // Marcar que entregou é o que libera a nova sem esperar a marca de vida
        // envelhecer. Se não der, ela assume em `staleMs` do mesmo jeito: esta
        // instância parou de renovar.
        for (let i = 0; i < 3 && !released; i++) {
          try {
            released = await store.release(me, now());
          } catch {
            await sleep(500);
          }
        }
      }
      state = "released";
      log("lease_released", { id: me, reason, to: to ?? null, released, tookMs: Date.now() - t0 });
      if (reason === "claimed" && store) {
        orphanTimer = setTimeout(() => void checkOrphaned(), orphanMs);
      }
    })();
    return handoff;
  }

  async function checkOrphaned() {
    if (!store) return;
    try {
      const row = await store.read();
      if (row.holder === me) {
        log("lease_orphaned", { id: me, claimant: row.claimant }, "warn");
        opts.onOrphaned?.();
      }
    } catch {
      /* banco fora do ar: o SIGTERM do deploy ainda pode vir */
    }
  }

  async function beat() {
    if (state !== "holding" || beating || !store) return;
    beating = true;
    try {
      const row = await store.beat(me, now());
      if (state !== "holding") return;
      if (beatFailures > 0) log("lease_beat_recovered", { id: me, failures: beatFailures });
      beatFailures = 0;
      if (!row) {
        state = "lost";
        stopBeating();
        log("lease_lost", { id: me }, "warn");
        opts.onLost();
        return;
      }
      if (row.claimant && row.claimant !== me) await handOff("claimed", row.claimant);
    } catch (e) {
      // Erro de rede NÃO é troca: segue servindo e tenta na próxima.
      if (beatFailures === 0) log("lease_beat_failed", { id: me, message: (e as Error)?.message || String(e) }, "warn");
      beatFailures += 1;
    } finally {
      beating = false;
    }
  }

  return {
    id: me,
    state: () => state,
    acquire,
    start() {
      if (state !== "holding" || beatTimer) return;
      beatTimer = setInterval(() => void beat(), beatMs);
    },
    async shutdown() {
      if (orphanTimer) clearTimeout(orphanTimer);
      if (state === "holding" || state === "disabled") return handOff("shutdown");
      if (handoff) return handoff;
    },
    stop() {
      stopBeating();
      if (orphanTimer) clearTimeout(orphanTimer);
    }
  };
}

// ------------------------------------------------------------
// O banco de verdade: a linha `id = 1` da `instance_lease`, pela service role
// (só ela tem privilégio na tabela — migration 0008).
// ------------------------------------------------------------
const TABLE = "instance_lease";
const COLS = "holder, holder_beat, claimant, claimed_at, released_by, released_at";

export function supabaseLeaseStore(db: SupabaseClient): LeaseStore {
  async function rows<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data as T;
  }
  return {
    read: () => rows<LeaseRow>(db.from(TABLE).select(COLS).eq("id", 1).single()),
    claim: (me, at) => rows<LeaseRow>(db.from(TABLE).upsert({ id: 1, claimant: me, claimed_at: at }, { onConflict: "id" }).select(COLS).single()),
    async take(me, at, force) {
      let q = db
        .from(TABLE)
        .update({ holder: me, holder_beat: at, claimant: null, claimed_at: null, released_by: null, released_at: null })
        .eq("id", 1);
      if (!force) q = q.eq("claimant", me);
      return (await rows<{ id: number }[]>(q.select("id"))).length === 1;
    },
    async beat(me, at) {
      const r = await rows<LeaseRow[]>(db.from(TABLE).update({ holder_beat: at }).eq("id", 1).eq("holder", me).select(COLS));
      return r[0] ?? null;
    },
    async release(me, at) {
      const r = await rows<{ id: number }[]>(db.from(TABLE).update({ released_by: me, released_at: at }).eq("id", 1).eq("holder", me).select("id"));
      return r.length === 1;
    }
  };
}
