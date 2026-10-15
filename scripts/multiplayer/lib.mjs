/**
 * ============================================================
 * NETSHEET ENGINE — OS CENÁRIOS DA VARREDURA DE MULTIPLAYER (Fase H)
 * ============================================================
 * A H quebra a mesa de propósito, cenário por cenário (o ledger é
 * docs/varreduras/H-multiplayer.md). Cada `h1*.mjs` é um cenário do plano;
 * esta biblioteca sobe o build de produção num processo próprio (o log JSON
 * vem pelo stdout), abre um contexto isolado do Playwright por pessoa
 * (localStorage e sessionStorage separados — abas do mesmo navegador
 * dividiriam a ficha local) e conta o que cada aba recebe pelo WebSocket. A
 * rede ruim é o `slowproxy.mjs`.
 *
 * Não roda no CI nem no vitest: é ferramenta de varredura, como o
 * scripts/visual/ da Fase F. Uso:
 *   npm run build
 *   node scripts/multiplayer/h1a.mjs            # a mesa de base
 *   node scripts/multiplayer/h1d.mjs            # exige o Supabase local (Docker)
 * Cada roteiro usa portas próprias (32xx o servidor, 33xx o proxy) e o
 * servidor sobe sem banco, salvo o `persist: true` (o H.1d).
 * ============================================================
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(REPO + "/package.json");
const playwright = require("@playwright/test");
export const { chromium } = playwright;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sobe dist/server.cjs com NODE_ENV=production. `persist: false` desliga o Supabase. */
export async function startServer({ port = 3201, persist = false, env = {} } = {}) {
  const logs = [];
  const childEnv = { ...process.env, NODE_ENV: "production", PORT: String(port), ...env };
  if (!persist) {
    childEnv.SUPABASE_URL = "";
    childEnv.SUPABASE_SERVICE_ROLE_KEY = "";
  }
  const child = spawn(process.execPath, [path.join(REPO, "dist/server.cjs")], { cwd: REPO, env: childEnv });
  const onLine = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (!line.trim()) continue;
      let parsed = null;
      try { parsed = JSON.parse(line); } catch { /* texto solto */ }
      logs.push({ t: Date.now(), line, json: parsed });
    }
  };
  child.stdout.on("data", onLine);
  child.stderr.on("data", onLine);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 400; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) break;
    } catch { /* ainda subindo */ }
    await sleep(150);
  }
  return {
    base,
    port,
    logs,
    child,
    events: (name) => logs.filter((l) => l.json && (l.json.event === name || l.json.msg === name || l.json.message === name)),
    async stop(signal = "SIGTERM") {
      if (child.exitCode !== null) return;
      const done = new Promise((r) => child.once("exit", r));
      child.kill(signal);
      await Promise.race([done, sleep(5000)]);
    }
  };
}

/** Uma pessoa = um contexto. Guarda console, erros de página e quadros do WS. */
export async function person(browser, name, { init, contextOptions = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...contextOptions });
  const page = await ctx.newPage();
  const p = { name, ctx, page, console: [], pageErrors: [], ws: [], framesIn: 0, bytesIn: 0, framesOut: 0, rooms: 0 };
  if (init) await page.addInitScript(init.fn, init.arg);
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") p.console.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => p.pageErrors.push(String(e).slice(0, 300)));
  p.http = [];
  page.on("response", (r) => { if (r.url().includes("/api/")) p.http.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
  page.on("websocket", (ws) => {
    const rec = { url: ws.url().replace(/token=[^&]+/, "token=…"), opened: Date.now(), closed: null };
    p.ws.push(rec);
    ws.on("framereceived", (f) => {
      p.framesIn++;
      const len = typeof f.payload === "string" ? Buffer.byteLength(f.payload) : f.payload.length;
      p.bytesIn += len;
      if (typeof f.payload === "string" && f.payload.startsWith("{\"code\"")) p.rooms++;
    });
    ws.on("framesent", () => p.framesOut++);
    ws.on("close", () => (rec.closed = Date.now()));
  });
  return p;
}

export function resetCounters(...people) {
  for (const p of people) {
    p.framesIn = 0; p.bytesIn = 0; p.framesOut = 0; p.rooms = 0;
  }
}

/** Cria a sala por REST, como o GM sem login (o servidor não exige — decisão do dono). */
export async function seedRoom(base, code, gmPeerId = "peer_h_gm", gmHandle = "Mestre") {
  const r = await fetch(base + "/api/rooms/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "Mesa H", gmHandle, gmPeerId })
  });
  const j = await r.json();
  if (!j.sessionToken) throw new Error("create falhou: " + r.status + " " + JSON.stringify(j));
  return { gmPeerId, gmToken: j.sessionToken, room: j.room };
}

export const gmInit = (gmPeerId, gmToken) => ({
  fn: ([id, t]) => {
    if (!sessionStorage.getItem("cyberpunk_peer_id")) {
      sessionStorage.setItem("cyberpunk_peer_id", id);
      sessionStorage.setItem("cyberpunk_session_token", t);
    }
  },
  arg: [gmPeerId, gmToken]
});

/** Dá um apelido à ficha local (o handle que a mesa mostra). */
export async function setHandle(p, base, handle) {
  await p.page.goto(base + "/sheet");
  const input = p.page.getByPlaceholder("Ex: Silverhand, V, Spider");
  await input.waitFor();
  await input.fill(handle);
  await sleep(300);
}

export async function enterAsGm(p, base, code) {
  await p.page.goto(base + "/room/" + code);
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}

export async function enterAsPlayer(p, base, code) {
  await p.page.goto(base + "/multiplayer");
  await p.page.getByPlaceholder("Digite o código da sala").fill(code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}

export async function session(p) {
  return p.page.evaluate(() => ({
    peerId: sessionStorage.getItem("cyberpunk_peer_id"),
    token: sessionStorage.getItem("cyberpunk_session_token")
  }));
}

/** O estado da sala como o servidor o tem (com o token de quem pergunta). */
export async function roomState(base, code, token) {
  const r = await fetch(`${base}/api/rooms/${code}`, { headers: { "X-Session-Token": token } });
  return r.json();
}

export async function api(base, pathname, token, body = {}) {
  const r = await fetch(base + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, sessionToken: token })
  });
  let j = null;
  try { j = await r.json(); } catch { /* corpo vazio */ }
  return { status: r.status, body: j };
}

export async function say(p, text) {
  const box = p.page.getByPlaceholder("Mensagem para a mesa...");
  await box.fill(text);
  await box.press("Enter");
}

export async function waitText(p, text, timeout = 8000) {
  const t0 = Date.now();
  await p.page.getByText(text, { exact: false }).first().waitFor({ timeout });
  return Date.now() - t0;
}

export function summary(people, server) {
  const out = {};
  for (const p of people) {
    out[p.name] = {
      framesIn: p.framesIn,
      kbIn: +(p.bytesIn / 1024).toFixed(1),
      roomFrames: p.rooms,
      framesOut: p.framesOut,
      sockets: p.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(","),
      consoleErrors: p.console.length,
      pageErrors: p.pageErrors.length
    };
  }
  if (server) {
    const counts = {};
    for (const l of server.logs) {
      const ev = l.json && (l.json.event || l.json.msg || l.json.message);
      if (ev) counts[ev] = (counts[ev] || 0) + 1;
    }
    out.serverEvents = counts;
  }
  return out;
}
