// H.1g — a queda para o SSE. (A) o Beto atrás de um proxy que derruba o
// upgrade do WebSocket desde o início; (B) a Ana com o WebSocket funcionando,
// que perde a conexão numa queda breve (o E.14): volta ao WebSocket?
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, say, waitText, sleep
} from "./lib.mjs";
import { startSlowProxy } from "./slowproxy.mjs";

const FAST = { latencyMs: 0, downBps: 50_000_000, upBps: 50_000_000 };
const server = await startServer({ port: 3251 });
const pBeto = startSlowProxy({ listenPort: 3351, targetPort: 3251, ...FAST });
const pAna = startSlowProxy({ listenPort: 3352, targetPort: 3251, ...FAST });
const code = "HS-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", new Date().toISOString().slice(14, 19), ...a);
const sockets = (p) => p.ws.map((w) => (w.closed ? "x" : "o")).join("");
async function enterByInvite(p, base) {
  await p.page.goto(base + "/room/" + code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}
const ssePeers = () => server.events("sse_fallback").map((l) => l.json.peerId);

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto");
  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, pAna.base, "Ana");
  await setHandle(beto, pBeto.base, "Beto");
  await enterAsGm(gm, server.base, code);
  const gmTok = async () => (await session(gm)).token;

  // ===== A. Proxy que derruba o WebSocket desde o início =====
  pBeto.setProfile({ blockWs: true });
  let t0 = Date.now();
  await enterByInvite(beto, pBeto.base);
  log("A) o Beto entra com o WebSocket bloqueado em", Date.now() - t0, "ms | upgrades derrubados:", pBeto.stats.wsBlocked,
    "| sse_fallback no log:", server.events("sse_fallback").length, JSON.stringify(server.events("sse_fallback")[0]?.json?.userAgent || "").slice(0, 60));
  await enterByInvite(ana, pAna.base);
  const sB = await session(beto);
  await say(gm, "gm-para-beto-sse");
  log("A) chat do GM chega ao Beto (SSE)?", await waitText(beto, "gm-para-beto-sse", 5000).then((ms) => `sim, ${ms} ms`).catch(() => "NÃO"));
  await say(beto, "beto-pelo-post");
  log("A) chat do Beto (POST) chega ao GM?", await waitText(gm, "beto-pelo-post", 5000).then((ms) => `sim, ${ms} ms`).catch(() => "NÃO"));
  await beto.page.locator('button[title*="Stun Save"]').click();
  log("A) rolagem do Beto (POST /roll) chega ao GM?", await waitText(gm, "Stun Save", 5000).then(() => "sim").catch(() => "NÃO"));
  // o Beto arrasta o próprio token, como na tela
  await beto.page.getByRole("button", { name: /Grid Tático/i }).click();
  await sleep(800);
  const tok = beto.page.locator('[title^="Beto (PLAYER)"]');
  const before = await tok.getAttribute("title");
  const board = beto.page.locator('[title^="Beto (PLAYER)"]').locator("xpath=ancestor::div[contains(@class,'absolute') and contains(@class,'inset-0')][1]/..");
  const box = await board.boundingBox();
  await tok.dragTo(board, { targetPosition: { x: box.width * 0.85, y: box.height * 0.85 } }).catch((e) => log("A) dragTo falhou:", String(e).slice(0, 80)));
  await sleep(1500);
  const banner = await beto.page.locator("text=/Acesso Negado|Apenas o Mestre/i").first().innerText().catch(() => "(nenhum aviso)");
  let st = await roomState(server.base, code, await gmTok());
  const srvTok = st.tacticalGrid.tokens.find((t) => t.peerId === sB.peerId);
  log("A) o Beto arrasta o próprio token: antes", before?.replace(/^.*Setor /, ""), "| no servidor depois:", `${srvTok.x},${srvTok.y}`, "| aviso na tela:", JSON.stringify(banner).slice(0, 110));
  log("A) pedidos do Beto:", JSON.stringify(beto.http.filter((h) => !h.includes("heartbeat")).slice(-4)));
  // e o GM vê o Beto online? (heartbeat pelo POST)
  await sleep(25000);
  st = await roomState(server.base, code, await gmTok());
  log("A) depois de 25 s: Beto online?", st.players[sB.peerId].isOnline, "| sockets WS abertos pelo Beto:", beto.ws.length);

  // ===== B. O E.14: a Ana perde o WebSocket numa queda breve =====
  log("B) a Ana está no WebSocket:", sockets(ana));
  pAna.setProfile({ blockWs: true });
  pAna.killWs();
  await sleep(6000);                      // a tentativa de 3 s cai no bloqueio
  pAna.setProfile({ blockWs: false });     // a rede volta
  log("B) depois da queda de ~6 s: sockets da Ana:", sockets(ana), "| a Ana no sse_fallback?", ssePeers().includes((await session(ana)).peerId));
  await sleep(60000);
  log("B) 60 s depois, com a rede boa: sockets da Ana:", sockets(ana), "(o = aberto, x = fechado) — voltou ao WebSocket?", ana.ws.some((w) => !w.closed));
  await say(gm, "gm-depois-da-queda");
  log("B) a Ana recebe o chat?", await waitText(ana, "gm-depois-da-queda", 5000).then(() => "sim").catch(() => "NÃO"));
  // Desde a H.3b (H.09), a Ana volta ao WebSocket — e ao Yjs: arrasta o próprio
  // token pela tela, como antes da queda. (Antes do conserto ela ficava no SSE,
  // e o REST do grid, que é do GM, devolvia 403.)
  const sA = await session(ana);
  await ana.page.getByRole("button", { name: /Grid Tático/i }).click();
  await sleep(800);
  const tokA = ana.page.locator('[title^="Ana (PLAYER)"]');
  const beforeA = await tokA.getAttribute("title");
  const boardA = ana.page.locator('[title^="Ana (PLAYER)"]').locator("xpath=ancestor::div[contains(@class,'absolute') and contains(@class,'inset-0')][1]/..");
  const boxA = await boardA.boundingBox();
  await tokA.dragTo(boardA, { targetPosition: { x: boxA.width * 0.15, y: boxA.height * 0.85 } }).catch((e) => log("B) dragTo falhou:", String(e).slice(0, 80)));
  await sleep(1500);
  st = await roomState(server.base, code, await gmTok());
  const tA = st.tacticalGrid.tokens.find((t) => t.peerId === sA.peerId);
  log("B) a Ana arrasta o próprio token pela tela: antes", beforeA?.replace(/^.*Setor /, ""), "| no servidor depois:", `${tA.x},${tA.y}`,
    "| pedidos de grid pelo REST:", ana.http.filter((h) => h.includes("tactical-grid")).length);
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor:", JSON.stringify(ev));
  for (const p of [beto, ana]) if (p.console.length) log(p.name, "console:", JSON.stringify([...new Set(p.console)].slice(0, 5)));
} finally {
  await browser.close();
  await pBeto.close();
  await pAna.close();
  await server.stop();
}
