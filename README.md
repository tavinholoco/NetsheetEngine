<div align="center">

# 🦾 NETSHEET ENGINE

**Cyberpunk 2020 Sheet Builder & PRD Suite**

Suíte completa para mesas de Cyberpunk 2020: criação de fichas com calculador de estatísticas,
cyberware, lifepath, rolagem de dados FNFF, mesa virtual multiplayer em tempo real, sistema social
(amigos, mensagens, perfis) e visualizador de PRD.

**Status:** 🚧 Alpha — em desenvolvimento ativo

[![CI](https://github.com/tavinholoco/NetsheetEngine/actions/workflows/ci.yml/badge.svg)](https://github.com/tavinholoco/NetsheetEngine/actions/workflows/ci.yml)

</div>

---

## Módulos

- **Ficha** — criador e gestor de fichas (atributos, perícias, cyberware, armas/SP, ferimentos, lifepath)
- **Mesa Multiplayer** — salas em tempo real, grid tático, iniciativa, NPCs gerados, poderes de GM
- **Dados** — rolador FNFF com crítico explosivo, fumble e dano por localização
- **Netrunner IA** — assistente com integração Gemini
- **Lendas** — biblioteca de presets e NPCs
- **Social** — perfis, amigos, solicitações e mensagens diretas
- **PRD** — especificação e roadmap do produto

## Stack

React 19 · Vite · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Express · Supabase (Auth/PostgreSQL/Realtime/Storage)
· SSE (multiplayer) · Gemini API

## Roadmap

O desenvolvimento segue um plano de 13 fases documentado em [`PLANO_DE_ACAO.md`](./PLANO_DE_ACAO.md),
com o detalhamento em [`src/data/prdData.ts`](./src/data/prdData.ts) (consumido pelo visualizador de PRD do app).

Fases concluídas até agora: **0** (fundação), **1** (segurança), **2** (migração Firebase → Supabase), **3** (multiplayer: persistência e confiabilidade), **4** (estado global com Zustand) e **5** (multiplayer em tempo real: WebSockets/Yjs). O protocolo de rede está documentado em [`docs/PROTOCOLO_MULTIPLAYER.md`](./docs/PROTOCOLO_MULTIPLAYER.md).

## Rodando localmente

Pré-requisitos: Node ≥ 20 e [Supabase CLI](https://supabase.com/docs/guides/cli) (Docker) para o ambiente local.

1. Instale as dependências: `npm install`
2. Inicie o Supabase local: `npx supabase start`
3. Crie um `.env.local` a partir de `.env.example` (Supabase URL/keys + `GEMINI_API_KEY`)
4. Rode o servidor de desenvolvimento: `npm run dev`
5. Acesse `http://localhost:3000`

> ⚠️ As chaves de `service_role` do Supabase são **exclusivas do servidor** — nunca as coloque com prefixo `VITE_`.

## Segurança

O repositório usa o [gitleaks](https://github.com/zricethezav/gitleaks) para bloquear segredos:

- **CI** — todo `push`/`pull request` roda `gitleaks detect` (config em [`.gitleaks.toml`](./.gitleaks.toml)) e falha o pipeline se qualquer segredo for encontrado.
- **Local** — varredura manual: `gitleaks detect --source . --config .gitleaks.toml --redact`
- **Pre-commit hook (opcional)** — bloqueia o commit antes do push:
  ```bash
  # Linux/macOS:
  ln -s ../../.gitleaks/pre-commit.sh .git/hooks/pre-commit
  # Windows (Git Bash, sem symlink): cp .gitleaks/pre-commit.sh .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  ```

Regras custom detectam Google OAuth Client Secrets (`GOCSPX-…`), Google/Firebase API Keys (`AIzaSy…`), tokens GitHub, chaves AWS e segredos genéricos de alta entropia. A anon key do Supabase local é permitida por design (é pública e vai no bundle do cliente).
