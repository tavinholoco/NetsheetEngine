// H.1d — o servidor cai e volta com a mesa aberta: restore, sessões
// persistidas (B.4) e o 401 → join com token (R.1). Supabase local de verdade.
// No Windows, kill() termina o processo na hora (sem o flushAllPending do
// SIGTERM): é a QUEDA BRUSCA. O desligamento educado do deploy é do H.1j.
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, say, waitText, sleep
} from "./lib.mjs";

const PORT = 3271;
let server = await startServer({ port: PORT, persist: true });
const base = server.base;
const code = "HR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", new Date().toISOString().slice(14, 21), ...a);
const sockets = (p) => p.ws.map((w) => (w.closed ? "x" : "o")).join("");
async function enterByInvite(p) {
  await p.page.goto(base + "/room/" + code);
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 20000 });
}
const persistedAt = async () => {
  // quando a sala foi gravada pela última vez (lido do próprio banco, pelo docker)
  const { execSync } = await import("node:child_process");
  try {
    return execSync(`docker exec supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite psql -U postgres -tAc "select to_char(updated_at,'MI:SS.MS'), jsonb_array_length(room_state->'chatMessages') from public.rooms where code='${code}'"`, { timeout: 30000 }).toString().trim();
  } catch { return "(erro ao ler)"; }
};

try {
  const gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  const ana = await person(browser, "Ana");
  const beto = await person(browser, "Beto");
  const caio = await person(browser, "Caio");
  for (const [p, h] of [[gm, "Mestre"], [ana, "Ana"], [beto, "Beto"], [caio, "Caio"]]) await setHandle(p, base, h);
  await enterAsGm(gm, base, code);
  await enterByInvite(ana);
  await enterByInvite(beto);
  const tok = async (p) => (await session(p)).token;
  const sA = await session(ana);
  const sB = await session(beto);
  await api(base, `/api/rooms/${code}/npcs/generate`, await tok(gm));
  await api(base, `/api/rooms/${code}/initiative`, await tok(gm), { action: "roll" });
  await api(base, `/api/rooms/${code}/damage`, await tok(gm), { targetId: sA.peerId, raw: 25, location: "Torso" });
  await sleep(3500);
  let st = await roomState(base, code, await tok(gm));
  const chatBefore = st.chatMessages.length;
  log("mesa montada e gravada:", persistedAt && (await persistedAt()), "| chat:", chatBefore);

  // --- a rajada: uma ação por segundo durante 10 s (o debounce de 2 s reinicia a cada uma) ---
  for (let i = 0; i < 10; i++) { await say(gm, `rajada-${i}`); await sleep(1000); }
  log("depois de 10 s de rajada, a última gravação no banco:", await persistedAt());
  // --- na janela, logo antes da queda: dano no Beto, o Caio entra, a Ana dá F5 ---
  await api(base, `/api/rooms/${code}/damage`, await tok(gm), { targetId: sB.peerId, raw: 25, location: "Torso" });
  await enterByInvite(caio);
  const sC = await session(caio);
  const tokAnaBefore = (await session(ana)).token;
  await ana.page.reload();
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 10000 });
  log("a Ana deu F5: token novo?", (await session(ana)).token !== tokAnaBefore);
  st = await roomState(base, code, await tok(gm));
  const localB = await beto.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").damagePoints);
  log("antes da queda — na memória: chat", st.chatMessages.length, "| Beto", st.players[sB.peerId].sheet.damagePoints, "(ficha local", localB + ") | Caio na mesa?", !!st.players[sC.peerId], "| no banco:", await persistedAt());

  // --- a queda ---
  const tDown = Date.now();
  await server.stop();
  log("servidor derrubado (queda brusca)");
  await sleep(4000);
  log("com o servidor fora — sockets: GM", sockets(gm), "Ana", sockets(ana), "Beto", sockets(beto), "Caio", sockets(caio));
  server = await startServer({ port: PORT, persist: true });
  log("servidor de volta em", Date.now() - tDown, "ms; restore:", JSON.stringify(server.logs.filter((l) => l.json && /restor/.test(l.json.event)).map((l) => l.json)).slice(0, 200));
  await sleep(12000);

  // --- o que voltou ---
  for (const p of [gm, ana, beto, caio]) {
    const s = await session(p);
    const r = await fetch(`${base}/api/rooms/${code}`, { headers: { "X-Session-Token": s.token } });
    const j = await r.json();
    log(`${p.name}: token vale?`, !!j.players, "| peerId", s.peerId === ({ GM: gmPeerId, Ana: sA.peerId, Beto: sB.peerId, Caio: sC.peerId })[p.name] ? "o mesmo" : "NOVO",
      "| sockets", sockets(p), "| pedidos depois da volta:", JSON.stringify(p.http.slice(-4)));
  }
  st = await roomState(base, code, await tok(gm));
  const handles = Object.values(st.players).map((p) => `${p.handle}:${p.sheet?.damagePoints ?? "?"}${p.isOnline ? "" : "(off)"}`).join(" ");
  log("a sala restaurada — assentos:", handles, "| chat:", st.chatMessages.length, `(antes ${chatBefore} + rajada)`,
    "| rajada salva:", st.chatMessages.filter((m) => /^rajada-/.test(m.text)).length, "de 10",
    "| iniciativa:", (st.initiativeList || []).map((e) => e.handle).join(","), "| NPCs:", Object.keys(st.npcs || {}).length);
  const localB2 = await beto.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").damagePoints);
  log("o dano do Beto (dado na janela): na mesa", st.players[sB.peerId]?.sheet?.damagePoints, "| na ficha local dele agora:", localB2);
  const gen = await api(base, `/api/rooms/${code}/npcs/generate`, await tok(gm));
  log("o GM ainda é GM?", gen.status);
  await say(gm, "depois-da-volta");
  for (const p of [ana, beto, caio]) log(`${p.name} recebe o chat depois da volta?`, await waitText(p, "depois-da-volta", 6000).then(() => "sim").catch(() => "NÃO"));
  await sleep(25000);
  st = await roomState(base, code, await tok(gm));
  log("30 s depois da volta — assentos:", Object.values(st.players).map((p) => `${p.handle}[${p.peerId.slice(-6)}]${p.isOnline ? "" : "(off)"}`).join(" "));
  for (const p of [ana, caio]) { const s = await session(p); log(`  ${p.name}: peerId`, s.peerId === ({ Ana: sA.peerId, Caio: sC.peerId })[p.name] ? "o mesmo" : `NOVO (${s.peerId.slice(-6)})`, "| sockets", sockets(p), "| pedidos:", JSON.stringify(p.http.slice(-5))); }
  const ev = {};
  for (const l of server.logs) if (l.json) ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos do servidor novo:", JSON.stringify(ev));
  for (const p of [gm, ana, beto, caio]) if (p.pageErrors.length) log(p.name, "erros:", JSON.stringify(p.pageErrors.slice(0, 3)));
  // limpa o banco local: todos saem
  for (const p of [caio, beto, ana, gm]) await api(base, `/api/rooms/${code}/leave`, await tok(p)).catch(() => {});
} finally {
  await browser.close();
  await server.stop();
}
