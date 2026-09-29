/**
 * Revisão pós-D (R.4) — o cursor do GM ia a cada `mousemove` (~60/s). O
 * servidor passou a aceitar ~20/s de awareness por jogador; o cliente manda no
 * máximo um a cada 60 ms, e sempre a última posição.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { trailingThrottle } from '../lib/throttle';

afterEach(() => {
  vi.useRealTimers();
});

describe('trailingThrottle', () => {
  it('60 movimentos num segundo viram ~16 envios, e o último é a posição final', () => {
    vi.useFakeTimers();
    const enviados: Array<[number, number]> = [];
    const send = trailingThrottle((x: number, y: number) => enviados.push([x, y]), 60);

    for (let i = 1; i <= 60; i++) {
      send(i / 60, 0.5);
      vi.advanceTimersByTime(1000 / 60);
    }
    vi.advanceTimersByTime(60);

    expect(enviados.length).toBeLessThanOrEqual(17);
    expect(enviados.length).toBeGreaterThanOrEqual(15);
    expect(enviados[enviados.length - 1]).toEqual([1, 0.5]);
  });

  it('cancel descarta o pendente', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const send = trailingThrottle(fn, 60);
    send(1);
    send.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});
