/**
 * Fase J (J.1d — SEC-17) — a segunda camada: o cliente não confia no awareness.
 * O servidor confere a forma desde a J; aqui, o que chegar de qualquer jeito
 * (um servidor de antes, um bug) vira cursor desenhável — nome em texto e
 * posição dentro do grid —, nunca um objeto no JSX, que derrubava o app inteiro.
 */
import { describe, it, expect, afterEach } from "vitest";
import * as encoding from "lib0/encoding";
import { YjsGridConnection, type RemoteCursor } from "../lib/yjsConnection";

function quadro(clientID: number, clock: number, state: unknown): ArrayBuffer {
  const update = encoding.createEncoder();
  encoding.writeVarUint(update, 1);
  encoding.writeVarUint(update, clientID);
  encoding.writeVarUint(update, clock);
  encoding.writeVarString(update, JSON.stringify(state));
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 1); // messageAwareness
  encoding.writeVarUint8Array(enc, encoding.toUint8Array(update));
  const bytes = encoding.toUint8Array(enc);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

let conn: YjsGridConnection | null = null;
afterEach(() => {
  conn?.destroy();
  conn = null;
});

function conectar() {
  const ws = { readyState: WebSocket.OPEN, send: () => {} } as unknown as WebSocket;
  const visto: { cursores: RemoteCursor[] } = { cursores: [] };
  conn = new YjsGridConnection(ws, "peer_vex", "Vex", {
    onGrid: () => {},
    onCursors: (c) => {
      visto.cursores = c;
    }
  });
  return visto;
}

describe("J.1d (SEC-17) — o cursor remoto no cliente", () => {
  it("um nome que não é texto vira '?', e o cursor continua desenhável", () => {
    const visto = conectar();
    conn!.handleBinary(quadro(77, 1, { user: { name: { nao: "é texto" } }, cursor: { x: 0.5, y: 0.5 } }));
    expect(visto.cursores).toHaveLength(1);
    expect(visto.cursores[0].name).toBe("?");
  });

  it("o nome é cortado e a posição fica dentro do grid", () => {
    const visto = conectar();
    conn!.handleBinary(quadro(78, 1, { user: { name: "M".repeat(500) }, cursor: { x: 7, y: -3 } }));
    expect(visto.cursores[0].name.length).toBeLessThanOrEqual(30);
    expect(visto.cursores[0].x).toBe(1);
    expect(visto.cursores[0].y).toBe(0);
  });

  it("o cursor do GM, na forma do app, passa como veio (controle)", () => {
    const visto = conectar();
    conn!.handleBinary(quadro(79, 1, { user: { name: "Dono", peerId: "peer_dono" }, cursor: { x: 0.25, y: 0.75 } }));
    expect(visto.cursores).toEqual([{ clientID: 79, name: "Dono", x: 0.25, y: 0.75 }]);
  });
});
