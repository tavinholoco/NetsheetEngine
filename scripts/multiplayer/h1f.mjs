// H.1f — o GM sai (T1.8): janela de dois GMs ou de nenhum? E o 4400 do expulso.
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, sleep
} from "./lib.mjs";

const server = await startServer({ port: 3241 });
const code = "HF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", new Date().toISOString().slice(14, 19), ...a);
async function enterByInvite(p) {
  await p.page.goto(server.base + "/room/" + code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}
const gmPowers = (p) => p.page.getByText("Poderes do GM", { exact: false }).first().isVisible().catch(() => false);

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto");
  const caio = await person(browser, "Caio");
  for (const [p, h] of [[gm, "Mestre"], [ana, "Ana"], [beto, "Beto"], [caio, "Caio"]]) await setHandle(p, server.base, h);
  await enterAsGm(gm, server.base, code);
  for (const p of [ana, beto, caio]) await enterByInvite(p);
  for (const p of [gm, ana, beto, caio]) p.page.on("dialog", (d) => d.accept());
  const tokOf = async (p) => (await session(p)).token;
  const sCaio = await session(caio);

  // --- 1. O GM remove o Caio: o socket fecha com 4400 ---
  const t0 = Date.now();
  const del = await api(server.base, `/api/rooms/${code}/players/${sCaio.peerId}/delete`, await tokOf(gm));
  log("GM remove o Caio:", del.status);
  const lobbyMsg = await caio.page.getByText("O Mestre removeu você desta mesa").first().waitFor({ timeout: 45000 }).then(() => Date.now() - t0).catch(() => null);
  log("o Caio vê 'O Mestre removeu você' em", lobbyMsg, "ms | tentativas de WebSocket:", caio.ws.length, "| pedidos:", JSON.stringify(caio.http.slice(-6)));

  // --- 2. O GM clica em Sair ---
  await gm.page.getByRole("button", { name: /^Sair$/i }).click();
  let st = await roomState(server.base, code, await tokOf(ana));
  log("depois do Sair do GM: gmPeerId é a Ana?", st.gmPeerId === (await session(ana)).peerId, "| gmHandle:", st.gmHandle,
    "| chat:", st.chatMessages.slice(-1)[0]?.text.slice(0, 90));
  const anaGmAt = await ana.page.getByText("Poderes do GM", { exact: false }).first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  log("a Ana vê os poderes do GM?", anaGmAt, "| o Beto?", await gmPowers(beto));
  const oldGm = await api(server.base, `/api/rooms/${code}/npcs/generate`, gmToken);
  log("o token do GM antigo ainda gera NPC?", oldGm.status, oldGm.body?.code || "");
  const anaGen = await api(server.base, `/api/rooms/${code}/npcs/generate`, await tokOf(ana));
  log("a Ana (GM nova) gera NPC:", anaGen.status);

  // --- 3. A GM nova fecha a aba (o sessionStorage morre com ela) ---
  const sAna = await session(ana);
  await ana.page.close();
  log("a Ana fechou a aba; esperando o vigia de presença…");
  let offAt = null;
  const t1 = Date.now();
  while (Date.now() - t1 < 80000) {
    st = await roomState(server.base, code, await tokOf(beto));
    const a = st.players[sAna.peerId];
    if (!offAt && a && !a.isOnline) offAt = Math.round((Date.now() - t1) / 1000);
    if (offAt && Date.now() - t1 > (offAt + 10) * 1000) break;
    await sleep(2000);
  }
  log("a Ana aparece offline aos", offAt, "s | gmPeerId continua nela?", st.gmPeerId === sAna.peerId, "| o Beto vê poderes do GM?", await gmPowers(beto));
  const betoGen = await api(server.base, `/api/rooms/${code}/npcs/generate`, await tokOf(beto));
  log("o Beto tenta gerar NPC:", betoGen.status, betoGen.body?.code || "");
  // a Ana volta pelo link do convite, numa aba nova
  const ana2 = await person(browser, "Ana-volta");
  await setHandle(ana2, server.base, "Ana");
  await enterByInvite(ana2);
  const s2 = await session(ana2);
  st = await roomState(server.base, code, s2.token);
  log("a Ana volta por uma aba nova: peerId novo?", s2.peerId !== sAna.peerId, "| é GM?", st.gmPeerId === s2.peerId,
    "| assentos 'Ana':", Object.values(st.players).filter((p) => p.handle === "Ana").length);
  const ana2Gen = await api(server.base, `/api/rooms/${code}/npcs/generate`, s2.token);
  log("ela tenta gerar NPC:", ana2Gen.status, ana2Gen.body?.code || "", "→ a mesa", ana2Gen.status === 200 ? "tem GM" : "ficou SEM GM");

  // --- 4. Uma ficha gerada herda o GM? ---
  const code2 = "HF2-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const seed2 = await seedRoom(server.base, code2, "peer_h_gm2", "Mestre2");
  await api(server.base, `/api/rooms/${code2}/players/generate`, seed2.gmToken);
  const dani = await person(browser, "Dani");
  await setHandle(dani, server.base, "Dani");
  await dani.page.goto(server.base + "/room/" + code2);
  await dani.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await dani.page.getByPlaceholder("Mensagem para a mesa...").waitFor();
  await api(server.base, `/api/rooms/${code2}/leave`, seed2.gmToken);
  st = await roomState(server.base, code2, await tokOf(dani));
  const heir = st.players[st.gmPeerId];
  log("sala 2 — o GM gera uma ficha, a Dani entra, o GM sai em <60 s: o cargo vai para",
    heir ? `${heir.handle} (${heir.peerId.startsWith("edgerunner_") ? "a FICHA GERADA" : "uma pessoa"})` : "ninguém");
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor:", JSON.stringify(ev));
} finally {
  await browser.close();
  await server.stop();
}
