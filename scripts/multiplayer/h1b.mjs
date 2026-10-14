// H.1b — rede estrangulada: o Beto num 3G ruim, pelo proxy. Chat, rolagem,
// token e dano chegam, e na ordem? E o jogador lento cai pelo teto de 1 MiB?
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm, enterAsPlayer,
  session, roomState, api, say, waitText, summary, resetCounters, sleep
} from "./lib.mjs";
import { startSlowProxy } from "./slowproxy.mjs";

const PROFILE = { latencyMs: 300, downBps: 50_000, upBps: 25_000 };
const server = await startServer({ port: 3211 });
const FAST = { latencyMs: 0, downBps: 50_000_000, upBps: 50_000_000 };
const proxy = startSlowProxy({ listenPort: 3311, targetPort: 3211, ...FAST });
const code = "HB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);

// Conta os setInterval vivos da página (a conexão Yjs velha que não é destruída).
const countIntervals = {
  fn: () => {
    const live = new Set();
    const si = window.setInterval.bind(window);
    const ci = window.clearInterval.bind(window);
    window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); live.add(id); return id; };
    window.clearInterval = (id) => { live.delete(id); return ci(id); };
    window.__liveIntervals = () => live.size;
  },
  arg: undefined
};

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto", { init: countIntervals });
  const all = [gm, ana, beto];
  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, server.base, "Ana");
  await setHandle(beto, proxy.base, "Beto");
  await enterAsGm(gm, server.base, code);
  await enterAsPlayer(ana, server.base, code);
  proxy.setProfile(PROFILE); // o site já carregou (no ar vem comprimido e em cache); daqui em diante, 3G
  let t0 = Date.now();
  await enterAsPlayer(beto, proxy.base, code);
  log("Beto (3G) na mesa em", Date.now() - t0, "ms; intervalos vivos:", await beto.page.evaluate(() => window.__liveIntervals()));
  const gmTok = async () => (await session(gm)).token;
  const sA = await session(ana);

  // Uma mesa do tamanho de verdade: 4 fichas geradas e 4 NPCs
  for (let i = 0; i < 4; i++) await api(server.base, `/api/rooms/${code}/players/generate`, await gmTok());
  for (let i = 0; i < 4; i++) await api(server.base, `/api/rooms/${code}/npcs/generate`, await gmTok());
  let st = await roomState(server.base, code, await gmTok());
  const npcIds = Object.keys(st.npcs);
  log("sala:", (JSON.stringify(st).length / 1024).toFixed(1), "KB,", Object.keys(st.players).length, "assentos,", npcIds.length, "NPCs");
  await waitText(beto, `${npcIds.length}`, 20000).catch(() => {});
  await sleep(4000);

  // --- Ordem: chat da Ana entremeado com dano e token movido pelo GM ---
  resetCounters(...all);
  const tokA = st.tacticalGrid.tokens.find((t) => t.peerId === sA.peerId);
  const marks = [];
  t0 = Date.now();
  for (let i = 1; i <= 6; i++) {
    await say(ana, `ord-${i}`);
    marks.push(`ord-${i}`);
    if (i % 2 === 0) {
      const g = (await roomState(server.base, code, await gmTok())).tacticalGrid;
      const moved = { ...g, tokens: g.tokens.map((t) => (t.id === tokA.id ? { ...t, x: i, y: 1 } : t)) };
      await api(server.base, `/api/rooms/${code}/tactical-grid`, await gmTok(), { gridState: moved });
    } else {
      await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: npcIds[0], raw: 1, location: "Torso" });
    }
  }
  const tGm = await waitText(gm, "ord-6", 20000);
  const tBeto = await waitText(beto, "ord-6", 30000);
  log("ord-6 visto: GM", tGm, "ms depois do fim da rajada; Beto", tBeto, "ms");
  await sleep(3000);
  const orderOf = async (p) => p.page.evaluate(() => [...document.querySelectorAll('[aria-label="Mensagens da mesa"] *')]
    .map((e) => e.childElementCount === 0 ? e.textContent : "").filter((t) => /^ord-\d$/.test(t)));
  log("ordem no chat — GM:", (await orderOf(gm)).join(","), "| Beto:", (await orderOf(beto)).join(","));
  const posOf = async (p) => p.page.evaluate(() => {
    const el = document.querySelector('[title^="Ana (PLAYER)"]');
    return el ? el.getAttribute("title").replace(/^.*Setor /, "") : "(grid não aberto)";
  });
  for (const p of all) await p.page.getByRole("button", { name: /Grid Tático/i }).click();
  await sleep(1500);
  st = await roomState(server.base, code, await gmTok());
  const srvTok = st.tacticalGrid.tokens.find((t) => t.id === tokA.id);
  log("token da Ana — servidor x,y:", srvTok.x, srvTok.y, "| GM vê:", await posOf(gm), "| Beto vê:", await posOf(beto));
  log("custo da rajada:", JSON.stringify(summary(all)));

  // --- Rolagem do Beto (sobe pelo 3G) ---
  for (const p of all) await p.page.getByRole("button", { name: /^💬 Chat$/i }).click();
  t0 = Date.now();
  await beto.page.locator('button[title*="Stun Save"]').click();
  await waitText(gm, "Stun Save", 20000);
  log("stun save do Beto chega ao GM em", Date.now() - t0, "ms");

  // --- Carga de mesa normal: 1 ação a cada 3 s por 45 s ---
  const act = async (i, tag) => {
    if (i % 3 === 0) await say(ana, `${tag}-${i}`);
    else if (i % 3 === 1) await say(gm, `${tag}-${i}`);
    else await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: npcIds[1], raw: 1, location: "Torso" });
  };
  resetCounters(...all);
  for (let i = 0; i < 15; i++) { await act(i, "norm"); await sleep(3000); }
  log("carga normal: slow_consumer_closed =", server.events("slow_consumer_closed").length, "; fila máx. no caminho:", proxy.stats.maxQueued, "B; sockets do Beto:", beto.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(","));

  // --- Rajada: 2 ações por segundo por 20 s ---
  for (let i = 0; i < 40; i++) { await act(i, "raj"); await sleep(500); }
  await sleep(2000);
  log("rajada: slow_consumer_closed =", server.events("slow_consumer_closed").length, "; sockets do Beto:", beto.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(","));
  const lastRaj = "raj-39".replace("39", "36"); // a última do chat entre as que a Ana/GM mandaram (36 = Ana)
  t0 = Date.now();
  await waitText(beto, lastRaj, 60000).catch(() => log("Beto não viu", lastRaj, "em 60 s"));
  log("Beto alcança a rajada em", Date.now() - t0, "ms");

  // --- Túnel: o Beto não recebe nada por 30 s, com a mesa no ritmo normal ---
  const closedBefore = server.events("slow_consumer_closed").length;
  proxy.stall(30000);
  for (let i = 0; i < 10; i++) { await act(i, "tun"); await sleep(3000); }
  await sleep(2000);
  log("túnel: slow_consumer_closed novos =", server.events("slow_consumer_closed").length - closedBefore,
    "; sockets do Beto:", beto.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(","));
  t0 = Date.now();
  await waitText(beto, "tun-9", 60000).catch(() => log("Beto não viu tun-9 em 60 s"));
  log("Beto alcança depois do túnel em", Date.now() - t0, "ms; intervalos vivos:", await beto.page.evaluate(() => window.__liveIntervals()));

  st = await roomState(server.base, code, await gmTok());
  log("online:", Object.values(st.players).filter((p) => ["Mestre","Ana","Beto"].includes(p.handle)).map((p) => `${p.handle}:${p.isOnline}`).join(" "));
  log("sala no fim:", (JSON.stringify(st).length / 1024).toFixed(1), "KB");
  log("totais:", JSON.stringify(summary(all, server)));
  for (const p of all) if (p.console.length || p.pageErrors.length) log(p.name, "console:", JSON.stringify([...new Set(p.console)].slice(0, 6)), JSON.stringify(p.pageErrors.slice(0, 3)));
  const warn = server.logs.filter((l) => l.json && l.json.level !== "info" && l.json.event !== "persistence_disabled").map((l) => l.line.slice(0, 220));
  if (warn.length) log("warn/error:", JSON.stringify([...new Set(warn)].slice(0, 10)));
  log("proxy:", JSON.stringify(proxy.stats));
} finally {
  await browser.close();
  await proxy.close();
  await server.stop();
}
