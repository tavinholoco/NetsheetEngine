// H.1c (2) — o GM que criou a mesa PELA TELA dá F5 (o H.03 do ledger).
// Na varredura (14/10) o clique em "Criar" não foi feito — exige login, e o
// Supabase local estava fora do ar —, e o roteiro montava o estado que ele
// deixava: a sessão no sessionStorage e a página em /multiplayer. Desde a H.3a,
// criar leva a URL para /room/CÓDIGO, e este roteiro faz o caminho de verdade:
// login pela tela, "Criar Mesa como GM", F5, e o "Sair" em /room/CÓDIGO.
//
// Exige o Supabase LOCAL (Docker) e o build feito com o .env.local apontando para
// ele. O usuário é descartável: criado pela API de admin do Supabase local, com
// senha aleatória que nunca é impressa, e apagado no fim. O roteiro recusa
// qualquer Supabase que não seja local — nunca cria conta em produção.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { REPO, chromium, startServer, person, session, roomState, api, sleep } from "./lib.mjs";

const env = Object.fromEntries(
  fs.readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const SB = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SB) || !KEY) {
  console.error("Este roteiro só roda com o Supabase LOCAL no .env.local (e a chave de serviço dele).");
  process.exit(2);
}
const admin = (p, init = {}) =>
  fetch(`${SB}/auth/v1/admin${p}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" } });
const email = `h1c-gm-${crypto.randomBytes(4).toString("hex")}@netsheet.test`;
const password = crypto.randomBytes(18).toString("base64url");
const created = await (await admin("/users", {
  method: "POST",
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: "Mestre" } })
})).json();
if (!created.id) {
  console.error("o usuário de teste não foi criado:", created.msg || created.error_description || created.error);
  process.exit(1);
}

const server = await startServer({ port: 3222 });
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);
const pathOf = (p) => new URL(p.page.url()).pathname;
try {
  // O CSP do build de produção só deixa conectar em https: — e o Supabase local é
  // http://127.0.0.1. No ar o Supabase é https; aqui o contexto ignora o CSP.
  const gm = await person(browser, "GM", { contextOptions: { bypassCSP: true } });
  gm.failed = [];
  gm.page.on("response", (r) => { if (r.status() >= 400) gm.failed.push(`${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 90)} ${r.status()}`); });
  gm.page.on("pageerror", (e) => gm.pageErrors.push(JSON.stringify(e).slice(0, 200) + " " + (e?.message || "")));
  await gm.page.goto(server.base + "/multiplayer");
  await gm.page.getByRole("button", { name: /Acessar Conta/i }).first().click();
  const dlg = gm.page.getByRole("dialog");
  await dlg.getByPlaceholder("edgerunner@nightcity.net").fill(email);
  await dlg.getByPlaceholder("••••••••").fill(password);
  await dlg.getByRole("button", { name: /Acessar Conta/i }).click();
  const loggedIn = await gm.page.getByText("Você está no modo visitante").waitFor({ state: "detached", timeout: 15000 }).then(() => true, () => false);
  if (!loggedIn) throw new Error(`o login pela tela falhou: ${JSON.stringify((await dlg.innerText().catch(() => "")).slice(0, 300))}`);
  if (await dlg.isVisible().catch(() => false)) await gm.page.keyboard.press("Escape");

  // --- criar pela tela ---
  await gm.page.getByPlaceholder(/Prefixo do código/i).fill("HG");
  await gm.page.getByRole("button", { name: /Criar Mesa como GM/i }).click();
  await gm.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
  await sleep(800);
  const s1 = await session(gm);
  const code = pathOf(gm).startsWith("/room/") ? pathOf(gm).slice("/room/".length) : null;
  log("o GM criou pela tela: URL", pathOf(gm), "| etiqueta GM na tela?", await gm.page.getByText("GM", { exact: true }).first().isVisible().catch(() => false));
  if (!code) throw new Error("a URL não foi para /room/CÓDIGO — o H.03 segue de pé");
  const joinsBefore = gm.http.filter((h) => h.includes("/api/rooms/join")).length;

  // --- o F5 ---
  await gm.page.reload();
  const back = await gm.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 }).then(() => true, () => false);
  await sleep(800);
  const s2 = await session(gm);
  const st = await roomState(server.base, code, s2.token);
  log("depois do F5: na mesa?", back, "| URL", pathOf(gm), "| peerId", s2.peerId === s1.peerId ? "o mesmo" : "NOVO",
    "| a sala diz que é o GM?", st.gmPeerId === s2.peerId, "| assentos:", Object.keys(st.players || {}).length,
    "| joins: antes do F5", joinsBefore, "depois", gm.http.filter((h) => h.includes("/api/rooms/join")).length);
  const gen = await api(server.base, `/api/rooms/${code}/npcs/generate`, s2.token);
  log("o GM gera NPC depois do F5:", gen.status);

  // --- "Sair" em /room/CÓDIGO ---
  await gm.page.getByRole("button", { name: /^Sair$/i }).click();
  const lobby = await gm.page.getByPlaceholder("Digite o código da sala").waitFor({ timeout: 8000 }).then(() => true, () => false);
  log("depois de Sair: lobby?", lobby, "| URL", pathOf(gm), "| campo do código:", JSON.stringify(await gm.page.getByPlaceholder("Digite o código da sala").inputValue().catch(() => "?")));
  log("console:", gm.console.length, JSON.stringify([...new Set(gm.console)].slice(0, 4)), "| erros de página:", JSON.stringify(gm.pageErrors.slice(0, 3)));
  log("pedidos fora do 2xx:", JSON.stringify(gm.failed));
} finally {
  await browser.close();
  await server.stop();
  const del = await admin(`/users/${created.id}`, { method: "DELETE" });
  if (!del.ok) console.error("o usuário de teste não foi apagado:", del.status, created.id);
}
