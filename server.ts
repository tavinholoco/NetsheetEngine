import express from "express";
import http from "http";
import pkg from "./package.json";

// T10.4 — versão do build embutida no healthcheck (o esbuild inline o JSON).
const APP_VERSION: string = (pkg as { version?: string }).version || "0.0.0";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  getAllActiveRooms,
  markStalePlayersOffline,
  collectAbandonedRooms,
  ROOM_OFFLINE_TIMEOUT_MS
} from "./server/roomManager.js";
import {
  deleteRoomPersisted,
  restoreRoomsFromDb,
  flushAllPending,
  freezePersistence,
  getDb
} from "./server/roomPersistence.js";
// Fase H (H.3d — H.13) — a passagem de bastão entre instâncias no deploy.
import { createInstanceLease, newInstanceId, supabaseLeaseStore, type InstanceLease } from "./server/instanceLease.js";

// Fase 3 — o servidor lê .env.local (VITE_* + chaves de serviço)
dotenv.config({ path: ['.env', '.env.local'] });

import { logger } from "./server/logger.js";
// L.3a (E.18) — o servidor em módulos: a borda HTTP, as rotas, quem escuta
// cada sala e o reenvio, o grid Yjs e o WebSocket. Aqui ficam a ligação entre
// eles, o health, os vigias, a passagem de bastão e o boot.
import { installHttpBasics, sendError } from "./server/http.js";
import { registerAiRoutes } from "./server/routes/ai.js";
import { registerRoomRoutes } from "./server/routes/rooms.js";
import {
  announceRestart,
  broadcastRoomUpdate,
  closeAllRealtime,
  dropRoomFeed,
  onBeforeBroadcast,
  setAnnouncing,
  setDraining
} from "./server/realtime.js";
import { destroyRoomYjs, seedDocFromJsonSafely } from "./server/yjsGrid.js";
import { attachRealtime } from "./server/wsGateway.js";

// O que os testes importam daqui, de antes do corte.
export { attachRealtime } from "./server/wsGateway.js";
export { pruneExpiredBuckets, resolveTrustProxy } from "./server/http.js";

// `app` exportado para testes de integração (T9.3 — supertest) sem subir o
// listener; o `startServer()` (porta 3000 + Vite/SPA + restore do banco) roda
// em produção/dev mas é pulado quando NODE_ENV === "test".
export const app = express();

// T10.1 — deploy: porta e host vêm do ambiente (Railway/Fly.io/Render
// injetam PORT; 3000 é só o default local). 0.0.0.0 é obrigatório nos
// containers das plataformas (aceitam tráfego externo pelo proxy).
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

installHttpBasics(app);
registerAiRoutes(app);
registerRoomRoutes(app);
// Fase 5 (T5.3) — JSON → doc Yjs a cada reenvio, para os clientes CRDT convergirem
// quando o grid muda por REST (joinRoom, generateNpc etc.).
onBeforeBroadcast(seedDocFromJsonSafely);

// T10.4 — healthcheck enriquecido: versão do build, uptime do processo e
// contagem de salas/jogadores ativos. Sempre 200 quando vivo, sem rate limit
// (o health check do Render passa por aqui). Nada de uptime bot no plano
// gratuito — regra 3 do contrato de custo zero.
app.get("/api/health", (req, res) => {
  const activeRooms = getAllActiveRooms();
  const playersActive = activeRooms.reduce((acc, r) => acc + r.playersCount, 0);
  res.json({
    status: "online",
    system: "NETSHEET ENGINE — Cyberpunk 2020 Multiplayer API",
    version: APP_VERSION,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    rooms: { active: activeRooms.length, players: playersActive },
    // R.5 (SEC-11) — o IP que os limitadores enxergam para QUEM PERGUNTA (o
    // próprio, nunca o de outro). Se for o do proxy do Render e não o seu, o
    // `trust proxy` está errado: é a verificação no ar numa requisição só.
    clientIp: req.ip
  });
});

// E.3c — rota da API que não existe: 404 em JSON, em todo ambiente. Antes só
// o fallback de produção fazia isso; em dev e nos testes, o Express respondia
// HTML. Registrado depois de todas as rotas da API e antes do Vite/estáticos.
app.use("/api", (_req, res) => {
  sendError(res, "route_not_found", "Rota não encontrada.");
});

// T1.4 — erro de parsing/payload do express.json em formato JSON
app.use((erro: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const err = erro as { type?: string; message?: string; stack?: string } | undefined;
  if (err?.type === "entity.too.large") {
    return sendError(res, "payload_too_large", "Payload excede o limite de 1MB.");
  }
  if (err?.type === "entity.parse.failed" || erro instanceof SyntaxError) {
    return sendError(res, "invalid_json", "JSON inválido no corpo da requisição.");
  }
  logger.error("unhandled_error", { message: err?.message || String(err), stack: err?.stack });
  return sendError(res, "internal_error", "Erro interno do servidor.");
});

// Fase 3 (T3.4) — varre periodicamente e marca como offline jogadores sem
// heartbeat dentro da janela. Salas alteradas são broadcastadas + persistidas.
// Iniciado dentro do startServer (após o restore) — no topo do módulo um
// re-evaluate (watch/HMR) vazaria interval sem cleanup.
let presenceWatcher: NodeJS.Timeout | null = null;

/**
 * Uma volta do vigia de presença. Exportada para teste (E.02).
 *
 * E.02 (SEC-14) — o que roda num `setInterval` não pode lançar: exceção num
 * timer é exceção não tratada, e o Node derruba o PROCESSO — todas as mesas
 * juntas, por causa de uma. Era o que acontecia com um grid malformado. O
 * `broadcastRoomUpdate` já não deixa o espelho Yjs escapar; o `try` por sala
 * aqui é a segunda camada, para o que vier depois.
 */
export function runPresenceSweep(): void {
  for (const code of markStalePlayersOffline()) {
    try {
      broadcastRoomUpdate(code); // já faz queueRoomPersist (T3.1)
    } catch (e) {
      logger.error("room_sweep_failed", { room: code, message: (e as Error)?.message || String(e) });
    }
  }
}

function startPresenceWatcher(): void {
  presenceWatcher = setInterval(runPresenceSweep, Math.min(15_000, Math.max(2_000, ROOM_OFFLINE_TIMEOUT_MS / 2)));
}

// Fase B (B.5 — SEC-04) — coletor de salas abandonadas. Implementa a
// transição `Ociosa → Encerrada` do ciclo de vida em docs/ARQUITETURA.md,
// que o diagrama especificava e o código não tinha.
//
// Encerrar uma mesa são TRÊS passos, e a nota do diagrama lista os três:
// revogar as sessões (dentro de collectAbandonedRooms), apagar a linha no
// Supabase e destruir o Y.Doc + awareness. Fazer só o primeiro deixaria uma
// linha órfã que ressuscitaria a sala no próximo boot.
//
// Intervalo separado do presenceWatcher de propósito: presença é questão de
// segundos, abandono é de horas. Varrer de 15 em 15 s por algo que muda uma
// vez por dia seria desperdício.
const ROOM_COLLECT_INTERVAL_MS = 15 * 60 * 1000;
let roomCollector: NodeJS.Timeout | null = null;
function startRoomCollector(): void {
  roomCollector = setInterval(() => {
    void (async () => {
      const collected = collectAbandonedRooms();
      if (collected.length === 0) return;
      logger.info("rooms_collected", { count: collected.length, codes: collected.slice(0, 10) });
      for (const code of collected) {
        destroyRoomYjs(code);
        dropRoomFeed(code);
        await deleteRoomPersisted(code);
      }
    })().catch((e) => {
      // E.02 — mesma regra do vigia: timer não derruba o processo.
      logger.error("room_collect_failed", { message: (e as Error)?.message || String(e) });
    });
  }, ROOM_COLLECT_INTERVAL_MS);
}

// =====================================================================
// H.3d (H.13) — A PASSAGEM DE BASTÃO ENTRE INSTÂNCIAS
// =====================================================================
// Num deploy, o Render liga esta instância enquanto a velha ainda serve a mesa
// e só manda tráfego para cá quando a porta abre (sem health check HTTP no
// serviço, o teste é a porta TCP — H.3d.0). Por isso a ordem do boot é: pedir
// o bastão → esperar a velha entregar → ler o banco → abrir a porta. NUNCA
// abrir a porta antes do bastão. Desenho na ADR 0007; o módulo, em
// server/instanceLease.ts.
let lease: InstanceLease | null = null;

/**
 * Quanto a instância segue aceitando ações depois do aviso: o que o jogador mandou
 * pelo socket antes de recebê-lo ainda está a caminho. Cobre a ida e volta de uma
 * rede lenta com folga.
 */
const HANDOFF_GRACE_MS = 2_000;

/**
 * Para de servir a mesa: avisa os sockets e segue aceitando ações por uma
 * carência (H.3d.4); depois recusa ações (`503 server_restarting`), para os
 * timers que mexem na mesa, fecha as conexões, grava tudo — inclusive o que
 * estava em voo — e congela a persistência. Na entrega do bastão (`claimed`),
 * no SIGTERM (`shutdown`) e quando outra instância forçou (`lost`: aí não
 * avisa nem grava — o banco já é dela). Exportada para o teste.
 */
export async function drainForHandoff(
  reason: "claimed" | "shutdown" | "lost",
  { graceMs = HANDOFF_GRACE_MS }: { graceMs?: number } = {}
): Promise<void> {
  let announced = 0;
  if (reason !== "lost") {
    setAnnouncing();
    announced = announceRestart();
    if (announced > 0) await new Promise((r) => setTimeout(r, graceMs));
  }
  setDraining();
  if (reason === "lost") freezePersistence();
  if (presenceWatcher) clearInterval(presenceWatcher);
  if (roomCollector) clearInterval(roomCollector);
  presenceWatcher = null;
  roomCollector = null;
  const connections = closeAllRealtime();
  const flushed = reason === "lost" ? false : await flushAllPending(3);
  freezePersistence();
  logger.info("handoff_drained", { reason, announced, connections, flushed, rooms: getAllActiveRooms().length });
}

async function startServer() {
  // H.3d — o bastão primeiro, de porta fechada. Só em produção e com banco: no
  // dev o `tsx` reinicia a cada arquivo salvo, e o processo morto sem SIGTERM
  // faria cada partida esperar a marca de vida envelhecer.
  const db = process.env.NODE_ENV === "production" ? getDb() : null;
  lease = createInstanceLease(db ? supabaseLeaseStore(db) : null, {
    id: newInstanceId(),
    onHandoff: (reason) => drainForHandoff(reason),
    onLost: () => void drainForHandoff("lost"),
    onOrphaned: () => {
      // Entregou e ninguém assumiu (a nova morreu no boot): sair, para o Render
      // religar esta instância — que assume o bastão de novo e lê o banco.
      logger.error("lease_orphaned_exit", { id: lease?.id });
      process.exit(1);
    },
    log: (event, data, level) => (level === "warn" ? logger.warn(event, data) : logger.info(event, data))
  });
  await lease.acquire();

  // Fase 3 (T3.2) — restaurar salas persistidas antes de aceitar conexões
  await restoreRoomsFromDb();

  // Fase 3 (T3.4) — watcher de presença (timeout de isOnline)
  startPresenceWatcher();

  // Fase B (B.5 — SEC-04) — coletor de salas abandonadas. Inicia junto com o
  // watcher de presença, depois do restore: recolher antes das salas voltarem
  // do banco não recolheria nada.
  startRoomCollector();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // T10.1 — fallback SPA: qualquer rota client-side serve o index.html. A
    // /api/* desconhecida já respondeu 404 em JSON antes daqui (E.3c).
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Fase 5 (T5.2) — servidor HTTP explícito para anexar o WebSocket ao upgrade
  const server = http.createServer(app);
  attachRealtime(server);

  server.listen(PORT, HOST, () => {
    logger.info("server_started", { host: HOST, port: PORT, env: process.env.NODE_ENV || "development", version: APP_VERSION, lease: lease?.state() });
    // H.3d — a marca de vida, a cada 2 s, é por onde esta instância vê o pedido da próxima.
    lease?.start();
  });
}

// Fase 3 (T3.1) — grava pendências de persistência no shutdown gracioso
// H.3d — com o bastão: quem ainda serve a mesa (a hibernação) entrega — grava e
// marca, e a próxima instância assume na hora; quem já entregou (o deploy) sai
// sem gravar nada, porque o banco já é da nova.
function shutdown(signal: string) {
  logger.info("server_shutdown", { signal, lease: lease?.state() ?? "none" });
  const done = lease ? lease.shutdown() : drainForHandoff("shutdown");
  void done
    .catch((e) => logger.error("shutdown_failed", { message: (e as Error)?.message || String(e) }))
    .finally(() => {
      process.exit(0);
    });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// T9.3 — em testes (Vitest define NODE_ENV=test), o módulo é importado via
// supertest: NÃO sobe listener, watcher de presença nem restore do banco.
if (process.env.NODE_ENV !== "test") {
  startServer();
}
