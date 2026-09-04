/**
 * Fase B (B.1 — SEC-01) — TRAVAS DO NETRUNNER IA
 * ==============================================
 * O `/api/gemini` é o único endpoint que gasta cota de um serviço externo pago
 * com a chave do dono. Antes desta fase ele aceitava qualquer requisição da
 * internet e ainda deixava o cliente escolher o `systemInstruction` — um proxy
 * de LLM genérico aberto.
 *
 * Estes testes fixam o comportamento de REJEIÇÃO, que é o que importa: nenhuma
 * requisição sem identidade verificada pode chegar ao provedor.
 *
 * O que estes testes deliberadamente NÃO cobrem, e por quê: o caminho feliz
 * exige um JWT válido do Supabase e uma chamada real ao Gemini. Testar isso
 * aqui significaria rede em suíte unitária — lento, instável e gastando cota a
 * cada `vitest run`. Os caminhos de rejeição são determinísticos e não tocam
 * rede nenhuma, e são justamente onde mora o SEC-01.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import { bearerFromHeader } from "../../server/supabaseAuth";

describe("POST /api/gemini — travas do SEC-01", () => {
  it("rejeita requisição sem Authorization (era o buraco: qualquer um chamava)", async () => {
    const res = await request(app).post("/api/gemini").send({ prompt: "Explique BTM" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/login/i);
  });

  it("rejeita Authorization que não é Bearer", async () => {
    const res = await request(app)
      .post("/api/gemini")
      .set("Authorization", "Basic dXNlcjpzZW5oYQ==")
      .send({ prompt: "Explique BTM" });
    expect(res.status).toBe(401);
  });

  it("rejeita Bearer vazio", async () => {
    const res = await request(app)
      .post("/api/gemini")
      .set("Authorization", "Bearer   ")
      .send({ prompt: "Explique BTM" });
    expect(res.status).toBe(401);
  });

  it("falha FECHADA quando a verificação de identidade não está configurada", async () => {
    // Sem SUPABASE_URL/SERVICE_ROLE_KEY no ambiente de teste, o servidor não
    // consegue validar o token. Precisa recusar — jamais degradar para "passa".
    const res = await request(app)
      .post("/api/gemini")
      .set("Authorization", "Bearer token-qualquer")
      .send({ prompt: "Explique BTM" });
    expect(res.status).toBe(503);
    expect(res.status).not.toBe(200);
  });

  it("não vaza o system prompt nem detalhe do provedor na resposta de erro", async () => {
    const res = await request(app).post("/api/gemini").send({ prompt: "x" });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/NETRUNNER IA, assistente/i);
    expect(body).not.toMatch(/GEMINI_API_KEY|apiKey/i);
  });
});

describe("bearerFromHeader", () => {
  it("extrai o token de um header bem formado", () => {
    expect(bearerFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("aceita o esquema em qualquer caixa", () => {
    expect(bearerFromHeader("bearer abc")).toBe("abc");
    expect(bearerFromHeader("BEARER abc")).toBe("abc");
  });

  it("devolve null para ausente, vazio ou outro esquema", () => {
    expect(bearerFromHeader(undefined)).toBeNull();
    expect(bearerFromHeader("")).toBeNull();
    expect(bearerFromHeader("Bearer")).toBeNull();
    expect(bearerFromHeader("Bearer    ")).toBeNull();
    expect(bearerFromHeader("Basic abc")).toBeNull();
  });
});
