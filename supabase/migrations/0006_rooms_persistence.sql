-- ============================================================
-- FASE 3 — PERSISTÊNCIA DE SALAS MULTIPLAYER (T3.1/T3.2)
-- ============================================================
-- Tabela `rooms` guarda o estado completo da mesa (GameRoom) como
-- JSONB. O servidor Express é o ÚNICO escritor/leitor (via service
-- role key — bypassa RLS). Clientes NUNCA acessam esta tabela
-- diretamente: o estado passa pelas rotas /api/rooms/*.
--
-- Por isso o RLS está ATIVO e SEM nenhuma policy: com RLS habilitado
-- e zero policies, anon/authenticated ficam bloqueados de ler e
-- gravar (select retorna 0 linhas; insert/update/delete → 42501).
-- O service_role (servidor) é isento de RLS por design.
-- ============================================================

create table if not exists public.rooms (
  code text primary key,
  room_state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Índice para restaurar salas mais recentes primeiro no boot (T3.2)
create index if not exists rooms_updated_at_idx on public.rooms (updated_at desc);

-- GRANTs padrão do Supabase (tabelas do schema public são acessíveis a
-- todos os roles; a proteção real vem da RLS abaixo — sem policies,
-- anon/authenticated são bloqueados; service_role bypassa).
grant all on table public.rooms to anon, authenticated, service_role;

-- Servidor-only: nenhuma policy → anon/authenticated bloqueados.
alter table public.rooms enable row level security;
