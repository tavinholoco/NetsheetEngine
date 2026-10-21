// L.5 (ARQ-07) — o ESLint em modo mínimo: os presets recomendados do ESLint e
// do typescript-eslint, sem regra que precise de tipos (o `tsc --noEmit` já
// confere os tipos, e o lint com tipos é lento), mais duas regras que o plano
// pede: nenhum `any` e nenhum `console.*` no cliente. O CI roda com
// `--max-warnings 0`: aviso também falha. Exceção é nomeada, no lugar, com o
// motivo — como as do `audit-ci`.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**",
      // Fora do repositório: os worktrees das sessões, e pastas locais não versionadas.
      ".claude/**", ".freebuff/**",
      // A sonda da J.1d: não rastreada, não commitar (o plano, J.1d).
      "src/__tests__/zz-j-probe.integration.test.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // `_` na frente diz "sem uso de propósito": o parâmetro que a assinatura
      // pede, ou o campo tirado do objeto com o resto (`{ sheet: _ficha, ...resto }`).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true }
      ]
    }
  },
  {
    // O cliente: o navegador, e nenhum `console.*` (o G.17) — erro vai para a
    // tela ou some; o servidor tem o `logger`.
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    rules: { "no-console": "error" }
  },
  {
    // O servidor, os scripts, o E2E e as configurações rodam no Node.
    files: ["server.ts", "server/**/*.ts", "scripts/**/*.{js,mjs,cjs,ts}", "e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node }
  },
  {
    // Os roteiros do Playwright mandam funções para rodar dentro da página
    // (`page.evaluate`): o `window` e o `document` de lá.
    files: ["scripts/multiplayer/**", "scripts/visual/**", "e2e/**"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    // Os testes: o Node do Vitest e o navegador do jsdom, e o `console` é deles.
    files: ["src/__tests__/**", "src/test/**"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { "no-console": "off" }
  }
);
