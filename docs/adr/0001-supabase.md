# ADR 0001 — Supabase como plataforma de dados (migração Firebase → Supabase)

- **Status:** Aceito
- **Data:** 08/08/2026
- **Decisores:** Dono do produto + desenvolvimento (Fase 2, T2.1–T2.20)
- **Fase do plano:** Fase 2 — Migração Firebase → Supabase

## Contexto

O app nasceu sobre o **Firebase** (Auth + Firestore). O site anterior tinha um
banco de dados criado via AI Studio do Google no Firebase, ainda com dados
antigos. Problemas identificados:

1. **Modelo de dados não-relacional** (Firestore) com regras de segurança
   frágeis e difíceis de testar para o padrão de multiusuário (amizades,
   mensagens diretas, fichas por dono).
2. **Necessidade de realtime** para chat, presença e listas de amigos — o
   Firestore entregava, mas com custo/limitações de query e sem SQL.
3. **RLS (Row Level Security)** — no Firestore as regras são por documento;
   o time queria políticas declarativas em SQL, auditáveis e testáveis com
   `set role anon/authenticated`.
4. **Storage** para avatares com controle de acesso por dono.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Manter Firebase** | Zero migração; dados antigos continuam lá | Regras por documento frágeis; sem SQL; lock-in de query; custo de escala |
| **Supabase** (escolhida) | PostgreSQL + RLS rigoroso; Realtime; Storage; Auth (email/senha + Google OAuth); CLI local com Docker | Migração de dados; novo provedor de auth (novo Google OAuth consent) |
| **Backend próprio + Postgres** | Controle total | Reconstruir auth/realtime/storage do zero — atrito alto |

## Decisão

Migrar a camada de dados para o **Supabase** (Auth + PostgreSQL + Realtime +
Storage), com:

- **Schema relacional com RLS em todas as tabelas**: `profiles`,
  `friendships`, `friend_requests`, `direct_messages`, `character_sheets`.
- **Fichas como `jsonb`** em `character_sheets` (flexibilidade do schema da
  ficha + consultas por dono).
- **Realtime** para mensagens diretas, presença e solicitações de amizade.
- **Bucket `avatars`** com RLS por dono para upload de imagem de perfil.
- **Auth**: e-mail/senha + **Google OAuth** (novo OAuth consent screen
  configurado na Google Auth Platform — Branding → Clients).
- **Migração dos dados antigos do Firebase: cancelada** (T2.9) — o banco
  inicia limpo; o usuário optou por não exportar o Firestore antigo.

## Consequências

**Positivas:**

- RLS declarativo em SQL, testado com `set role anon/authenticated` (T2.19):
  acessos anônimos e cross-user bloqueados em todas as tabelas e no storage.
- `supabase db push` + migrations versionadas (0001–0004) versionadas no
  repo — schema reproduzível.
- Realtime nativo para chat/presença; Storage com políticas por dono.
- CLI local com Docker facilita o desenvolvimento (T2.1).

**Negativas / custos:**

- Dois provedores de identidade (o usuário criou conta no Supabase e precisa
  de credenciais separadas do Google Cloud).
- A anon key do Supabase é pública por design (vai no bundle) — o que
  obrigou a uma **allowlist no gitleaks** para não bloquear o CI.
- Dados antigos do Firebase ficaram para trás (decisão consciente).

## Referências

- `supabase/migrations/` — migrations 0001–0004 (schema + RLS + bucket).
- `src/lib/supabase.ts` — API de dados (auth, perfis, amizades, chat, fichas).
- Fase 2 do `PLANO_DE_ACAO.md` (T2.1–T2.20).
