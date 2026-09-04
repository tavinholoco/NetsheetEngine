/**
 * ============================================================
 * NETSHEET ENGINE — CLIENTE HTTP DO NETRUNNER IA (T7.3)
 * ============================================================
 * Único ponto de acesso ao endpoint `/api/gemini` (que encapsula a
 * GEMINI_API_KEY no servidor). O componente `AiAssistant` consome esta
 * função — nenhum fetch cru no componente.
 *
 * Fase B (B.1 — SEC-01): duas mudanças de contrato.
 *  - O `systemInstruction` SAIU. A instrução do modelo virou código do
 *    servidor (`server/aiPrompt.ts`); mandá-la daqui não teria efeito, porque
 *    o servidor descarta o que o cliente enviar.
 *  - A chamada agora exige o JWT do usuário logado. Sem ele o servidor
 *    responde 401 — o endpoint deixou de ser aberto.
 */

import { apiFetch } from './http';
import { auth } from '../lib/supabase';

/**
 * POST /api/gemini — envia prompt e devolve o texto da resposta.
 * @throws ApiError(401) se não houver sessão do Supabase ativa.
 */
export async function askGemini(prompt: string): Promise<string> {
  const { data } = await auth.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    // Falha aqui em vez de deixar o servidor recusar: a mensagem fica melhor e
    // evita uma ida à rede que já se sabe perdida.
    throw new Error('Faça login para usar o Netrunner IA.');
  }

  const res = await apiFetch<{ text?: string }>('/api/gemini', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt })
  });
  return res.text || '';
}
