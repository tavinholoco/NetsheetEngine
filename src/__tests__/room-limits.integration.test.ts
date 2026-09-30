/**
 * Fase E (E.03 — SEC-15) — O TAMANHO DA MESA NÃO TINHA TETO
 * =========================================================
 * A R.4 e a R.16 puseram teto no RITMO (mensagens por minuto) e no número de
 * assentos. O TAMANHO do que o servidor guarda e reenvia continuava livre — e
 * criar sala não exige login no servidor, então qualquer visitante é GM da
 * própria sala. Medido e reproduzido em 30/09/2026, antes do conserto:
 *
 *  - SALAS sem teto: ~4 KB de memória e ~3,9 KB no banco cada. Um IP, no ritmo
 *    do limitador (120/min), cria ~172 mil por dia: ~680 MB de heap (a
 *    instância gratuita tem 512 MB) e ~650 MB no banco (o Supabase gratuito
 *    entra em modo só-leitura acima de 500 MB). E o restore traz tudo de volta
 *    no boot, 15 min antes da primeira volta do coletor.
 *  - FICHA: a maior que a validação aceita tem ~557 KB (a do gerador, 2,7 KB).
 *    16 assim fazem uma sala de ~8,7 MB, reenviada a até 48 sockets.
 *  - NPCs sem teto; chat com teto em dois caminhos e oito `push` sem (as duas
 *    pistas do plano, E.1b).
 *  - SOCKET QUE NÃO LÊ: cada reenvio fica no buffer do servidor. Com 3 sockets
 *    parados, o heap vivo foi de 49 a 156 MB em 100 reenvios, linear.
 *
 * Um teto para cada um, e um teste para cada teto.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";
import request from "supertest";
import { app, attachRealtime } from "../../server";
import {
  MAX_CHAT_MESSAGES,
  MAX_NPCS_PER_ROOM,
  MAX_ROOMS,
  MAX_SHEET_BYTES,
  createRoom,
  generateRoomNpc,
  getAllActiveRooms,
  getRoom,
  isRoomAbandoned,
  joinRoom,
  leaveRoom,
  postChatMessage,
  restoreRoom
} from "../../server/roomManager";
import { generateRandomNpc } from "../utils/npcGenerator";
import type { GameRoom } from "../types/multiplayer";

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

/** Uma ficha com cyberware de notas longas — `kb` quilobytes, mais ou menos. */
function fichaDe(kb: number) {
  const n = Math.ceil((kb * 1024) / 5200);
  return {
    ...SHEET,
    cyberware: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: "Implante", category: "x", humanityLoss: "1", costEb: 1, notes: "x".repeat(5000) }))
  };
}

let server: http.Server;
let port: number;
const abertos: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const ws of abertos) ws.terminate();
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

const novoCodigo = (p: string) => `${p}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function mesa(prefixo = "RL") {
  const code = novoCodigo(prefixo);
  const gm = await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
  return { code, gmToken: gm.body.sessionToken as string };
}

describe("E.03 (SEC-15) — teto de salas", () => {
  it(`com ${MAX_ROOMS} salas abertas, criar outra → 503 rooms_full; liberar uma reabre a vaga`, async () => {
    const enchidas: string[] = [];
    while (getAllActiveRooms().length < MAX_ROOMS) {
      const code = novoCodigo("CHEIA");
      createRoom(code, "x", "x", `peer_${code}`);
      enchidas.push(code);
    }
    const recusa = await request(app).post("/api/rooms/create").send({ code: novoCodigo("MAIS"), name: "x", gmHandle: "x", gmPeerId: "peer_x" });
    expect(recusa.status).toBe(503);
    expect(recusa.body.code).toBe("rooms_full");
    expect(() => createRoom(novoCodigo("DIRETO"), "x", "x", "peer_d")).toThrow();

    // O restore também respeita o teto — o boot não traz de volta o que não cabe.
    const snapshot = { ...getRoom(enchidas[0])!, code: novoCodigo("VOLTA") } as GameRoom;
    expect(restoreRoom(snapshot)).toBe(false);

    const livre = enchidas.pop()!;
    leaveRoom(livre, `peer_${livre}`);
    const agora = await request(app).post("/api/rooms/create").send({ code: novoCodigo("VAGA"), name: "x", gmHandle: "x", gmPeerId: "peer_v" });
    expect(agora.status).toBe(200);

    for (const code of enchidas) leaveRoom(code, `peer_${code}`);
    leaveRoom(agora.body.room.code, "peer_v");
  });

  it("sala abandonada não volta no boot (o coletor levaria 15 min para recolhê-la)", () => {
    const velha = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const snapshot = {
      code: "ABANDONADA-1",
      createdAt: velha,
      players: { p: { peerId: "p", handle: "x", role: "x", sheet: SHEET, isOnline: false, joinedAt: velha, lastActiveAt: velha } }
    } as unknown as GameRoom;
    expect(isRoomAbandoned(snapshot)).toBe(true);
    expect(isRoomAbandoned({ ...snapshot, createdAt: new Date().toISOString(), players: {} } as GameRoom)).toBe(false);
  });
});

describe("E.03 (SEC-15) — teto de NPCs por sala", () => {
  it(`com ${MAX_NPCS_PER_ROOM} NPCs, gerar outro → 409 npcs_full`, async () => {
    const { code, gmToken } = await mesa("NPC");
    for (let i = 0; i < MAX_NPCS_PER_ROOM; i++) expect(generateRoomNpc(code, "peer_dono").room).not.toBeNull();
    expect(generateRoomNpc(code, "peer_dono").room).toBeNull();
    const r = await request(app).post(`/api/rooms/${code}/npcs/generate`).send({ sessionToken: gmToken });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("npcs_full");
    expect(Object.keys(getRoom(code)!.npcs!)).toHaveLength(MAX_NPCS_PER_ROOM);
  });
});

describe("E.03 (SEC-15) — teto de tamanho da ficha", () => {
  it(`ficha acima de ${MAX_SHEET_BYTES / 1024} KB no join → 413 sheet_too_large, e nenhum assento nasce`, async () => {
    const { code } = await mesa("FICHA");
    const r = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_grande", handle: "G", sheet: fichaDe(200) });
    expect(r.status).toBe(413);
    expect(r.body.code).toBe("sheet_too_large");
    expect(getRoom(code)!.players["peer_grande"]).toBeUndefined();
    expect(joinRoom(code, "peer_grande", "G", fichaDe(200) as never)).toBeNull();
  });

  it("na sincronia também, e a ficha da mesa não muda", async () => {
    const { code } = await mesa("SYNC");
    const pj = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: SHEET });
    expect(pj.status).toBe(200);
    const r = await request(app).post(`/api/rooms/${code}/sheet`).send({ sessionToken: pj.body.sessionToken, sheet: fichaDe(200) });
    expect(r.status).toBe(413);
    expect(r.body.code).toBe("sheet_too_large");
    expect(getRoom(code)!.players["peer_vex"].sheet.cyberware ?? []).toHaveLength(0);
  });

  it("uma ficha de verdade cabe com folga", async () => {
    const { code } = await mesa("REAL");
    const r = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_real", handle: "Real", sheet: generateRandomNpc() });
    expect(r.status).toBe(200);
    const r2 = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_cheia", handle: "Cheia", sheet: fichaDe(40) });
    expect(r2.status).toBe(200);
  });
});

describe("E.03 (SEC-15) — teto do chat em todo caminho", () => {
  it(`entrar e sair em laço não passa de ${MAX_CHAT_MESSAGES} mensagens`, async () => {
    const { code } = await mesa("CHAT");
    for (let i = 0; i < 80; i++) {
      joinRoom(code, `peer_laco_${i}`, `L${i}`, SHEET as never);
      leaveRoom(code, `peer_laco_${i}`);
      expect(getRoom(code)!.chatMessages.length).toBeLessThanOrEqual(MAX_CHAT_MESSAGES);
    }
  });

  it("um chat que já passou do teto volta a ele na próxima mensagem (antes tirava uma só)", async () => {
    const { code } = await mesa("CHAT2");
    const room = getRoom(code)!;
    const msg = room.chatMessages[0];
    room.chatMessages = Array.from({ length: 150 }, (_, i) => ({ ...msg, id: `m${i}` }));
    postChatMessage(code, "peer_dono", "oi");
    expect(room.chatMessages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(room.chatMessages.at(-1)!.text).toBe("oi");
  });
});

describe("E.03 (SEC-15) — socket que não lê é derrubado", () => {
  it("o servidor fecha o WebSocket que acumula reenvios sem ler", async () => {
    const { code, gmToken } = await mesa("LENTO");
    // Uma sala de ~900 KB — perto do que o teto de ficha deixa.
    let token = "";
    for (let i = 0; i < 15; i++) {
      const r = await request(app).post("/api/rooms/join").send({ code, peerId: `peer_f${i}`, handle: `F${i}`, sheet: fichaDe(55) });
      expect(r.status).toBe(200);
      if (i === 0) token = r.body.sessionToken;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${code}?token=${token}`, { perMessageDeflate: false });
    abertos.push(ws);
    ws.on("error", () => {});
    await new Promise<void>((r) => ws.once("open", () => r()));
    let fechou = false;
    ws.once("close", () => (fechou = true));
    // Para de ler: o TCP enche e o resto fica no buffer do servidor.
    const tcp = (ws as unknown as { _socket: { pause(): void; resume(): void } })._socket;
    tcp.pause();

    for (let i = 0; i < 40; i++) {
      await request(app).post(`/api/rooms/${code}/roll`).send({ sessionToken: gmToken, kind: "save" });
    }
    // Volta a ler: se o servidor derrubou o socket, o cliente vê o fechamento
    // depois de esvaziar o que já tinha chegado; se não, o socket segue aberto.
    tcp.resume();
    const limite = Date.now() + 8000;
    while (!fechou && Date.now() < limite) await new Promise((r) => setTimeout(r, 50));
    expect(fechou).toBe(true);
  }, 30_000);
});
