/**
 * L.5 — a mensagem de um erro pego num `catch`, que é `unknown`. Era o
 * `catch (e: any) { … e?.message || 'texto' }` repetido em sete telas: o erro
 * da API (`ApiError`), o do Supabase (objeto com `message`) e o do navegador
 * trazem a mensagem; o resto cai no texto da tela.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const { message } = e as { message: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
