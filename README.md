<div align="center">

# NETSHEET ENGINE

**Cyberpunk 2020 Sheet Builder & PRD Suite**

Suíte completa para mesas de Cyberpunk 2020: criação de fichas com calculador de estatísticas,
cyberware, lifepath, rolagem de dados FNFF, mesa virtual multiplayer em tempo real, sistema social
(amigos, mensagens, perfis) e visualizador de PRD.

**Status:** Alpha — em desenvolvimento ativo

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

O documento mestre do projeto é o [`docs/PLANO_MESTRE.md`](./docs/PLANO_MESTRE.md) — 13 fases, das
quais 5 são varreduras de qualidade com filtro contra overengineering, mais um contrato de custo zero
para a hospedagem. Ele substituiu o [`PLANO_DE_ACAO.md`](./PLANO_DE_ACAO.md), que guiou as Fases 0–10
e ainda será encerrado formalmente na Fase M.

O detalhamento de produto está em [`docs/PRD.md`](./docs/PRD.md) e em
[`src/data/prdData.ts`](./src/data/prdData.ts) (consumido pelo visualizador de PRD do app).

Dois documentos vivos sustentam o plano e são atualizados pelas fases que mudam o sistema:

- [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) — diagramas Mermaid do sistema: contêineres e
  fronteiras de confiança, ciclo de vida de sala e sessão, pipeline de dano FNFF e máquina de estados
  do ferimento.
- [`docs/SEGURANCA.md`](./docs/SEGURANCA.md) — o portão de segurança (seis perguntas STRIDE que toda
  fase de construção responde antes de fechar) e o modelo de ameaça.

Fases 0–10 do plano antigo concluídas: fundação, segurança, migração Firebase → Supabase, multiplayer
(persistência, estado global, tempo real com WebSockets/Yjs), motor de dados FNFF, roteamento, PRD,
testes e deploy/CI-CD/hardening. Nada disso foi desfeito — o plano novo continua a partir daí, na
**Fase A**. O protocolo de rede está documentado em [`docs/PROTOCOLO_MULTIPLAYER.md`](./docs/PROTOCOLO_MULTIPLAYER.md).

## Rodando localmente

Pré-requisitos: Node ≥ 20 e [Supabase CLI](https://supabase.com/docs/guides/cli) (Docker) para o ambiente local.

1. Instale as dependências: `npm install`
2. Inicie o Supabase local: `npx supabase start`
3. Crie um `.env.local` a partir de `.env.example` (Supabase URL/keys + `GEMINI_API_KEY`)
4. Rode o servidor de desenvolvimento: `npm run dev`
5. Acesse `http://localhost:3000`

> As chaves de `service_role` do Supabase são **exclusivas do servidor** — nunca as coloque com prefixo `VITE_`.

## Deploy

O backend (Express + WebSocket + Yjs) é um **processo único** — o estado das salas vive em memória (com persistência JSON). Veja [`docs/DEPLOY.md`](./docs/DEPLOY.md) para o passo a passo completo, variáveis de ambiente e healthcheck.

- **Render** — config em [`render.yaml`](./render.yaml) (Web Service com runtime Node nativo) — **único alvo de backend** (Fase A do `docs/PLANO_MESTRE.md`, DOC-02)
- **Docker** — `docker build -t netsheet-engine . && docker run -p 3000:3000 netsheet-engine` (imagem multi-stage já valida build + testes + E2E WS)
- **Frontend** — o SPA é servido pelo próprio backend na mesma porta (sem CORS); também pode ser hospedado estático no Vercel/Netlify apontando o `VITE_SUPABASE_URL` para o Supabase cloud
- Railway e Fly.io foram avaliados e **arquivados** em [`docs/deploy-alternativas/`](./docs/deploy-alternativas/) — rodar em duas plataformas ao mesmo tempo não soma nada ao orçamento de custo zero, só duplica manutenção

> Por causa do estado em memória (Yjs/salas), o servidor deve rodar como **instância única** — não escale horizontalmente sem um backend de persistência compartilhado.

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
