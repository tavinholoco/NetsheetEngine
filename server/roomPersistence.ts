// ============================================================
// FASE 3 — PERSISTÊNCIA DE SALAS NO SUPABASE (T3.1/T3.2)
// ============================================================
// O roomManager continua sendo a fonte de verdade em memória. Este
// módulo apenas espelha o estado de cada sala na tabela `rooms`
// (room_state jsonb) usando a service role key do servidor, que
// bypassa RLS. Nenhum cliente acessa esta tabela diretamente.
//
// Estratégia de escrita:
//  - queueRoomPersist(code): salva com DEBOUNCE (2s) — mutações em
//    rajada (ex.: drag de token no grid) geram 1 write por janela. H.10:
//    com espera máxima de 10 s — numa rajada contínua o debounce
//    reiniciava a cada mutação e a sala não era gravada nenhuma vez.
//  - persistRoomNow(code): grava imediato (usado no leave, no join — H.11 —
//    e no flush). As gravações de uma sala vão EM FILA: a última a chegar
//    ao banco é sempre a mais nova.
//  - deleteRoomPersisted(code): remove a linha quando a sala encerra.
//  - restoreRoomsFromDb(): T3.2 — carrega salas ativas no boot.
//  - flushAllPending(): grava tudo — no shutdown e na entrega do bastão
//    (H.3d), esperando inclusive a gravação que já estava em voo.
//  - freezePersistence(): H.3d — depois de entregar o bastão, a instância
//    não grava mais nada: o banco passa a ser da nova.
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exportRoomSessions, getRoom, isRoomAbandoned, restoreRoom, restoreRoomSessions } from "./roomManager.js";
import type { GameRoom } from "../src/types/multiplayer.js";
import { logger } from "./logger.js";
import { roomKey } from "./room/key.js";

const ROOMS_TABLE = "rooms";
const SAVE_DEBOUNCE_MS = 2000;
/** H.10 — numa rajada, grava pelo menos a cada 10 s (o `maxWait` de um debounce comum). */
const SAVE_MAX_WAIT_MS = 10_000;

let db: SupabaseClient | null = null;
const pendingTimers = new Map<string, NodeJS.Timeout>();
/** H.10 — desde quando a sala tem mutação não gravada. */
const pendingSince = new Map<string, number>();
/** A fila de gravações de cada sala: a próxima só sai quando a anterior voltou. */
const writeChains = new Map<string, Promise<boolean>>();
/** H.3d — o bastão foi entregue: nenhuma gravação sai mais desta instância. */
let frozen = false;

// Os testes da H.3d trocam o banco por um falso — o `getDb` devolve null em teste.
let testClient: SupabaseClient | null = null;
export function setPersistenceClientForTests(client: SupabaseClient | null): void {
  testClient = client;
  for (const t of pendingTimers.values()) clearTimeout(t);
  pendingTimers.clear();
  pendingSince.clear();
  writeChains.clear();
  frozen = false;
}

/** O cliente do Supabase do servidor (service role) — o bastão da H.3d usa o mesmo. */
export function getDb(): SupabaseClient | null {
  if (testClient) return testClient;
  if (db) return db;
  // T9.3 — testes de integração NUNCA tocam o banco, mesmo que .env.local
  // tenha credenciais (supertest roda o app em processo, sem listener).
  if (process.env.NODE_ENV === "test") return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logger.warn("persistence_disabled", { reason: "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes" });
    return null;
  }
  db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return db;
}

function clearPending(key: string): void {
  const timer = pendingTimers.get(key);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(key);
  pendingSince.delete(key);
}

/** Agende a gravação da sala (debounce — coalesce rajadas de mutação). */
export function queueRoomPersist(code: string): void {
  const client = getDb();
  if (!client || frozen) return;
  const key = roomKey(code);
  const since = pendingSince.get(key) ?? Date.now();
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingSince.set(key, since);
  // H.10 — o debounce reinicia a cada mutação, mas não passa da espera máxima.
  const delay = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, since + SAVE_MAX_WAIT_MS - Date.now()));
  pendingTimers.set(key, setTimeout(() => {
    void persistRoomNow(key);
  }, delay));
}

/**
 * Grava a sala imediatamente (se ainda existir em memória). Resolve `true` se
 * gravou (ou não havia o que gravar), `false` se a gravação falhou — e aí ela
 * volta para a fila do debounce.
 */
export function persistRoomNow(code: string): Promise<boolean> {
  const key = roomKey(code);
  // O que estava agendado vai junto: esta gravação leva o estado de agora.
  clearPending(key);
  const previous = writeChains.get(key) ?? Promise.resolve(true);
  const next = previous.then(() => writeRoom(key));
  writeChains.set(key, next);
  void next.finally(() => {
    if (writeChains.get(key) === next) writeChains.delete(key);
  });
  return next;
}

async function writeRoom(key: string): Promise<boolean> {
  const client = getDb();
  if (!client || frozen) return true;
  // O retrato da sala é tirado na vez desta gravação na fila, não na hora do
  // pedido: a última da fila leva sempre o estado mais novo.
  const room: GameRoom | undefined = getRoom(key);
  if (!room) return true; // sala encerrada em memória — o delete cuida dela
  const { error } = await client
    .from(ROOMS_TABLE)
    .upsert(
      {
        code: room.code,
        room_state: room as unknown as Record<string, unknown>,
        // B.4 (SEC-03) — sessões em coluna PRÓPRIA, jamais dentro de
        // room_state: aquele objeto é o que vai no broadcast para a mesa
        // inteira. Só o hash do token é gravado (ver roomManager).
        sessions: exportRoomSessions(room.code),
        updated_at: new Date().toISOString()
      },
      { onConflict: "code" }
    );
  if (error) {
    // Retry em 2s: evita perder a janela de debounce em falha de rede
    // transitória (sem retry, o estado daquela janela se perderia).
    logger.warn("persistence_save_failed", { room: key, retryInMs: SAVE_DEBOUNCE_MS, message: error.message });
    if (!frozen && !pendingTimers.has(key)) {
      pendingSince.set(key, Date.now());
      pendingTimers.set(key, setTimeout(() => {
        void persistRoomNow(key);
      }, SAVE_DEBOUNCE_MS));
    }
    return false;
  }
  return true;
}

/** Remove a sala do banco (mesa encerrada). Também cancela persist pendente. */
export async function deleteRoomPersisted(code: string): Promise<void> {
  const client = getDb();
  if (!client || frozen) return;
  const key = roomKey(code);
  clearPending(key);
  const { error } = await client.from(ROOMS_TABLE).delete().eq("code", key);
  if (error) {
    logger.warn("persistence_delete_failed", { room: key, message: error.message });
  }
}

/** T3.2 — restaura as salas persistidas no boot (players marcados offline). */
export async function restoreRoomsFromDb(): Promise<number> {
  const client = getDb();
  if (!client) return 0;
  const { data, error } = await client
    .from(ROOMS_TABLE)
    .select("code, room_state, sessions")
    .order("updated_at", { ascending: false });
  if (error) {
    logger.warn("persistence_restore_failed", { message: error.message });
    return 0;
  }
  let restored = 0;
  let sessionsRestored = 0;
  let abandoned = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const state = row.room_state as unknown;
    if (typeof state === "object" && state !== null) {
      // E.03 (SEC-15) — sala abandonada não volta: o coletor só roda 15 min
      // depois do boot, e o restore trazia tudo de volta antes dele. A linha
      // sai do banco, como o coletor faria.
      if (isRoomAbandoned(state as GameRoom)) {
        abandoned += 1;
        await deleteRoomPersisted(String(row.code));
        continue;
      }
      // E.03 — e o que não cabe no teto de salas fica no banco, fora da
      // memória (as mais recentes vêm primeiro, pela ordem da consulta).
      if (!restoreRoom(state as GameRoom)) {
        skipped += 1;
        continue;
      }
      restored += 1;
      // B.4 (SEC-03) — repõe as sessões DEPOIS da sala existir. Linha gravada
      // antes da migration 0007 vem sem a coluna: `undefined` é tratado como
      // "nenhuma sessão", e a mesa volta ao comportamento antigo (todos
      // reconectam) em vez de quebrar o boot.
      sessionsRestored += restoreRoomSessions((state as GameRoom).code, row.sessions);
    }
  }
  logger.info("persistence_restored", { count: restored, sessions: sessionsRestored, abandoned, skipped });
  return restored;
}

/**
 * Grava todas as pendências — no shutdown e na entrega do bastão (H.3d).
 * Espera também as gravações que já estavam em voo: a instância nova só lê o
 * banco depois disto, e uma gravação atrasada chegaria depois da leitura. Com
 * `attempts` > 1, o que falhou na rede é tentado de novo na hora. Resolve
 * `true` se nada ficou por gravar.
 */
export async function flushAllPending(attempts = 1): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const keys = [...pendingTimers.keys()];
    const writes = [...writeChains.values(), ...keys.map((key) => persistRoomNow(key))];
    await Promise.all(writes);
    if (pendingTimers.size === 0) return true;
  }
  return false;
}

/** H.3d — o bastão foi entregue: daqui em diante, esta instância não grava nada. */
export function freezePersistence(): void {
  frozen = true;
  for (const key of [...pendingTimers.keys()]) clearPending(key);
}
