// ============================================================
// VERIFICAÇÃO PÓS-DEPLOY — o que precisa valer no ar (R.15)
// ============================================================
// Uso:   node scripts/verify-prod.mjs [BASE_URL]
//        (padrão: https://netsheetengine.onrender.com)
//
// Roda, contra o servidor publicado, as checagens do checklist de 01/10 do
// plano (docs/PLANO_MESTRE.md, R.15) e da verificação pós-deploy do
// docs/DEPLOY.md. Cada linha diz o que protege.
//
// Regras do projeto que este script respeita:
//   - UMA requisição por passo — nada de monitor (regra 3 do custo zero). Só o
//     health tenta de novo, 3 vezes, porque o serviço dorme e leva ~1 min.
//   - Não imprime IP de ninguém: diz só se o `clientIp` bateu (R.5).
//   - Cria UMA sala de teste e sai dela no fim — o servidor a apaga.
//   - Nenhuma credencial: nada aqui precisa de login.
// ============================================================
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const BASE = (process.argv[2] || process.env.BASE_URL || "https://netsheetengine.onrender.com").replace(/\/$/, "");
const LOCAL = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE);
// Roda da raiz do repositório (o E2E de WebSocket também é chamado de lá). Lê o
// package.json do diretório atual, não do caminho do script: assim ele funciona
// até copiado para fora do repo (o fallback da tarefa agendada de 01/10).
if (!fs.existsSync("package.json") || !fs.existsSync("scripts/test-ws-e2e.mjs")) {
  console.error("❌ Rode da raiz do repositório NetSheet Engine.");
  process.exit(2);
}
const esperado = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

const resultados = [];
const ok = (id, nome, passou, detalhe = "") => resultados.push({ id, nome, passou, detalhe });

async function req(path, init = {}, timeoutMs = 30_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { ...init, signal: ctl.signal });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* não é JSON */ }
    return { status: res.status, texto, json, tipo: res.headers.get("content-type") || "" };
  } finally {
    clearTimeout(t);
  }
}
const post = (path, body, headers = {}) =>
  req(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const sufixo = () => Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");

console.log(`\n🔎 Verificação pós-deploy — ${BASE}\n`);

// 01.1 — o serviço voltou (o Render suspenso responde 503 "Service Suspended")
let health = null;
for (let tentativa = 1; tentativa <= 3 && !health; tentativa++) {
  try {
    const r = await req("/api/health", {}, 90_000);
    if (/Service Suspended/i.test(r.texto)) { ok("01.1", "Serviço no ar", false, "o Render ainda diz Service Suspended"); break; }
    if (r.json && r.json.status === "online") health = r.json;
  } catch { /* acordando */ }
  if (!health && tentativa < 3) await new Promise((s) => setTimeout(s, 45_000));
}
if (!health) {
  if (!resultados.length) ok("01.1", "Serviço no ar", false, "o /api/health não respondeu JSON em 3 tentativas");
} else {
  ok("01.1", "Serviço no ar (/api/health online)", true);
  // 01.2 — o deploy é o último commit (R.9: a versão anda com a tag)
  ok("01.2", `Versão publicada = ${esperado} (package.json)`, health.version === esperado,
    health.version === esperado ? "" : `publicada ${health.version} — faça Manual Deploy → Deploy latest commit`);
  // 01.3 — trust proxy (R.5): o limitador enxerga o IP de quem pergunta
  if (LOCAL) {
    ok("01.3", "clientIp = IP público (R.5)", true, "pulado: servidor local, sem proxy");
  } else {
    let meu = null;
    try { meu = (await (await fetch("https://api.ipify.org")).text()).trim(); } catch { /* sem rede externa */ }
    ok("01.3", "clientIp = IP público de quem pergunta (R.5)", meu !== null && health.clientIp === meu,
      meu === null ? "não conferido: api.ipify.org não respondeu" : health.clientIp === meu ? "bateu" : "NÃO bateu — ver TRUST_PROXY no DEPLOY.md");
  }
  // 01.4 — o site carrega, e a tela traz a versão certa (R.9 na interface)
  const home = await req("/");
  const titulo = (home.texto.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const bundle = (home.texto.match(/src="(\/assets\/index-[^"]+\.js)"/) || [])[1];
  let versaoNaTela = false;
  if (bundle) versaoNaTela = (await req(bundle)).texto.includes(esperado);
  ok("01.4", "Site carrega e a interface mostra a versão certa", /NETSHEET/i.test(titulo) && versaoNaTela,
    `título "${titulo}"; bundle ${bundle ? (versaoNaTela ? "com" : "SEM") + ` ${esperado}` : "não achado"}`);

  // 01.5 — /api desconhecida responde JSON, não a SPA
  const naoExiste = await req("/api/nao-existe");
  ok("01.5", "/api desconhecida → 404 JSON", naoExiste.status === 404 && naoExiste.tipo.includes("json"));
  // 01.6 — lobby fechado (R.11): ninguém lista as salas
  const lobby = await req("/api/rooms");
  ok("01.6", "GET /api/rooms → 404 (R.11, sala fora do lobby)", lobby.status === 404);
  // 01.7 — IA trancada (SEC-01): sem login, 401
  const ia = await post("/api/gemini", { prompt: "oi" });
  ok("01.7", "POST /api/gemini sem login → 401 (SEC-01)", ia.status === 401, `recebeu ${ia.status}`);

  // 01.8 — contratos da revisão pós-D, com UMA sala de teste
  const code = `VERIF-${sufixo()}`;
  const gmPeerId = `peer_verif_${sufixo().toLowerCase()}`;
  const criada = await post("/api/rooms/create", { code, name: "Verificação pós-deploy", gmHandle: "Verificador", gmPeerId });
  const token = criada.json?.sessionToken;
  ok("01.8a", "Criar sala com código de convite → 200", criada.status === 200 && !!token, `recebeu ${criada.status}`);
  if (token) {
    const sheet = { handle: "Intruso", role: "Solo", stats: { INT: 5, REF: 5, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 5, EMP: 5 }, woundLevel: 0 };
    const tomada = await post("/api/rooms/join", { code, peerId: gmPeerId, handle: "Intruso", sheet });
    ok("01.8b", "join com o gmPeerId sem o token → 409 seat_taken (R.1)", tomada.status === 409 && tomada.json?.code === "seat_taken", `recebeu ${tomada.status}`);
    const sobrescrever = await post("/api/rooms/create", { code, name: "Tomada", gmHandle: "Hostil", gmPeerId: "peer_hostil" });
    ok("01.8c", "create com código em uso → 409 room_exists (R.2)", sobrescrever.status === 409 && sobrescrever.json?.code === "room_exists", `recebeu ${sobrescrever.status}`);
    const saida = await post(`/api/rooms/${code}/leave`, { sessionToken: token });
    ok("01.8d", "Sala de teste removida (o GM saiu)", saida.status === 200);
  }

  // 01.9 — o transporte da mesa: WebSocket + Yjs (o E2E do CI, contra o servidor publicado)
  const e2e = spawnSync(process.execPath, ["scripts/test-ws-e2e.mjs"], { env: { ...process.env, BASE_URL: BASE }, encoding: "utf8" });
  const resumo = (e2e.stdout.match(/Resultado: .*/) || [""])[0];
  ok("01.9", "E2E de WebSocket (chat, rolagem, Yjs)", e2e.status === 0, resumo);
}

// ------------------------------------------------------------
console.log(resultados.map((r) => `  ${r.passou ? "✅" : "❌"} ${r.id.padEnd(5)} ${r.nome}${r.detalhe ? `  — ${r.detalhe}` : ""}`).join("\n"));
const falhas = resultados.filter((r) => !r.passou).length;
console.log(`\n${falhas === 0 ? "✅ Tudo certo no ar." : `❌ ${falhas} checagem(ns) falharam.`}`);
console.log("Do dono, fora deste script: a versão do Node no log do build (Render → Events) e o uso do workspace.\n");
process.exit(falhas === 0 ? 0 : 1);
