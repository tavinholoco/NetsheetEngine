/**
 * Revisão pós-D (R.4 — SEC-10) — OS TETOS DO WEBSOCKET
 * =====================================================
 * O REST sempre teve limitador (global, de sala e de chat) e teto de corpo
 * (1 MB). O WebSocket, que é o transporte principal da mesa, não tinha nada:
 * o chat pelo WS escapava do limite de 30/min, e o `maxPayload` era o padrão
 * do `ws`, 100 MiB. Como cada mensagem reenvia a sala inteira a todas as
 * conexões (ARQ-01), um participante com um script gastava a banda do
 * workspace do Render em minutos — e a cota estourada desliga os dois serviços
 * até o mês seguinte.
 *
 * Os números seguem os do REST onde há equivalente. O que é só do WS tem o
 * porquê ao lado. As contas são por JOGADOR (sala + peerId), não por conexão:
 * abrir mais sockets não compra mais cota — e o número de sockets por jogador
 * também tem teto, porque cada socket a mais recebe cada reenvio da sala.
 */

export const WS_LIMITS = {
  /** O mesmo teto do `express.json` no REST. */
  maxPayloadBytes: 1024 * 1024,
  /** Awareness é cursor e nome — dezenas de bytes. Maior que isto é abuso. */
  maxAwarenessBytes: 4 * 1024,
  /** Uma aba recarregando convive com a anterior por um instante; 3 cobre isso. */
  maxSocketsPerPeer: 3,
  /** Janela das contas abaixo. */
  windowMs: 60_000,
  perWindow: {
    /** Todo quadro, antes de qualquer parse — teto de CPU. */
    frame: 1800,
    /** Chat: o mesmo `chatLimiter` do REST. */
    chat: 30,
    /** Rolagem e iniciativa: o mesmo `roomLimiter` do REST. */
    action: 120,
    /** Updates do grid Yjs — cada um aceito reenvia a sala inteira. */
    sync: 120,
    /** Cursor do GM: o cliente manda no máximo ~20/s (R.4), e o pacote é pequeno. */
    awareness: 1200
  }
} as const;

export type WsBudget = keyof typeof WS_LIMITS.perWindow;

type Bucket = { count: number; resetAt: number };

/**
 * Janela fixa por chave — a mesma conta do limitador do REST. `true` se ainda
 * cabe; conta a tentativa de qualquer jeito, para o flood não "descansar".
 */
export function allowInWindow(
  buckets: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

/**
 * Contas por jogador. Os baldes **não** somem quando o socket fecha: somem
 * quando a janela vence (poda amortizada, como a do REST). Se sumissem no
 * `close`, reconectar zeraria a cota.
 */
export class WsRateLimiter {
  private buckets = new Map<string, Bucket>();
  private sinceSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  allow(code: string, peerId: string, budget: WsBudget): boolean {
    const t = this.now();
    this.sinceSweep += 1;
    if (this.sinceSweep >= 500) {
      this.sinceSweep = 0;
      for (const [key, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(key);
    }
    return allowInWindow(
      this.buckets,
      `${code}:${peerId}:${budget}`,
      WS_LIMITS.perWindow[budget],
      WS_LIMITS.windowMs,
      t
    );
  }

  /** Estouro pela primeira vez nesta janela? (para avisar o autor uma vez só) */
  justExceeded(code: string, peerId: string, budget: WsBudget): boolean {
    const b = this.buckets.get(`${code}:${peerId}:${budget}`);
    return !!b && b.count === WS_LIMITS.perWindow[budget] + 1;
  }

  get size(): number {
    return this.buckets.size;
  }
}
