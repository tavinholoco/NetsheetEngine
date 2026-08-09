/**
 * Fase 9 (T9.4) — E2E: AUTH UI (modo visitante)
 * ==============================================
 * O login real (Google OAuth / email) exige credenciais do Supabase — fora de
 * escopo do CI. Este teste valida o FLUXO DE UI do AuthModal em modo visitante:
 * abrir pelo perfil, conferir as opções (Google + e-mail/senha), alternar para
 * cadastro e fechar. O gating de "Criar Mesa como GM" (disabled sem login)
 * também é coberto aqui.
 */
import { test, expect } from "@playwright/test";

test("AuthModal abre do perfil em modo visitante e expõe Google + e-mail/senha", async ({ page }) => {
  await page.goto("/profile");

  // Perfil de visitante
  await expect(page.getByText("Perfil de Visitante")).toBeVisible();

  // Abre o modal
  await page.getByRole("button", { name: /Acessar Conta \/\/ Edgerunner/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Autenticação Net-Access", { exact: false })).toBeVisible();

  // Opções de autenticação presentes
  await expect(page.getByRole("button", { name: /Login com Google/i })).toBeVisible();
  await expect(page.getByPlaceholder("edgerunner@nightcity.net")).toBeVisible();
  await expect(page.getByPlaceholder("••••••••")).toBeVisible();

  // Alterna para cadastro e volta
  await page.getByRole("button", { name: /Cadastre-se/i }).click();
  await expect(page.getByText("Cadastrar Novo Edgerunner")).toBeVisible();
  await expect(page.getByPlaceholder("ex: Johnny Silverhand")).toBeVisible();

  // Fecha o modal
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("Criar Mesa como GM fica desabilitada sem login (gating de auth)", async ({ page }) => {
  await page.goto("/multiplayer");
  await expect(page.getByText("Mesa Multiplayer", { exact: false }).first()).toBeVisible();

  const createBtn = page.getByRole("button", { name: /Criar Mesa como GM/i });
  await expect(createBtn).toBeDisabled();

  // Aviso de modo visitante presente
  await expect(page.getByText(/modo visitante/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Acessar Conta/i }).first()).toBeVisible();
});
