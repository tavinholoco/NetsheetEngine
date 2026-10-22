// L.3a (E.18) — a rota do Netrunner IA. É a candidata natural da migração da
// ADR 0005 (Groq primário, Gemini fallback). Saiu do `server.ts` na L.3a.
import type { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import { bearerFromHeader, isAuthVerificationConfigured, verifySupabaseJwt } from "../supabaseAuth.js";
import { MAX_PROMPT_CHARS, NETRUNNER_SYSTEM_PROMPT } from "../aiPrompt.js";
import { logger } from "../logger.js";
import { ERR_SESSAO_CONTA, aiLimiter, sendError } from "../http.js";

export function registerAiRoutes(app: Express): void {
  // ==========================================
  // NETRUNNER IA (Fase B, B.1 — SEC-01)
  // ==========================================
  // Este endpoint gasta a chave do dono a cada chamada. Antes da Fase B ele
  // aceitava qualquer requisição da internet e ainda deixava o cliente escolher
  // o `systemInstruction` — um proxy de LLM genérico aberto, pago por quem
  // hospeda. Quatro travas agora, todas necessárias:
  //   1. Limiter dedicado, muito mais apertado que o de sala.
  //   2. Identidade verificada por JWT do Supabase (o autor vem do token).
  //   3. `systemInstruction` do cliente IGNORADO — a instrução é código.
  //   4. Teto de tamanho no prompt.
  app.post("/api/gemini", aiLimiter, async (req, res) => {
    // Ordem deliberada: rejeição mais barata primeiro. Sem token não há nada a
    // decidir — 401 sem tocar em rede nem em configuração.
    const token = bearerFromHeader(req.headers.authorization);
    if (!token) {
      return sendError(res, "login_required", "Faça login para usar o Netrunner IA.");
    }

    // Falha fechada: com token, mas sem verificação configurada, o servidor não
    // consegue saber se ele vale. Preferimos o assistente indisponível a ele
    // aberto — e 503 diz a verdade (problema do servidor), enquanto 401 mentiria
    // culpando a sessão do usuário.
    if (!isAuthVerificationConfigured()) {
      logger.warn("ai_unavailable", { reason: "verificação de identidade não configurada" });
      return sendError(res, "ai_unavailable", "Netrunner IA indisponível: verificação de identidade não configurada no servidor.");
    }

    const user = await verifySupabaseJwt(token);
    if (!user) {
      return sendError(res, "login_required", ERR_SESSAO_CONTA);
    }

    const { prompt } = req.body ?? {};
    if (typeof prompt !== "string" || !prompt.trim()) {
      return sendError(res, "invalid_input", "Prompt é obrigatório.");
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return sendError(res, "prompt_too_large", `Prompt longo demais (máx. ${MAX_PROMPT_CHARS} caracteres).`);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return sendError(res, "ai_unavailable", "Netrunner IA indisponível: GEMINI_API_KEY não configurada.");
      }
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        // A instrução do sistema vem do servidor, SEMPRE. O que o cliente mandar
        // em `systemInstruction` é descartado sem aviso — é entrada hostil.
        config: { systemInstruction: NETRUNNER_SYSTEM_PROMPT },
      });

      logger.info("ai_request", { userId: user.id, promptChars: prompt.length });
      res.json({ text: response.text });
    } catch (error) {
      logger.error("gemini_api_error", { message: (error as Error)?.message || String(error) });
      // Mensagem do provedor pode conter detalhe interno — não repassa ao cliente.
      sendError(res, "ai_failed", "Falha ao contatar o Netrunner IA. Tente de novo em instantes.");
    }
  });
}
