// H.3d.4 — o caminho até o navegador entrega o FECHAMENTO do WebSocket que o servidor manda?
//
//   node scripts/multiplayer/h3d-fechamento.mjs                               # contra o ar
//   BASE=http://127.0.0.1:3100 node scripts/multiplayer/h3d-fechamento.mjs    # um build local
//
// Contra o ar (uma mesa de teste, ~1 min; aborta se houver mesa aberta): mede, pelo mesmo
// caminho do navegador (Cloudflare → Render), quanto leva (1) um quadro de DADOS do servidor
// e (2) o FECHAMENTO que o servidor inicia (a expulsão fecha o socket com 4400) — e se o
// cliente ainda consegue "mandar" pelo socket depois. Apaga a mesa no fim.
// No ar em 15/10/2026: os dados em ~145 ms; o 4400 NUNCA chegou — o cliente viu 1006 depois
// de 1,7 s e mandou 3 quadros pelo socket "aberto". No build local: 4400 em 1 ms. É por isso
// que a entrega do bastão avisa por um quadro de dados (H.3d.5, ADR 0007).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const BASE = process.env.BASE || "https://netsheetengine.onrender.com";
const WSB = BASE.replace(/^http/, "ws");
const sfx = Math.random().toString(36).slice(2, 8).toUpperCase();
const code = `LAT-${sfx}`;
const t0 = Date.now();
const log = (...a) => console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(7)}s`, ...a);

async function post(path, body, headers = {}) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null), at: Date.now() };
}

const h = await (await fetch(BASE + "/api/health")).json();
log(`health: ${h.rooms.active} mesa(s) no ar, uptime ${h.uptime}s`);
if (h.rooms.active > 0) {
  log("ABORTADO: há mesa aberta.");
  process.exit(1);
}

const gm = await post("/api/rooms/create", { code, name: "Latência", gmHandle: "Mestre", gmPeerId: "peer_lat_gm_" + sfx.toLowerCase() });
const gmToken = gm.body.sessionToken;
const ana = await post("/api/rooms/join", { code, peerId: "peer_lat_ana_" + sfx.toLowerCase(), handle: "Ana", sheet: { handle: "Ana", stats: {} } });
const anaToken = ana.body.sessionToken;
const anaPeer = "peer_lat_ana_" + sfx.toLowerCase();
log(`mesa ${code}: create ${gm.status}, join ${ana.status}`);

function open(token, name) {
  const ws = new WebSocket(`${WSB}/ws/rooms/${code}?token=${token}`);
  const s = { ws, name, msgs: [], closed: null, closeCode: null };
  ws.on("message", (raw, bin) => {
    if (bin) return;
    s.msgs.push({ at: Date.now(), text: raw.toString() });
  });
  ws.on("close", (c) => {
    s.closed = Date.now();
    s.closeCode = c;
  });
  ws.on("error", () => {});
  return new Promise((r, j) => {
    ws.once("open", () => r(s));
    ws.once("error", j);
  });
}
const sGm = await open(gmToken, "GM");
const sAna = await open(anaToken, "Ana");
await new Promise((r) => setTimeout(r, 1500));

// (1) quadro de dados: o GM fala pelo WebSocket; quando a Ana recebe a sala com a mensagem
for (let i = 1; i <= 3; i++) {
  const label = `lat-${i}`;
  const sent = Date.now();
  sGm.ws.send(JSON.stringify({ type: "message", text: label }));
  const got = await new Promise((r) => {
    const iv = setInterval(() => {
      const m = sAna.msgs.find((x) => x.at >= sent && x.text.includes(label));
      if (m) { clearInterval(iv); r(m.at); }
      if (Date.now() - sent > 10_000) { clearInterval(iv); r(null); }
    }, 10);
  });
  log(`dados: '${label}' do GM chegou à Ana em ${got ? got - sent : "—"} ms`);
}

// (2) o fechamento que o servidor inicia: o GM expulsa a Ana (o servidor fecha o socket dela com 4400)
const kick = await post(`/api/rooms/${code}/players/${anaPeer}/delete`, { sessionToken: gmToken });
log(`expulsão: ${kick.status} (resposta em ${kick.at - t0} ms do começo)`);
// e a Ana, achando que o socket está aberto, "manda" a cada 500 ms
let tentativas = 0;
const iv = setInterval(() => {
  if (sAna.closed) return;
  if (sAna.ws.readyState === WebSocket.OPEN) { sAna.ws.send(JSON.stringify({ type: "heartbeat" })); tentativas++; }
}, 500);
const fim = Date.now() + 40_000;
while (!sAna.closed && Date.now() < fim) await new Promise((r) => setTimeout(r, 50));
clearInterval(iv);
log(`fechamento: a Ana viu o socket fechar ${sAna.closed ? sAna.closed - kick.at : ">40000"} ms depois da resposta da expulsão — código ${sAna.closeCode}; mandou ${tentativas} quadro(s) "com o socket aberto" nesse tempo`);

// limpeza: o GM sai (a mesa some do banco)
sGm.ws.close();
const leave = await post(`/api/rooms/${code}/leave`, { sessionToken: gmToken });
const h2 = await (await fetch(BASE + "/api/health")).json();
log(`limpeza: leave ${leave.status}; ${h2.rooms.active} mesa(s) no ar`);
process.exit(0);
