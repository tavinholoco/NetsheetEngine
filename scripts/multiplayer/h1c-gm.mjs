// H.1c (2) — o GM que criou a mesa pela tela dá F5.
// Criar pela tela exige login (Supabase local, fora do ar aqui), mas o estado
// que ela deixa é conhecido pelo código: `createRoom` grava o peerId e o token
// no sessionStorage (`persistSession`, api/rooms.ts:49–55) e a tela passa a
// `active` SEM mudar a URL — fica /multiplayer. Depois do F5, a store volta
// vazia. Esse é o estado que este roteiro monta: a sessão do GM no
// sessionStorage e a página aberta em /multiplayer.
import {
  chromium, startServer, person, seedRoom, setHandle, session, roomState, api, sleep
} from "./lib.mjs";

const server = await startServer({ port: 3222 });
const code = "HG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const { gmPeerId, gmToken } = await seedRoom(server.base, code, "peer_h_gm", "Mestre");
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);
try {
  const gm = await person(browser, "GM", {
    init: { fn: ([id, t]) => { if (!sessionStorage.getItem("cyberpunk_peer_id")) { sessionStorage.setItem("cyberpunk_peer_id", id); sessionStorage.setItem("cyberpunk_session_token", t); } }, arg: [gmPeerId, gmToken] }
  });
  await setHandle(gm, server.base, "Mestre");
  // o F5 em /multiplayer
  await gm.page.goto(server.base + "/multiplayer");
  await sleep(1500);
  const inRoom = await gm.page.getByPlaceholder("Mensagem para a mesa...").isVisible().catch(() => false);
  log("GM depois do F5 em /multiplayer: na mesa sozinho?", inRoom, "| campo do código:", JSON.stringify(await gm.page.getByPlaceholder("Digite o código da sala").inputValue().catch(() => "?")));
  // o caminho natural: digitar o código e entrar
  await gm.page.getByPlaceholder("Digite o código da sala").fill(code);
  await gm.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await gm.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: 10000 });
  await sleep(800);
  const s = await session(gm);
  const powers = await gm.page.getByText("Poderes do GM", { exact: false }).first().isVisible().catch(() => false);
  log("GM entra pelo código: peerId", s.peerId === gmPeerId ? "o mesmo" : "NOVO", "| poderes do GM na tela?", powers);
  const st = await roomState(server.base, code, s.token);
  log("a sala: gmPeerId =", st.gmPeerId, "| assentos:", Object.values(st.players).map((p) => `${p.handle}[${p.peerId === st.gmPeerId ? "GM" : p.peerId.slice(0, 12)}]`).join(" "));
  const tryGm = await api(server.base, `/api/rooms/${code}/npcs/generate`, s.token);
  log("o 'GM' tenta gerar NPC:", tryGm.status, tryGm.body?.code || "");
  // ele ainda consegue voltar a ser GM? o link do convite reidrata a sessão — mas o peerId do sessionStorage já foi trocado
  log("sessionStorage agora: peerId", (await session(gm)).peerId === gmPeerId ? "o do GM" : "trocado pelo novo");
  await gm.page.goto(server.base + "/room/" + code);
  await sleep(2000);
  const s2 = await session(gm);
  const st2 = await roomState(server.base, code, s2.token);
  log("pelo link do convite depois disso: é GM?", st2.gmPeerId === s2.peerId);
} finally {
  await browser.close();
  await server.stop();
}
