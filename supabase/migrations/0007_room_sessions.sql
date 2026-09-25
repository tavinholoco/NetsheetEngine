-- ============================================================
-- FASE B (B.4) — SESSÕES DE MESA SOBREVIVEM AO RESTART (SEC-03)
-- ============================================================
-- As sessões viviam só na memória do processo (`sessions` em
-- server/roomManager.ts). Qualquer restart — deploy, crash, ou o
-- despertar da hibernação do plano gratuito do Render — derrubava
-- TODAS as mesas: os jogadores continuavam na sala restaurada do
-- banco, mas nenhum token valia mais, e toda ação virava 401.
--
-- COLUNA SEPARADA, NÃO DENTRO DE room_state
-- O `room_state` guarda o GameRoom, que é exatamente o objeto
-- transmitido a todos os clientes a cada mutação. Sessão ali dentro
-- vazaria o token de cada jogador para a mesa inteira — trocaria o
-- SEC-03 por algo pior. Por isso coluna própria, que o broadcast
-- nunca toca.
--
-- O QUE É GRAVADO É O HASH, NUNCA O TOKEN
-- A chave do mapa é SHA-256 do token. O servidor hasheia o token
-- recebido e compara. Assim o token existe apenas no cliente e em
-- trânsito: um dump do banco (ou um backup vazado) não entrega
-- sessão viva nenhuma. Persistir segredo em claro seria abrir um
-- buraco novo enquanto se fecha outro.
--
-- Herda a postura da 0006: RLS ativo e ZERO policies. O servidor
-- (service_role) é o único que enxerga esta coluna.
-- ============================================================

alter table public.rooms
  add column if not exists sessions jsonb not null default '{}'::jsonb;

comment on column public.rooms.sessions is
  'B.4/SEC-03 — mapa { sha256(sessionToken): peerId } da mesa. Nunca contém o token em claro e nunca é transmitido ao cliente.';
