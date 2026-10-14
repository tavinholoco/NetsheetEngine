// H.1c — refresh no meio do combate, do jogador e do GM.
// Ana entra pelo link do convite (/room/CÓDIGO, o caminho da R.11); Beto, pelo
// lobby digitando o código. O GM, pelo deep link.
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, waitText, sleep
} from "./lib.mjs";

const server = await startServer({ port: 3221 });
const code = "HC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);

async function enterByInvite(p) {
  await p.page.goto(server.base + "/room/" + code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}
async function enterByLobby(p) {
  await p.page.goto(server.base + "/multiplayer");
  await p.page.getByPlaceholder("Digite o código da sala").fill(code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 15000 });
}
const inRoom = (p, ms = 8000) => p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: ms }).then(() => true).catch(() => false);

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto");
  await setHandle(gm, server.base, "Mestre");
  await setHandle(ana, server.base, "Ana");
  await setHandle(beto, server.base, "Beto");
  await enterAsGm(gm, server.base, code);
  await enterByInvite(ana);
  await enterByLobby(beto);
  log("URLs depois de entrar — Ana:", new URL(ana.page.url()).pathname, "| Beto:", new URL(beto.page.url()).pathname);
  const gmTok = async () => (await session(gm)).token;
  const sA0 = await session(ana);
  const sB0 = await session(beto);

  await api(server.base, `/api/rooms/${code}/npcs/generate`, await gmTok());
  await api(server.base, `/api/rooms/${code}/initiative`, await gmTok(), { action: "roll" });
  await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: sA0.peerId, raw: 25, location: "Torso" });
  await api(server.base, `/api/rooms/${code}/damage`, await gmTok(), { targetId: sB0.peerId, raw: 25, location: "Torso" });
  await sleep(1500);

  const snapshot = async (label) => {
    const st = await roomState(server.base, code, await gmTok());
    const seats = Object.values(st.players).map((p) => `${p.handle}${p.isOnline ? "" : "(off)"}:${p.sheet?.damagePoints ?? "?"}`).join(" ");
    const ini = (st.initiativeList || []).map((e) => `${e.handle}${e.isCurrentTurn ? "*" : ""}`).join(" ");
    log(label, "| assentos:", seats, "| iniciativa:", ini, "| chat:", st.chatMessages.length);
    return st;
  };
  let st = await snapshot("antes dos refresh");
  const chatBefore = st.chatMessages.length;

  // --- 1. Ana (link do convite) dá F5 ---
  await ana.page.reload();
  let back = await inRoom(ana);
  let sA1 = await session(ana);
  const localA = await ana.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").damagePoints);
  log("Ana depois do F5: na mesa?", back, "| URL", new URL(ana.page.url()).pathname, "| mesmo peerId?", sA1.peerId === sA0.peerId, "| ferimento local:", localA);
  st = await snapshot("depois do F5 da Ana");

  // --- 2. Beto (entrou pelo lobby) dá F5 ---
  await beto.page.reload();
  back = await inRoom(beto, 6000);
  log("Beto depois do F5: na mesa sozinho?", back, "| URL", new URL(beto.page.url()).pathname);
  if (!back) {
    const field = await beto.page.getByPlaceholder("Digite o código da sala").inputValue().catch(() => "(sem campo)");
    log("  o que o Beto vê: o lobby, com o campo do código =", JSON.stringify(field));
    await beto.page.getByPlaceholder("Digite o código da sala").fill(code);
    await beto.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
    back = await inRoom(beto);
    const sB1 = await session(beto);
    log("  Beto entra de novo pelo código: na mesa?", back, "| mesmo peerId?", sB1.peerId === sB0.peerId);
  }
  st = await snapshot("depois do F5 do Beto");

  // --- 3. O GM dá F5 ---
  await gm.page.reload();
  back = await inRoom(gm);
  const stillGm = await gm.page.getByText("Poderes do GM", { exact: false }).first().isVisible().catch(() => false);
  log("GM depois do F5: na mesa?", back, "| poderes do GM visíveis?", stillGm, "| gmPeerId igual?", (await session(gm)).peerId === gmPeerId);
  const nt = await api(server.base, `/api/rooms/${code}/initiative`, await gmTok(), { action: "next" });
  log("GM passa o turno depois do F5:", nt.status);
  st = await snapshot("depois do F5 do GM");

  // --- 4. Ana dá F5 duas vezes seguidas ---
  await ana.page.reload({ waitUntil: "commit" });
  await sleep(60);
  await ana.page.reload();
  back = await inRoom(ana);
  log("Ana depois de dois F5 seguidos: na mesa?", back, "| mesmo peerId?", (await session(ana)).peerId === sA0.peerId);
  st = await snapshot("depois dos dois F5 da Ana");

  const sys = st.chatMessages.slice(chatBefore).map((m) => m.text.slice(0, 70));
  log("mensagens de sistema que os refresh puseram no chat:", JSON.stringify(sys));
  for (const p of [gm, ana, beto]) if (p.console.length || p.pageErrors.length) log(p.name, "console:", JSON.stringify([...new Set(p.console)].slice(0, 6)), JSON.stringify(p.pageErrors.slice(0, 3)));
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor:", JSON.stringify(ev));
} finally {
  await browser.close();
  await server.stop();
}
