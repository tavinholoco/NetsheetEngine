import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { TacticalGridState } from "../types/multiplayer";
import { deriveGridFromDoc, writeGridToDoc } from "./gridDoc";

/**
 * Fase 5 (T5.3) — Conexão Yjs do grid tático sobre o WebSocket existente.
 *
 * O grid vive num `Y.Doc` (CRDT): o GM (e cada jogador movendo o próprio
 * token) edita localmente e o `YjsGridConnection` sincroniza os updates
 * incrementais com o servidor, que os propaga para a mesa. Cursos do GM vão
 * pelo protocolo de awareness (não-persistente). O JSON `room.tacticalGrid`
 * continua a verdade durável (decisão T5.1) — espelhado pelo servidor.
 *
 * Protocolo de mensagens binárias (y-websocket wire):
 *   [messageSync(0) + syncStep1/syncStep2/update]
 *   [messageAwareness(1) + update]
 *   [messageQueryAwareness(3)]
 */

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

export interface RemoteCursor {
  clientID: number;
  name: string;
  /** Posição do cursor do GM em percentuais do grid (0..1). */
  x: number;
  y: number;
}

export interface YjsGridCallbacks {
  onGrid: (grid: TacticalGridState) => void;
  onCursors: (cursors: RemoteCursor[]) => void;
}

export class YjsGridConnection {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private ws: WebSocket;
  private callbacks: YjsGridCallbacks;
  private disposed = false;
  private refreshInterval: number | null = null;

  constructor(ws: WebSocket, peerId: string, name: string, callbacks: YjsGridCallbacks) {
    this.ws = ws;
    this.callbacks = callbacks;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState({ user: { name, peerId } });

    // Update local no doc → envia incremental ao servidor; update remoto é
    // aplicado pelo handleBinary e NÃO é ecoado (origin !== "local").
    this.doc.on("update", (update, origin) => {
      if (origin === "local") {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        this.sendBinary(encoding.toUint8Array(encoder));
      }
      this.callbacks.onGrid(deriveGridFromDoc(this.doc));
    });

    // Awareness local mudou → envia; awareness remoto aplicado via handleBinary.
    this.awareness.on("update", (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const { added, updated, removed } = changes;
      if (origin === "local") {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.awareness.clientID])
        );
        this.sendBinary(encoding.toUint8Array(encoder));
      }
      this.callbacks.onCursors(this.remoteCursors());
    });

    // Awareness expira no servidor após 30s (outdatedTimeout) — re-publica
    // periodicamente para manter o cursor/estado do GM vivo.
    this.refreshInterval = window.setInterval(() => {
      const localState = this.awareness.getLocalState();
      if (localState) this.awareness.setLocalState(localState);
    }, 25_000);
  }

  /** Inicia o sync: o servidor responde syncStep2 com o estado completo. */
  startSync(): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.sendBinary(encoding.toUint8Array(encoder));

    // Pede o awareness atual dos outros membros da mesa.
    const query = encoding.createEncoder();
    encoding.writeVarUint(query, messageQueryAwareness);
    this.sendBinary(encoding.toUint8Array(query));
  }

  /** Processa uma mensagem binária recebida do servidor. */
  handleBinary(data: ArrayBuffer): void {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === messageSync) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, "remote");
      // Resposta (ex.: syncStep2 ao nosso syncStep1) — envia de volta.
      if (encoding.length(encoder) > 1) {
        this.sendBinary(encoding.toUint8Array(encoder));
      }
    } else if (messageType === messageAwareness) {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, "remote");
    }
  }

  /** Aplica um grid local (drag, add/remove token, tema, dimensões) no CRDT. */
  applyLocalGrid(grid: TacticalGridState): void {
    writeGridToDoc(this.doc, grid, "local");
  }

  /** GM: publica a posição do cursor (percentuais 0..1) via awareness. */
  setCursor(x: number, y: number): void {
    this.awareness.setLocalStateField("cursor", { x, y });
  }

  clearCursor(): void {
    this.awareness.setLocalStateField("cursor", null);
  }

  private remoteCursors(): RemoteCursor[] {
    const out: RemoteCursor[] = [];
    this.awareness.getStates().forEach((state, clientID) => {
      if (clientID === this.awareness.clientID) return;
      const cursor = state?.cursor;
      const user = state?.user;
      if (cursor && typeof cursor.x === "number" && typeof cursor.y === "number") {
        out.push({ clientID, name: user?.name || "?", x: cursor.x, y: cursor.y });
      }
    });
    return out;
  }

  private sendBinary(data: Uint8Array): void {
    if (this.disposed) return;
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
      } catch {
        /* ignore */
      }
    }
  }

  destroy(): void {
    try {
      // Publica a saída (estado null) antes de fechar — remove o cursor do GM
      // nos outros clientes imediatamente (em vez de aguardar o timeout).
      this.awareness.setLocalState(null);
    } catch {
      /* ignore */
    }
    this.disposed = true;
    if (this.refreshInterval !== null) window.clearInterval(this.refreshInterval);
    try {
      this.awareness.destroy();
      this.doc.destroy();
    } catch {
      /* ignore */
    }
  }
}
