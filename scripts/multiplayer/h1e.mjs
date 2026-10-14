// H.1e — o mesmo jogador em duas abas. "Duplicar aba" copia o sessionStorage
// (mesmo peerId e token) e divide o localStorage (a mesma ficha local). A aba
// nova reentra pelo RoomPage, e o join com token revoga a sessão da antiga —
// sem fechar o socket dela (H.0). O que a aba antiga vê, e o que ela faz?
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, say, waitText, sleep
} from "./lib.mjs";

const server = await startServer({ port: 3231 });
const code = "HE-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);

/** "Duplicar aba": página nova no mesmo contexto, com o sessionStorage copiado. */
async function duplicate(p, label) {
  const s = await session(p);
  const page = await p.ctx.newPage();
  const tab = { name: label, page, console: [], ws: [] };
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") tab.console.push(m.text().slice(0, 200)); });
  page.on("websocket", (ws) => {
    const rec = { opened: Date.now(), closed: null, closeInfo: null };
    tab.ws.push(rec);
    ws.on("close", () => (rec.closed = Date.now()));
  });
  await page.addInitScript(([id, t]) => {
    if (!sessionStorage.getItem("cyberpunk_peer_id")) {
      sessionStorage.setItem("cyberpunk_peer_id", id);
      sessionStorage.setItem("cyberpunk_session_token", t);
    }
  }, [s.peerId, s.token]);
  await page.goto(p.page.url());
  await page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 10000 });
  return tab;
}
const seats = async (tok) => {
  const st = await roomState(server.base, code, tok);
  return Object.values(st.players).map((p) => `${p.handle}[${p.peerId.slice(-6)}]${p.isOnline ? "" : "(off)"}`).join(" ");
};
const sockState = (t) => t.ws.map((w) => (w.closed ? "fechado" : "aberto")).join(",");

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, server.base, "Ana");
  await enterAsGm(gm, server.base, code);
  await ana.page.goto(server.base + "/room/" + code);
  await ana.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor();
  const gmTok = async () => (await session(gm)).token;
  const s0 = await session(ana);
  log("Ana entrou:", await seats(await gmTok()));

  // --- A aba 2 (duplicada) ---
  const tab2 = await duplicate(ana, "Ana-aba2");
  await sleep(1000);
  const sTab2 = await tab2.page.evaluate(() => sessionStorage.getItem("cyberpunk_session_token"));
  const v1 = await fetch(`${server.base}/api/rooms/${code}`, { headers: { "X-Session-Token": s0.token } });
  log("depois da aba 2:", await seats(await gmTok()), "| token da aba 1 vale?", v1.status === 200 && !!(await v1.json()).players, "| aba 1 socket:", sockState(ana));

  log("pedidos da aba 1 depois de entrar:", JSON.stringify(ana.http.slice(2)));
  // A aba 1 ainda fala pelo socket aberto?
  await say(ana, "fala-da-aba-1");
  const ok1 = await waitText(gm, "fala-da-aba-1", 4000).then(() => true).catch(() => false);
  log("a aba 1 (sessão revogada) ainda manda chat pelo socket?", ok1);

  // O GM aplica dano na Ana: as duas abas acompanham o ferimento e sincronizam a ficha (POST /sheet)
  await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: s0.peerId, raw: 25, location: "Torso" });
  await sleep(4000);
  const s1 = await session(ana);
  log("depois do dano: assentos:", await seats(await gmTok()), "| aba 1 peerId", s1.peerId === s0.peerId ? "o mesmo" : "NOVO", "| aba 2 peerId",
    (await tab2.page.evaluate(() => sessionStorage.getItem("cyberpunk_peer_id"))) === s0.peerId ? "o mesmo" : "NOVO");
  log("aviso na aba 1:", JSON.stringify(await ana.page.locator("text=/Sessão expirada|removeu|assento/i").first().innerText().catch(() => "(nenhum)")));

  // --- Abas 3 e 4: o teto de 3 sockets por jogador (R.4) fecha o mais antigo com 4409 ---
  const tab3 = await duplicate(tab2.page === undefined ? ana : { ctx: ana.ctx, page: tab2.page }, "Ana-aba3");
  const tab4 = await duplicate({ ctx: ana.ctx, page: tab3.page }, "Ana-aba4");
  await sleep(6000);
  log("4 abas: assentos:", await seats(await gmTok()));
  log("sockets — aba1:", sockState(ana), "| aba2:", sockState(tab2), "| aba3:", sockState(tab3), "| aba4:", sockState(tab4));
  await say(gm, "gm-depois-das-4-abas");
  await sleep(2500);
  for (const t of [ana, tab2, tab3, tab4]) {
    const seen = await t.page.getByText("gm-depois-das-4-abas").first().isVisible().catch(() => false);
    log(`${t.name}: vê a mensagem nova do GM?`, seen);
  }
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor:", JSON.stringify(ev));
  for (const t of [ana, tab2, tab3, tab4]) if (t.console.length) log(t.name, "console:", JSON.stringify([...new Set(t.console)].slice(0, 5)));
} finally {
  await browser.close();
  await server.stop();
}
