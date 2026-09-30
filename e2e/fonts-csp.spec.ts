/**
 * Fase F (F.0d) — AS FONTES CARREGAM COM O HELMET ATIVO
 * =====================================================
 * O ARQ-09 viveu desde a Fase 10 porque o helmet é pulado em dev: o
 * `@import` do Google Fonts passava no `npm run dev` e o CSP de produção
 * (`style-src 'self'`, `font-src 'self'`) o recusava no ar, em silêncio —
 * a tela caía em Cascadia/Consolas. Este E2E roda contra o build de
 * produção (o `webServer` do playwright.config.ts), então o CSP é o do ar.
 *
 * Duas provas por tela:
 *  1. nenhuma violação de CSP — pelo evento `securitypolicyviolation` e pelo
 *     console. Pega também qualquer recurso externo que alguém acrescente;
 *  2. as faces carregadas: `document.fonts` com `status === "loaded"`.
 *     NUNCA `document.fonts.check()`: ele devolve `true` até para fonte
 *     inexistente (MDN), então passaria com o bug de pé.
 */
import { test, expect, type Page } from "@playwright/test";

const FAMILIAS = ["Rajdhani", "Share Tech Mono"];

const TELAS: { path: string; pronta: (page: Page) => ReturnType<Page["getByText"]> }[] = [
  { path: "/", pronta: (page) => page.getByText("BEM-VINDO A NIGHT CITY") },
  { path: "/sheet", pronta: (page) => page.getByText("BIO-MONITOR // FERIMENTOS") },
  { path: "/multiplayer", pronta: (page) => page.getByPlaceholder("Digite o código da sala") }
];

test("as fontes carregam com o CSP de produção, sem violação, nas três telas", async ({ page }) => {
  const console_csp: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) console_csp.push(msg.text());
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });

  const vistas = new Set<string>();
  for (const tela of TELAS) {
    await page.goto(tela.path);
    await expect(tela.pronta(page)).toBeVisible();

    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ""), status: f.status }));
    });
    const violacoes = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

    expect(violacoes, `violação de CSP em ${tela.path}`).toEqual([]);
    expect(faces.filter((f) => f.status === "error"), `face que falhou em ${tela.path}`).toEqual([]);
    const carregadas = faces.filter((f) => f.status === "loaded").map((f) => f.family);
    expect(carregadas.length, `nenhuma face carregada em ${tela.path}`).toBeGreaterThan(0);
    carregadas.forEach((f) => vistas.add(f));
  }

  expect(console_csp, "aviso de CSP no console").toEqual([]);
  // As duas faces da identidade aparecem em algum lugar das três telas.
  for (const familia of FAMILIAS) expect([...vistas]).toContain(familia);
});
