/**
 * Fase F (F.4.2) — ANIMAÇÃO QUE PARA (WCAG 2.2.2, nível A)
 * =======================================================
 * Conteúdo que se move sozinho por mais de 5 s precisa de um jeito de parar —
 * e o `prefers-reduced-motion` sozinho NÃO é técnica suficiente, pela W3C
 * (F.0a). A versão 10× menor certa: no @theme, toda animação decorativa com
 * iterações finitas, que param em ≤ 5 s — um lugar só para os `pulse`, os
 * `ping`, o `bounce` e o `pulse-glow`. O `spin` de carregando é essencial e
 * fica em loop. E, de boa prática, quem pede menos movimento não recebe
 * animação nenhuma além dele.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const animacoes = new Map<string, string>();
for (const m of theme.matchAll(/--animate-([\w-]+):\s*([^;]+);/g)) animacoes.set(m[1], m[2].trim());

/** Duração total em segundos: a duração × as iterações (sem número, uma). */
function total(valor: string): number {
  const partes = valor.split(/\s+/);
  const duracao = Number(partes.find((p) => /^[\d.]+s$/.test(p))?.slice(0, -1));
  const numero = partes.find((p) => /^\d+(\.\d+)?$/.test(p));
  const iteracoes = partes.includes('infinite') ? Infinity : numero ? Number(numero) : 1;
  return duracao * iteracoes;
}

describe('animação decorativa para em ≤ 5 s (WCAG 2.2.2)', () => {
  // As do Tailwind (pulse, ping, bounce) vêm em loop: têm de ser redefinidas aqui.
  for (const nome of ['pulse', 'ping', 'bounce', 'pulse-glow', 'glitch', 'fadeIn']) {
    it(`--animate-${nome} existe no @theme e termina em até 5 s`, () => {
      const valor = animacoes.get(nome);
      expect(valor, `--animate-${nome} não está no @theme`).toBeDefined();
      expect(total(valor!)).toBeLessThanOrEqual(5);
    });
  }

  it('nenhuma animação do @theme fica em loop (o spin, essencial, é o padrão do Tailwind)', () => {
    for (const [nome, valor] of animacoes) expect(`${nome}: ${valor}`).not.toMatch(/infinite/);
  });
});

describe('prefers-reduced-motion', () => {
  it('zera as animações e transições, fora o spin de carregando', () => {
    const bloco = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(bloco).toMatch(/:not\(\.animate-spin\)/);
    expect(bloco).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(bloco).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
