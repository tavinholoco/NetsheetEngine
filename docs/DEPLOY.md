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
| `ROOM_OFFLINE_TIMEOUT_MS` | runtime | Opcional — timeout de `isOnline` da mesa (T3.4). Padrão 60 s |
| `ROOM_ABANDONED_TIMEOUT_MS` | runtime | Opcional — janela de abandono: o coletor encerra a mesa após este tempo sem ninguém ativo (B.5). Padrão 24 h. **Diminuir com cuidado — o delete é irreversível** |
| `MAX_ROOMS` | runtime | Opcional (E.03) — quantas salas podem estar abertas ao mesmo tempo. **Padrão 30.** Criar sala não exige login no servidor, e cada sala é memória na instância de 512 MB e uma linha no banco. Se o GM ver "o servidor está com o máximo de mesas abertas" (`503 rooms_full`, com `rooms_full` no log), subir aqui: é a saída sem deploy de código. As vagas voltam sozinhas 24 h depois da última atividade de cada sala |
| `TRUST_PROXY` | runtime | **No Render: `loopback, linklocal, uniquelocal` + as faixas do Cloudflare** (R.5, 01.3 — definida no painel em 10/10/2026; o valor inteiro está abaixo da tabela). Em quais proxies confiar para achar o IP do jogador. O padrão do código, `1` em produção, **não serve no Render** — medido: a cadeia é jogador → borda do **Cloudflare** → proxy interno com endereço **privado** → app. Com `1`, o `req.ip` é o proxy privado; só com os privados, a borda do Cloudflare — e os limitadores viram um balde por borda. Confiar por **faixa**, e não por número de saltos, continua certo se o Render mudar a cadeia, e um `X-Forwarded-For` forjado fica à esquerda do IP que o Cloudflare anexa, onde o Express não chega. Aceita número de saltos, `false` ou lista de endereços/sub-redes; `true` é recusado (deixaria o cliente escolher o próprio IP). Conferir com o passo 1 da verificação pós-deploy |

**O valor da `TRUST_PROXY` no Render** (10/10/2026) — os privados e as faixas oficiais do Cloudflare,
de [cloudflare.com/ips-v4](https://www.cloudflare.com/ips-v4) e [/ips-v6](https://www.cloudflare.com/ips-v6).
Se o Cloudflare publicar faixa nova, o sintoma é o `clientIp` do health voltar a ser um IP dele:
refazer a linha a partir das duas listas.

```
loopback, linklocal, uniquelocal, 173.245.48.0/20, 103.21.244.0/22, 103.22.200.0/22, 103.31.4.0/22, 141.101.64.0/18, 108.162.192.0/18, 190.93.240.0/20, 188.114.96.0/20, 197.234.240.0/22, 198.41.128.0/17, 162.158.0.0/15, 104.16.0.0/13, 104.24.0.0/14, 172.64.0.0/13, 131.0.72.0/22, 2400:cb00::/32, 2606:4700::/32, 2803:f800::/32, 2405:b500::/32, 2405:8100::/32, 2a06:98c0::/29, 2c0f:f248::/32
```

> **NUNCA** commite valores reais: o CI roda **gitleaks** e bloqueia o push.

## Healthcheck

`GET /api/health` → **sempre `200` quando o processo está vivo** (sem rate
limit — bots externos não podem ser bloqueados por IP). Desde a T10.4 o
payload é rico para monitoramento:

```json
{
  "status": "online",
  "system": "NETSHEET ENGINE — Cyberpunk 2020 Multiplayer API",
  "version": "0.4.4",          // versão do build (do package.json) — anda junto com a tag (R.9)
  "uptime": 48213,             // segundos desde o boot do processo
  "timestamp": "2026-08-10T…Z",
  "env": "production",
  "rooms": { "active": 3, "players": 7 },  // salas/jogadores na memória
  "clientIp": "203.0.113.10"   // R.5 — o SEU IP, como os limitadores o enxergam
}
```

O `clientIp` devolve a quem pergunta o próprio IP — nunca o de outra pessoa. Serve para conferir o
`trust proxy` (R.5): se ele vier como um endereço interno do Render ou um IP do Cloudflare em vez do
seu, os limitadores estão contando todo mundo no mesmo balde — ver a `TRUST_PROXY` acima.

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
- **Mergear com mesa aberta: pode, mas não no meio de um combate** *(desde a H.3d.4, 15/10/2026 — antes, a
  regra era "não mergeie com uma mesa aberta", da E.06 de 30/09; o histórico vem a seguir)*. A troca de
  instância não perde nada — provado no ar, 30 de 30 ações —, mas a mesa fica ~5–15 s "reconectando": as ações
  demoram e se repetem sozinhas. *O porquê da regra antiga:* mesmo com 1
  réplica, **cada deploy roda duas instâncias por pelo menos 60 s**: no deploy sem interrupção, a
  instância nova sobe, restaura as salas do banco e passa a receber o tráfego novo; a velha segue com os
  WebSockets de quem estava jogando e só recebe o `SIGTERM` 60 s depois, com mais 30 s de carência
  ([Render — deploys](https://render.com/docs/deploys)). Nesse intervalo, o que o GM faz por REST cai na
  nova e o que a mesa faz pelo WebSocket, na velha — e a nova nunca relê o banco. **Medido no ar (H.1j,
  14/10/2026):** as duas ficaram vivas **~20 s**, não os 60 s da doc, e o que a velha recebeu nesse tempo se
  perdeu; os jogadores voltaram sozinhos em 3 s, no mesmo assento. **No log do Render (H.3d.0, 15/10):** a
  velha levou o `SIGTERM` 5 s depois de a nova abrir a porta, na troca do tráfego; e o serviço **não tem**
  *Health Check Path* — o Render testa a porta TCP. O Render publica a cada push no
  `master` (e no "Manual Deploy"), então a regra é de quem mergeia: PR de código, só fora de sessão de
  jogo. O conserto no código — a passagem de bastão entre as instâncias — é a **H.3d** do plano (o H.13 do
  [ledger da H](./varreduras/H-multiplayer.md), a [ADR 0007](./adr/0007-passagem-de-bastao.md)), **provado no ar
  na H.3d.4 (15/10/2026)**.
- **A passagem de bastão (H.3d — ADR 0007):** em produção, a instância nova pede o bastão
  (`instance_lease`) e só lê o banco e abre a porta depois de a velha entregar — e a velha, ao entregar,
  avisa os navegadores por um quadro de dados e segue aceitando ações por 2 s (H.3d.5: no ar, o fechamento de
  WebSocket que o servidor manda **não chega** ao navegador), depois recusa ações com `503 server_restarting`,
  fecha os sockets e grava tudo. Os jogadores veem um
  "reconectando" curto (medido no ar: **12,4 s**, a maior parte na troca do próprio Render, que variou de 2 a
  10 s) e o cliente repete as ações sozinho. **Não configure um *Health
  Check Path* que responda antes do bastão:** o desenho depende de a porta só abrir depois dele. No log de um
  deploy, a sequência é `lease_released` e `handoff_drained` na velha, `lease_acquired` (`how:
  handed-over`) na nova. `lease_forced`, `lease_unavailable` ou `lease_orphaned_exit` são a borda — o que
  cada um quer dizer está na ADR. **O primeiro deploy com este código** ainda perde como antes: a velha não
  tem o bastão para entregar.
- Se escalar horizontalmente no futuro, será preciso um pub/sub compartilhado
  (ex.: Redis/Postgres LISTEN) — fora do escopo atual (documentado no
  ADR-0002).

---

## Render — alvo único de backend

> **Serviço em produção: `https://netsheetengine.onrender.com`** — sem hífen; o nome do
> `render.yaml` (`netsheet-engine`) **não** é o endereço. Registrado em 26/09/2026, quando a
> ausência da URL no repositório impediu conferir o deploy da Fase C. Naquela data o serviço estava
> **suspenso** no Render (`503 Service Suspended`, o que é diferente de hibernado: hibernado acorda
> em 30–50 s; suspenso não sobe com requisição nenhuma): o workspace **estourou as 750 h de setembro**,
> por instâncias do Newra News criadas sem querer (erro operacional do dono, já corrigido lá). **Volta em 01/10/2026** — o que conferir nesse dia está na seção de
> operação do [plano](./PLANO_MESTRE.md#linha-de-base-atual). O produto ainda não foi publicado.

> **O serviço em produção é Docker** (painel: `NetsheetEngine`, selo *Docker*, região `us-west1`) —
> **não** o Blueprint do `render.yaml`, que descreve um serviço de runtime nativo que não existe.
> Conferido no painel em 10/10/2026: o log do build roda os estágios do [`Dockerfile`](../Dockerfile).
>
> **Versão do Node: a do `FROM` do `Dockerfile`, que segue a versão maior do
> [`.node-version`](../.node-version) (24, LTS)** — o arquivo que o CI usa (`node-version-file`). O
> Render **não** lê o `.node-version` num serviço Docker. *A R.8 supôs que lia; o `Dockerfile` ficou em
> `node:22-alpine` e a produção rodou o 22 enquanto o CI testava o 24, até 10/10/2026 (item 01.10 do
> plano).* Trocar de versão é mudar os dois — o `node-version.test` falha se divergirem.

Para recriar o serviço do zero: **New → Web Service**, o repositório, runtime **Docker** (o Render
acha o `Dockerfile` na raiz), plano free, health check `/api/health` e auto-deploy no `master`; as
variáveis da tabela acima no painel — as `VITE_*` também valem no build, porque o Render as passa
como *build args* ao Docker. O `render.yaml` (Blueprint, runtime nativo) é a alternativa que **não**
está em uso.

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
        VITE_API_URL=https://netsheetengine.onrender.com
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
     (`netsheetengine.onrender.com`).
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

**Um comando só (desde 30/09/2026):**

```bash
node scripts/verify-prod.mjs                       # padrão: https://netsheetengine.onrender.com
node scripts/verify-prod.mjs http://127.0.0.1:3000 # contra um build de produção local
```

Ele roda as checagens abaixo **e** as da revisão pós-D — versão publicada = `package.json` (R.9),
`clientIp` = seu IP (R.5, sem imprimir IP), versão certa na interface, lobby fechado
(`GET /api/rooms` → 404, R.11), `join` sem prova → 409 `seat_taken` (R.1), `create` com código em uso
→ 409 `room_exists` (R.2) e o E2E de WebSocket —, com uma sala de teste que ele apaga no fim. Uma
requisição por passo (só o health tenta 3 vezes, porque o serviço dorme). Sai com erro se algo falhar.
Fora dele, só no painel do Render: a **versão do Node** no log do build e o uso do workspace.

Os mesmos passos, à mão:

```bash
# 1. Healthcheck — e o `clientIp` tem de ser o seu IP público (R.5, trust proxy).
#    Compare com: curl -s https://api.ipify.org
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

# 6. Lobby fechado (R.11) — ninguém lista as salas
curl -s -o /dev/null -w "%{http_code}\n" https://SEU-DOMINIO/api/rooms   # esperado: 404
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
  `ws/wss/https` para o WebSocket das mesas e Supabase; **fontes só do próprio
  origin** — auto-hospedadas pelo `@fontsource` desde a F.0c, porque o `@import`
  do Google era recusado em silêncio), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS. Em dev o helmet é
  pulado (o Vite HMR precisa de inline/eval) — por isso o E2E
  `e2e/fonts-csp.spec.ts`, que roda o build de produção, falha com qualquer
  violação de CSP: é o único lugar em que o CSP do ar é exercitado antes do deploy.
- **Logs estruturados** — JSON lines no stdout (`{"t","level","event",...}`),
  parseáveis por qualquer coletor; nunca logam segredos.

## Build local (docker)

```bash
docker build -t netsheet-engine \
  --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GEMINI_API_KEY=... netsheet-engine
```
