/**
 * Fase F (F.2.7, F.2.8) — CONTRASTE DOS TOKENS DE TEXTO
 * =====================================================
 * O WCAG 1.4.3 (AA) pede 4,5:1 para texto. A F.0a mediu, no navegador, o texto
 * apagado (`text-slate-500/600`, hoje `subtle`/`faint`) em 2,4–4,2:1 e a escala
 * de ferimento de Mortal 2 a 6 em 3,0–4,5:1 — quanto mais perto da morte,
 * menos legível. Desde a F.2 a cor mora no @theme: o conserto é trocar o valor
 * num lugar só, e este teste trava o valor.
 *
 * Lê o @theme de src/index.css, resolve os `var()` e converte oklch → sRGB
 * (as matrizes do OKLab, de Björn Ottosson). Os fundos são `surface` e
 * `raised`: um painel `bg-raised/70` sobre `surface` fica entre os dois, e o
 * contraste contra ele não é menor que o pior dos dois.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WOUND_LEVEL_NAMES, WOUND_MAX } from '../utils/injuryRules';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const tokens = new Map<string, string>();
for (const m of theme.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());

function resolver(nome: string, profundidade = 0): string {
  const valor = tokens.get(nome);
  if (valor === undefined) throw new Error(`token --color-${nome} não existe no @theme`);
  const ref = valor.match(/^var\(--color-([\w-]+)\)$/);
  if (!ref) return valor;
  if (profundidade > 5) throw new Error(`var() em ciclo em --color-${nome}`);
  return resolver(ref[1], profundidade + 1);
}

/** oklch(L% C h) → luminância relativa (WCAG), em sRGB linear recortado. */
function luminancia(nome: string): number {
  const valor = resolver(nome);
  const m = valor.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`--color-${nome}: só oklch(L% C h) é entendido, veio ${valor}`);
  const L = Number(m[1]) / 100;
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const recorte = (v: number) => Math.min(1, Math.max(0, v));
  const R = recorte(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const G = recorte(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const B = recorte(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contraste(texto: string, fundo: string): number {
  const [a, b] = [luminancia(texto), luminancia(fundo)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const FUNDOS = ['surface', 'raised'];
const AA = 4.5;

describe('texto neutro (F.2.8) — 4,5:1 sobre surface e raised', () => {
  for (const texto of ['fg-strong', 'fg', 'fg-soft', 'muted', 'subtle', 'faint']) {
    for (const fundo of FUNDOS) {
      it(`${texto} sobre ${fundo}`, () => {
        expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

// Que cada nível pinta com o seu wound-N, o injury-rules.test confere.
describe('escala de dano, wound-* (F.2.7)', () => {
  for (let i = 0; i <= WOUND_MAX; i++) {
    for (const fundo of FUNDOS) {
      it(`wound-${i} (${WOUND_LEVEL_NAMES[i].name}) sobre ${fundo}: 4,5:1`, () => {
        expect(contraste(`wound-${i}`, fundo)).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it('do Crítico à Morte Iminente a gravidade clareia — nunca escurece', () => {
    for (let i = 4; i <= WOUND_MAX; i++) {
      expect(luminancia(`wound-${i}`)).toBeGreaterThanOrEqual(luminancia(`wound-${i - 1}`));
    }
  });
});
