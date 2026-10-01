#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — AS REGRAS DA TIPOGRAFIA, NO NAVEGADOR (Fase F, F.1)
 * ============================================================
 * O que a análise estática não vê é o que o elemento HERDA: um contêiner mono
 * com um filho em negrito pede negrito à Share Tech Mono, que só tem o 400, e
 * o navegador o inventa. Este script olha o resultado renderizado, em 12 telas
 * (as rotas e a mesa do GM em chat, grid e iniciativa), e relata:
 *   - a fatia de texto de cada voz (Rajdhani / Share Tech Mono / Orbitron);
 *   - texto em Share Tech Mono com peso ≥ 600 (negrito sintético — F.1.2);
 *   - texto visível abaixo de 10 px (o piso da F.1.6);
 *   - º/ª fora da mono (Rajdhani e Orbitron não têm o glifo).
 * Na F.1 (30/09/2026): 0 negrito sintético e 0 abaixo de 10 px nas 12 telas.
 *
 * Uso (build de produção no ar, `netsheet-prod`, servidor recém-subido — a
 * sala de teste usa código fixo):
 *   node scripts/visual/tipografia.mjs
 * ============================================================
 */
// O @playwright/test é CommonJS: o chromium vem do export default.
import playwright from "@playwright/test";

const { chromium } = playwright;

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const browser = await chromium.launch();

async function checar(page, nome) {
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const out = { negrito: [], pequeno: [], ordinal: [], vozes: {} };
    for (const el of document.querySelectorAll("body *")) {
      const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
      if (!txt) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.getClientRects().length === 0) continue;
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      out.vozes[fam] = (out.vozes[fam] || 0) + txt.length;
      const id = `<${el.tagName.toLowerCase()}> "${txt.slice(0, 40)}"`;
      if (fam === "Share Tech Mono" && parseInt(cs.fontWeight, 10) >= 600) out.negrito.push(`${id} peso ${cs.fontWeight}`);
      if (parseFloat(cs.fontSize) < 10 && parseFloat(cs.opacity) > 0.2) out.pequeno.push(`${id} ${cs.fontSize}`);
      if (/[ºª]/.test(txt) && fam !== "Share Tech Mono") out.ordinal.push(`${id} em ${fam}`);
    }
    return out;
  });
  const total = Object.values(r.vozes).reduce((a, b) => a + b, 0) || 1;
  const vozes = Object.entries(r.vozes).map(([k, v]) => `${k} ${Math.round((100 * v) / total)}%`).join(" · ");
  console.log(`\n== ${nome}: ${vozes}`);
  for (const [k, lista] of [["negrito na mono", r.negrito], ["abaixo de 10px", r.pequeno], ["º/ª fora da mono", r.ordinal]]) {
    if (lista.length) console.log(`  ${k} (${lista.length}): ${lista.slice(0, 6).join(" | ")}`);
  }
  return r.negrito.length + r.pequeno.length;
}

async function pagina(init) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init.fn, init.arg);
  return page;
}

let problemas = 0;
for (const [nome, rota, pronta] of [
  ["início", "/", "text=BEM-VINDO A NIGHT CITY"],
  ["ficha", "/sheet", "text=BIO-MONITOR // FERIMENTOS"],
  ["dados", "/dice", "text=Rolagem de Perícia"],
  ["saguão da mesa", "/multiplayer", "text=Mesa Multiplayer"],
  ["netrunner IA", "/ai", "text=Assistente Netrunner IA"],
  ["lendas", "/presets", "text=Lendas de Night City"],
  ["PRD", "/prd", "text=PRD // NETSHEET ENGINE"],
  ["perfil (visitante)", "/profile", "text=Perfil de Visitante"],
  ["404", "/nao-existe", "text=ROTA NÃO ENCONTRADA"]
]) {
  const page = await pagina();
  await page.goto(BASE + rota);
  await page.locator(pronta).first().waitFor({ timeout: 15000 });
  problemas += await checar(page, nome);
}

const code = "TYPO-F1";
const res = await fetch(`${BASE}/api/rooms/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, name: "Mesa Tipo", gmHandle: "TYPO-GM", gmPeerId: "typo_gm" })
});
const { sessionToken } = await res.json();
if (!sessionToken) throw new Error(`semear a sala falhou (${res.status}) — o servidor precisa ser recém-subido`);
const gm = await pagina({
  fn: ([t]) => {
    sessionStorage.setItem("cyberpunk_peer_id", "typo_gm");
    sessionStorage.setItem("cyberpunk_session_token", t);
  },
  arg: [sessionToken]
});
await gm.goto(BASE + "/multiplayer");
await gm.getByPlaceholder("Digite o código da sala").fill(code);
await gm.getByRole("button", { name: /Entrar na Mesa/i }).click();
await gm.getByPlaceholder("Mensagem para a mesa...").waitFor();
await gm.getByPlaceholder("Mensagem para a mesa...").fill("teste da tipografia");
await gm.keyboard.press("Enter");
await gm.locator('button[title*="Death Save"]').click();
await gm.waitForTimeout(800);
problemas += await checar(gm, "mesa GM — chat");
for (const aba of [/Grid/i, /Iniciativa/i]) {
  await gm.getByRole("button", { name: aba }).first().click();
  await gm.waitForTimeout(600);
  problemas += await checar(gm, `mesa GM — ${aba.source}`);
}
await browser.close();
console.log(problemas ? `\n❌ ${problemas} problema(s)` : "\n✅ nenhum negrito sintético na mono e nenhum texto abaixo de 10 px");
process.exit(problemas ? 1 : 0);
