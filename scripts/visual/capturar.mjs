#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — CAPTURA DETERMINÍSTICA DAS TELAS (Fase F)
 * ============================================================
 * A prova de "a tela não mudou" (F.2.6) e de "mudou só onde devia" é comparar
 * capturas pixel a pixel (`comparar.mjs`). Para isso a captura tem de ser
 * repetível: relógio congelado, animação e transição desligadas, viewport e
 * escala fixas. Medido na F.2.6 (30/09/2026): duas capturas do mesmo build
 * diferem só numa região de 30×8 px da ficha.
 *
 * Fotografa cinco telas: início, ficha, dados, mesa do GM e mesa do jogador. A
 * mesa é semeada pelo REST com o `peerId` do navegador do GM (o `join` exige o
 * token — R.1), então rode contra um servidor **recém-subido**: o código da sala
 * é fixo e um segundo `create` responde 409.
 *
 * Uso (com o build de produção no ar — a configuração `netsheet-prod` do
 * .claude/launch.json, porta 3100):
 *   npm run build
 *   node scripts/visual/capturar.mjs <pasta-de-saída>
 *   BASE_URL=http://127.0.0.1:3000 node scripts/visual/capturar.mjs <pasta>
 * ============================================================
 */
// O @playwright/test é CommonJS: o chromium vem do export default.
import playwright from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const { chromium } = playwright;

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const SAIDA = process.argv[2];
if (!SAIDA) {
  console.error("Uso: node scripts/visual/capturar.mjs <pasta-de-saída>");
  process.exit(1);
}
fs.mkdirSync(SAIDA, { recursive: true });
const FIXO = new Date("2026-09-30T20:00:00-03:00");
const SEM_MOVIMENTO = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

const browser = await chromium.launch();

async function novaPagina(init) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXO);
  if (init) await page.addInitScript(init.fn, init.arg);
  return { ctx, page };
}

async function foto(page, nome) {
  await page.addStyleTag({ content: SEM_MOVIMENTO });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: true });
  console.log("ok", nome);
}

for (const [nome, rota, pronta] of [
  ["1-inicio", "/", "text=BEM-VINDO A NIGHT CITY"],
  ["2-ficha", "/sheet", "text=BIO-MONITOR // FERIMENTOS"],
  ["3-dados", "/dice", "text=Rolagem de Perícia"]
]) {
  const { ctx, page } = await novaPagina();
  await page.goto(BASE + rota);
  await page.locator(pronta).first().waitFor();
  await foto(page, nome);
  await ctx.close();
}

const code = "SNAP-F2";
const res = await fetch(`${BASE}/api/rooms/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, name: "Mesa Snap", gmHandle: "SNAP-GM", gmPeerId: "snap_gm" })
});
const { sessionToken: gmToken } = await res.json();
if (!gmToken) throw new Error(`semear a sala falhou (${res.status}) — o servidor precisa ser recém-subido`);

// O GM entra pelo deep link: só ele hidrata a sessão (peerId e token) do
// sessionStorage, e desde a R.1 o `join` prova o assento com o token. Pelo
// lobby, o cliente gera um peerId novo e entra como jogador — foi assim até a
// F.4: a "mesa do GM" das capturas da F.2.6 e da F.1 era a visão de jogador.
async function entrar(page, comoGm = false) {
  if (comoGm) {
    await page.goto(BASE + "/room/" + code);
  } else {
    await page.goto(BASE + "/multiplayer");
    await page.getByPlaceholder("Digite o código da sala").fill(code);
    await page.getByRole("button", { name: /Entrar na Mesa/i }).click();
  }
  await page.getByPlaceholder("Mensagem para a mesa...").waitFor();
}

const gm = await novaPagina({
  fn: ([t]) => {
    sessionStorage.setItem("cyberpunk_peer_id", "snap_gm");
    sessionStorage.setItem("cyberpunk_session_token", t);
  },
  arg: [gmToken]
});
await entrar(gm.page, true);
// Prova de que a página é do GM: a etiqueta "GM" do cabeçalho da sala só aparece para ele.
await gm.page.getByText("GM", { exact: true }).first().waitFor();
const jogador = await novaPagina({ fn: () => sessionStorage.setItem("cyberpunk_peer_id", "snap_jogador"), arg: undefined });
await entrar(jogador.page);
await gm.page.waitForTimeout(800);
await foto(gm.page, "4-mesa-gm");
await foto(jogador.page, "5-mesa-jogador");
await browser.close();
