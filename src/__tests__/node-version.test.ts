/**
 * R.8 (continuação, 10/10/2026) — a produção roda o Node que o CI testa.
 * A R.8 fixou o 24 no `.node-version` supondo que o Render o lia. Não lê: o
 * serviço é Docker, e quem decide o Node é o `FROM` do Dockerfile — que
 * ficou em `node:22-alpine` enquanto o CI testava o 24. Só o log do build no
 * painel mostrou (01.10). Este teste impede os dois de divergirem de novo.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(__dirname, '..', '..');
const ler = (f: string) => fs.readFileSync(path.join(raiz, f), 'utf8');

describe('versão do Node', () => {
  it('todo FROM node do Dockerfile usa a versão maior do .node-version', () => {
    const maior = ler('.node-version').trim().split('.')[0];
    const imagens = [...ler('Dockerfile').matchAll(/^FROM\s+node:(\S+)/gm)].map((m) => m[1]);
    expect(imagens.length).toBeGreaterThan(0);
    for (const tag of imagens) expect(tag.split(/[.-]/)[0], `FROM node:${tag}`).toBe(maior);
  });
});
