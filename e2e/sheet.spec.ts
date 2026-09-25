/**
 * Fase 9 (T9.4) — E2E: CRIAR/EDITAR FICHA (modo visitante)
 * ========================================================
 * O criador de ficha roda sem login (persistência local no navegador):
 * renderiza a ficha padrão, calcula estatísticas derivadas e persiste a
 * edição do handle entre reloads (fallback localStorage da T2.13).
 */
import { test, expect } from "@playwright/test";

test("ficha padrão renderiza com estatísticas derivadas (BTM, Humanidade)", async ({ page }) => {
  await page.goto("/sheet");

  await expect(page.getByText("BIO-MONITOR // FERIMENTOS")).toBeVisible();
  await expect(page.getByText("ATRIBUTOS PRIMÁRIOS & DERIVADOS")).toBeVisible();

  // Ficha padrão: todos os atributos 5 → BTM −2, Humanidade 50, Run 15
  await expect(page.getByText("ESTATÍSTICAS DERIVADAS")).toBeVisible();
  // (o JSX escreve "Humanidade" — o uppercase visual vem do CSS)
  await expect(page.getByText("Humanidade", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("50", { exact: true }).first()).toBeVisible();

  // Bio-Monitor com 11 níveis (0..10)
  await expect(page.getByText("Saudável (OK)", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "10", exact: true }).first()).toBeVisible();
});

test("editar o handle persiste após reload (modo visitante / localStorage)", async ({ page }) => {
  await page.goto("/sheet");

  const handleInput = page.getByPlaceholder("Ex: Silverhand, V, Spider");
  await expect(handleInput).toBeVisible();
  await handleInput.fill("E2E-Choomba");
  // blur para disparar onChange/autosave
  await page.keyboard.press("Tab");

  await page.reload();
  await expect(page.getByPlaceholder("Ex: Silverhand, V, Spider")).toHaveValue("E2E-Choomba");
});

test("Bio-Monitor: o nível de ferimento aplica o efeito do livro e os alvos dos saves", async ({ page }) => {
  // Fase C (C.5, C.7). Este teste codificava a tabela de regra de casa
  // ("REF −4, MA −4, consciência 50%") e o death save DESLIGADO no Mortal 6 —
  // que era o bug. A ficha padrão tem BODY 5 e REF/INT/COOL 5.
  await page.goto("/sheet");
  const deathSave = page.getByRole("button", { name: /death · 1d10 ≤/i });
  const stunSave = page.getByRole("button", { name: /stun · 1d10 ≤/i });

  // Sério (2): REF −2; stun em BODY − 1; death save não é exigido fora do Mortal.
  await page.getByRole("button", { name: "2", exact: true }).first().click();
  await expect(page.getByText("REF −2", { exact: true })).toBeVisible();
  await expect(stunSave).toHaveText(/1d10 ≤ 4/);
  await expect(deathSave).toBeDisabled();

  // Mortal 0 (4): REF, INT e COOL a um terço — e a ficha avisa com que valor se rola.
  await page.getByRole("button", { name: "4", exact: true }).first().click();
  await expect(page.getByText("REF, INT, COOL ÷3")).toBeVisible();
  await expect(page.getByText(/rola com 2/i).first()).toBeVisible();

  // Mortal 6 (10): ainda vivo — o death save LIGA, contra BODY − 6.
  await page.getByRole("button", { name: "10", exact: true }).first().click();
  await expect(deathSave).toBeEnabled();
  await expect(deathSave).toHaveText(/1d10 ≤ -1/);
});
