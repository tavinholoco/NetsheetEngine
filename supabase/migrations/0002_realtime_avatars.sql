-- ============================================================
-- NETSHEET ENGINE — MIGRAÇÃO 0002 (Fase 2: Firebase → Supabase)
-- T2.7  — Realtime para mensagens diretas e presença (profiles.status)
-- T2.16 — Bucket avatars no Storage com RLS por pasta do auth.uid()
--
-- Realtime no Supabase entrega mudanças via websocket respeitando
-- as policies de RLS de cada tabela (o cliente autenticado só
-- recebe as linhas que tem permissão de ler).
-- ============================================================

-- ============================================================
-- T2.7 — Realtime (postgres_changes)
-- Habilitar a publicação supabase_realtime para as tabelas que o
-- cliente consome ao vivo:
--   * direct_messages  → chat em tempo real (T2.12)
--   * profiles         → presença via profiles.status (T2.14)
--   * friend_requests  → solicitações de amizade em tempo real (T2.12)
-- NOTA: a própria tabela supabase_realtime é gerida pelo Supabase;
-- só adicionamos/removemos tabelas da publicação.
-- ============================================================
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.friend_requests;

-- ============================================================
-- T2.16 — Storage: bucket "avatars"
-- Bucket público (leitura pública) com RLS para upload apenas na
-- pasta do próprio auth.uid(): `avatars/<uid>/<arquivo>`.
-- O path no Storage é `bucket/name`; (storage.foldername(name))[1]
-- devolve a primeira parte do nome (a pasta do usuário).
-- NOTA: subscrito em resultado de função exige parênteses em Postgres.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- leitura pública (bucket público): qualquer um lê avatares
create policy "avatars_select_public" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

-- upload/overwrite apenas na própria pasta (<uid>/<arquivo>)
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
