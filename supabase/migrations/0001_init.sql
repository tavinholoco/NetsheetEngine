-- ============================================================
-- NETSHEET ENGINE — MIGRAÇÃO INICIAL (Fase 2: Firebase → Supabase)
-- T2.4 — Tabelas de perfis, amizades, mensagens diretas e fichas
-- T2.5 — RLS (Row Level Security) + índices em todas as tabelas
-- T2.6 — Trigger de auto-criação de perfil em auth.users insert
--
-- Compatibilidade com a camada atual (src/lib/firebase.ts):
--   profiles.{uid, cyberpunkId, email, displayName, bio, avatarIcon, status}
--   friendRequests.{senderUid, senderName, senderCyberpunkId, senderAvatar, receiverUid, timestamp}
--   directMessages/{roomId}/messages.{senderUid, senderName, text, timestamp}
--   characterSheets/{uid}/sheets/{sheetId} (CharacterSheet + updatedAt)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
-- T2.4 — TABELA: profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cyberpunk_id text not null unique,            -- ex.: #NC-1234 (gerado no trigger T2.6)
  display_name text not null default 'Edgerunner',
  bio text not null default '',
  avatar_icon text not null default 'cpu',
  avatar_url text not null default '',
  email text,
  status text not null default 'online'
    check (status in ('online', 'inativo', 'em jogo', 'offline')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_cyberpunk_id_idx on public.profiles (cyberpunk_id);
create index if not exists profiles_status_idx on public.profiles (status);

-- ============================================================
-- T2.4 — TABELA: friendships (par único canônico, sender < receiver)
-- A ordem canônica evita duplicatas (a,b) e (b,a): um único registro
-- por par de edgerunners. Insert exige ser participante do par.
-- ============================================================
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_unique_pair unique (sender_id, receiver_id),
  constraint friendships_canonical_order check (sender_id < receiver_id),
  constraint friendships_no_self check (sender_id <> receiver_id)
);

create index if not exists friendships_sender_id_idx on public.friendships (sender_id);
create index if not exists friendships_receiver_id_idx on public.friendships (receiver_id);
create index if not exists friendships_status_idx on public.friendships (status);

-- ============================================================
-- T2.4 — TABELA: friend_requests (compatível com FriendRequest)
-- ============================================================
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_uid uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  sender_cyberpunk_id text not null default '',
  sender_avatar text not null default '',
  receiver_uid uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self check (sender_uid <> receiver_uid)
);

create index if not exists friend_requests_sender_uid_idx on public.friend_requests (sender_uid);
create index if not exists friend_requests_receiver_uid_idx on public.friend_requests (receiver_uid);

-- ============================================================
-- T2.4 — TABELA: direct_messages
-- chat_room_id é o id determinístico do par (getChatRoomId):
-- [uidA, uidB].sort().join('__') — a RLS checa participação via LIKE.
-- ============================================================
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  chat_room_id text not null,
  sender_uid uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_chat_room_id_idx on public.direct_messages (chat_room_id);
create index if not exists direct_messages_sender_uid_idx on public.direct_messages (sender_uid);
create index if not exists direct_messages_created_at_idx on public.direct_messages (created_at);

-- ============================================================
-- T2.4 — TABELA: character_sheets
-- data jsonb guarda a CharacterSheet completa (T2.13 consumirá).
-- sheet_id preserva o contrato do cliente (CharacterSheet.id), que no
-- Firebase era a chave do documento — vira a chave de upsert no Supabase.
-- ============================================================
create table public.character_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_id text not null,                     -- CharacterSheet.id (contrato do cliente)
  handle text not null default '',
  role text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_sheets_user_sheet_unique unique (user_id, sheet_id)
);

create index if not exists character_sheets_user_id_idx on public.character_sheets (user_id);
create index if not exists character_sheets_user_sheet_idx on public.character_sheets (user_id, sheet_id);
create index if not exists character_sheets_updated_at_idx on public.character_sheets (updated_at);

-- ============================================================
-- T2.6 — TRIGGER: auto-criar profile quando um usuário se registra
-- gera cyberpunk_id determinístico por uid (mesma regra do cliente).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  generated_id text;
begin
  -- '#NC-####' determinístico a partir do uid (hashtextextended evita overflow)
  generated_id := '#NC-' || lpad(
    (1000 + ((hashtextextended(new.id::text, 0) % 9000 + 9000) % 9000))::text,
    4, '0'
  );
  insert into public.profiles (id, cyberpunk_id, display_name, email)
  values (
    new.id,
    generated_id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Edgerunner'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute procedure public.set_updated_at();

create trigger character_sheets_set_updated_at
  before update on public.character_sheets
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- T2.5 — RLS (Row Level Security)
-- Regra geral: ler/alterar apenas o que pertence ao usuário
-- autenticado. Perfis são legíveis por qualquer autenticado.
-- ============================================================

-- ---------- profiles ----------
alter table public.profiles enable row level security;

-- leitura pública (autenticado): necessário p/ buscar por cyberpunk_id
create policy "profiles_select_public" on public.profiles
  for select to authenticated using (true);

-- insert do próprio dono (fallback; o trigger T2.6 já cria com security definer)
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- update/delete do próprio dono
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- ---------- friendships ----------
alter table public.friendships enable row level security;

-- select: apenas participantes do par
create policy "friendships_select_participant" on public.friendships
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- insert: o usuário precisa ser um dos dois lados do par
create policy "friendships_insert_participant" on public.friendships
  for insert to authenticated
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

-- update (aceitar/recusar/remover): participantes do par
create policy "friendships_update_participant" on public.friendships
  for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

-- delete (remover amizade): participantes do par
create policy "friendships_delete_participant" on public.friendships
  for delete to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- ---------- friend_requests ----------
alter table public.friend_requests enable row level security;

-- select: remetente ou destinatário
create policy "friend_requests_select_participant" on public.friend_requests
  for select to authenticated
  using (auth.uid() = sender_uid or auth.uid() = receiver_uid);

-- insert: apenas o remetente cria a solicitação
-- (sender_name/cyberpunk_id/avatar são client-supplied; o cliente T2.12 deve
--  derivá-los de profiles — ou documentar a confiança no remetente autenticado)
create policy "friend_requests_insert_sender" on public.friend_requests
  for insert to authenticated
  with check (auth.uid() = sender_uid);

-- update: apenas o destinatário aceita/recusa
create policy "friend_requests_update_receiver" on public.friend_requests
  for update to authenticated
  using (auth.uid() = receiver_uid)
  with check (auth.uid() = receiver_uid);

-- delete: destinatário (recusa) ou remetente (cancelamento)
create policy "friend_requests_delete_participant" on public.friend_requests
  for delete to authenticated
  using (auth.uid() = sender_uid or auth.uid() = receiver_uid);

-- ---------- direct_messages ----------
alter table public.direct_messages enable row level security;

-- select: participante do chat (uid presente no chat_room_id)
-- NOTA de performance: o LIKE com curinga à esquerda não usa o índice btree;
-- se o volume de mensagens crescer, migrar para colunas participant_a/participant_b
-- ou índice GIN pg_trgm (tarefa de otimização fora do escopo da Fase 2).
create policy "direct_messages_select_participant" on public.direct_messages
  for select to authenticated
  using (chat_room_id like '%' || auth.uid()::text || '%');

-- insert: remetente deve ser participante do chat (evita injeção em chats de terceiros)
create policy "direct_messages_insert_sender" on public.direct_messages
  for insert to authenticated
  with check (
    sender_uid = auth.uid()
    and chat_room_id like '%' || auth.uid()::text || '%'
  );

-- ---------- character_sheets ----------
alter table public.character_sheets enable row level security;

-- select/update/delete: apenas o dono
create policy "character_sheets_select_owner" on public.character_sheets
  for select to authenticated using (user_id = auth.uid());

create policy "character_sheets_insert_owner" on public.character_sheets
  for insert to authenticated with check (user_id = auth.uid());

create policy "character_sheets_update_owner" on public.character_sheets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "character_sheets_delete_owner" on public.character_sheets
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- GRANTS (novo default do Supabase: entidades NÃO são auto-expostas)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on table public.profiles to anon, authenticated;
grant all on table public.friendships to anon, authenticated;
grant all on table public.friend_requests to anon, authenticated;
grant all on table public.direct_messages to anon, authenticated;
grant all on table public.character_sheets to anon, authenticated;
