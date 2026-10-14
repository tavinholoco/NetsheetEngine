// H.1k — a habilidade especial na mesa: o tipo `skill` procura em sheet.skills,
// e a habilidade mora em specialAbilityName. A tela da mesa não tem botão de
// perícia; aqui, o pedido vai direto à API com a sessão de um jogador de verdade.
import { chromium, startServer, person, seedRoom, setHandle, session, roomState, api } from "./lib.mjs";

const server = await startServer({ port: 3291 });
const base = server.base;
const code = "HK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
await seedRoom(base, code);
const browser = await chromium.launch();
const log = (...a) => console.log("•", ...a);
try {
  const ana = await person(browser, "Ana");
  await setHandle(ana, base, "Ana");
  await ana.page.goto(base + "/room/" + code);
  await ana.page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  await ana.page.getByPlaceholder("Mensagem para a mesa...").waitFor();
  const s = await session(ana);
  const st = await roomState(base, code, s.token);
  const sheet = st.players[s.peerId].sheet;
  log("a ficha da Ana: papel", sheet.role, "| habilidade especial:", sheet.specialAbilityName, sheet.specialAbilityRank, "| perícias:", (sheet.skills || []).length);
  sheet.skills = [{ id: "sk_aw", name: "Awareness / Notice", stat: "INT", level: 4 }];
  const up = await api(base, `/api/rooms/${code}/sheet`, s.token, { sheet });
  log("a Ana ganha a perícia Awareness / Notice pela sincronia:", up.status);
  const first = sheet.skills[0];
  const r1 = await api(base, `/api/rooms/${code}/roll`, s.token, { kind: "skill", skillName: first?.name });
  log(`rolar a perícia "${first?.name}" pela API:`, r1.status, r1.body?.roll?.label || r1.body?.error || "");
  const r2 = await api(base, `/api/rooms/${code}/roll`, s.token, { kind: "skill", skillName: sheet.specialAbilityName });
  log(`rolar a habilidade especial "${sheet.specialAbilityName}" pela API:`, r2.status, r2.body?.code || "", r2.body?.error || r2.body?.roll?.label || "");
  const buttons = await ana.page.locator('button[title*="RNG no servidor"]').evaluateAll((els) => els.map((e) => e.getAttribute("title").split(" — ")[0]));
  log("os botões de rolagem na barra da mesa:", JSON.stringify(buttons));
} finally {
  await browser.close();
  await server.stop();
}
