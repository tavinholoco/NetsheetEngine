/**
 * Fase F (F.4) — o `cn` (tailwind-merge) e os tokens do @theme
 * ===========================================================
 * O tailwind-merge não lê o @theme. Um nome que ele não conhece cai no grupo
 * "cor" e briga com a cor de verdade — e um dos dois some do className. Achado
 * no modal de login (F.4.2): `shadow-glow-30` sumia ao lado de
 * `shadow-accent-500/30` (box-shadow: none), e `text-micro` sumia ao lado de
 * `text-muted`. Antes da F.2 e da F.1 eram valores arbitrários
 * (`shadow-[…]`, `text-[10px]`), que ele reconhece.
 *
 * O teste deriva os tokens do próprio @theme: um token de tamanho novo que o
 * `cn` não conheça falha aqui.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cn } from '../lib/utils';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const nomes = (prefixo: string) =>
  [...theme.matchAll(new RegExp(`--${prefixo}-([\\w-]+):`, 'g'))].map((m) => m[1]);

describe('cn conhece os tokens de tamanho do @theme', () => {
  it('o @theme tem os tokens que este teste confere', () => {
    expect(nomes('text').length).toBeGreaterThan(0);
    expect(nomes('shadow').length).toBeGreaterThan(0);
    expect(nomes('drop-shadow').length).toBeGreaterThan(0);
    expect(nomes('tracking').length).toBeGreaterThan(0);
  });

  for (const t of nomes('text')) {
    it(`text-${t} não some ao lado de uma cor de texto, e briga com outro tamanho`, () => {
      expect(cn(`text-${t} text-muted`)).toBe(`text-${t} text-muted`);
      expect(cn(`text-xs text-${t}`)).toBe(`text-${t}`);
    });
  }

  for (const s of nomes('shadow')) {
    it(`shadow-${s} não some ao lado da cor da sombra`, () => {
      expect(cn(`shadow-${s} shadow-accent-500/30`)).toBe(`shadow-${s} shadow-accent-500/30`);
    });
  }

  for (const s of nomes('drop-shadow')) {
    it(`drop-shadow-${s} não some ao lado da cor`, () => {
      expect(cn(`drop-shadow-${s} drop-shadow-signal-400/90`)).toBe(`drop-shadow-${s} drop-shadow-signal-400/90`);
    });
  }

  for (const t of nomes('tracking')) {
    it(`tracking-${t} briga com outro tracking (o último vence)`, () => {
      expect(cn(`tracking-wide tracking-${t}`)).toBe(`tracking-${t}`);
    });
  }
});
