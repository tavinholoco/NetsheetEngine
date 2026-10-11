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
