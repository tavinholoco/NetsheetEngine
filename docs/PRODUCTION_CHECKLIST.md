# NETSHEET ENGINE — Checklist de Produção (Fase 10, T10.7)

Resultado da auditoria de produção em **10/08/2026** (T10.7). Cada item tem
status, evidência e o comando para revalidar.

---

## 1. Segredos fora do bundle ✅

| Verificação | Resultado |
|---|---|
| Variáveis `VITE_*` existentes | Apenas `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **todas públicas por design** |
| `VITE_SERVICE_ROLE` / `VITE_GEMINI` no código | **Não existem** (`grep` em `src/` + `server/`) |
| Bundle do cliente (`dist/assets/*.js`) | Grep por `AIzaSy…`, `GOCSPX-…`, `service_role…`: **zero chaves** (o único match é o texto de UI *"GEMINI_API_KEY no servidor."*) |
| JWT inline no bundle | Somente a **anon key demo** (`role: "anon"`, `iss: "supabase-demo"`) — fallback público, nunca a service role |
| `.env.local` | Gitignorado (`git check-ignore` ✓) |
| Bloqueio em CI | gitleaks v8.23.3 pinado (`.gitleaks.toml`) + SARIF na aba Security — falha o push se vazar |

**Regra de ouro:** chaves com prefixo `VITE_` vão para o bundle → **nunca** criar
`VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_GEMINI_API_KEY` ou qualquer `VITE_` com
segredo. Tudo que é secreto entra por variável de runtime do servidor
(`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`).

*Revalidar:* `npm run build` → `grep -rhoE "AIzaSy|GOCSPX|service_role" dist/assets/*.js`
(esperado: vazio).

## 2. Variáveis por ambiente ✅

| Grupo | Variáveis | Build (inline) ou runtime | Onde definir |
|---|---|---|---|
| Cliente | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | **build** (inline no bundle) | Plataforma estática + backend (Docker build-args) |
| Cliente | `VITE_API_URL` | **build** | Plataforma estática (frontend) |
| Servidor | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` | **runtime** (secrets) | Painel do Render (secrets) |
| Servidor | `CORS_ORIGINS` | **runtime** | Allowlist de origins do frontend (T10.6) |
| Servidor | `PORT`, `HOST` | runtime | Plataformas injetam `PORT` |

**Matriz de ambientes recomendada:**

| Ambiente | Supabase | Frontend | `VITE_API_URL` | `CORS_ORIGINS` |
|---|---|---|---|---|
| Local | `supabase start` (54321) | Vite dev (3000) | *(vazio)* | *(vazio)* |
| Staging | projeto cloud `staging` | Vercel preview | `https://api-staging.<domínio>` | `https://preview-<hash>.vercel.app` |
| Produção | projeto cloud `prod` | Vercel/Netlify | `https://api.<domínio>` | `https://<domínio>,https://www.<domínio>` |

> Como `import.meta.env` é inline no build, **um build por ambiente** — nunca
> reutilizar o artefato de staging em produção.

## 3. RLS em produção ✅ (56/56)

- **Migrations 0001–0006** em `supabase/migrations/` (profiles, friendships,
  friend_requests, direct_messages, character_sheets, rooms, storage).
- **Suíte automatizada** `supabase/tests/rls_tests.sql` + runner
  `scripts/test-rls.mjs` → **56/56 PASS** (executado em 10/08/2026 contra o
  Postgres local, container `supabase_db_*`).
- Cobre: anon bloqueado em todas as tabelas; authenticated cross-user
  bloqueado (update/delete de perfil alheio, amizade não-participada, ficha de
  terceiro, storage de outro usuário); **rooms servidor-only** (sem policies —
  nem anon nem authenticated leem o estado das mesas).
- A tabela `rooms` (persistência Fase 3) usa a **service role** no servidor
  (bypassa RLS de propósito — é o único caminho de escrita).

**Para validar no cloud após aplicar as migrations:**
```bash
supabase db push                  # aplica 0001–0006 no projeto remoto
# roda a MESMA suíte SQL contra o Postgres de produção (via psql ou o runner
# apontando SUPABASE_DB_CONTAINER para o container; para o cloud, use
# "supabase test db" ou pipe o SQL no psql com a connection string de produção)
```
*Revalidar (local):* `node scripts/test-rls.mjs` → esperado `56/56`.

## 4. Checklist pré-release ✅

- [x] `tsc --noEmit` zero erros (gate do CI)
- [x] Vitest **141/141** + E2E WS 5/5 + Playwright **6/6** (CI verde)
- [x] Build Docker: health 200, SPA, JSON 404, E2E WS dentro do container
- [x] `/api/health` enriquecido (version/uptime/rooms) + monitor externo (T10.4)
- [x] CORS por allowlist (T10.6) — `CORS_ORIGINS` configurada com a origin real
- [x] Instância única (estado em memória — Yjs/WS); sem escala horizontal
- [x] Segredos como *secrets* da plataforma (nunca em `.env` commitado)
- [x] gitleaks CI ativo (bloqueia push com segredo)

## 5. Recomendações contínuas

- **Rotação:** service role/Gemini/Google OAuth secrets ficam ativos só onde
  necessário; rotacionar se algum dia forem expostos (nenhum encontrado).
- **2FA** em GitHub, Supabase e registrar do domínio.
- **`npm audit`** periódico (devDeps de ferramentas, sem secrets).
- **Monitoramento** ativo via T10.4 (UptimeRobot: health + SSL).
- **Backups do Supabase cloud** habilitados (retenção automática).

## 6. Banco de dados — backups/PITR + migrations no CI (T10.8)

### Backups automáticos / PITR (ação manual do usuário)

1. No painel do Supabase cloud: **Database → Backups**.
2. Ative **PITR (Point-in-Time Recovery)** e escolha a retenção (7/14/30 dias).
   *(Recurso pago — o plano free não inclui PITR, apenas backups manuais.)*
3. Confirme que os **backups diários automáticos** estão habilitados.

### Migrations via `supabase db push` no CI

O CI ganhou o job **`db-sync`** (`.github/workflows/ci.yml`): no push ao
`master` ele roda `supabase link` + `supabase db push` aplicando as migrations
`0001–0006`. O job é **inerte até você configurar 2 secrets no repo**
(Settings → Secrets and variables → Actions):

| Secret | Valor | Onde obter |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal access token | Supabase → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Identificador do projeto cloud | Supabase → Project Settings → General (subdomain `xxxx.supabase.co`) |

Sem os secrets, o job pula com `exit 0` (verde, sem efeito). Depois de
configurá-los, qualquer mudança em `supabase/migrations/` aplica no push ao
master — e **sempre rode `node scripts/test-rls.mjs` após aplicar** para
validar as políticas (56/56).
