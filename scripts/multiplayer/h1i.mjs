// H.1i — ficha editada em duas abas; a reconexão resolve por last-write-wins
// com o updatedAt do CLIENTE. (A) a Ana com o relógio 2 h atrasado edita e
// reconecta; (B) a Ana em duas abas edita campos diferentes.
import {
  chromium, startServer, person, seedRoom, gmInit, setHandle, enterAsGm,
  session, roomState, api, sleep
} from "./lib.mjs";

const server = await startServer({ port: 3281 });
const base = server.base;
const code = "HI-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);
const handleInput = (p) => p.page.getByPlaceholder("Ex: Silverhand, V, Spider");
async function editHandle(p, value) {
  await p.page.goto(base + "/sheet");
  await handleInput(p).fill(value);
  await sleep(1200); // o autosave local e os 600 ms da sincronia com a mesa
}
const seatsView = async () => {
  const st = await roomState(base, code, (await session(gm)).token);
  return Object.values(st.players).map((p) => `${p.handle}[${p.peerId.slice(-6)}] upd=${(p.sheet.updatedAt || "").slice(11, 19)}`).join(" | ");
};
let gm;
try {
  gm = await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) });
  await setHandle(gm, base, "Mestre");
  await enterAsGm(gm, base, code);

  // ===== A. relógio do navegador 2 h atrasado =====
  const ana = await person(browser, "Ana");
  await ana.page.clock.install();
  await ana.page.clock.setSystemTime(new Date(Date.now() - 2 * 3600_000));
  await setHandle(ana, base, "Ana");
  await ana.page.goto(base + "/room/" + code);
  await ana.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor();
  log("A) a Ana entra com o relógio 2 h atrasado:", await seatsView());
  // edita a ficha fora da mesa (a sincronia leva para a mesa: o /sheet não compara updatedAt)
  await ana.page.getByRole("button", { name: /Sair/i }).count(); // (só para garantir a página carregada)
  await editHandle(ana, "Ana-v2");
  await ana.page.goto(base + "/room/" + code); // F5 de volta à mesa: join com a ficha local (updatedAt atrasado)
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 10000 });
  await sleep(1500);
  log("A) depois de editar e voltar (F5):", await seatsView());

  // o servidor com uma versão "mais nova" que a do cliente: a Ana volta com a ficha de antes?
  // (só o próprio navegador escreve a ficha do assento — o GM escreve só o ferimento)
  const sA = await session(ana);
  await api(base, `/api/rooms/${code}/damage`, (await session(gm)).token, { targetId: sA.peerId, raw: 25, location: "Torso" });
  await sleep(1500);
  const st = await roomState(base, code, (await session(gm)).token);
  const local = await ana.page.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}"));
  log("A) o GM fere a Ana: na mesa", st.players[sA.peerId].sheet.damagePoints, "pts, handle", st.players[sA.peerId].handle,
    "| na ficha local:", local.damagePoints, "pts, handle", local.handle, ", updatedAt local", (local.updatedAt || "").slice(11, 19));

  // ===== B. duas abas da mesma Ana, cada uma edita um campo =====
  const s = await session(ana);
  const tab2 = await ana.ctx.newPage();
  await tab2.addInitScript(([id, t]) => { if (!sessionStorage.getItem("cyberpunk_peer_id")) { sessionStorage.setItem("cyberpunk_peer_id", id); sessionStorage.setItem("cyberpunk_session_token", t); } }, [s.peerId, s.token]);
  await tab2.goto(base + "/room/" + code);
  await tab2.getByPlaceholder("Mensagem para a mesa...").waitFor();
  await sleep(2500);
  log("B) duas abas da Ana:", await seatsView());
  await tab2.goto(base + "/sheet");
  await tab2.getByPlaceholder("Ex: Silverhand, V, Spider").fill("Ana-aba2");
  await sleep(1500);
  await tab2.goto(base + "/room/" + code);
  await tab2.getByPlaceholder("Mensagem para a mesa...").waitFor();
  await sleep(2500);
  log("B) a aba 2 renomeia para Ana-aba2:", await seatsView());
  const local2 = await tab2.evaluate(() => JSON.parse(localStorage.getItem("cyberpunk_active_sheet_v1") || "{}").handle);
  log("B) a ficha local (a mesma para as duas abas) agora é:", local2);
  const ev = {};
  for (const l of server.logs) if (l.json && l.json.event !== "persistence_disabled") ev[l.json.event] = (ev[l.json.event] || 0) + 1;
  log("eventos:", JSON.stringify(ev));
} finally {
  await browser.close();
  await server.stop();
}
