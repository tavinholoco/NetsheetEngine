import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 9 (T9.4) — E2E PLAYWRIGHT (auth UI, ficha, multiplayer 2 navegadores)
 * =========================================================================
 * Roda contra o SERVIDOR DE PRODUÇÃO (dist/server.cjs) — não o dev server
 * com HMR. O build precisa existir: `npm run build` (no CI roda antes; local,
 * rode os binários direto por causa do `&` no caminho da pasta).
 *
 * Local:    node node_modules/@playwright/test/cli.js test
 * CI:       job e2e no .github/workflows/ci.yml (instala chromium + build + test)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // salas compartilhadas entre testes do multiplayer
  workers: 1, // um servidor, um fluxo por vez (evita corrida de sala)
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node dist/server.cjs",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { NODE_ENV: "production", PORT: "3000" }
  }
});
