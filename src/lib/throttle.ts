/**
 * Chama `fn` no máximo uma vez a cada `ms`, sempre com os ÚLTIMOS argumentos
 * (só na borda final). Para o cursor do GM (R.4): ele ia a cada `mousemove`,
 * ~60/s, e o servidor aceita ~20/s por jogador. Com a borda final, a posição
 * em que o mouse parou sempre chega — um descarte no servidor poderia deixar o
 * cursor parado no lugar errado.
 */
export function trailingThrottle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;

  const call = (...args: A): void => {
    last = args;
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      const a = last;
      last = null;
      if (a) fn(...a);
    }, ms);
  };

  /** Descarta o que estava pendente (ex.: o componente desmontou). */
  call.cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    last = null;
  };

  return call;
}
