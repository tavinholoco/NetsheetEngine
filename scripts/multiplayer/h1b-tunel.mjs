// H.1b (2) — o túnel longo: o Beto some da rede por 90 s, nos dois sentidos,
// com a mesa agindo a cada 2 s. O teto de 1 MiB (E.03) corta? E depois do corte,
// o que o cliente faz — volta sozinho, converge, vaza a conexão Yjs velha?
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm, enterAsPlayer,
  session, roomState, api, say, waitText, sleep
} from "./lib.mjs";
import { startSlowProxy } from "./slowproxy.mjs";

const STALL_S = Number(process.argv[2] || 90);
const PROFILE = { latencyMs: 300, downBps: 50_000, upBps: 25_000 };
const FAST = { latencyMs: 0, downBps: 50_000_000, upBps: 50_000_000 };
const server = await startServer({ port: 3212 });
const proxy = startSlowProxy({ listenPort: 3312, targetPort: 3212, ...FAST });
const code = "HT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", new Date().toISOString().slice(11, 19), ...a);
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
  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, server.base, "Ana");
  await setHandle(beto, proxy.base, "Beto");
  await enterAsGm(gm, server.base, code);
  await enterAsPlayer(ana, server.base, code);
  proxy.setProfile(PROFILE);
  await enterAsPlayer(beto, proxy.base, code);
  const gmTok = async () => (await session(gm)).token;
  for (let i = 0; i < 4; i++) await api(server.base, `/api/rooms/${code}/players/generate`, await gmTok());
  for (let i = 0; i < 4; i++) await api(server.base, `/api/rooms/${code}/npcs/generate`, await gmTok());
  let st = await roomState(server.base, code, await gmTok());
  const npcIds = Object.keys(st.npcs);
  await sleep(8000);
  log("sala:", (JSON.stringify(st).length / 1024).toFixed(1), "KB; intervalos vivos no Beto:", await beto.page.evaluate(() => window.__liveIntervals()));

  // o túnel: nada passa em sentido nenhum (o proxy segura o que chega)
  proxy.setProfile({ downBps: 0, upBps: 0 });
  log(`túnel de ${STALL_S} s começa`);
  const t0 = Date.now();
  let i = 0;
  let cutAt = null;
  let offlineAt = null;
  while (Date.now() - t0 < STALL_S * 1000) {
    if (i % 3 === 0) await say(ana, `tun-${i}`);
    else if (i % 3 === 1) await say(gm, `tun-${i}`);
    else await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: npcIds[i % 4], raw: 1, location: "Torso" });
    i++;
    if (!cutAt && server.events("slow_consumer_closed").length) {
      cutAt = Math.round((Date.now() - t0) / 1000);
      log("slow_consumer_closed aos", cutAt, "s:", server.events("slow_consumer_closed")[0].line.slice(0, 200));
    }
    if (!offlineAt) {
      const s = await roomState(server.base, code, await gmTok());
      const b = Object.values(s.players).find((p) => p.handle === "Beto");
      if (b && !b.isOnline) { offlineAt = Math.round((Date.now() - t0) / 1000); log("o Beto aparece offline aos", offlineAt, "s"); }
    }
    await sleep(2000);
  }
  const last = `tun-${i - 1 - ((i - 1) % 3 === 2 ? 1 : 0)}`;
  proxy.setProfile(PROFILE);
  log("túnel acabou;", i, "ações; última de chat:", last, "; sockets do Beto até aqui:", beto.ws.length);
  const t1 = Date.now();
  const seen = await waitText(beto, last, 120000).then(() => true).catch(() => false);
  log(seen ? `Beto alcança em ${Date.now() - t1} ms` : "Beto NÃO alcança em 120 s",
    "; sockets do Beto:", beto.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(","));
  await sleep(5000);
  st = await roomState(server.base, code, await gmTok());
  const b = Object.values(st.players).find((p) => p.handle === "Beto");
  log("Beto na mesa:", b ? `online=${b.isOnline}` : "SEM ASSENTO",
    "; assentos com handle Beto:", Object.values(st.players).filter((p) => p.handle === "Beto").length,
    "; intervalos vivos:", await beto.page.evaluate(() => window.__liveIntervals()));
  const banner = await beto.page.locator("text=/Sessão expirada|reconex|Conexão/i").first().innerText().catch(() => "(nenhum aviso na tela)");
  log("o que o Beto vê de aviso:", banner);
  log("console do Beto:", JSON.stringify([...new Set(beto.console)].slice(0, 6)), JSON.stringify(beto.pageErrors.slice(0, 3)));
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor:", JSON.stringify(ev));
} finally {
  await browser.close();
  await proxy.close();
  await server.stop();
}
