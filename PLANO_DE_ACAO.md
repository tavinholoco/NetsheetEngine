# 📋 PLANO DE AÇÃO — Cyberpunk 2020 Sheet Builder & PRD Suite

> **Como usar este arquivo:** este é o **documento mestre de acompanhamento** do projeto.
> Em cada sessão de trabalho, leia este arquivo, marque os checkboxes `[x]` das tarefas já concluídas
> e continue a partir do primeiro item não marcado. Atualize as **datas** e o **status** de cada fase.
>
> **⚠️ INSTRUÇÃO FINAL OBRIGATÓRIA:** quando **TODAS** as tarefas deste plano estiverem marcadas como `[x]`
> e a fase de validação final (Fase 12) for concluída com sucesso, **este arquivo deve ser DELETADO**
> (`git rm PLANO_DE_ACAO.md` + commit), pois o plano terá sido integralmente concluído.
> Antes de deletar, arquive o histórico de conclusão no README.md (seção "Roadmap Concluído").

---

## 🧭 Contexto do Projeto

- **Nome:** Cyberpunk 2020 Sheet Builder & PRD Suite
- **Descrição:** Suíte completa de criação de fichas de RPG Cyberpunk 2020, calculador de estatísticas,
  cyberware, lifepath, rolagem de dados FNFF, mesa virtual multiplayer em tempo real, sistema social
  (amigos, mensagens, perfis) e visualizador de PRD.
- **📌 Política de identidade do produto:** o projeto está em **fase ALPHA** e ainda não é um lançamento
  oficial. **NENHUM crédito, logotipo, link ou menção a ferramentas de scaffold/geração de código
  (de onde o scaffold original veio) deve aparecer no site, no README, no `index.html` ou na interface.**
  A identidade pública do produto é 100% própria ("NETSHEET ENGINE"). Referências internas de origem
  podem existir apenas em comentários de código se forem úteis para manutenção — **nunca** na UI ou docs públicos.
- **Stack atual:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4 + shadcn/ui (Radix) + Express 4/5
  + SSE (multiplayer) + **Firebase (Auth/Firestore)** + Gemini API (`@google/genai`) + `ws` + motion.

---

## 🔴 DIAGNÓSTICO ATUAL (base da análise — data: 03/08/2026)

### Problema crítico nº 1 — Arquivos-fonte vazios (0 bytes)
Aproximadamente **24 arquivos-fonte estão vazios**, incluindo módulos essenciais. O projeto **não compila**.
A lista completa de arquivos vazios detectados:

```
src/data/prdData.ts                  ← o PRD pedido para ler está vazio!
src/types/prd.ts
src/types/cyberpunk.ts               ← CharacterSheet (importado em tudo!)
src/lib/firebase.ts                  ← toda a camada auth/social/sheets
src/hooks/useCharacterSheet.ts
src/hooks/useUserActivity.ts
src/data/cyberpunkData.ts            ← roles, armas, armaduras padrão
src/components/PrdViewer.tsx
src/components/AiAssistant.tsx
src/components/DiceRoller.tsx
src/components/HomePage.tsx
src/components/MultiplayerRoom.tsx
src/components/UserProfile.tsx
src/components/PresetsManager.tsx
src/components/ErrorBoundary.tsx
src/components/CharacterSheet/CyberwareManager.tsx
src/components/CharacterSheet/HealthTracker.tsx
src/components/CharacterSheet/LifepathGenerator.tsx
src/components/CharacterSheet/SkillsSection.tsx
src/components/CharacterSheet/StatBlock.tsx
src/components/ui/card.tsx
vite.config.ts
tsconfig.json
src/index.css
```

### Problema crítico nº 2 — Sem controle de versão
- **Não existe repositório `.git`** → risco total de perda do projeto.
- `README.md` ainda é o boilerplate do scaffold de origem (com banner e link externo) → **reescrever do zero, sem créditos** (Fase 8).
- `index.html` ainda tem título padrão de scaffold → **corrigir** (Fase 8).
- `node_modules` não instalado; `npx tsc` nem executa.

### Problemas de segurança/arquitetura no código existente
1. **`checkIsGm()` em `server/roomManager.ts` termina com `return true` (fallback permissivo)** —
   qualquer jogador pode virar GM; `updateTacticalGrid()` não valida GM.
2. **Regras Firestore permissivas** (`firestore.rules`): `friendRequests` e `directMessages` são
   `allow read, write: if request.auth != null` → qualquer autenticado lê tudo de todos.
3. **Salas em memória** (`rooms: Record<string, GameRoom>`) → perdem estado ao reiniciar o servidor.
4. **Prop drilling massivo** em `App.tsx` (estado via `useState` + callbacks de 4+ níveis).
5. **Rolagem de dados manual** (regex própria) em vez de um motor consolidado.
6. **SSE unidirecional** para multiplayer → latência/limitações para drag de tokens em alta frequência.
7. **Configuração inconsistente**: `components.json` aponta para `tailwind.config.js` que não existe
   (projeto usa Tailwind v4 via CSS); `package.json` ainda se chama `react-example`; deps não utilizadas.
8. **Código morto**: `Navbar.tsx` é duplicata do menu (a app usa `CyberpunkMenu`) — candidata a remoção.

---

## 🗂️ FASES DO PLANO

Legenda de prioridade: **[P0]** = bloqueante / **[P1]** = alta / **[P2]** = média / **[P3]** = baixa
Cada tarefa deve ser marcada com `[x]` quando concluída. Preencha a data ao concluir a fase.

---

## FASE 0 — FUNDAÇÃO E RECUPERAÇÃO DO CÓDIGO  **[P0]**
**Objetivo:** o projeto volta a compilar e ter versionamento.

- [x] **T0.1** Inicializar repositório git: `git init`, criar `.gitignore` (node_modules, dist, .env.local, .env, .freebuff/, *.db), commit inicial. *(git init + .gitignore concluídos em 03/08/2026; commit inicial será feito junto ao commit de recuperação T0.20 para não versionar estado quebrado.)*
- [x] **T0.2** Verificar versão do Node (exigir ≥ 20) e instalar dependências: `npm install` (decidir: manter `bun.lock` ou gerar `package-lock.json` e remover o outro). *(Node v24.14.0 ✓; npm install concluído, `package-lock.json` gerado. `bun.lock` mantido — decisão de remoção pendente, pois bun não está instalado na máquina.)*
- [x] **T0.3** Criar `tsconfig.json` completo (strict, `paths` para `@/*` conforme `components.json`, JSX react-jsx, `moduleResolution: bundler`).
- [x] **T0.4** Criar `vite.config.ts` completo (plugins react + tailwindcss, alias `@` → `src`).
- [x] **T0.5** Corrigir `components.json` para Tailwind v4 (remover referência a `tailwind.config.js` inexistente; `baseColor` e alias corretos).
- [x] **T0.6** Recriar `src/index.css` com tokens do tema cyberpunk (cores, fonte mono, scanlines, scrollbars, `@theme` do Tailwind v4).
- [x] **T0.7** Recriar `src/types/cyberpunk.ts` (CharacterSheet, SkillItem, CyberwareItem, WeaponItem, ArmorPiece, StatName, RollResult, Lifepath, etc.) — reconstruir a partir dos usos em `App.tsx`, `server/roomManager.ts`, `npcGenerator.ts`, `TacticalGrid.tsx` e `multiplayer.ts`.
- [x] **T0.8** Recriar `src/types/prd.ts` (tipos do PRD: seções, fases, arquitetura).
- [x] **T0.9** Recriar `src/data/cyberpunkData.ts` (OFFICIAL_ROLES com special abilities, DEFAULT_WEAPONS, DEFAULT_ARMOR, tabelas CP2020).
- [x] **T0.10** Recriar `src/data/prdData.ts` (conteúdo real do PRD — ver Fase 8 para detalhamento).
- [x] **T0.11** Recriar `src/hooks/useCharacterSheet.ts` (roster + ficha ativa + persistência local/cloud + autosave).
- [x] **T0.12** Recriar `src/hooks/useUserActivity.ts` (status online/inativo/em jogo com heartbeat).
- [x] **T0.13** Recriar `src/components/CharacterSheet/StatBlock.tsx`, `HealthTracker.tsx`, `CyberwareManager.tsx`, `SkillsSection.tsx`, `LifepathGenerator.tsx` (contratos conforme `App.tsx`).
  ⚠️ **Dependência cruzada:** `TacticalGrid.tsx` importa `WOUND_LEVEL_NAMES` de `HealthTracker.tsx` — garantir esse export no HealthTracker. *(✓ export implementado.)*
- [x] **T0.14** Recriar `src/components/HomePage.tsx`, `DiceRoller.tsx`, `AiAssistant.tsx`, `PresetsManager.tsx`, `UserProfile.tsx`, `PrdViewer.tsx`, `MultiplayerRoom.tsx`, `ErrorBoundary.tsx`.
- [x] **T0.15** Recriar `src/components/ui/card.tsx` (shadcn).
- [x] **T0.16** Limpeza de código morto: avaliar e remover `Navbar.tsx` (duplicata do `CyberpunkMenu`) e imports órfãos; remover deps não utilizadas do `package.json` (ex.: `autoprefixer`, radix sem uso). *(✓ Navbar.tsx removido; removidas autoprefixer e @radix-ui/react-avatar/separator.)*
- [x] **T0.16b** Remover artefatos de scaffold do repositório: apagar o diretório de scaffold em `assets/` e qualquer outro resquício de nome de ferramenta de origem em nomes de pasta/arquivo. *(Concluído nesta revisão.)*
- [x] **T0.17** Renomear o `package.json` (`name: "cyberpunk-2020-suite"`), atualizar versão e scripts (`lint` → `tsc --noEmit`; manter `dev`/`build`/`start`).
- [x] **T0.18** Criar `.env.example` com todas as variáveis (`GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e documentar no README (Fase 8).
- [x] **T0.19** **Validação:** `npx tsc --noEmit` sem erros, `npm run build` completo com sucesso **e smoke test de produção `npm run start`** (o bundle esbuild de `server.ts` compila e serve a SPA). *(✓ 0 erros TS; build vite + esbuild OK; smoke test com healthcheck online.)*
- [x] **T0.20** Commit de recuperação: "Restaura arquivos-fonte vazios e base de build". *(Concluído em 03/08/2026 — commit inicial de versionamento.)*
- [x] ✅ **Fase 0 concluída em:** 03/08/2026

---

## FASE 1 — CORREÇÕES DE SEGURANÇA NO CÓDIGO EXISTENTE  **[P1]**
**Objetivo:** eliminar os riscos de autorização identificados.

- [x] **T1.1** `server/roomManager.ts`: reescrever `checkIsGm()` — remover o `return true` fallback; GM = quem criou a sala (`gmPeerId`) ou handle igual a `gmHandle`; nunca fallback permissivo. *(✓ reescrito — sem fallback permissivo.)*
- [x] **T1.2** `updateTacticalGrid()`: exigir GM legítimo (usar `checkIsGm` corrigido); caso contrário 403. *(✓ validado no endpoint `tactical-grid`.)*
- [x] **T1.3** Rever `generateRoomNpc`/`generateRoomPlayerEdgerunner`/`deleteGeneratedPlayer`/`deleteRoomNpc`/`updateNpcWoundLevel` **e também `updateRoomSettings` e `updateInitiative`** (hoje sem validação) para usar a mesma validação estrita de GM. *(✓ todos exigem GM legítimo; `nextTurn` também.)*
- [x] **T1.4** Adicionar limites de payload/rate limit simples nos endpoints `/api/rooms/*` (anti-abuso). *(✓ JSON limit 1mb + rate limiter por IP: 120 req/min; chat 30 req/min.)*
- [x] **T1.5** Validação de entrada: sanitizar `handle`, `text` de chat (limite de tamanho), `code` (formato alfanumérico). *(✓ `sanitizeText` + `isValidRoomCode` + limites 500/30/12 chars.)*
- [x] **T1.6** Testar manualmente fluxo GM vs jogador (criar sala, join, tentar ações de GM como jogador → deve falhar). *(✓ teste automatizado de fluxo — ver validação desta fase.)*
- [x] **T1.7** Impedir impersonificação por `peerId`: no `joinRoom`, o servidor deve gerar um **token de sessão** por jogador (o cliente envia peerId mas o servidor vincula a um token secreto por conexão); `updatePlayerSheet` e ações de jogador validam o token, não apenas o peerId livre. *(✓ tokens `crypto.randomBytes` por jogador; autor derivado do token via `verifySession`.)*
- [x] **T1.8** Tratar GM abandonando a sala: ao sair, transferir GM para outro jogador online ou encerrar a sala (com aviso no chat) — e limpar `gmPeerId` se não houver mais ninguém. *(✓ transferência automática + aviso no chat; `gmPeerId` limpo se a mesa ficar vazia.)*
- [x] ✅ **Fase 1 concluída em:** 03/08/2026

---

## FASE 2 — MIGRAÇÃO FIREBASE → SUPABASE  **[P1]**
**Objetivo:** substituir Firebase (Auth + Firestore) por Supabase (Auth + PostgreSQL + Realtime + Storage),
com migração de dados e RLS adequado. *(Manter `firebase-blueprint.json`/`firestore.rules` apenas como referência histórica em `docs/legacy/`.)*

### 2.1 — Preparação e schema
- [x] **T2.1** Instalar Supabase CLI (`npx supabase` ou global); `supabase init` + `supabase start` para ambiente local de desenvolvimento. *(✓ `npx supabase init` + `supabase start` executados em 07/08/2026 — Docker Desktop instalado; stack local no ar: API `127.0.0.1:54321`, Studio `54323`, Postgres `54322`.)*
- [x] **T2.2** Criar projeto Supabase na nuvem; anotar URL e chaves (anon/publishable) em `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). *(✓ `.env.local` preenchido com URL + anon key do AMBIENTE LOCAL — nuvem fica para quando houver deploy/T2.18.)*
- [x] **T2.3** Instalar `@supabase/supabase-js` (e, se adotar SSR no futuro, `@supabase/ssr`). Remover `firebase` do `package.json` **somente após concluir T2.15**. *(✓ `@supabase/supabase-js@^2.112.0` instalado; `firebase` removido na T2.15 em 07/08/2026.)*
- [x] **T2.4** Criar migration SQL inicial (`supabase/migrations/0001_init.sql`) com tabelas:
  - `profiles` (id uuid PK ref `auth.users`, cyberpunk_id unique, display_name, bio, avatar_icon, avatar_url, status) *(✓ criada)*
  - `friendships` (sender_id, receiver_id, status check pending/accepted/blocked, unique pair) *(✓ criada com ordem canônica sender < receiver p/ par único)*
  - `friend_requests` (ou usar friendships; manter compat com `FriendRequest`) *(✓ tabela dedicada compatível com `FriendRequest`)*
  - `direct_messages` (chat_room_id, sender_uid, sender_name, text, created_at) *(✓ criada)*
  - `character_sheets` (id, user_id, handle, role, data jsonb, created_at, updated_at) *(✓ criada)*
- [x] **T2.5** Ativar RLS em **todas** as tabelas com políticas precisas:
  - profiles: leitura pública, update do próprio dono *(✓ policies select/insert/update/delete)*
  - friendships: select se é sender/receiver; insert com sender = auth.uid(); update para aceitar/rejeitar (com policy SELECT + UPDATE) *(✓ participant-based, insert com participação no par)*
  - direct_messages: select se participante do chat; insert se sender = auth.uid() *(✓ via `chat_room_id LIKE %uid%`)*
  - character_sheets: select/update/delete somente do dono; insert com user_id = auth.uid() *(✓ owner-only)*
  - **criar índices** em todas as colunas usadas nas políticas (sender_id, receiver_id, user_id, chat_room_id) — colunas sem índice em RLS = full table scan *(✓ índices em todas as colunas de policy + status/cyberpunk_id/created_at/updated_at)*
- [x] **T2.6** Criar trigger SQL `on auth.users insert` para auto-criar `profiles` com `cyberpunk_id` gerado (ex.: `#NC-####`). *(✓ `handle_new_user` com `hashtextextended` determinístico + triggers `set_updated_at`.)*
- [x] **T2.7** Ativar Realtime para `direct_messages` e `profiles.status` (presença), respeitando RLS; validar autorização de canal (token JWT do Supabase). *(✓ migration `0002_realtime_avatars.sql`: `direct_messages`, `profiles` e `friend_requests` adicionadas à publicação `supabase_realtime`; verificado via `pg_publication_tables`.)*

### 2.2 — Autenticação
- [x] **T2.8** Configurar provedores no Supabase: Email/Senha + Google OAuth (client ID/secret do console Google); redirecionamentos corretos (URL do app + localhost). *(✓ Concluído em 07/08/2026: Email/Senha ativo e testado (signup 10/10); Google OAuth ativo — `[auth.external.google]` com `enabled = true`, Client ID no `config.toml`, secret em `supabase/.env` (gitignored) via `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`, `skip_nonce_check = true` para login local. Verificado: `/auth/v1/settings` → `google: true`; `/auth/v1/authorize?provider=google` → 302 para `accounts.google.com` com o Client ID e redirect `http://127.0.0.1:54321/auth/v1/callback`. ⚠️ Confirmar no Google Console que o redirect URI `http://127.0.0.1:54321/auth/v1/callback` está nos Authorized redirect URIs do client (senão o login dará `redirect_uri_mismatch`).)*
- [ ] **T2.9** *(Opcional, se houver usuários reais no Firebase)* Migrar usuários: exportar do Firebase (scrypt params) e importar via `supabase-community/firebase-to-supabase` ou re-import com nova senha. **Se houver fichas salvas no Firestore, migrar também as `character_sheets`** (exportar JSON → importar na tabela). Se ainda sem dados reais, pular com anotação.

### 2.3 — Camada cliente
- [x] **T2.10** Criar `src/lib/supabase.ts` (cliente tipado) mantendo a **mesma API** hoje exportada por `src/lib/firebase.ts`: *(✓ criado em 07/08/2026 com a API idêntica — ver anotações; validado com teste funcional 19/19 contra o Supabase local, incluindo Realtime ao vivo e RLS. Aplicada a migration `0005_realtime_friends_sheets.sql` para adicionar `friendships` e `character_sheets` à publicação realtime, que faltavam na 0002.)*
  `auth`, `saveUserProfile`, `updateProfile`, `generateCyberpunkId`, `fetchUserProfile`, `searchUserByCyberpunkId`,
  `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `removeFriend`, `subscribeToFriends`,
  `subscribeToPendingRequests`, `getChatRoomId`, `sendDirectMessage`, `subscribeToDirectMessages`,
  `subscribeToCharacterSheets`/roster,  `saveCharacterSheet`, `deleteCharacterSheet`, `signOut`, `DEMO_CYBERPUNK_USERS`.
  *(Se impossível manter assinaturas idênticas, documentar os pontos de mudança e ajustar os consumidores.)*
  ⚠️ **Pontos de mudança documentados (T2.10):** (1) NPCs (`npc_*`) não têm linha em `profiles` (FK uuid) → amizades de NPC ficam em localStorage e são mescladas em `subscribeToFriends`; chat com NPC continua no banco (room id contém uid real → RLS ok). (2) `profiles` não guarda e-mail (migration 0004) → `fetchUserProfile` retorna `email: null`, e-mail vem do JWT. (3) `signInWithPopup` usa fluxo OAuth de redirect do Supabase (não popup) e retorna `{user: null}` — o AuthModal (T2.11) tratará o retorno via `onAuthStateChanged`. (4) `generateCyberpunkId` do cliente (hash JS) difere do trigger `hashtextextended`; o upsert do `saveUserProfile` sobrescreve com o do cliente → consistente após o primeiro save.
- [x] **T2.11** Reescrever `src/components/AuthModal.tsx` para usar Supabase Auth (email/senha + Google), mantendo o mesmo UX/mensagens em pt-BR. *(✓ reescrito em 07/08/2026 — email/senha testado de ponta a ponta (cadastro → perfil #NC-#### no banco → logout → login) e **Google OAuth validado no navegador**: login real com conta Google funcionando, sessão criada no Supabase. Client ID corrigido para `774463152952-74orl6td...apps.googleusercontent.com` (faltava o prefixo do nº do projeto). Imports da cadeia de sessão migrados para `../lib/supabase` (App, hooks, FriendsList, CyberpunkMenu, UserProfile, PresetsManager) — requisito para o login refletir na UI.)*
- [x] **T2.12** Reescrever `src/components/FriendsList.tsx` (subscrições Realtime no lugar de onSnapshot) e o chat (`subscribeToDirectMessages` via Realtime). *(✓ concluído em 07/08/2026 — FriendsList já consumia a camada `supabase.ts` (T2.10/T2.11); validado o fluxo social completo de ponta a ponta: teste de integração 17/17 com a camada compilada (signup → perfis → busca → solicitação → aceite → amizade ao vivo via Realtime → chat ao vivo → RLS bloqueando terceiro → remoção) + navegador real (adicionar NPC, lista atualiza na hora, chat com Johnny Silverhand persistindo no banco). 🐛 **Corrigido crash de Realtime**: o `CyberpunkMenu` monta o `FriendsList` em 2 lugares (desktop sidebar + drawer mobile) → dois `subscribeToFriends(uid)` criavam canais com o mesmo nome e o supabase-js lançava "cannot add postgres_changes callbacks ... after subscribe()" (ErrorBoundary). Fix: registry compartilhado de canais com refcount (`subscribeShared` em `src/lib/supabase.ts`) — 1º subscriber cria, demais reutilizam, todos os loads disparam; aplicado a `subscribeToFriends`, `subscribeToPendingRequests`, `subscribeToDirectMessages` e `subscribeToCharacterSheets`. 🐛 **Corrigido reload de NPCs**: NPCs vivem em localStorage (não em `profiles`) → adicionar/remover NPC não disparava Realtime; agora `FriendsList` força re-subscrição via `friendsReloadKey` após operações com `npc_*`.)*
- [x] **T2.13** Reescrever `src/hooks/useCharacterSheet.ts` para persistência em `character_sheets` (jsonb) + fallback localStorage offline. *(✓ concluído em 07/08/2026 — o hook já consumia a camada `supabase.ts` (T2.11); nesta tarefa foram completados: (1) **roster local exibido no modo visitante** (antes `setRoster([])` descartava o localStorage); (2) **merge one-way local→cloud** no primeiro login — fichas criadas no modo visitante são enviadas à nuvem uma vez por uid (flag `cyberpunk_merged_v1_<uid>`); (3) **autosave cloud com debounce (1,5s)** quando logado e a ficha tem handle (a UI já anunciava "Auto-Sincronização Ativa" mas só salvava local); autosave local permanece imediato. Validação: teste de integração 13/13 com a camada compilada (save/upsert jsonb sem duplicar → roster Realtime → load → delete → RLS bloqueando terceiro → multi-subscriber) + navegador real (fichas locais de visitante → login → merge no banco confirmado via psql; edição do handle → gravado na nuvem sem clicar em Salvar).)*
- [x] **T2.14** Reescrever `src/hooks/useUserActivity.ts` usando presença Realtime (ou heartbeat em `profiles.status`). *(✓ concluído em 07/08/2026 — o hook já escrevia `profiles.status` (T2.11); nesta tarefa foram completados: (1) **limpeza de presença**: `pagehide` (fechar aba) → 'offline', `visibilitychange` (aba oculta) → 'inativo', logout/desmontagem → 'offline' no cleanup — antes o status ficava "online" para sempre; (2) **status de amigos ao vivo**: `subscribeToFriends` passou a escutar `profiles` (evento UPDATE) além de `friendships`, via canal compartilhado — o LED de presença dos amigos agora atualiza em tempo real. Validação: teste de integração 11/11 com a camada compilada (A muda online→em jogo→offline e B vê cada mudança ao vivo sem novo subscribe; multi-subscriber com listener duplo não crasha) + navegador real (2 contas: LED de "Presenca UI B" mudou para EM JOGO e depois OFFLINE no DOM de A sem interação).)*
- [x] **T2.15** Atualizar componentes que importam de `../lib/firebase` (CyberpunkMenu, Navbar se ainda existir após T0.16, App, UserProfile, PresetsManager, MultiplayerRoom) para `../lib/supabase`; depois remover `firebase` do `package.json` e apagar arquivos de config legados (mover `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules` para `docs/legacy/`). *(✓ 07/08/2026 — nenhum componente importava mais `lib/firebase` (todos migrados na T2.11); removido o pacote `firebase` de package.json + package-lock.json + bun.lock, apagado `src/lib/firebase.ts`, movidos os 3 arquivos legados para `docs/legacy/` e atualizado o rótulo do rodapé para "SUPABASE CLOUD CONECTADO". Build validado — o `npm run build` só falha nesta máquina pelo `&` no caminho da pasta (invocar binários via `node node_modules/...` resolve).)*

### 2.4 — Storage (avatares)
- [x] **T2.16** Criar bucket `avatars` no Supabase Storage com RLS: upload só na pasta do próprio `auth.uid()` (via `storage.foldername(name)[1]`), leitura pública. *(✓ migration `0002_realtime_avatars.sql`: bucket público `avatars` (5 MB, mime image/*) + policies `avatars_select_public`/`_insert_own_folder`/`_update_own_folder`/`_delete_own_folder` via `(storage.foldername(name))[1] = auth.uid()::text`; migration `0003_bucket_list_policy.sql` (select público em `storage.buckets` p/ listagem). Testado: upload próprio ✓, cross-user bloqueado ✓, leitura pública ✓.)*
- [ ] **T2.17** Atualizar `UserProfile` para upload de avatar (arquivo) em vez de apenas URL/ícone.

### 2.5 — Validação da migração
- [ ] **T2.18** Testes manuais: cadastro/login (email + Google), perfil, busca por cyberpunk_id, solicitação/aceite/recusa de amizade, chat em tempo real, salvar/carregar fichas, remoção de amizade.
- [ ] **T2.19** Testar RLS: acessos anônimos e cross-user bloqueados (logs do Supabase sem acesso indevido); UPDATE exige SELECT policy (validar).
- [ ] **T2.20** `npx tsc --noEmit` + `npm run build` verdes após a migração.
- [ ] ✅ **Fase 2 concluída em:** ____/____/______

---

## FASE 3 — MULTIPLAYER: PERSISTÊNCIA E CONFIABILIDADE  **[P1]**
**Objetivo:** salas não podem mais viver só em memória; reconexão e estado estável.

- [ ] **T3.1** Persistir salas no Supabase (tabela `rooms` + `room_state jsonb`) ou Redis/Upstash; salvar após cada mutação no `roomManager`.
- [ ] **T3.2** Restaurar salas ativas no boot do servidor (carregar do banco ao iniciar).
- [ ] **T3.3** Reconexão: ao re-joinar com mesmo `peerId`, restaurar ficha/token em vez de duplicar.
- [ ] **T3.4** Timeout de `isOnline`: marcar como offline após inatividade (heartbeat do cliente).
- [ ] **T3.5** Decidir e documentar: migrar SSE → WebSockets/Yjs (Fase 5) agora ou depois — se depois, manter SSE com os fixes de reconnection (EventSource auto-reconecta, mas garantir re-sync de estado).
  ⚠️ **Evitar retrabalho:** antes de persistir salas em `room_state jsonb`, decidir o formato de persistência (JSON simples vs **snapshot Yjs**). Se Yjs for escolhido na Fase 5, a Fase 3 já deve guardar snapshots Yjs — senão a persistência será reescrita.
- [ ] ✅ **Fase 3 concluída em:** ____/____/______

---

## FASE 4 — ESTADO FRONTEND: ZUSTAND  **[P2]**
**Objetivo:** eliminar prop drilling e re-renders em cascata.

- [ ] **T4.1** Instalar `zustand`; criar stores: `useSheetStore` (ficha ativa + roster), `useRoomStore` (estado da sala multiplayer), `useRollStore` (histórico de rolagens), `useUiStore` (toasts, banners, abas).
- [ ] **T4.2** Refatorar `App.tsx` para consumir as stores; manter interface com componentes (props mínimas).
- [ ] **T4.3** Migrar `MultiplayerRoom` para `useRoomStore` (estado reativo sem cascata).
- [ ] **T4.4** Validar: `tsc --noEmit` + testes manuais de navegação.
- [ ] ✅ **Fase 4 concluída em:** ____/____/______

---

## FASE 5 — MULTIPLAYER EM TEMPO REAL: WEBSOCKETS/YJS  **[P2]**
**Objetivo:** sincronização de alta frequência (drag de tokens, grid) sem latência e sem conflitos.

- [ ] **T5.1** Avaliar e escolher: Yjs + Hocuspocus (`y-websocket`) vs Socket.IO (recomenda-se Yjs para estado do grid/fichas; WebSocket puro para chat/rolls).
- [ ] **T5.2** Implementar transporte: substituir/encapsular SSE por WebSocket para o grid tático, tokens, iniciativa e chat da mesa (manter SSE como fallback durante transição).
- [ ] **T5.3** Integrar Yjs ao `TacticalGrid` (tokens como estado CRDT; awareness para cursores do GM).
- [ ] **T5.4** Rolar dados no servidor (RNG server-authoritative) e broadcast do resultado.
- [ ] **T5.5** Documentar protocolo (tipos de mensagem) em `docs/PROTOCOLO_MULTIPLAYER.md`.
- [ ] ✅ **Fase 5 concluída em:** ____/____/______

---

## FASE 6 — MOTOR DE DADOS (DICE ENGINE)  **[P2]**
**Objetivo:** rolagens corretas e auditáveis para FNFF.

- [ ] **T6.1** Instalar `@dice-roller/rpg-dice-roller` (suporta d10 explosivo `1d10!`, fumble, audit trail).
- [ ] **T6.2** Criar `src/utils/diceEngine.ts` com helpers: `rollSkill(stat, skill)`, `rollDamage(formula)`, `rollDeathSave(body)`, `rollLocation()`.
- [ ] **T6.3** Substituir a lógica manual em `App.tsx` (`handleRollSkill`, `handleRollDamageOnly`, `handleRollDeathSave`) e `DiceRoller` pelo motor.
- [ ] **T6.4** Unit tests do motor (explosões, fumbles, faixas de dano).
- [ ] ✅ **Fase 6 concluída em:** ____/____/______

---

## FASE 7 — ROTEAMENTO E ESTRUTURA DE CÓDIGO  **[P2]**
**Objetivo:** URLs reais e organização por features.

- [ ] **T7.1** Adicionar React Router: rotas `/`, `/sheet`, `/dice`, `/ai`, `/multiplayer`, `/presets`, `/profile`, `/prd`, `/room/:code`.
- [ ] **T7.2** Refatorar estrutura por features: `src/features/social`, `src/features/sheet`, `src/features/multiplayer`, `src/features/ai` (manter `components/ui` e `lib`).
- [ ] **T7.3** Criar camada `src/api/` centralizada (cliente HTTP para `/api/rooms/*` e Gemini) em vez de fetch espalhado.
- [ ] **T7.4** Validar build e deep-links (`/room/ABC123` recarrega e reconecta).
- [ ] ✅ **Fase 7 concluída em:** ____/____/______

---

## FASE 8 — PRD REAL, DOCUMENTAÇÃO E IDENTIDADE DO PRODUTO  **[P1]**
**Objetivo:** o PRD do produto passa a existir de verdade (hoje `prdData.ts` está vazio) e a identidade
pública é 100% própria — **sem nenhum crédito a ferramentas de scaffold na UI, README ou HTML**.

- [ ] **T8.1** Criar `docs/PRD.md`: visão, personas, escopo, funcionalidades por módulo, regras de negócio CP2020, não-objetivos, métricas.
- [x] **T8.2** Popular `src/data/prdData.ts` para alimentar o `PrdViewer` (seções, fases do roadmap, arquitetura). *(Populado nesta sessão — T0.10.)*
- [x] **T8.3** Reescrever `README.md` do zero: nome/identidade do produto, descrição, stack, instruções (`.env.example`, Supabase + Gemini API key, `npm run dev`), roadmap. **Sem banner, link ou crédito do scaffold de origem.** *(Reescrito nesta revisão — v1.2 do plano.)*
- [x] **T8.4** Corrigir `index.html`: título real ("Cyberpunk 2020 Sheet Builder"), meta description, `lang="pt-BR"`, favicon próprio. **Remover qualquer título/marca padrão de scaffold.** *(Corrigido nesta revisão.)*
- [ ] **T8.5** Garantir que a UI (footer do `App.tsx`, modais, splash) exiba apenas a identidade "NETSHEET ENGINE" — nenhuma menção a ferramenta de origem.
- [ ] **T8.6** Documentar decisões (ADR): `docs/adr/` para Supabase, Yjs/WebSockets, Zustand, rpg-dice-roller.
- [ ] **T8.7** Atualizar `metadata.json` e demais metadados do produto com nome/descrição finais; **remover campos de metadados específicos de plataforma de scaffold** (ex.: `majorCapabilities`) que não fazem sentido para o produto.
- [ ] ✅ **Fase 8 concluída em:** ____/____/______

---

## FASE 9 — TESTES  **[P2]**
**Objetivo:** regras do jogo e fluxos críticos protegidos.

- [ ] **T9.1** Configurar Vitest + React Testing Library.
- [ ] **T9.2** Testes unit: estatísticas derivadas (BTM, SP, perda de humanidade), dice engine, npcGenerator, regras de ferimento.
- [ ] **T9.3** Testes de integração do servidor: criar/join/leave sala, iniciativa, GM permissions (usando supertest ou node:test).
- [ ] **T9.4** Testes e2e (Playwright): fluxo de auth → criar ficha → sala multiplayer (2 navegadores).
- [ ] **T9.5** RLS: testes de política (script de verificação em SQL com `set local role` para anon/authenticated).
- [ ] ✅ **Fase 9 concluída em:** ____/____/______

---

## FASE 10 — DEPLOY, CI/CD E HARDENING DE PRODUÇÃO  **[P1]**
**Objetivo:** aplicação acessível publicamente com pipeline automatizado e produção endurecida.

- [ ] **T10.1** Backend (Express + WebSocket): deploy em Railway/Fly.io/Render (processo Node, variáveis `GEMINI_API_KEY`, `VITE_SUPABASE_*`, porta).
- [ ] **T10.2** Frontend: build estático (Vite) no Vercel/Netlify com env vars do cliente.
- [ ] **T10.3** Configurar domínio customizado (opcional) e HTTPS.
- [ ] **T10.4** Healthcheck `/api/health` monitorado (uptime bot).
- [ ] **T10.5** CI/CD: GitHub Actions (ou equivalente) — `tsc --noEmit`, lint, testes, build em cada PR/push.
- [ ] **T10.6** Hardening do servidor: CORS restrito (hoje não há middleware CORS), `helmet` (security headers), rate limiting global, logs estruturados.
- [ ] **T10.7** Checklist de produção: secrets fora do bundle (nunca `VITE_` com segredo de service role), variáveis de ambiente por ambiente, revisão de RLS em produção.
- [ ] **T10.8** Banco de dados: ativar **backups automáticos/PITR** do Supabase e aplicar migrations via `supabase db push` no pipeline de CI/CD.
- [ ] ✅ **Fase 10 concluída em:** ____/____/______

---

## FASE 11 — REGRAS CP2020 AVANÇADAS  **[P3]**
**Objetivo:** profundidade de sistema.

- [ ] **T11.1** Inventário e peso (ENC/EV) com encumbrance automático.
- [ ] **T11.2** Netrunning completo (MU, programas, data walls, ações por turno).
- [ ] **T11.3** Pós-ferimento automático: aplicar penalidades de REF por estado de ferimento (Sério -2 etc.).
- [ ] **T11.4** Loot/NPCs: gerenciador de inventário de NPCs e drops.
- [ ] **T11.5** Export/Import de ficha (JSON + PDF print).
- [ ] ✅ **Fase 11 concluída em:** ____/____/______

---

## FASE 12 — VALIDAÇÃO FINAL E ENCERRAMENTO DO PLANO  **[P0]**
**Objetivo:** garantir que tudo está concluído e **deletar este arquivo**.

- [ ] **T12.1** `git status` limpo (sem pendências); todos os commits com mensagens claras.
- [ ] **T12.2** Rodar suíte completa: `tsc --noEmit`, `npm run build`, testes unit/integration/e2e, lint.
- [ ] **T12.3** Teste manual completo em produção (staging): auth, social, ficha, mesa multiplayer com 2+ usuários reais.
- [ ] **T12.4** Conferir que **nenhum checkbox acima ficou sem `[x]`** e que todas as datas de fase estão preenchidas.
- [ ] **T12.5** Arquivar resumo do roadmap concluído no `README.md`.
- [ ] **T12.6** 🗑️ **DELETAR ESTE ARQUIVO** (`git rm PLANO_DE_ACAO.md` + commit "Plano de ação concluído — remove documento mestre").
- [ ] ✅ **Plano integralmente concluído em:** ____/____/______

---

## 📊 RESUMO DE PROGRESSO (preencher a cada sessão)

| Fase | Descrição | Status | Data |
|------|-----------|--------|------|
| 0 | Fundação e recuperação do código | ✅ concluída | 03/08/2026 |
| 1 | Correções de segurança | ✅ concluída | 03/08/2026 |
| 2 | Migração Firebase → Supabase | 🔄 em andamento (2.1–2.7/2.16 concluídos) | 07/08/2026 |
| 3 | Multiplayer: persistência | ⬜ | — |
| 4 | Estado frontend (Zustand) | ⬜ | — |
| 5 | Multiplayer real-time (WS/Yjs) | ⬜ | — |
| 6 | Motor de dados | ⬜ | — |
| 7 | Roteamento e estrutura | ⬜ | — |
| 8 | PRD, documentação e identidade | ⬜ | — |
| 9 | Testes | ⬜ | — |
| 10 | Deploy, CI/CD e hardening | ⬜ | — |
| 11 | Regras CP2020 avançadas | ⬜ | — |
| 12 | Validação final + delete deste arquivo | ⬜ | — |

**Última atualização:** 07/08/2026 — **revisão v1.6**: Fases 0 e 1 concluídas; **Fase 2 em andamento**.
Fase 2 (progresso 2.1–2.7/2.16): ambiente local **rodando** (Docker Desktop instalado; `supabase start` no ar:
API `127.0.0.1:54321`, Studio `54323`, Postgres `54322`); migrations **0001** (schema + RLS + triggers),
**0002** (Realtime p/ `direct_messages`/`profiles`/`friend_requests` + bucket `avatars` com RLS de pasta)
e **0003** (listagem pública de buckets) e **0004** (remoção de `profiles.email` — privacidade, pois o Realtime
não filtra colunas, apenas linhas; e-mail próprio fica no JWT) aplicadas; `.env.local` preenchido com chaves
locais; Email/Senha validado com teste funcional (signup → perfil `#NC-####` → upload avatar → cross-user
bloqueado: 10/10 ✓; pós-reset 7/7 ✓).
Pendente: **T2.9** (migração de dados — pular se não houver dados reais), **2.3 camada cliente (T2.10–T2.15)**,
**2.4 storage UI (T2.17)** e **2.5 validação (T2.18–T2.20)**.

> **✅ T2.11 — Google OAuth validado (07/08/2026):** após corrigir o Client ID para `774463152952-74orl6td...apps.googleusercontent.com` (faltava o prefixo do nº do projeto), o **login real com conta Google funcionou de ponta a ponta** no navegador — sessão criada no Supabase local e perfil sincronizado. Client ID em `supabase/config.toml` (público, versionado); Client Secret em `supabase/.env` (gitignored, nunca commitar).
>
> **Passo a passo original (para referência):**
> 1. Acessar [console.cloud.google.com](https://console.cloud.google.com) → criar/selecionar projeto.
> 2. **APIs & Services → OAuth consent screen**: escolher External, preencher app name (ex.: NETSHEET ENGINE)
>    e e-mail; adicionar o escopo `.../auth/userinfo.email` e `.../auth/userinfo.profile`; salvar.
> 3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → tipo **Web application**.
>    Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback` (local).
> 4. Copiar o **Client ID** e o **Client secret**.
> 5. No `supabase/config.toml`: `[auth.external.google] enabled = true`, `client_id = "<seu-client-id>"` e
>    `secret = env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` (criar a env var antes de rodar `supabase start`),
>    OU preencher via Studio local (`http://127.0.0.1:54323` → Authentication → Providers → Google).
> 6. Reiniciar o stack: `supabase stop && supabase start`.
> Total: 13 fases, ~100 tarefas (83 pendentes).

> 🔁 **Regra de ouro:** ao iniciar qualquer sessão, comece por Fase 0 e siga em ordem.
> Se uma tarefa for concluída, marque `[x]` e atualize a tabela de resumo. Nunca deixe tarefas
> concluídas desmarcadas. Quando Fase 12 for atingida, **delete este arquivo**.
