// ============================================================
// NETSHEET ENGINE — VERIFICAÇÃO DE JWT DO SUPABASE (Fase B, B.1 — SEC-01)
// ============================================================
// Antes desta fase o servidor não sabia verificar identidade NENHUMA: só
// conhecia o `sessionToken` próprio das salas, que diz "este peer pertence a
// esta mesa" e nada sobre quem é a pessoa. O `/api/gemini` ficava aberto a
// qualquer requisição da internet, gastando a chave do dono.
//
// Aqui verificamos o JWT que o Supabase Auth emite para o usuário logado,
// chamando `auth.getUser(jwt)` — o próprio Supabase valida assinatura e
// expiração. Custa uma ida à rede por requisição (~100 ms), aceitável porque o
// volume do assistente é baixíssimo, e evita introduzir mais um segredo
// (SUPABASE_JWT_SECRET) que teria de ser configurado e protegido no Render.
//
// FALHA FECHADA, sempre: sem configuração, sem token, token inválido ou erro
// de rede, ninguém entra. Um endpoint que gasta dinheiro do dono não pode
// degradar para "deixa passar" quando algo dá errado.
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

let client: SupabaseClient | null = null;
let resolved = false;

/** Cliente dedicado à verificação. `null` = verificação indisponível. */
function getAuthClient(): SupabaseClient | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logger.warn("auth_verification_unavailable", {
      reason: "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes"
    });
    return null;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

export function isAuthVerificationConfigured(): boolean {
  return getAuthClient() !== null;
}

/** Extrai o JWT de `Authorization: Bearer <token>`. */
export function bearerFromHeader(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Valida o JWT no Supabase Auth. Devolve o usuário ou `null` — nunca lança,
 * para o caller ter um único caminho de rejeição.
 */
export async function verifySupabaseJwt(token: string): Promise<AuthedUser | null> {
  const auth = getAuthClient();
  if (!auth) return null;
  try {
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch (e: unknown) {
    // Rede fora, Supabase pausado, timeout: rejeita. Nunca registra o token.
    logger.warn("auth_verification_error", {
      message: e instanceof Error ? e.message : String(e)
    });
    return null;
  }
}
