/**
 * Fase F (F.2.1, F.2.4) — a conversão de cor para token
 * ======================================================
 * A tabela `scripts/color-map.json` é a especificação; o script só a aplica.
 * O que se testa é o que faria a conversão mudar cor ou rotular errado: o
 * prefixo, a variante e a opacidade passando intactos; o neutro pelo tipo de
 * uso; o brilho virando escala + token; e as famílias "à mão" (vermelho, rosa)
 * ficando literais para a F.2b. A prova de que o visual não mudou é a captura
 * da F.2.6 — aqui se prova a regra.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { converter, lerMapa } from '../../scripts/migrate-colors';

const mapa = lerMapa();
const conv = (s: string) => converter(s, mapa).texto;

describe('classes da paleta → rampa por papel', () => {
  it('troca a família e mantém prefixo, variante, tom e opacidade', () => {
    expect(conv('hover:bg-cyan-500/40 text-yellow-400 border-l-purple-500 ring-emerald-400/60')).toBe(
      'hover:bg-accent-500/40 text-signal-400 border-l-cyber-500 ring-ok-400/60'
    );
    expect(conv("color: 'text-amber-400'")).toBe("color: 'text-caution-400'");
  });

  it('o neutro vai pelo tipo de uso × tom, e o tom sem nome cai na rampa night', () => {
    expect(conv('bg-slate-950 bg-slate-900 border-slate-800 text-slate-400 via-slate-950')).toBe(
      'bg-surface bg-raised border-line text-muted via-surface'
    );
    expect(conv('bg-slate-700 border-slate-500 border-t-slate-800')).toBe('bg-night-700 border-night-500 border-t-line');
  });

  it('vermelho, rosa e as outras famílias à mão ficam literais', () => {
    const s = 'text-red-500 bg-pink-600 text-rose-700 text-orange-400 bg-sky-400 text-teal-400';
    expect(conv(s)).toBe(s);
  });
});

describe('brilho → escala do @theme + cor do token', () => {
  it('geometria vira shadow-glow-N e a cor vira token com a opacidade', () => {
    expect(conv('p-2 shadow-[0_0_15px_rgba(6,182,212,0.4)]')).toBe('p-2 shadow-glow-15 shadow-accent-500/40');
    expect(conv('"hover:shadow-[0_0_12px_rgba(250,204,21,1)]"')).toBe('"hover:shadow-glow-12 hover:shadow-signal-400"');
    expect(conv(' drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]')).toBe(' drop-shadow-glow-12 drop-shadow-white/15');
  });

  it('o brilho vermelho e o rosa ficam para a F.2b', () => {
    const s = ' shadow-[0_0_12px_rgba(239,68,68,0.5)] shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    expect(conv(s)).toBe(s);
  });
});

it('é idempotente: converter duas vezes dá o mesmo que uma', () => {
  const s = 'bg-slate-950 text-cyan-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] text-red-400';
  expect(conv(conv(s))).toBe(conv(s));
});
