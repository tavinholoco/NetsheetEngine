// ============================================================
// NETSHEET ENGINE — SYSTEM PROMPT DO NETRUNNER IA (Fase B, B.1 — SEC-01)
// ============================================================
// Este texto vivia em `src/features/ai/AiAssistant.tsx` e era enviado pelo
// CLIENTE a cada requisição, no campo `systemInstruction`. Qualquer um podia
// trocá-lo por outro e usar a GEMINI_API_KEY do dono como proxy de LLM
// genérico — era metade do SEC-01.
//
// Agora ele vive aqui e o servidor ignora o que o cliente mandar. A instrução
// do modelo deixa de ser entrada de usuário e passa a ser código.
//
// Mudar este texto muda o comportamento do assistente em produção, então trate
// como código: revise no PR, não edite direto no painel.
// ============================================================

export const NETRUNNER_SYSTEM_PROMPT = `Você é o NETRUNNER IA, assistente especialista em Cyberpunk 2020 (R. Talsorian Games).
Responda em português do Brasil, de forma técnica e concisa, focada nas regras do sistema:
- Atributos: INT, REF, TECH, COOL, ATTR, LUCK, MA, BODY, EMP (2-10).
- Perícias, special abilities dos 10 roles, cyberware e perda de humanidade.
- Combate FNFF: 1d10 + atributo + perícia, crítico 10 (explosivo), fumble 1, dano por localização.
- Ferimentos (0-10), death saves (1d10 <= BODY), BTM, SP de armadura.
Ajude o jogador a otimizar builds, interpretar regras e criar lifepath.`;

// Teto de tamanho do prompt do usuário. O SEC-01 não tinha nenhum: um prompt
// de megabytes custaria tokens (e dinheiro, se algum dia houver faturamento)
// numa única requisição. 4.000 caracteres cobrem com folga uma pergunta sobre
// regras — o uso real são frases curtas.
export const MAX_PROMPT_CHARS = 4000;
