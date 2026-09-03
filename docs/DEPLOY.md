# NETSHEET ENGINE — Guia de Deploy

> **Render é o único alvo de backend** (Fase A, `A.6` do
> [`PLANO_MESTRE.md`](./PLANO_MESTRE.md), DOC-02). Railway e Fly.io foram arquivados em
> [`docs/deploy-alternativas/`](./deploy-alternativas/) — não mantidos ativamente.

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
| `CORS_ORIGINS` | runtime | **Allowlist CORS (T10.6)** — origins do frontend estático, separadas por vírgula (ex.: `https://netsheet.app,https://www.netsheet.app`). Vazio = sem CORS; `*` = qualquer origin (legado) |
| `PORT` | runtime | Injetada automaticamente pelas plataformas (default 3000) |
| `HOST` | runtime | Obrigatório `0.0.0.0` em containers (default já é esse) |
| `ROOM_OFFLINE_TIMEOUT_MS` | runtime | Opcional — timeout de `isOnline` da mesa (T3.4) |

> **NUNCA** commite valores reais: o CI roda **gitleaks** e bloqueia o push.

## Healthcheck

`GET /api/health` → **sempre `200` quando o processo está vivo** (sem rate
limit — bots externos não podem ser bloqueados por IP). Desde a T10.4 o
payload é rico para monitoramento:

```json
{
  "status": "online",
  "system": "NETSHEET ENGINE — Cyberpunk 2020 Multiplayer API",
  "version": "0.4.0",          // versão do build (do package.json)
  "uptime": 48213,             // segundos desde o boot do processo
  "timestamp": "2026-08-10T…Z",
  "env": "production",
  "rooms": { "active": 3, "players": 7 }  // salas/jogadores na memória
}
```

Já configurado no `HEALTHCHECK` do Dockerfile e nas plataformas. Rotas
`/api/*` desconhecidas respondem **JSON 404** (não HTML da SPA) — seguro para
uptime bots.

## Monitoramento externo (T10.4)

> ### 🛑 NÃO aponte um uptime bot para o `/api/health` enquanto estiver no plano gratuito
>
> A recomendação original desta seção era um monitor a cada 5 minutos. **Ela quebra o free tier do
> Render — e não só o deste projeto.**
>
> O Render concede **750 horas de instância grátis por _workspace_ por mês** e hiberna um serviço
> gratuito após 15 minutos sem tráfego de entrada. Um monitor de 5 em 5 minutos nunca deixa o
> serviço hibernar: ele passa a consumir **~730 h/mês sozinho**, de um orçamento compartilhado por
> **todos** os serviços do workspace. Quando as 750 h acabam, o Render **suspende os serviços
> gratuitos até a virada do mês**.
>
> Na prática, ligar esse monitor derrubaria também o `newra-news-api`, que divide o mesmo workspace.
>
> **O que fazer em vez disso:**
> - Aceitar a hibernação. O cliente manda heartbeat a cada 20 s enquanto a mesa está aberta, então o
>   serviço **não hiberna durante uma sessão** — só entre sessões, e voltar leva ~1 min.
> - O incômodo real da hibernação não é a espera, é a perda das sessões em memória (SEC-03). A
>   correção está na Fase B do [`PLANO_MESTRE.md`](./PLANO_MESTRE.md), não num uptime bot.
> - Se quiser aviso de queda, use um check **de baixa frequência** (1×/dia ou 1×/semana) ou um
>   monitor que só rode em janela de jogo. A tabela abaixo vale **apenas em plano pago**.

Em **plano pago** (sem hibernação e sem cota de horas), o healthcheck serve de pulso para um
**uptime bot** externo — fora da plataforma, para avisar quando o deploy "morre" mas o provedor não
nota:

| Serviço | Setup | Observações |
|---|---|---|
| **UptimeRobot** | *Add New Monitor → HTTP(S)* → URL `https://SEU-DOMINIO/api/health`, intervalo 5 min, resposta esperada `200` + *Alert when keywords exist* = `online` | Plano free: 50 monitores. Adicione também um **monitor de SSL** (`https://SEU-DOMINIO`) para avisar 14/7/3 dias antes da expiração do certificado |
| **StatusCake** | *Uptime Test → HTTP(s)* → mesma URL + *Validation: keyword* `online` | Inclui verificação de **SSL/TLS** e alertas por e-mail, Slack, Telegram |
| **Alternativas** | Better Uptime, Hetrix, Grafana Cloud (sintetizado) | Mesma ideia: GET no `/api/health` esperando 200 + keyword `online` |

- **Contatos de alerta**: e-mail + canal do grupo (Telegram/Slack/Discord).
- **SLA de alerta**: falha em 1–2 checks consecutivos (5 min) antes de notificar.
- **Não** use o `/api/health` para decisões de tráfego (ele não mede latência
  nem estado do Supabase — é só liveness). A contagem `rooms.active` serve
  como termômetro manual: mesa vazia e subindo = deploy saudável e com uso.

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

## Render — alvo único de backend

1. Em [render.com](https://render.com): **New → Blueprint** e selecione o repo
   (detecta `render.yaml`).
2. Defina os valores das variáveis com `sync: false` no painel do serviço
   (o blueprint cria os placeholders).
3. O serviço sobe com runtime Node nativo (plano free ok), healthcheck
   `/api/health` e auto-deploy em push.

> Railway e Fly.io tinham seções próprias aqui até a Fase A. Os configs
> (`railway.toml`, `fly.toml`) e o porquê de terem saído do caminho principal
> estão em [`docs/deploy-alternativas/`](./deploy-alternativas/).

---

## Frontend estático (Vercel/Netlify) + backend no Render

Quando o SPA é hospedado estático (Vercel/Netlify) e o backend mora no
Render, o cliente precisa saber onde está a API. Isso é
resolvido por **`VITE_API_URL`** (Fase 10, T10.2) — uma só variável da qual
REST, SSE e WebSocket derivam:

```
Cliente estático (Vercel) ──► REST/SSE/WS ──► Express + WS (Render)
        VITE_API_URL=https://netsheet-api.onrender.com
```

### Configuração

1. **Backend** (Render — seção acima): suba normalmente.
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
>
> **CORS (T10.6):** desde o hardening, o servidor **não responde CORS por
> padrão**. Configure a env de runtime `CORS_ORIGINS` com as origins exatas
> do frontend (separadas por vírgula) — ex.: `CORS_ORIGINS=https://netsheet.app,https://www.netsheet.app`.
> Sem isso, o navegador bloqueia as chamadas cross-origin (mesmo origin
> continua funcionando).

---

## Domínio próprio + HTTPS (T10.3)

O HTTPS é **obrigatório** para o multiplayer: o WebSocket do navegador exige
`wss://` (o cliente já deriva `ws→wss` automaticamente quando a página e o
`VITE_API_URL` usam `https` — `src/api/base.ts`). O Render emite
**Let's Encrypt automaticamente** ao detectar o domínio.

### Modelo 1 — Tudo num domínio (mais simples)

O backend serve a SPA + API + WS no mesmo domínio; `VITE_API_URL` fica vazio.

```
netsheet.app ──► Render (SPA + /api + wss://netsheet.app)
```

1. **Compre o domínio** em um registrar (Namecheap, Registro.br, Google…).
2. **No painel do Render**, *Settings → Custom Domains*: digite o domínio e
   copie o registro indicado (A record para o IP dedicado). *(Custom domain
   no Render exige plano pago — free não aceita domínio próprio.)*
3. **No painel do registrar**, crie o registro:
   - Apex (`netsheet.app`): **A record** → IP fornecido pelo Render.
   - Subdomínio (`www.netsheet.app`): **CNAME** → domínio canônico do serviço
     (`netsheet-engine.onrender.com`).
4. **Aguarde a propagação** (minutos a ~24h) e verifique:
   `dig netsheet.app +short` / `nslookup netsheet.app`.
5. O HTTPS é emitido sozinho; confira com `curl -I https://netsheet.app/api/health`.

### Modelo 2 — Frontend estático + subdomínio de API

Frontend no Vercel/Netlify, backend no Render.

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

# 5. Netrunner AI — desde a Fase B (B.1) o endpoint EXIGE JWT do Supabase.
#    Sem Authorization a resposta correta é 401: se vier 200, o SEC-01
#    voltou e a chave do dono está exposta.
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://SEU-DOMINIO/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Diga oi"}'          # esperado: 401
```

## Hardening (T10.6)

O servidor aplica as seguintes proteções (todas validadas por curl em
produção):

- **CORS por allowlist** — `CORS_ORIGINS` (env). Sem a env, nenhum origin
  recebe headers CORS; `*` reabilita o legado. Auth por token de sessão no
  body (sem cookies), então origin permitida não abre CSRF.
- **Rate limit global** — 600 req/min por IP em `/api/*`, **exceto
  `/api/health`** (uptime bots não podem ser bloqueados), somado aos limiters
  específicos de mesa (`roomLimiter` 120/min, `chatLimiter` 30/min).
- **helmet (production)** — security headers: `Content-Security-Policy`
  customizada (script só do próprio origin; estilos inline liberados para
  Tailwind/React; imagens `https:` para avatares do storage; conexões
  `ws/wss/https` para o WebSocket das mesas e Supabase), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS. Em dev o helmet é
  pulado (o Vite HMR precisa de inline/eval).
- **Logs estruturados** — JSON lines no stdout (`{"t","level","event",...}`),
  parseáveis por qualquer coletor; nunca logam segredos.

## Build local (docker)

```bash
docker build -t netsheet-engine \
  --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GEMINI_API_KEY=... netsheet-engine
```
