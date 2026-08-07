-- ============================================================
-- NETSHEET ENGINE — MIGRAÇÃO 0003 (Fase 2: Firebase → Supabase)
-- Listagem de buckets (T2.16, complemento)
--
-- storage.buckets tem RLS habilitado por padrão sem policies → a
-- listagem de buckets (GET /storage/v1/bucket, supabase.storage
-- .listBuckets()) retorna vazio para anon/authenticated.
-- Buckets públicos devem ser listáveis para a camada cliente.
-- ============================================================
create policy "buckets_select_public" on storage.buckets
  for select to public
  using (public = true);
