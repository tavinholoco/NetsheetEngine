-- ============================================================
-- NETSHEET ENGINE — MIGRAÇÃO 0005 (Fase 2: Firebase → Supabase)
-- Realtime: friendships e character_sheets na publicação
--
-- A migration 0002 habilitou realtime para direct_messages, profiles e
-- friend_requests. A camada cliente (T2.10) também assina:
--   * friendships       → subscribeToFriends (lista de amigos ao vivo)
--   * character_sheets  → subscribeToCharacterSheets (roster ao vivo)
-- Sem elas na publicação supabase_realtime, os eventos nunca chegam e
-- apenas o load inicial funciona.
-- ============================================================
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.character_sheets;
