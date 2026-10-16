// H.1h — o último socket fecha e alguém reconecta no mesmo instante: o
// destroyRoomYjs descarta o doc — a reconexão perde movimento do grid?
// E, de carona: no SSE, o grid da tela acompanha a mesa?
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, sleep
} from "./lib.mjs";
import { startSlowProxy } from "./slowproxy.mjs";

const FAST = { latencyMs: 0, downBps: 50_000_000, upBps: 50_000_000 };
const server = await startServer({ port: 3261 });
const pGm = startSlowProxy({ listenPort: 3361, targetPort: 3261, ...FAST });
const pAna = startSlowProxy({ listenPort: 3362, targetPort: 3261, ...FAST });
const code = "HH-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", new Date().toISOString().slice(14, 19), ...a);
const sockets = (p) => p.ws.map((w) => (w.closed ? "x" : "o")).join("");

/** Onde a tela da pessoa mostra o token (pelo title "… - Setor B3"), e quantos tokens ela desenha. */
const view = (p, name) => p.page.evaluate((n) => {
  const els = [...document.querySelectorAll(`[title^="${n} ("]`)];
  return { at: els.map((e) => e.getAttribute("title").replace(/^.*Setor /, "")).join(","), tokens: document.querySelectorAll('[title*=") - Setor "]').length };
}, name);
const ROWS = "ABCDEFGHIJKLMNOP";
const sector = (t) => `${ROWS[t.y]}${t.x + 1}`;
async function serverView(name) {
  const st = await roomState(server.base, code, (await session(gm)).token);
  const t = st.tacticalGrid.tokens.find((k) => k.name === name);
  return { at: t ? sector(t) : "?", tokens: st.tacticalGrid.tokens.length, grid: st.tacticalGrid };
}
let gm;

try {
  gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  await setHandle(gm, pGm.base, "Mestre");
  await setHandle(ana, pAna.base, "Ana");
  await enterAsGm(gm, pGm.base, code);
  await ana.page.goto(pAna.base + "/room/" + code);
  await ana.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor();
  for (const p of [gm, ana]) await p.page.getByRole("button", { name: /Grid Tático/i }).click();
  await sleep(1500);

  const drag = async (p, name, fx, fy) => {
    const tok = p.page.locator(`[title^="${name} ("]`).first();
    const board = tok.locator("xpath=ancestor::div[contains(@class,'absolute') and contains(@class,'inset-0')][1]/..");
    const box = await board.boundingBox();
    await tok.dragTo(board, { targetPosition: { x: box.width * fx, y: box.height * fy } });
  };

  // --- 1. Movimento aceito, os dois sockets caem juntos, e voltam ---
  await drag(ana, "Ana", 0.55, 0.3);
  await sleep(800);
  let sv = await serverView("Ana");
  log("1) a Ana arrasta o token: servidor", sv.at, "| tela da Ana", JSON.stringify(await view(ana, "Ana")), "| tela do GM", JSON.stringify(await view(gm, "Ana")));
  pGm.killWs(); pAna.killWs();               // os dois caem: o último socket fecha → destroyRoomYjs
  await sleep(4500);                           // a reconexão de 3 s
  sv = await serverView("Ana");
  log("1) depois de cair e voltar: sockets GM", sockets(gm), "Ana", sockets(ana), "| servidor", sv.at, `(${sv.tokens} tokens)`,
    "| Ana vê", JSON.stringify(await view(ana, "Ana")), "| GM vê", JSON.stringify(await view(gm, "Ana")));

  // --- 2. O movimento em voo: a Ana arrasta e os sockets caem no mesmo instante ---
  pAna.setProfile({ latencyMs: 600 });         // o update fica no caminho
  await drag(ana, "Ana", 0.25, 0.75);
  pGm.killWs(); pAna.killWs();
  pAna.setProfile({ latencyMs: 0 });
  await sleep(5000);
  sv = await serverView("Ana");
  log("2) movimento em voo quando tudo caiu: servidor", sv.at, `(${sv.tokens} tokens)`, "| Ana vê", JSON.stringify(await view(ana, "Ana")), "| GM vê", JSON.stringify(await view(gm, "Ana")));

  // --- 3. Reconexão de verdade no mesmo instante: o GM cai e volta enquanto a Ana move de novo ---
  pGm.killWs();
  await drag(ana, "Ana", 0.75, 0.75);
  await sleep(4500);
  sv = await serverView("Ana");
  log("3) o GM cai, a Ana move, o GM volta: servidor", sv.at, "| Ana vê", JSON.stringify(await view(ana, "Ana")), "| GM vê", JSON.stringify(await view(gm, "Ana")));

  // --- 4. De carona: a Ana perde o WebSocket por 5 s (H.09) — o grid da tela acompanha a mesa? ---
  // Antes da H.3b ela caía no SSE e o grid congelava na última posição do Yjs. Desde
  // então ela tenta o WebSocket de novo (3 s, depois 6 s) e o Yjs volta com a mesa.
  pAna.setProfile({ blockWs: true });
  pAna.killWs();
  await sleep(5000);
  pAna.setProfile({ blockWs: false });
  log("4) a Ana perdeu o WebSocket por 5 s: sockets", sockets(ana));
  sv = await serverView("Ana");
  const g = sv.grid;
  const anaTok = g.tokens.find((t) => t.name === "Ana");
  const moved = { ...g, tokens: g.tokens.map((t) => (t.id === anaTok.id ? { ...t, x: 0, y: 0 } : t)) };
  const r = await api(server.base, `/api/rooms/${code}/tactical-grid`, (await session(gm)).token, { gridState: moved });
  const tMove = Date.now();
  let anaSees = await view(ana, "Ana");
  while (Date.now() - tMove < 20000 && anaSees?.at !== "A1") { await sleep(500); anaSees = await view(ana, "Ana"); }
  sv = await serverView("Ana");
  log("4) o GM move o token da Ana para A1 (REST", r.status + "): servidor", sv.at, "| GM vê", JSON.stringify(await view(gm, "Ana")),
    "| Ana vê", JSON.stringify(anaSees), anaSees?.at === "A1" ? `em ${Date.now() - tMove} ms` : "— CONGELADO depois de 20 s", "| sockets", sockets(ana));
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos:", JSON.stringify(ev));
  for (const p of [gm, ana]) if (p.pageErrors.length) log(p.name, "erros:", JSON.stringify(p.pageErrors.slice(0, 3)));
} finally {
  await browser.close();
  await pGm.close();
  await pAna.close();
  await server.stop();
}
