import { useCallback, useRef, useState } from 'react';

/**
 * G.06 — uma ação por vez, por chave. Enquanto a requisição de uma chave está
 * em voo, o segundo clique não sai, e `isBusy` desliga o botão — com o Render
 * acordando (~1 min), é o que mostra que a ação foi pedida. O ref barra o clique
 * que chega antes do render; o estado só desenha.
 */
export function useInFlight() {
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  const run = useCallback((key: string, action: () => Promise<unknown> | void): void => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(action());
    } catch (e) {
      pending = Promise.reject(e);
    }
    // O erro é de quem chamou (o banner da mesa); aqui só se solta a chave.
    pending
      .catch(() => {})
      .finally(() => {
        inFlight.current.delete(key);
        setBusy(new Set(inFlight.current));
      });
  }, []);

  const isBusy = useCallback((key: string) => busy.has(key), [busy]);

  return { run, isBusy };
}
