/**
 * Fase B (B.7) — INSTRUMENTAÇÃO DO FALLBACK SSE
 * =============================================
 * O cliente sempre tenta WebSocket primeiro e só abre EventSource quando o WS
 * falha. Logo, toda conexão ao stream é uma queda de fallback — e é esse o
 * dado que a Fase L (L.6) vai usar para decidir se o fallback fica ou sai.
 *
 * POR QUE ISTO TEM TESTE
 * O modo de falha aqui é traiçoeiro: se o log nunca for emitido, a L.6 vai ler
 * "ninguém caiu para SSE em meses" e concluir que o fallback é desnecessário —
 * removendo um caminho que talvez seja o único que funciona atrás de um proxy
 * corporativo. Ausência de evidência viraria evidência de ausência, e a
 * decisão sairia errada com toda a confiança do mundo.
 *
 * Um teste barato aqui protege uma decisão cara lá na frente.
 */
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../server";
import { logger } from "../../server/logger";

let n = 0;
function code(): string {
  n += 1;
  return `B7-${Date.now().toString(36).slice(-4)}-${n}`.toUpperCase();
}

async function makeRoom() {
  const c = code();
  const res = await request(app)
    .post("/api/rooms/create")
    .send({ code: c, name: "Mesa", gmHandle: "GM", gmPeerId: "gm1" });
  return { code: c, token: res.body.sessionToken as string };
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Espera até a condição valer, checando a cada 10 ms.
 *
 * A primeira versão deste teste esperava 300 ms fixos e conferia depois — o que
 * passa quase sempre e falha quando a máquina está ocupada. Teste que depende
 * de "tempo suficiente" é intermitente por construção: não mede o evento, mede
 * a carga do CI. Aqui esperamos pelo EVENTO, com teto para não travar a suíte.
 */
async function esperarPor(cond: () => boolean, tetoMs = 3000): Promise<boolean> {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}

describe("log de fallback SSE", () => {
  it("emite `sse_fallback` quando um cliente autenticado abre o stream", async () => {
    const { code: c, token } = await makeRoom();
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});

    // O stream não termina sozinho: disparamos e observamos o efeito.
    const req = request(app).get(`/api/rooms/${c}/stream?token=${token}`);
    req.end(() => {});

    const emitiu = await esperarPor(() =>
      spy.mock.calls.some(([evento]) => evento === "sse_fallback")
    );
    req.abort();

    expect(emitiu, "o evento sse_fallback não foi emitido").toBe(true);
    const chamada = spy.mock.calls.find(([evento]) => evento === "sse_fallback");

    const campos = chamada![1] as Record<string, unknown>;
    expect(campos.room).toBe(c);
    expect(campos.peerId).toBe("gm1");
    expect(typeof campos.userAgent).toBe("string");
  });

  it("NÃO emite o evento quando a conexão é recusada por falta de sessão", async () => {
    // Recusa não é queda de fallback. Contá-la inflaria o número que a L.6 lê.
    const { code: c } = await makeRoom();
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});

    const res = await request(app).get(`/api/rooms/${c}/stream`);

    expect(res.status).toBe(401);
    expect(spy.mock.calls.some(([evento]) => evento === "sse_fallback")).toBe(false);
  });
});
