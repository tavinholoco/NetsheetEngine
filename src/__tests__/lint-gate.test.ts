/**
 * L.5 (ARQ-07) — o ESLint no portão do CI
 * ========================================
 * A L.5 zerou os 20 `any` fora de teste (o E.16 tinha sete no `server.ts`), os
 * 27 dos testes e os 12 `console.*` do cliente (o G.17). O que impede de
 * voltarem é o lint no CI com `--max-warnings 0`. Aqui se trava a regra (o
 * ESLint de verdade, sobre um trecho) e a ligação (o script e o passo do CI).
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const raiz = path.resolve(__dirname, '..', '..');
const ler = (f: string) => fs.readFileSync(path.join(raiz, f), 'utf8');
const TRECHO = 'export const x: any = 1;\nconsole.log(x);\n';

async function regras(arquivo: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: raiz });
  const [r] = await eslint.lintText(TRECHO, { filePath: path.join(raiz, arquivo) });
  return r.messages.map((m) => m.ruleId ?? '(parse)').sort();
}

describe('L.5 — a regra', () => {
  it('no cliente, o any e o console.* são erro', async () => {
    expect(await regras('src/lib/fixture-l5.ts')).toEqual(['@typescript-eslint/no-explicit-any', 'no-console']);
  }, 30_000);

  it('no servidor, o any é erro; o console é do logger', async () => {
    expect(await regras('server/fixture-l5.ts')).toEqual(['@typescript-eslint/no-explicit-any']);
  }, 30_000);
});

describe('L.5 — a ligação no CI', () => {
  it('o lint é o ESLint com --max-warnings 0, e o typecheck é o tsc', () => {
    const scripts = JSON.parse(ler('package.json')).scripts as Record<string, string>;
    expect(scripts.lint).toMatch(/^eslint .*--max-warnings 0/);
    expect(scripts.typecheck).toBe('tsc --noEmit');
  });

  it('o job do CI roda os dois', () => {
    const ci = ler('.github/workflows/ci.yml');
    expect(ci).toMatch(/run: npm run typecheck/);
    expect(ci).toMatch(/run: npm run lint/);
  });
});
