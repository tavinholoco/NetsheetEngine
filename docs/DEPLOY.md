# NETSHEET ENGINE — Guia de Deploy (Fase 10, T10.1)

O app é **um único processo Node** que serve tudo: API Express (`/api/*`),
WebSocket (`/ws/rooms/:code`), SSE de fallback e a **SPA estática** (`dist/`)
em modo produção. Isso simplifica o deploy: uma instância = um serviço.

```
Cliente (React) ──►  Express + WebSocket (dist/server.cjs)  ──►  Supabase
                    │  SPA estática (dist/) · REST /api · WS  │   (auth + rooms
                    └────────────────────────────────────────┘    + storage)
```

## Variáveis de ambiente

| Variável | Quando | O que é |
|---|---|---|
| `VITE_SUPABASE_URL` | **build** | URL do projeto Supabase (inline no bundle do cliente) |
| `VITE_SUPABASE_ANON_KEY` | **build** | Chave anon do Supabase (pública por design — cliente) |
| `SUPABASE_URL` | runtime | URL do Supabase (persistência de salas, Fase 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **Service role — bypassa RLS. Sempre como SECRET.** |
| `GEMINI_API_KEY` | runtime | Chave da API Gemini (Netrunner AI, `/api/gemini`) |
| `PORT` | runtime | Injetada automaticamente pelas plataformas (default 3000) |
| `HOST` | runtime | Obrigatório `0.0.0.0` em containers (default já é esse) |
| `ROOM_OFFLINE_TIMEOUT_MS` | runtime | Opcional — timeout de `isOnline` da mesa (T3.4) |

> **NUNCA** commite valores reais: o CI roda **gitleaks** e bloqueia o push.

## Healthcheck

`GET /api/health` → `200 {"status":"online",...}`. Já configurado em todas as
plataformas abaixo e no `HEALTHCHECK` do Dockerfile. Rotas `/api/*`
desconhecidas respondem **JSON 404** (não HTML da SPA) — seguro para uptime
bots.

## ⚠️ Operacional: UMA instância

O estado das salas multiplayer vive **em memória** no processo (decisão
T5.1 — JSON como verdade durável + sync ao vivo em WS/Yjs). O servidor
persiste salas no Supabase (`rooms` tabela) com debounce e restaura no boot
(T3.2), mas conexões WebSocket/SSE ao vivo são por instância.

- **Mantenha 1 réplica** (as configs abaixo já fixam isso).
- Se escalar horizontalmente no futuro, será preciso um pub/sub compartilhado
  (ex.: Redis/Postgres LISTEN) — fora do escopo atual (documentado no
  ADR-0002).

---

## Opção A — Railway (mais simples)

1. Crie o projeto em [railway.app](https://railway.app) e conecte o repo
   (o `railway.toml` é detectado automaticamente).
2. Em **Variables**, defina:
   - Build-time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Runtime: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
3. Deploy automático em cada push no `master` (healthcheck `/api/health`).

## Opção B — Render

1. Em [render.com](https://render.com): **New → Blueprint** e selecione o repo
   (detecta `render.yaml`).
2. Defina os valores das variáveis com `sync: false` no painel do serviço
   (o blueprint cria os placeholders).
3. O serviço sobe com runtime Node nativo (plano free ok), healthcheck
   `/api/health` e auto-deploy em push.

## Opção C — Fly.io

```bash
fly launch --no-deploy --name netsheet-engine      # cria o app (fly.toml)
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=...
fly deploy --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=...
```

HTTPS + healthcheck (`/api/health`) já vêm configurados no `fly.toml`
(1 máquina, 1 GB). Logs: `fly logs`; console: `fly ssh console`.

---

## Verificação pós-deploy

```bash
# 1. Healthcheck
curl -s https://SEU-DOMINIO/api/health

# 2. SPA carrega (deve vir o index.html com o título do produto)
curl -s https://SEU-DOMINIO/ | grep -o "<title>[^<]*</title>"

# 3. API responde JSON (não HTML) em rota desconhecida
curl -s https://SEU-DOMINIO/api/nao-existe

# 4. Fluxo multiplayer (cria sala → E2E WS roda contra o servidor remoto)
BASE_URL=https://SEU-DOMINIO node scripts/test-ws-e2e.mjs

# 5. Netrunner AI (se GEMINI_API_KEY configurada)
curl -s -X POST https://SEU-DOMINIO/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Diga oi"}' | head -c 200
```

## Build local (docker)

```bash
docker build -t netsheet-engine \
  --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GEMINI_API_KEY=... netsheet-engine
```
