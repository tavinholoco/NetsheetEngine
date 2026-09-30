/**
 * R.9 (continuação) — a versão que a interface mostra vem do package.json.
 * Até 29/09 havia "v0.4.0" escrito à mão em seis lugares, e a tela mostrava
 * 0.4.0 com o projeto em 0.4.3 — o /api/health tinha sido consertado, a tela
 * não. Este teste impede a versão escrita à mão de voltar.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import pkg from '../../package.json';
import { APP_VERSION } from '../version';

/** Citam versões passadas de propósito: o histórico de lançamentos, e o
 *  comentário do version.ts que conta por que ele existe. */
const HISTORICO = new Set(['PatchNotesFeed.tsx', 'version.ts']);

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : arquivos(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe('versão da interface', () => {
  it('APP_VERSION é a do package.json', () => {
    expect(APP_VERSION).toBe(`v${pkg.version}`);
  });

  it('nenhum arquivo da interface escreve a versão à mão', () => {
    const src = path.resolve(__dirname, '..');
    const achados = arquivos(src)
      .filter((f) => !HISTORICO.has(path.basename(f)))
      .flatMap((f) =>
        fs
          .readFileSync(f, 'utf8')
          .split(/\r?\n/)
          .map((linha, i) => ({ f: path.relative(src, f), i: i + 1, linha }))
          .filter(({ linha }) => /(^|[\s'"`>])v\d+\.\d+\.\d+/.test(linha))
      )
      .map(({ f, i }) => `${f}:${i}`);
    expect(achados).toEqual([]);
  });
});
