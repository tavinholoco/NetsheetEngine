/**
 * L.3b — o E.11 do ledger da E: `code.toUpperCase()` em 25 pontos, sem dono
 * ==========================================================================
 * O `getRoom` normalizava o código com `trim()` e maiúsculas; o mapa de streams
 * do SSE, só com maiúsculas. Um stream aberto com espaço no código achava a sala
 * e caía num conjunto que o reenvio nunca visita: um stream mudo. Nenhum cliente
 * manda código assim, mas a URL é de quem a digita. A L.3b fatiou o
 * `roomManager`, que é o gatilho do E.11: a normalização mora num `roomKey` só.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { app } from "../../server";
import { getRoom, roomKey } from "../../server/roomManager";

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer(app);
  server.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

describe("L.3b — E.11: um código, uma chave", () => {
  it("o roomKey tira o espaço das pontas e põe em maiúsculas, como o getRoom sempre fez", () => {
    expect(roomKey("  nc-2020-k7q9xd ")).toBe("NC-2020-K7Q9XD");
    expect(roomKey("NC-2020")).toBe("NC-2020");
  });

  it("o stream aberto com o código em minúsculas e com espaço recebe o reenvio da sala", async () => {
    const code = `E11-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    await request(app).post("/api/rooms/create").send({ code, name: "Mesa", gmHandle: "Dono", gmPeerId: "peer_dono" });
    const pj = await request(app).post("/api/rooms/join").send({ code, peerId: "peer_vex", handle: "Vex", sheet: { handle: "Vex", stats: {} } });
    const token = pj.body.sessionToken as string;
    expect(getRoom(` ${code.toLowerCase()}`)).toBeDefined();

    const eventos: string[] = [];
    const req = http.get(`http://127.0.0.1:${port}/api/rooms/%20${code.toLowerCase()}/stream?token=${token}`, (res) => {
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk.toString();
        let fim: number;
        while ((fim = buf.indexOf("\n\n")) >= 0) {
          const bloco = buf.slice(0, fim);
          buf = buf.slice(fim + 2);
          if (bloco.startsWith("data: ")) eventos.push(bloco.slice(6));
        }
      });
    });
    req.on("error", () => {});
    const ate = async (cond: () => boolean) => {
      const limite = Date.now() + 4000;
      while (Date.now() < limite && !cond()) await new Promise((r) => setTimeout(r, 20));
      return cond();
    };
    expect(await ate(() => eventos.length >= 1)).toBe(true); // a sala inteira de entrada

    await request(app).post(`/api/rooms/${code}/message`).send({ sessionToken: token, text: "alguém me ouve?" });
    expect(await ate(() => eventos.some((e) => e.includes("alguém me ouve?")))).toBe(true);
    req.destroy();
  });
});
