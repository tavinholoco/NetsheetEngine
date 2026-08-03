<div align="center">

# 🦾 Cyberpunk 2020 Sheet Builder & PRD Suite

Suíte completa para mesas de Cyberpunk 2020: criação de fichas com calculador de estatísticas,
cyberware, lifepath, rolagem de dados FNFF, mesa virtual multiplayer em tempo real, sistema social
(amigos, mensagens, perfis) e visualizador de PRD.

**Status:** 🚧 Alpha — em desenvolvimento ativo

</div>

---

## Módulos

- **Ficha** — criador e gestor de fichas (atributos, perícias, cyberware, armas/SP, ferimentos, lifepath)
- **Mesa Multiplayer** — salas em tempo real, grid tático, iniciativa, NPCs gerados, poderes de GM
- **Dados** — rolador FNFF com crítico explosivo, fumble e dano por localização
- **Netrunner IA** — assistente com integração Gemini
- **Lendas** — biblioteca de presets e NPCs
- **Social** — perfis, amigos, solicitações e mensagens diretas
- **PRD** — especificação e roadmap do produto (em construção)

## Stack

React 19 · Vite · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Express · Supabase (Auth/PostgreSQL)
· WebSockets/SSE · Gemini API

## Rodando localmente

1. Instale as dependências: `npm install`
2. Crie um `.env.local` a partir de `.env.example` (Supabase URL/keys + `GEMINI_API_KEY`)
3. Rode o servidor de desenvolvimento: `npm run dev`
4. Acesse `http://localhost:3000`

> O documento de acompanhamento das mudanças e do roadmap vive em [`PLANO_DE_ACAO.md`](./PLANO_DE_ACAO.md).
