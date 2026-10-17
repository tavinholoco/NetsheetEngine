/**
 * J.11 (17/10/2026) — a allowlist de caminhos do gitleaks não esconde o que deve ser varrido.
 * O gitleaks da versão do CI (v8.23.3) testa cada padrão de `[allowlist].paths` contra o caminho
 * **sem âncora** (`regexMatched` → `FindString`): o `\.git`, escrito para a pasta `.git`, casava com
 * `.github/workflows/` — onde moram as referências aos secrets do CI —, e o scanner não olhava os
 * workflows. Este teste lê os padrões como o gitleaks os usa (o padrão em qualquer ponto do caminho)
 * e confere os dois lados: nenhum arquivo rastreado fica de fora, a não ser os que devem; e o que deve
 * ficar de fora, fica.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '..', '..');

/** O que fica fora da varredura de propósito: gerado, de terceiros, ou onde o segredo mora local (gitignored). */
const DE_FORA = [
  'package-lock.json',
  'bun.lock',
  'node_modules/yjs/dist/yjs.cjs',
  'dist/server.cjs',
  'dist/assets/index-abc123.js',
  '.git/config',
  '.env.local',
  'supabase/.env',
  // O `gitleaks dir` no Windows entrega o caminho com barra invertida (medido com o v8.23.3, 17/10/2026).
  'node_modules\\yjs\\dist\\yjs.cjs',
  'dist\\server.cjs',
  '.git\\config',
  'supabase\\.env',
];

/** Não rastreados hoje, e varridos: cada um casava com um padrão sem âncora. */
const VARRIDOS_DE_EXEMPLO = [
  'src/rules/distance.ts',
  'docs/node_modules.md',
  '.env.local.example',
  'supabase/.env.example',
  '.github\\workflows\\ci.yml',
];

/** Os padrões de `paths` em `[allowlist]` — as strings literais (`'''…'''`) da lista, como o TOML as lê. */
function padroesDaAllowlist(): string[] {
  const toml = fs.readFileSync(path.join(raiz, '.gitleaks.toml'), 'utf8');
  const inicio = /^\[allowlist\][\s\S]*?^paths\s*=\s*\[/m.exec(toml);
  if (!inicio) throw new Error('.gitleaks.toml sem [allowlist].paths');
  // Um item por vez — espaço, comentário, vírgula ou string literal —, até o `]` que fecha a lista.
  const item = /\s+|#[^\n]*|,|'''([\s\S]*?)'''|\]/y;
  const padroes: string[] = [];
  for (let pos = inicio.index + inicio[0].length; ; pos = item.lastIndex) {
    item.lastIndex = pos;
    const m = item.exec(toml);
    if (!m) throw new Error(`[allowlist].paths: só strings literais ('''…''') — achei ${toml.slice(pos, pos + 30)}`);
    if (m[0] === ']') return padroes;
    if (m[1] !== undefined) padroes.push(m[1]);
  }
}

describe('allowlist de caminhos do gitleaks (J.11)', () => {
  const padroes = padroesDaAllowlist().map((p) => new RegExp(p));
  // `RegExp.test` procura o padrão em qualquer ponto do texto — o `FindString` do gitleaks.
  const pulado = (caminho: string) => padroes.some((re) => re.test(caminho));

  it('nenhum arquivo rastreado fica fora da varredura, a não ser os que devem', () => {
    const rastreados = execFileSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    expect(rastreados.length).toBeGreaterThan(100);
    const varridos = [...rastreados.filter((f) => !DE_FORA.includes(f)), ...VARRIDOS_DE_EXEMPLO];
    expect(varridos.filter(pulado)).toEqual([]);
  });

  it('o que deve ficar de fora continua de fora', () => {
    expect(padroes.length).toBeGreaterThan(0);
    for (const caminho of DE_FORA) expect(pulado(caminho), caminho).toBe(true);
  });
});
