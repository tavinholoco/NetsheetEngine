# ADR 0005 — Provedor de IA do Netrunner: Groq como primário, Gemini como fallback

- **Status:** Aceito — **implementação pendente, sem fase dona** (ver [revisão de 03/09/2026](#revisão-de-03092026--a-fase-b-trancou-o-endpoint-mas-não-migrou))
- **Data:** 02/09/2026
- **Decisores:** Desenvolvimento (auditoria de retomada)
- **Fase do plano:** prevista para a Fase B; **não entrou nela** — ver revisão abaixo

## Contexto

O módulo **Netrunner IA** usa `@google/genai` com `gemini-2.5-flash`, encapsulado no endpoint
`/api/gemini`. A auditoria de retomada levantou três pressões sobre essa escolha:

1. **Custo (SEC-01).** O endpoint não exige autenticação e aceita `systemInstruction` vindo do
   cliente. É um proxy de LLM aberto rodando na chave do dono — o único componente do projeto capaz
   de gerar uma cobrança real. O objetivo declarado do projeto é **custo zero**.
2. **Cota.** As fontes públicas divergem bastante sobre o limite diário gratuito do
   `gemini-2.5-flash` em 2026 (relatos de 250 e de 1.500 requisições/dia, com um corte de quota em
   dezembro de 2025). Uma cota que não dá para afirmar com segurança é uma cota difícil de planejar.
3. **Concentração.** A mesma `GEMINI_API_KEY` é usada pelo projeto **Newra News**
   (`newra-news-api`), que gera um artigo por dia. Os dois projetos dividem o mesmo balde de cota — o
   mesmo padrão de interferência que já existe nas 750 h de workspace do Render.

O uso real aqui é modesto: um assistente conversacional que explica regras de CP2020, diagnostica
build de ficha e gera lifepath. Poucas requisições por sessão, prompts curtos, respostas em
português.

## Opções consideradas

| Opção | Free tier (set/2026) | Prós | Contras |
|---|---|---|---|
| **Manter só Gemini** | Cota divergente entre fontes | Zero trabalho; já integrado | Cota incerta; balde compartilhado com o Newra News |
| **Groq** (escolhida como primária) | 30 RPM, sem cartão de crédito; RPD por modelo (ex.: ~1.000/dia no `llama-3.3-70b-versatile`) | Inferência muito rápida (LPU); **já em uso e validado no Newra News**; API compatível com OpenAI | Depreca modelos com frequência — o Newra já sofreu isso (`llama-3.1-8b-instant`, desligado em 16/08/2026); limites por **organização**, não por chave |
| **Cerebras** | ~1M tokens/dia | Volume alto; modelos grandes | Menos maduro; menos usado no ecossistema |
| **Cloudflare Workers AI** | 10.000 neurons/dia | Sem cold start, na edge | Modelo de cota em "neurons" é difícil de estimar antes de medir |
| **Mistral** | ~1B tokens/mês | Volume generoso; bom em português | Mais uma conta e mais um SDK |
| **OpenRouter** | ~20 RPM por modelo, ~30 modelos gratuitos | Uma chave, muitos modelos; troca de modelo sem trocar código | Camada de intermediação a mais; modelos gratuitos entram e saem |

## Decisão

**Adotar o Groq como provedor primário e manter o Gemini como fallback**, atrás de uma interface
única no servidor.

Três razões, em ordem de peso:

1. **Precedente validado no próprio ecossistema do autor.** O `newra-news-api` já roda com
   `GROQ_API_KEY` e `GROQ_MODEL`, e já atravessou uma depreciação de modelo do Groq. O custo de
   aprendizado é zero e as armadilhas já são conhecidas.
2. **O free tier do Groq é declarado sem cartão de crédito**, o que se alinha com a regra número 1 do
   contrato de custo zero: *não vincular faturamento à chave*. Sem cartão, o pior caso de um abuso é
   "a IA parou hoje" — nunca uma fatura.
3. **Dois provedores atrás de uma interface** removem o ponto único de falha que a depreciação de
   modelo cria. Quando o Groq desligar o modelo da vez — e vai desligar —, o fallback cobre até a
   troca de string.

### Consequências

- Criar `src/api/ai.ts` (ou equivalente no servidor) com a interface `askAi(prompt)`, e duas
  implementações. O endpoint deixa de se chamar `/api/gemini` e passa a `/api/ai`, mantendo a rota
  antiga como alias temporário.
- O `systemInstruction` **passa a ser fixo no servidor** independentemente do provedor — é a correção
  do SEC-01 e é o que torna a troca de provedor segura.
- Usar **organizações/contas separadas** do Groq para NetSheet e Newra News, ou aceitar
  conscientemente que dividem o balde: no Groq os limites são **por organização**, não por chave.
- Modelo do Groq é configurável por env (`AI_MODEL`), como o Newra News já faz — depreciação vira
  troca de variável, não deploy de código.
- O `@google/genai` continua como dependência enquanto o fallback existir.

### Fica registrado para quando for reavaliar

Se o volume crescer além do free tier do Groq (improvável no uso de mesa privada), o próximo passo é
o **OpenRouter**, que dá acesso a vários provedores por uma chave só — inclusive ao próprio Groq —
e permite trocar de modelo sem mexer em integração.

## Notas

Limites levantados por pesquisa em setembro de 2026 e sujeitos a mudança. **Confirme no console do
provedor antes de dimensionar qualquer coisa** — a divergência entre fontes públicas sobre a cota do
Gemini é justamente uma das razões desta ADR.

## Revisão de 03/09/2026 — a Fase B trancou o endpoint, mas não migrou

A B.1 fechou o SEC-01 **mantendo o Gemini**. A pedido do dono, a troca de provedor ficou de fora para
não misturar a correção crítica com uma migração no mesmo commit.

O que a B.1 já entregou desta ADR:

- **`systemInstruction` fixo no servidor** (`server/aiPrompt.ts`). O cliente não manda mais a
  instrução, e o que ele enviar é descartado. Era a pré-condição que esta ADR apontava para a troca
  de provedor ser segura.
- **Endpoint isolado**: identidade (JWT do Supabase), limiter de 10/min e teto de prompt vivem antes
  da chamada ao modelo, e o prompt vive em `server/aiPrompt.ts`. Trocar o provedor é mexer só no
  bloco que chama o modelo.

O que **não** foi feito:

- A interface `askAi(prompt)` com duas implementações, a rota `/api/ai` e o alias temporário de
  `/api/gemini`.
- `GROQ_API_KEY` / `AI_MODEL` como variáveis de ambiente.

**Nenhuma fase do plano é dona disso hoje.** Aplicando o filtro de necessidade: o sintoma que
motivou a ADR (cota do Gemini incerta, dividida com o Newra News) **ainda não foi observado como
falha** neste projeto. Até alguém decidir onde encaixar, o gatilho para fazer é: *a primeira resposta
`429`/cota esgotada do Gemini no log `gemini_api_error`, ou o Newra News esgotar a cota
compartilhada.*
