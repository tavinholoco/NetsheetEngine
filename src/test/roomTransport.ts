import { vi } from 'vitest';

/** WebSocket inerte: os testes de tela da mesa não exercitam o transporte. */
export class FakeWebSocket {
  static OPEN = 1;
  readyState = 0;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send() {}
  close() {}
}

/**
 * Troca o WebSocket e o EventSource do jsdom por versões inertes, para montar o
 * `MultiplayerRoom` sem rede. Desfazer com `vi.unstubAllGlobals()`.
 */
export function stubRoomTransport(): void {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('EventSource', class { close() {} });
}

/** H.3b — WebSocket que o teste abre, derruba e faz falhar. */
export class ControlledWebSocket {
  static OPEN = 1;
  static instances: ControlledWebSocket[] = [];
  readyState = 0;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    ControlledWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  /** O servidor aceitou a conexão. */
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  /** A rede caiu — ou, antes do `open`, a tentativa falhou. */
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
}

export class ControlledEventSource {
  static instances: ControlledEventSource[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    ControlledEventSource.instances.push(this);
  }
  close() {}
}

/**
 * Como o `stubRoomTransport`, mas o teste conduz o socket: cada `new WebSocket`
 * e cada `new EventSource` do componente ficam nas listas devolvidas.
 */
export function controlRoomTransport(): { sockets: ControlledWebSocket[]; streams: ControlledEventSource[] } {
  ControlledWebSocket.instances = [];
  ControlledEventSource.instances = [];
  vi.stubGlobal('WebSocket', ControlledWebSocket);
  vi.stubGlobal('EventSource', ControlledEventSource);
  return { sockets: ControlledWebSocket.instances, streams: ControlledEventSource.instances };
}
