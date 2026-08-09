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
//    rajada (ex.: drag de token no grid) geram 1 write por janela.
//  - persistRoomNow(code): grava imediato (usado no leave e no flush).
//  - deleteRoomPersisted(code): remove a linha quando a sala encerra.
//  - restoreRoomsFromDb(): T3.2 — carrega salas ativas no boot.
//  - flushAllPending(): grava tudo no shutdown (SIGINT/SIGTERM).
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRoom, restoreRoom } from "./roomManager.js";
import type { GameRoom } from "../src/types/multiplayer.js";

const ROOMS_TABLE = "rooms";
const SAVE_DEBOUNCE_MS = 2000;

let db: SupabaseClient | null = null;
const pendingTimers = new Map<string, NodeJS.Timeout>();

function getDb(): SupabaseClient | null {
  if (db) return db;
  // T9.3 — testes de integração NUNCA tocam o banco, mesmo que .env.local
  // tenha credenciais (supertest roda o app em processo, sem listener).
  if (process.env.NODE_ENV === "test") return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[roomPersistence] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — persistência de salas DESATIVADA.");
    return null;
  }
  db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return db;
}

/** Agende a gravação da sala (debounce — coalesce rajadas de mutação). */
export function queueRoomPersist(code: string): void {
  const client = getDb();
  if (!client) return;
  const key = code.trim().toUpperCase();
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingTimers.set(key, setTimeout(() => {
    pendingTimers.delete(key);
    void persistRoomNow(key);
  }, SAVE_DEBOUNCE_MS));
}

/** Grava a sala imediatamente (se ainda existir em memória). */
export async function persistRoomNow(code: string): Promise<void> {
  const client = getDb();
  if (!client) return;
  const key = code.trim().toUpperCase();
  const room: GameRoom | undefined = getRoom(key);
  if (!room) return; // sala encerrada em memória — o delete cuida dela
  const { error } = await client
    .from(ROOMS_TABLE)
    .upsert(
      { code: room.code, room_state: room as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "code" }
    );
  if (error) {
    // Retry em 2s: evita perder a janela de debounce em falha de rede
    // transitória (sem retry, o estado daquela janela se perderia).
    console.warn(`[roomPersistence] falha ao salvar sala ${key} (retry em 2s):`, error.message);
    const timer = pendingTimers.get(key);
    if (timer) clearTimeout(timer);
    pendingTimers.set(key, setTimeout(() => {
      pendingTimers.delete(key);
      void persistRoomNow(key);
    }, SAVE_DEBOUNCE_MS));
  }
}

/** Remove a sala do banco (mesa encerrada). Também cancela persist pendente. */
export async function deleteRoomPersisted(code: string): Promise<void> {
  const client = getDb();
  if (!client) return;
  const key = code.trim().toUpperCase();
  const timer = pendingTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(key);
  }
  const { error } = await client.from(ROOMS_TABLE).delete().eq("code", key);
  if (error) {
    console.warn(`[roomPersistence] falha ao remover sala ${key}:`, error.message);
  }
}

/** T3.2 — restaura as salas persistidas no boot (players marcados offline). */
export async function restoreRoomsFromDb(): Promise<number> {
  const client = getDb();
  if (!client) return 0;
  const { data, error } = await client
    .from(ROOMS_TABLE)
    .select("code, room_state")
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[roomPersistence] falha ao restaurar salas:", error.message);
    return 0;
  }
  let restored = 0;
  for (const row of data ?? []) {
    const state = row.room_state as unknown;
    if (typeof state === "object" && state !== null) {
      restoreRoom(state as GameRoom);
      restored += 1;
    }
  }
  console.log(`[roomPersistence] ${restored} sala(s) restaurada(s) do banco.`);
  return restored;
}

/** Grava todas as pendências (shutdown gracioso). */
export async function flushAllPending(): Promise<void> {
  const keys = [...pendingTimers.keys()];
  for (const key of keys) {
    const timer = pendingTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      pendingTimers.delete(key);
    }
    await persistRoomNow(key);
  }
}
