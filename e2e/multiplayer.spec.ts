/**
 * Fase 9 (T9.4) — E2E: MULTIPLAYER COM 2 NAVEGADORES
 * ===================================================
 * Dois contextos isolados (storage separado → peerIds diferentes) entram na
 * MESMA sala via UI e trocam mensagens em tempo real (WebSocket, com fallback
 * SSE) + rolagem server-authoritative (T5.4): o jogador A pede um death save e
 * o jogador B vê o resultado vindo do RNG do servidor.
 *
 * A sala é semeada via REST (o botão "Criar Mesa como GM" é gated por login —
 * coberto no auth.spec.ts). Cleanup em finally: todos saem via REST para a
 * sala ser encerrada e removida da persistência local/CI.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";

function uniqueCode(): string {
  return "E2E-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

async function seedRoom(code: string) {
  const res = await fetch(`${BASE}/api/rooms/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "Mesa E2E", gmHandle: "E2E-GM", gmPeerId: "e2e_gm" })
  });
  const data = await res.json();
  return { gmToken: data.sessionToken as string, room: data.room };
}

function sessionToken(page: Page): Promise<string | null> {
  return page.evaluate(() => sessionStorage.getItem("cyberpunk_session_token"));
}

test("chat realtime bidirecional + rolagem server-authoritative entre 2 navegadores", async ({ browser }) => {
  const code = uniqueCode();
  const { gmToken } = await seedRoom(code);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    // ---- Jogador A entra na sala pela UI ----
    await pageA.goto("/multiplayer");
    await pageA.getByPlaceholder("Digite o código da sala").fill(code);
    await pageA.getByRole("button", { name: /Entrar na Mesa/i }).click();
    await expect(pageA.getByPlaceholder("Mensagem para a mesa...")).toBeVisible();

    // ---- Jogador B entra na MESMA sala ----
    await pageB.goto("/multiplayer");
    await pageB.getByPlaceholder("Digite o código da sala").fill(code);
    await pageB.getByRole("button", { name: /Entrar na Mesa/i }).click();
    await expect(pageB.getByPlaceholder("Mensagem para a mesa...")).toBeVisible();

    // ---- Chat A → B ----
    await pageA.getByPlaceholder("Mensagem para a mesa...").fill("ola da sala A");
    await pageA.keyboard.press("Enter");
    await expect(pageB.getByText("ola da sala A")).toBeVisible();

    // ---- Chat B → A ----
    await pageB.getByPlaceholder("Mensagem para a mesa...").fill("oi da sala B");
    await pageB.keyboard.press("Enter");
    await expect(pageA.getByText("oi da sala B")).toBeVisible();

    // ---- Rolagem server-authoritative: A rola death save → B vê o resultado ----
    await pageA.locator('button[title*="Death Save"]').click();
    await expect(pageB.getByText(/🎲 Teste de Atordoamento\/Morte \(Death Save\):/)).toBeVisible();
  } finally {
    // Cleanup: todos saem via REST → sala encerrada (e linha removida do banco)
    const tokenA = await sessionToken(pageA);
    const tokenB = await sessionToken(pageB);
    for (const token of [tokenB, tokenA, gmToken]) {
      if (!token) continue;
      try {
        await fetch(`${BASE}/api/rooms/${code}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: token })
        });
      } catch {
        /* cleanup best-effort */
      }
    }
    await ctxA.close();
    await ctxB.close();
  }
});
