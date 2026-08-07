-- ============================================================
-- NETSHEET ENGINE — MIGRAÇÃO 0004 (Fase 2: Firebase → Supabase)
-- Privacidade: remover `email` de public.profiles
--
-- Motivo: profiles tem policy de SELECT `using (true)` para
-- authenticated (leitura pública p/ busca por cyberpunk_id) e agora
-- participa da publicação supabase_realtime (T2.7). Sem essa remoção,
-- qualquer usuário autenticado leria o e-mail de TODOS os usuários
-- via REST e via Realtime (o Realtime não filtra colunas, apenas linhas).
--
-- O e-mail do próprio usuário continua disponível via JWT
-- (supabase.auth.getUser() → user.email) — o cliente T2.10 deve lê-lo
-- de lá, não de profiles.
-- ============================================================
alter table public.profiles drop column email;

-- ============================================================
-- Atualizar o trigger de auto-criação de perfil (sem email)
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
  insert into public.profiles (id, cyberpunk_id, display_name)
  values (
    new.id,
    generated_id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Edgerunner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
