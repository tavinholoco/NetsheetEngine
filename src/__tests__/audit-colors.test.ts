/**
 * Fase F (F.0e) — o contador de cor escrita à mão
 * ================================================
 * O critério de pronto da F depende deste número, e a F.2.10 o põe no CI
 * exigindo zero. O que se testa é o que a F.0a mostrou que as contagens à mão
 * erravam: o `rgba` colado num `_` dentro de `shadow-[…]`, o hex que é cor ×
 * o "#123" de comentário, o `@theme` (onde os tokens moram) fora da conta, e a
 * exceção nomeada que cobre só até o número dela.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { aplicarExcecoes, codigoDeSaida, contarTexto, monoComNegrito, type Excecao } from '../../scripts/audit-colors';

describe('contarTexto — código (.ts/.tsx)', () => {
  it('conta utilitário da paleta com variante e opacidade, e ignora token e cor sem tom', () => {
    const c = contarTexto('className="hover:bg-red-500/60 text-slate-400 text-accent-400 border-red"', 'codigo');
    expect(c.paleta).toBe(2);
  });

  it('conta o rgba dentro do valor arbitrário de sombra', () => {
    expect(contarTexto('shadow-[0_0_12px_rgba(239,68,68,0.5)]', 'codigo').rgba).toBe(1);
    expect(contarTexto('drop-shadow-[0_0_8px_rgba(6,182,212,1)] rgb(0 0 0)', 'codigo').rgba).toBe(2);
  });

  it('hex só conta em string ou valor arbitrário, não em comentário', () => {
    expect(contarTexto("color: '#ef4444'", 'codigo').hex).toBe(1);
    expect(contarTexto('bg-[#020617]', 'codigo').hex).toBe(1);
    expect(contarTexto('// veio do PR #123, ver #22', 'codigo').hex).toBe(0);
  });

  it('black e white vão numa coluna à parte', () => {
    const c = contarTexto('text-black bg-white/80 hover:border-white text-red-500', 'codigo');
    expect(c.pretoBranco).toBe(3);
    expect(c.paleta).toBe(1);
  });
});

describe('contarTexto — CSS', () => {
  it('o bloco @theme fica fora da conta; o resto do arquivo conta', () => {
    const css = [
      '@theme {',
      '  --color-accent: #22d3ee;',
      '  --shadow-glow: 0 0 12px rgba(0, 0, 0, 0.5);',
      '}',
      'body { background-color: #020617; }',
      '.x { background: rgba(15, 23, 42, 0.6); }'
    ].join('\n');
    const c = contarTexto(css, 'css');
    expect(c.hex).toBe(1);
    expect(c.rgba).toBe(1);
  });
});

describe('aplicarExcecoes — exceção nomeada cobre só até o número dela', () => {
  const ex: Excecao = {
    arquivo: 'src/a.tsx',
    categoria: 'hex',
    ate: 5,
    motivo: 'teste',
    gatilho: 'teste',
    revisadoEm: '30/09/2026'
  };
  const linha = { arquivo: 'src/a.tsx', paleta: 3, rgba: 0, hex: 7, pretoBranco: 0 };

  it('o que passar do teto volta a contar', () => {
    expect(aplicarExcecoes([linha], [ex])[0]).toMatchObject({ hex: 2, paleta: 3 });
  });

  it('não vale para outro arquivo nem outra categoria', () => {
    expect(aplicarExcecoes([{ ...linha, arquivo: 'src/b.tsx' }], [ex])[0].hex).toBe(7);
    expect(aplicarExcecoes([linha], [{ ...ex, categoria: 'rgba' }])[0].hex).toBe(7);
  });
});

/*
 * F.1.2 — a Share Tech Mono só tem o peso 400: pedir negrito a ela faz o
 * navegador inventar um (99 elementos na ficha, na F.0a). Conta o trecho de
 * classe que junta `font-mono` e peso; o ternário não soma alternativas.
 */
describe('monoComNegrito — negrito pedido à mono', () => {
  it('conta o trecho com font-mono e peso, e não o que tem só um dos dois', () => {
    expect(monoComNegrito('<span className="font-mono font-bold">1</span>')).toBe(1);
    expect(monoComNegrito('<span className="font-black text-xl font-mono">1</span>')).toBe(1);
    expect(monoComNegrito('<span className="font-mono text-xl">1</span><b className="font-bold">x</b>')).toBe(0);
  });

  it('alternativas de ternário não se somam', () => {
    expect(monoComNegrito('className={`x ${a ? "font-mono" : "font-bold"}`}')).toBe(0);
  });
});

/**
 * F.2.10 — a trava: o CI roda o contador e ele tem de sair com erro quando
 * sobra cor à mão ou negrito na mono. `black`/`white` não contam.
 */
describe('codigoDeSaida — a trava do CI', () => {
  const zero = { paleta: 0, rgba: 0, hex: 0, pretoBranco: 0 };

  it('zero cor à mão e zero negrito na mono: passa, mesmo com black/white', () => {
    expect(codigoDeSaida({ ...zero, pretoBranco: 109 }, 0)).toBe(0);
  });

  it('uma cor de paleta, um rgba ou um hex: falha', () => {
    expect(codigoDeSaida({ ...zero, paleta: 1 }, 0)).toBe(1);
    expect(codigoDeSaida({ ...zero, rgba: 1 }, 0)).toBe(1);
    expect(codigoDeSaida({ ...zero, hex: 1 }, 0)).toBe(1);
  });

  it('negrito pedido à mono: falha', () => {
    expect(codigoDeSaida(zero, 1)).toBe(1);
  });
});
