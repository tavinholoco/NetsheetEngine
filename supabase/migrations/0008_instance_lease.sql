-- ============================================================
-- FASE H (H.3d — H.13) — A PASSAGEM DE BASTÃO ENTRE INSTÂNCIAS
-- ============================================================
-- Num deploy, o Render liga a instância nova enquanto a velha ainda
-- serve a mesa. A nova lia a `rooms` ao ligar e as duas seguiam
-- separadas até a velha morrer: o que chegava à velha nesse meio-
-- tempo pelo WebSocket se perdia (H.1j, medido no ar em 14/10/2026).
--
-- O conserto é uma regra só: UMA instância manda na mesa por vez.
-- Esta tabela é o bastão. A nova anota que quer assumir (`claimant`)
-- e não abre a porta; a velha, que renova a marca de vida
-- (`holder_beat`) a cada 2 s, vê o pedido, para de aceitar ações,
-- fecha os sockets, grava tudo e marca que entregou (`released_by`).
-- Só então a nova lê a `rooms` e escuta. Sem marca de vida recente
-- (a velha morreu, ou o serviço hibernava), a nova assume na hora.
-- Desenho, versões descartadas e premissas: o H.13 do ledger da H e a
-- ADR 0007.
--
-- UMA LINHA SÓ
-- `id` é sempre 1 (a restrição impede uma segunda linha). A tabela
-- não cresce: é a pergunta 5 do portão.
--
-- SÓ O SERVIDOR
-- Quem escreve aqui manda a instância que serve a mesa parar. Por isso
-- nenhum papel de cliente toca a tabela: os privilégios de anon e
-- authenticated são REVOGADOS (o select nega, em vez de devolver vazio
-- como na `rooms`), e o RLS fica ligado e sem política como segunda
-- camada. O servidor usa a service role. O Realtime do Supabase foi
-- descartado para o aviso pelo mesmo motivo: a chave anônima é pública.
-- ============================================================

create table if not exists public.instance_lease (
  id smallint primary key default 1,
  holder text,
  holder_beat timestamptz,
  claimant text,
  claimed_at timestamptz,
  released_by text,
  released_at timestamptz,
  constraint instance_lease_single_row check (id = 1)
);

comment on table public.instance_lease is
  'H.3d/H.13 — o bastão: qual instância do servidor manda nas mesas. Uma linha (id = 1); só a service role lê e escreve.';
comment on column public.instance_lease.holder is
  'A instância que serve as mesas agora (id aleatório por processo).';
comment on column public.instance_lease.holder_beat is
  'A última marca de vida do holder, renovada a cada 2 s. Velha demais = o holder morreu.';
comment on column public.instance_lease.claimant is
  'A instância nova que pediu para assumir e espera, sem abrir a porta.';
comment on column public.instance_lease.released_by is
  'Quem entregou o bastão, depois de fechar os sockets e gravar tudo. Igual ao holder = a nova pode assumir.';

insert into public.instance_lease (id) values (1) on conflict (id) do nothing;

revoke all on table public.instance_lease from anon, authenticated;
grant select, insert, update on table public.instance_lease to service_role;

alter table public.instance_lease enable row level security;
