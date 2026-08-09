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

test("Bio-Monitor: clicar em nível de ferimento atualiza a penalidade", async ({ page }) => {
  await page.goto("/sheet");

  // Nível 4 → "REF −4, MA −4, consciência 50%"
  await page.getByRole("button", { name: "4", exact: true }).first().click();
  await expect(page.getByText("REF −4, MA −4, consciência 50%")).toBeVisible();

  // Nível 10 → morte iminente + death save desabilitado
  await page.getByRole("button", { name: "10", exact: true }).first().click();
  await expect(page.getByText("Morte iminente").first()).toBeVisible();
  const deathSave = page.getByRole("button", { name: /1d10 ≤ BODY/i });
  await expect(deathSave).toBeDisabled();
});
