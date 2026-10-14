// H.1a — mesa de base: GM + 2 jogadores, do zero ao combate. É o que os outros
// cenários comparam. Build de produção, servidor próprio, três contextos.
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm, enterAsPlayer,
  session, roomState, api, say, waitText, summary, resetCounters, sleep
} from "./lib.mjs";

const persist = process.argv.includes("--persist");
const server = await startServer({ port: 3201, persist });
const code = "HA-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto");
  const all = [gm, ana, beto];

  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, server.base, "Ana");
  await setHandle(beto, server.base, "Beto");

  let t0 = Date.now();
  await enterAsGm(gm, server.base, code);
  log("GM na mesa em", Date.now() - t0, "ms");
  t0 = Date.now();
  await enterAsPlayer(ana, server.base, code);
  log("Ana na mesa em", Date.now() - t0, "ms");
  t0 = Date.now();
  await enterAsPlayer(beto, server.base, code);
  log("Beto na mesa em", Date.now() - t0, "ms");
  await sleep(1500);

  // Todos se veem? (a lista de jogadores na tela de cada um)
  for (const p of all) {
    const txt = await p.page.locator("text=JOGADORES").first().locator("..").innerText().catch(() => "");
    log(p.name, "vê jogadores:", txt.replace(/\s+/g, " ").slice(0, 120));
  }

  const gmTok = async () => (await session(gm)).token;
  const sA = await session(ana);
  const sB = await session(beto);
  let st = await roomState(server.base, code, await gmTok());
  log("assentos:", Object.keys(st.players).length, "tokens no grid:", st.tacticalGrid?.tokens?.length,
    "handles:", Object.values(st.players).map((p) => p.handle).join(","));

  // Chat: Ana fala, os outros dois veem
  resetCounters(...all);
  await say(ana, "ana-oi-1");
  const lat = await Promise.all([waitText(gm, "ana-oi-1"), waitText(beto, "ana-oi-1")]);
  log("chat Ana → GM/Beto em ms:", lat.join(" / "));
  log("um chat custou:", JSON.stringify(summary(all)));

  // Rolagem server-authoritative: Beto rola o death save
  await beto.page.locator('button[title*="Death Save"]').click();
  await Promise.all([waitText(gm, "Death Save"), waitText(ana, "Death Save")]);
  log("death save do Beto visto pelos dois");

  // GM gera dois NPCs pela tela
  for (let i = 0; i < 2; i++) {
    await gm.page.getByRole("button", { name: /Gerar NPC/i }).click();
    await sleep(700);
  }
  st = await roomState(server.base, code, await gmTok());
  const npcIds = Object.keys(st.npcs || {});
  log("NPCs:", npcIds.length, "tokens no grid:", st.tacticalGrid?.tokens?.length);

  // Iniciativa pela tela do GM
  await gm.page.getByRole("button", { name: /Iniciativa$/ }).click();
  await gm.page.getByRole("button", { name: /Rolar iniciativa/i }).click();
  await sleep(800);
  st = await roomState(server.base, code, await gmTok());
  log("iniciativa:", (st.initiativeList || []).map((e) => `${e.handle}:${e.score}${e.isCurrentTurn ? "*" : ""}`).join(" "));
  for (const p of [ana, beto]) {
    await p.page.getByRole("button", { name: /Iniciativa$/ }).click();
    const n = await p.page.locator("text=entradas").first().innerText();
    log(p.name, "vê iniciativa:", n);
  }
  await gm.page.getByRole("button", { name: /Próximo Turno/i }).click();
  await sleep(600);
  st = await roomState(server.base, code, await gmTok());
  log("vez depois do próximo turno:", (st.initiativeList || []).find((e) => e.isCurrentTurn)?.handle);

  // Combate: o NPC ataca a Ana (servidor rola), o GM aplica 12 de dano no Beto
  resetCounters(...all);
  const atk = await api(server.base, `/api/rooms/${code}/attack`, await gmTok(), { attackerId: npcIds[0], targetId: sA.peerId, range: "close" });
  log("NPC ataca Ana:", atk.status, atk.body?.error || "");
  const dmg = await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: sB.peerId, raw: 25, location: "Torso" });
  log("dano no Beto:", dmg.status, dmg.body?.error || "");
  await sleep(1200);
  st = await roomState(server.base, code, await gmTok());
  const wA = st.players[sA.peerId]?.sheet?.damagePoints;
  const wB = st.players[sB.peerId]?.sheet?.damagePoints;
  // a ficha local de cada jogador acompanha o ferimento (decisão 7a)
  const localA = await ana.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").damagePoints);
  const localB = await beto.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").damagePoints);
  log("chat do combate:", JSON.stringify(st.chatMessages.slice(-3).map((m) => m.text)));
  log("ferimento na mesa — Ana:", wA, "Beto:", wB, "| na ficha local — Ana:", localA, "Beto:", localB);
  log("o combate custou:", JSON.stringify(summary(all)));

  // Ociosa: 45 s parada — o que trafega sem ninguém agir (heartbeat, awareness)
  resetCounters(...all);
  await sleep(45000);
  log("45 s ociosa:", JSON.stringify(summary(all)));

  st = await roomState(server.base, code, await gmTok());
  log("online:", Object.values(st.players).map((p) => `${p.handle}:${p.isOnline}`).join(" "));
  log("tamanho da sala:", (JSON.stringify(st).length / 1024).toFixed(1), "KB");

  for (const p of all) {
    if (p.console.length || p.pageErrors.length) log(p.name, "console:", JSON.stringify([...new Set(p.console)].slice(0, 6)), "erros:", JSON.stringify(p.pageErrors));
  }
  log("eventos do servidor:", JSON.stringify(summary([], server).serverEvents));
  const warn = server.logs.filter((l) => l.json && l.json.level !== "info").map((l) => l.line.slice(0, 200));
  if (warn.length) log("warn/error do servidor:", JSON.stringify([...new Set(warn)].slice(0, 10)));
} finally {
  await browser.close();
  await server.stop();
}
