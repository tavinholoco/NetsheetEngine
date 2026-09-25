import type { Rng } from '../rules/dice';

/**
 * RNG de teste: devolve os valores da fila, na ordem. Falha alto se a fila
 * acabar ou se um valor não couber no dado pedido — um teste que pede mais
 * dados do que roteirizou está testando outra coisa.
 */
export function scriptedRng(values: readonly number[]): Rng & { remaining: () => number } {
  const queue = [...values];
  const rng = (sides: number): number => {
    const v = queue.shift();
    if (v === undefined) throw new Error(`scriptedRng: fila vazia ao pedir 1d${sides}`);
    if (!Number.isInteger(v) || v < 1 || v > sides) throw new Error(`scriptedRng: ${v} não é face de 1d${sides}`);
    return v;
  };
  return Object.assign(rng, { remaining: () => queue.length });
}
