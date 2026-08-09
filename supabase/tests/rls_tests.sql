-- ============================================================
-- NETSHEET ENGINE — TESTES DE RLS (T2.19)
-- ============================================================
-- Verifica que a Row Level Security bloqueia acessos anônimos e
-- cross-user em profiles, friendships, friend_requests,
-- direct_messages, character_sheets, storage (bucket avatars) e rooms
-- (Fase 3 — persistência de salas, servidor-only).
--
-- Técnica: impersonação via `set role` + `request.jwt.claim.sub`
-- (padrão Supabase — auth.uid() lê esse GUC). Helpers com
-- `security invoker` para respeitar a RLS do role em execução.
--
-- Executar (substitua o nome do container do banco local):
--   docker exec -i supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite \
--     psql -U postgres -d postgres -f supabase/tests/rls_tests.sql
--
-- Pré-requisitos: usuários A, B, C com perfis — o script agora é
-- AUTO-SEED (T9.5): cria os 3 usuários se não existirem (on conflict do
-- nothing) e o trigger handle_new_user gera os perfis. Os UIDs são fixos e
-- descartáveis (senha placeholder — não há login, só RLS).
--
-- Executar (automatizado, recomenda-se):
--   node scripts/test-rls.mjs
--
-- Executar manualmente (substitua o nome do container do banco local):
--   docker exec -i supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite \
--     psql -U postgres -d postgres -f supabase/tests/rls_tests.sql
-- ============================================================

\set ON_ERROR_STOP off
\set VERBOSITY terse

-- ============================================================
-- HELPERS
-- ============================================================
drop schema if exists rls_test cascade;
create schema rls_test;
grant usage on schema rls_test to anon, authenticated;

create table rls_test.results (label text primary key, ok boolean not null);
grant select, insert, update, delete on rls_test.results to anon, authenticated;

create or replace function rls_test.record(p_label text, p_ok boolean)
returns void language plpgsql security invoker as $$
begin
  insert into rls_test.results (label, ok) values (p_label, p_ok)
  on conflict (label) do update set ok = excluded.ok;
  if p_ok then
    raise notice 'PASS  %', p_label;
  else
    raise notice 'FAIL  %', p_label;
  end if;
end $$;

-- p_sql deve retornar linhas; conta-as e compara com o esperado.
create or replace function rls_test.expect_count(p_sql text, p_expected int, p_label text)
returns void language plpgsql security invoker as $$
declare c int;
begin
  execute format('select count(*) from (%s) _t', p_sql) into c;
  perform rls_test.record(p_label, c = p_expected);
exception when others then
  perform rls_test.record(p_label || ' (erro: ' || sqlerrm || ')', false);
end $$;

-- p_sql deve lançar erro de privilégio (RLS denies → SQLSTATE 42501).
create or replace function rls_test.expect_denied(p_sql text, p_label text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_sql;
    perform rls_test.record(p_label, false);
  exception
    when insufficient_privilege then
      perform rls_test.record(p_label, true);
    when others then
      perform rls_test.record(p_label || ' (erro: ' || sqlerrm || ')', false);
  end;
end $$;

-- p_sql deve executar sem erro.
create or replace function rls_test.expect_ok(p_sql text, p_label text)
returns void language plpgsql security invoker as $$
begin
  execute p_sql;
  perform rls_test.record(p_label, true);
exception when others then
  perform rls_test.record(p_label || ' (erro: ' || sqlerrm || ')', false);
end $$;

-- p_sql é um UPDATE/DELETE; conta as linhas afetadas via ROW_COUNT.
create or replace function rls_test.expect_affected(p_sql text, p_expected int, p_label text)
returns void language plpgsql security invoker as $$
declare c int;
begin
  execute p_sql;
  get diagnostics c = row_count;
  perform rls_test.record(p_label, c = p_expected);
exception when others then
  perform rls_test.record(p_label || ' (erro: ' || sqlerrm || ')', false);
end $$;

grant execute on all functions in schema rls_test to anon, authenticated;

-- ============================================================
-- IDENTIDADES (usuários de teste)
-- ============================================================
-- A = 6dbca66c-511a-4959-8919-a03b1bdeff5b
-- B = 7afefc46-fb18-41a5-8b78-57fad6249e69
-- C = da1a9ef2-dc3d-459c-9366-71e757a75737

-- ============================================================
-- SELF-SEED DOS USUÁRIOS DE TESTE (T9.5 — idempotente)
-- Cria A/B/C em auth.users se ainda não existirem; o trigger
-- handle_new_user cria os perfis correspondentes automaticamente.
-- ============================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '6dbca66c-511a-4959-8919-a03b1bdeff5b', 'authenticated', 'authenticated', 'rls_a@test.local', 'SCRAM', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '7afefc46-fb18-41a5-8b78-57fad6249e69', 'authenticated', 'authenticated', 'rls_b@test.local', 'SCRAM', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'da1a9ef2-dc3d-459c-9366-71e757a75737', 'authenticated', 'authenticated', 'rls_c@test.local', 'SCRAM', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (email) do nothing;

-- ============================================================
-- RESET + RE-SEED (idempotência: re-executar não acumula estado)
-- storage.objects tem o trigger protect_delete → habilita a GUC
-- só para o reset (restaura no fim da sessão de reset).
-- ============================================================
delete from public.friend_requests
  where sender_uid in ('6dbca66c-511a-4959-8919-a03b1bdeff5b','7afefc46-fb18-41a5-8b78-57fad6249e69','da1a9ef2-dc3d-459c-9366-71e757a75737')
     or receiver_uid in ('6dbca66c-511a-4959-8919-a03b1bdeff5b','7afefc46-fb18-41a5-8b78-57fad6249e69','da1a9ef2-dc3d-459c-9366-71e757a75737');
delete from public.direct_messages where chat_room_id like '%6dbca66c-511a-4959-8919-a03b1bdeff5b%';
delete from public.direct_messages where chat_room_id like '%7afefc46-fb18-41a5-8b78-57fad6249e69%';
delete from public.direct_messages where chat_room_id like '%da1a9ef2-dc3d-459c-9366-71e757a75737%';
delete from public.friendships
  where sender_id in ('6dbca66c-511a-4959-8919-a03b1bdeff5b','7afefc46-fb18-41a5-8b78-57fad6249e69','da1a9ef2-dc3d-459c-9366-71e757a75737')
     or receiver_id in ('6dbca66c-511a-4959-8919-a03b1bdeff5b','7afefc46-fb18-41a5-8b78-57fad6249e69','da1a9ef2-dc3d-459c-9366-71e757a75737');
delete from public.character_sheets where user_id in ('6dbca66c-511a-4959-8919-a03b1bdeff5b','7afefc46-fb18-41a5-8b78-57fad6249e69');

set storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'avatars' and name like '6dbca66c-511a-4959-8919-a03b1bdeff5b/%';
reset storage.allow_delete_query;

insert into public.friendships (sender_id, receiver_id, status) values ('6dbca66c-511a-4959-8919-a03b1bdeff5b', '7afefc46-fb18-41a5-8b78-57fad6249e69', 'accepted');
insert into public.friendships (sender_id, receiver_id, status) values ('7afefc46-fb18-41a5-8b78-57fad6249e69', 'da1a9ef2-dc3d-459c-9366-71e757a75737', 'accepted');
insert into public.friend_requests (sender_uid, sender_name, sender_cyberpunk_id, receiver_uid) values ('7afefc46-fb18-41a5-8b78-57fad6249e69', 'B', '#NC-B', '6dbca66c-511a-4959-8919-a03b1bdeff5b');
insert into public.friend_requests (sender_uid, sender_name, sender_cyberpunk_id, receiver_uid) values ('6dbca66c-511a-4959-8919-a03b1bdeff5b', 'A', '#NC-A', '7afefc46-fb18-41a5-8b78-57fad6249e69');
insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text) values ('6dbca66c-511a-4959-8919-a03b1bdeff5b__7afefc46-fb18-41a5-8b78-57fad6249e69', '6dbca66c-511a-4959-8919-a03b1bdeff5b', 'A', 'msg-teste-rls');
insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text) values ('7afefc46-fb18-41a5-8b78-57fad6249e69__da1a9ef2-dc3d-459c-9366-71e757a75737', '7afefc46-fb18-41a5-8b78-57fad6249e69', 'B', 'msg-b-c');
insert into public.character_sheets (user_id, sheet_id, handle, role, data) values ('6dbca66c-511a-4959-8919-a03b1bdeff5b', 'sheet_rls_a', 'Vex RLS', 'Solo', '{}'::jsonb);
insert into public.character_sheets (user_id, sheet_id, handle, role, data) values ('7afefc46-fb18-41a5-8b78-57fad6249e69', 'sheet_rls_b', 'Sombra RLS', 'Netrunner', '{}'::jsonb);
insert into storage.objects (bucket_id, name, owner_id) values ('avatars', '6dbca66c-511a-4959-8919-a03b1bdeff5b/seed.png', '6dbca66c-511a-4959-8919-a03b1bdeff5b');

-- ============================================================
-- 1) ANON — nenhuma política (to authenticated) → tudo negado
-- ============================================================
reset role;
set request.jwt.claim.sub = '';
set role anon;

select rls_test.expect_count('select * from public.profiles', 0, 'anon: não lê profiles');
-- UPDATE exige policy de UPDATE (e o USING dela funciona como SELECT): anon
-- não tem policy → RLS filtra tudo → 0 linhas afetadas (requisito T2.19).
select rls_test.expect_affected('update public.profiles set bio = ''x''', 0, 'anon: NÃO atualiza perfis (sem policy de update)');
select rls_test.expect_denied('insert into public.profiles (id, cyberpunk_id) values (gen_random_uuid(), ''#NC-ANON'')', 'anon: não insere em profiles');
select rls_test.expect_count('select * from public.friendships', 0, 'anon: não lê friendships');
select rls_test.expect_denied('insert into public.friendships (sender_id, receiver_id) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''7afefc46-fb18-41a5-8b78-57fad6249e69'')', 'anon: não insere em friendships');
select rls_test.expect_count('select * from public.friend_requests', 0, 'anon: não lê friend_requests');
select rls_test.expect_denied('insert into public.friend_requests (sender_uid, receiver_uid) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''7afefc46-fb18-41a5-8b78-57fad6249e69'')', 'anon: não insere em friend_requests');
select rls_test.expect_count('select * from public.direct_messages', 0, 'anon: não lê direct_messages');
select rls_test.expect_denied('insert into public.direct_messages (chat_room_id, sender_uid, text) values (''x__y'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''hi'')', 'anon: não insere em direct_messages');
select rls_test.expect_count('select * from public.character_sheets', 0, 'anon: não lê character_sheets');
select rls_test.expect_denied('insert into public.character_sheets (user_id, sheet_id) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''anon_sheet'')', 'anon: não insere em character_sheets');
-- rooms (Fase 3): servidor-only — RLS ativo sem policies → nada de anon
select rls_test.expect_count('select * from public.rooms', 0, 'anon: não lê rooms (servidor-only)');
select rls_test.expect_denied('insert into public.rooms (code, room_state) values (''RLSNC-1'', ''{}''::jsonb)', 'anon: não insere em rooms');
select rls_test.expect_affected('update public.rooms set room_state = ''{}''::jsonb', 0, 'anon: NÃO atualiza rooms');
select rls_test.expect_affected('delete from public.rooms where code = ''RLSNC-1''', 0, 'anon: NÃO deleta de rooms (sem policy de delete)');
select rls_test.expect_denied('insert into storage.objects (bucket_id, name, owner_id) values (''avatars'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b/anon.png'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'')', 'anon: não faz upload no bucket avatars');
-- leitura pública (políticas to public): bucket público + listagem de buckets
select rls_test.expect_count('select * from storage.objects where bucket_id = ''avatars''', 1, 'anon: lê avatares (bucket público)');
select rls_test.expect_count('select * from storage.buckets where public = true', 1, 'anon: lista buckets públicos');

-- ============================================================
-- 2) AUTENTICADO A — lê o próprio, escondido do alheio
-- ============================================================
reset role;
set request.jwt.claim.sub = '6dbca66c-511a-4959-8919-a03b1bdeff5b';
set role authenticated;

-- profiles: leitura pública entre autenticados; escrita só do dono
select rls_test.expect_count('select * from public.profiles', 4, 'A: lê perfis (público p/ autenticado)');
select rls_test.expect_count('select * from public.profiles where id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 1, 'A: vê o próprio perfil');
select rls_test.expect_affected('update public.profiles set bio = ''rls-ok'' where id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 1, 'A: atualiza o próprio perfil');
select rls_test.expect_affected('update public.profiles set bio = ''hack'' where id = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 0, 'A: NÃO atualiza o perfil de B');
select rls_test.expect_affected('delete from public.profiles where id = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 0, 'A: NÃO deleta o perfil de B');
select rls_test.expect_denied('insert into public.profiles (id, cyberpunk_id) values (''7afefc46-fb18-41a5-8b78-57fad6249e69'', ''#NC-ROUBO'')', 'A: NÃO insere perfil com id de B');

-- friendships: só pares em que participa
select rls_test.expect_count('select * from public.friendships', 1, 'A: só vê a amizade A-B (não vê B-C)');
select rls_test.expect_affected('update public.friendships set status = ''accepted'' where sender_id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b'' and receiver_id = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 1, 'A: atualiza a própria amizade (participante)');
select rls_test.expect_affected('update public.friendships set status = ''blocked'' where sender_id = ''7afefc46-fb18-41a5-8b78-57fad6249e69'' and receiver_id = ''da1a9ef2-dc3d-459c-9366-71e757a75737''', 0, 'A: NÃO altera a amizade B-C');
select rls_test.expect_affected('delete from public.friendships where sender_id = ''7afefc46-fb18-41a5-8b78-57fad6249e69'' and receiver_id = ''da1a9ef2-dc3d-459c-9366-71e757a75737''', 0, 'A: NÃO remove a amizade B-C');

-- friend_requests: vê as que é remetente OU destinatário; insere só como remetente
select rls_test.expect_count('select * from public.friend_requests', 2, 'A: vê solicitações em que participa (B→A e A→B)');
select rls_test.expect_ok('insert into public.friend_requests (sender_uid, sender_name, receiver_uid) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''A'', ''7afefc46-fb18-41a5-8b78-57fad6249e69'')', 'A: insere solicitação como remetente');
select rls_test.expect_denied('insert into public.friend_requests (sender_uid, sender_name, receiver_uid) values (''7afefc46-fb18-41a5-8b78-57fad6249e69'', ''B'', ''da1a9ef2-dc3d-459c-9366-71e757a75737'')', 'A: NÃO insere solicitação em nome de B');
select rls_test.expect_affected('update public.friend_requests set sender_name = ''hack'' where sender_uid = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 0, 'A: NÃO edita solicitação que apenas enviou (só receiver atualiza)');
select rls_test.expect_affected('update public.friend_requests set sender_name = ''x'' where receiver_uid = ''6dbca66c-511a-4959-8919-a03b1bdeff5b'' and sender_uid = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 1, 'A: atualiza solicitação recebida (é o destinatário)');

-- direct_messages: só chats em que participa (uid no chat_room_id)
select rls_test.expect_count('select * from public.direct_messages', 1, 'A: só vê mensagens do chat A-B');
select rls_test.expect_ok('insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b__7afefc46-fb18-41a5-8b78-57fad6249e69'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''A'', ''oi'')', 'A: envia mensagem no chat em que participa');
select rls_test.expect_denied('insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text) values (''7afefc46-fb18-41a5-8b78-57fad6249e69__da1a9ef2-dc3d-459c-9366-71e757a75737'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'', ''A'', ''intruso'')', 'A: NÃO injeta mensagem no chat B-C (não participa)');
select rls_test.expect_denied('insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text) values (''6dbca66c-511a-4959-8919-a03b1bdeff5b__7afefc46-fb18-41a5-8b78-57fad6249e69'', ''7afefc46-fb18-41a5-8b78-57fad6249e69'', ''B'', ''falso'')', 'A: NÃO envia mensagem como outro remetente');
select rls_test.expect_affected('update public.direct_messages set text = ''edit'' where chat_room_id like ''%7afefc46-fb18-41a5-8b78-57fad6249e69%''', 0, 'A: NÃO edita mensagens (sem policy de update)');
select rls_test.expect_affected('delete from public.direct_messages where chat_room_id like ''%7afefc46-fb18-41a5-8b78-57fad6249e69%''', 0, 'A: NÃO deleta mensagens (sem policy de delete)');

-- character_sheets: apenas as próprias
select rls_test.expect_count('select * from public.character_sheets', 1, 'A: só vê a própria ficha (não a de B)');
select rls_test.expect_affected('update public.character_sheets set handle = ''Vex RLS 2'' where user_id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 1, 'A: atualiza a própria ficha');
select rls_test.expect_affected('update public.character_sheets set handle = ''hack'' where user_id = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 0, 'A: NÃO altera a ficha de B');
select rls_test.expect_affected('delete from public.character_sheets where user_id = ''7afefc46-fb18-41a5-8b78-57fad6249e69''', 0, 'A: NÃO deleta a ficha de B');

-- storage: pasta própria apenas
select rls_test.expect_ok('insert into storage.objects (bucket_id, name, owner_id) values (''avatars'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b/own.png'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'')', 'A: faz upload na própria pasta avatars');select rls_test.expect_denied('insert into storage.objects (bucket_id, name, owner_id) values (''avatars'', ''7afefc46-fb18-41a5-8b78-57fad6249e69/roubo.png'', ''7afefc46-fb18-41a5-8b78-57fad6249e69'')', 'A: NÃO faz upload na pasta de B');
select rls_test.expect_affected('update storage.objects set metadata = ''{"hack":true}''::jsonb where name like ''7afefc46%''', 0, 'A: NÃO altera objeto de B');
-- DELETE direto é bloqueado pelo trigger protect_delete (42501), além do RLS.
select rls_test.expect_denied('delete from storage.objects where name like ''7afefc46%''', 'A: NÃO deleta objeto de B (trigger protect_delete + RLS)');
select rls_test.expect_count('select * from storage.objects where bucket_id = ''avatars''', 2, 'A: lê avatares (bucket público)');

-- ============================================================
-- 3) AUTENTICADO B — confirma o isolamento pelo outro lado
-- ============================================================
reset role;
set request.jwt.claim.sub = '7afefc46-fb18-41a5-8b78-57fad6249e69';
set role authenticated;

select rls_test.expect_count('select * from public.character_sheets', 1, 'B: só vê a própria ficha');
select rls_test.expect_count('select * from public.character_sheets where user_id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 0, 'B: NÃO vê a ficha de A');
select rls_test.expect_affected('update public.profiles set bio = ''hack'' where id = ''6dbca66c-511a-4959-8919-a03b1bdeff5b''', 0, 'B: NÃO atualiza o perfil de A');
-- rooms: autenticado também é bloqueado (estado da mesa passa pelo servidor)
select rls_test.expect_count('select * from public.rooms', 0, 'B: não lê rooms (servidor-only)');
select rls_test.expect_denied('insert into public.rooms (code, room_state) values (''RLSNC-2'', ''{}''::jsonb)', 'B: não insere em rooms');
select rls_test.expect_count('select * from public.direct_messages', 3, 'B: vê chats A-B e B-C (participa dos dois)');
select rls_test.expect_denied('insert into storage.objects (bucket_id, name, owner_id) values (''avatars'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b/x.png'', ''6dbca66c-511a-4959-8919-a03b1bdeff5b'')', 'B: NÃO faz upload na pasta de A');
select rls_test.expect_count('select * from public.friend_requests', 3, 'B: vê solicitações em que participa');

-- ============================================================
-- RESUMO (falha explícita se houver algum FAIL — útil p/ CI/T9.5)
-- ============================================================
reset role;
select count(*) filter (where ok) as pass,
       count(*) filter (where not ok) as fail,
       count(*) as total
from rls_test.results;

do $$
begin
  if exists (select 1 from rls_test.results where not ok) then
    raise exception 'RLS: % teste(s) FALHARAM — ver NOTICE acima',
      (select count(*) from rls_test.results where not ok);
  else
    raise notice 'RLS: todos os testes passaram ✔';
  end if;
end
$$;
