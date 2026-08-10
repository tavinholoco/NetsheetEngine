/**
 * ============================================================
 * NETSHEET ENGINE — LOGGER ESTRUTURADO (Fase 10, T10.6)
 * ============================================================
 * Logs em JSON lines (um objeto por linha) — parseáveis por qualquer
 * coletor (Railway/Render/Fly expõem stdout; grep/jq funcionam direto):
 *
 *   {"t":"2026-08-10T…Z","level":"info","event":"server_started","port":3000,"env":"production"}
 *
 * Nunca logar segredos (sessionToken, service_role, GEMINI_API_KEY).
 */

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
