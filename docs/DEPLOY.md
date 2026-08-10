# NETSHEET ENGINE — Guia de Deploy (Fase 10, T10.1–T10.3)

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
| `VITE_API_URL` | **build** | Base do backend multiplayer — **obrigatória no frontend estático** (T10.2); vazia = mesmo origin |
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

## Opção D — Frontend estático (Vercel/Netlify) + backend na nuvem

Quando o SPA é hospedado estático (Vercel/Netlify) e o backend mora no
Railway/Render/Fly.io, o cliente precisa saber onde está a API. Isso é
resolvido por **`VITE_API_URL`** (Fase 10, T10.2) — uma só variável da qual
REST, SSE e WebSocket derivam:

```
Cliente estático (Vercel) ──► REST/SSE/WS ──► Express + WS (Railway)
        VITE_API_URL=https://netsheet-api.onrender.com
```

### Configuração

1. **Backend** (Railway/Render/Fly — Opção A/B/C acima): suba normalmente.
   O servidor já responde **CORS em `/api/*`** (qualquer origin — auth por
   token de sessão, sem cookies).
2. **Frontend** (Vercel ou Netlify): importe o repo e use as configs prontas:
   - **Vercel** — `vercel.json` (build `npm run build:web`, output `dist`,
     SPA rewrites para os deep-links `/room/ABC123`);
   - **Netlify** — `netlify.toml` (mesma ideia, redirect `/* → /index.html`).
3. **Env var de build**: `VITE_API_URL=https://SEU-BACKEND` — **apenas a
   origin, sem path nem barra final** (o WS deriva trocando http→ws; um path
   quebraria a rota `/ws/rooms/:code`, que vive na raiz do servidor) +
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. O `import.meta.env` é inline
   no build — um build por ambiente (staging/produção).

> O proxy `/api/*` das plataformas estáticas é uma alternativa só para REST
> (não faz streaming SSE nem WebSocket). Para o realtime da mesa, use sempre
> `VITE_API_URL` direto ao backend.

---

## Domínio próprio + HTTPS (T10.3)

O HTTPS é **obrigatório** para o multiplayer: o WebSocket do navegador exige
`wss://` (o cliente já deriva `ws→wss` automaticamente quando a página e o
`VITE_API_URL` usam `https` — `src/api/base.ts`). Todas as plataformas
abaixo emitem **Let's Encrypt automaticamente** ao detectar o domínio.

### Modelo 1 — Tudo num domínio (mais simples)

O backend serve a SPA + API + WS no mesmo domínio; `VITE_API_URL` fica vazio.

```
netsheet.app ──► Railway/Render/Fly.io (SPA + /api + wss://netsheet.app)
```

1. **Compre o domínio** em um registrar (Namecheap, Registro.br, Google…).
2. **No painel do backend**, adicione o domínio customizado:
   - **Railway** → aba *Settings → Custom Domains*: `netsheet.app` (+ `www`).
     A plataforma mostra o registro DNS esperado (A record → IP do serviço).
   - **Render** → *Settings → Custom Domains*: digite o domínio e copie o
     registro indicado (A record para o IP dedicado). *(Custom domain no
     Render exige plano pago — free não aceita domínio próprio.)*
   - **Fly.io** → `fly certs create netsheet.app` e depois aponte os DNS:
     `fly ips list` dá os IPs IPv4 (A record) e IPv6 (AAAA) do app.
3. **No painel do registrar**, crie o registro:
   - Apex (`netsheet.app`): **A record** → IP fornecido pela plataforma.
   - Subdomínio (`www.netsheet.app`): **CNAME** → `www.netsheet.app` para o
     domínio canônico da plataforma (ex.: `netsheet.up.railway.app`).
4. **Aguarde a propagação** (minutos a ~24h) e verifique:
   `dig netsheet.app +short` / `nslookup netsheet.app`.
5. O HTTPS é emitido sozinho; confira com `curl -I https://netsheet.app/api/health`.

### Modelo 2 — Frontend estático + subdomínio de API

Frontend no Vercel/Netlify, backend no Railway/Render/Fly.io.

```
netsheet.app (Vercel/Netlify) ──► api.netsheet.app (backend, wss://api.netsheet.app)
```

1. **Frontend**:
   - **Vercel** → *Project → Settings → Domains*: adicione `netsheet.app`.
     Registro no registrar: apex → **A `76.76.21.21`**; `www` → **CNAME
     `cname.vercel-dns.com`**. TLS automático + redirect `www → apex`
     opcional. Depois, **env de build** `VITE_API_URL=https://api.netsheet.app`
     e redeploy.
   - **Netlify** → *Domain settings → Add a domain*: apex → **A record**
     para o IP do Netlify (a plataforma exibe o valor exato); `www` → **CNAME**
     para `<site>.netlify.app`. TLS automático (Let's Encrypt).
2. **Backend**: siga o Modelo 1 com `api.netsheet.app` no lugar do apex
   (subdomínio → mesmo processo: A/CNAME + certificado automático).
3. **Env de build** do frontend: `VITE_API_URL=https://api.netsheet.app`
   (apenas origin, sem path — T10.2) → REST/SSE apontam para o backend e o
   WebSocket vira `wss://api.netsheet.app/ws/rooms/:code`.

### Cloudflare (opcional)

Se usar o Cloudflare como DNS/proxy na frente:

- **DNS-only (cinza)**: mais simples — os certificados das plataformas bastam.
- **Proxy (laranja)**: use o modo **Full (strict)** (não "Flexible") e
  mantenha o certificado de origem válido; o Cloudflare suporta WebSocket.
  Em "Flexible", o TLS termina no Cloudflare e o backend recebe HTTP — o
  navegador ainda vê `wss`, mas é uma camada a menos de segurança.

### Checklist de verificação

```bash
dig netsheet.app +short                          # IP correto após propagação
curl -I https://netsheet.app/api/health          # 200 + HTTPS (TLS 1.2+)
curl -I https://api.netsheet.app/api/health      # backend direto (Modelo 2)
# SPA serve por HTTPS e o WS conecta (o E2E WS aceita BASE_URL=https://...):
BASE_URL=https://netsheet.app node scripts/test-ws-e2e.mjs
```

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
