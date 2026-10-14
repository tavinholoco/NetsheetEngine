// H.1c (3) — dois F5 seguidos com o `join` do primeiro ainda em voo (rede com
// 400 ms de atraso). A Ana entrou pelo link do convite, o caminho que funciona.
import { chromium, startServer, person, seedRoom, setHandle, session, roomState, sleep } from "./lib.mjs";
import { startSlowProxy } from "./slowproxy.mjs";

const server = await startServer({ port: 3223 });
const proxy = startSlowProxy({ listenPort: 3323, targetPort: 3223, latencyMs: 0, downBps: 50_000_000, upBps: 50_000_000, drainOnClose: true });
const code = "HD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);
try {
  for (const gapMs of [0, 100, 300]) {
    const ana = await person(browser, "Ana-" + gapMs);
    await setHandle(ana, proxy.base, "Ana" + gapMs);
    await ana.page.goto(proxy.base + "/room/" + code);
    await ana.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
    await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
    const s0 = await session(ana);
    proxy.setProfile({ latencyMs: 400 });
    const sent = ana.page.waitForRequest((r) => r.url().includes("/api/rooms/join"), { timeout: 20000 });
    await ana.page.reload({ waitUntil: "commit" });
    await sent;
    await sleep(gapMs);
    await ana.page.reload();
    const back = await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    await sleep(3000);
    proxy.setProfile({ latencyMs: 0 });
    const s1 = await session(ana);
    const st = await roomState(server.base, code, s1.token);
    const mine = Object.values(st.players || {}).filter((p) => p.handle === "Ana" + gapMs).length;
    log(`segundo F5 ${gapMs} ms depois de o join sair: na mesa?`, back, "| mesmo peerId?", s1.peerId === s0.peerId, "| assentos com o nome dela:", mine,
      "| erro na tela:", JSON.stringify(await ana.page.locator("text=/Sessão|assento|Sala/i").first().innerText().catch(() => "")).slice(0, 80));
    await ana.ctx.close();
  }
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos:", JSON.stringify(ev));
} finally {
  await browser.close();
  await proxy.close();
  await server.stop();
}
