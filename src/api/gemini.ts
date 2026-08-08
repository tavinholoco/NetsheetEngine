/**
 * ============================================================
 * NETSHEET ENGINE — CLIENTE HTTP DO NETRUNNER IA (T7.3)
 * ============================================================
 * Único ponto de acesso ao endpoint `/api/gemini` (que encapsula a
 * GEMINI_API_KEY no servidor). O componente `AiAssistant` consome esta
 * função — nenhum fetch cru no componente.
 */

import { apiFetch } from './http';

/** POST /api/gemini — envia prompt e devolve o texto da resposta. */
export async function askGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const data = await apiFetch<{ text?: string }>('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ prompt, systemInstruction })
  });
  return data.text || '';
}
