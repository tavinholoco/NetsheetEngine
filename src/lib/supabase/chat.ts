/**
 * L.4 — mensagens diretas (o chat da rede de amigos).
 */
import { supabase, subscribeShared, type Unsubscribe } from './client';
import type { DirectMessage, DirectMessageRow } from './types';

/** Gera o id determinístico do chat entre dois usuários. */
export function getChatRoomId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('__');
}

/** Envia uma mensagem direta para o chat de dois usuários. */
export async function sendDirectMessage(
  senderUid: string,
  senderName: string,
  friendUid: string,
  text: string
): Promise<void> {
  const roomId = getChatRoomId(senderUid, friendUid);
  const { error } = await supabase.from('direct_messages').insert({
    chat_room_id: roomId,
    sender_uid: senderUid,
    sender_name: senderName,
    text
  });
  if (error) throw error;
}

/** Assina as mensagens de um chat em tempo real (Realtime postgres_changes). */
export function subscribeToDirectMessages(
  chatRoomId: string,
  cb: (msgs: DirectMessage[]) => void
): Unsubscribe {
  let active = true;

  const load = async () => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_room_id', chatRoomId)
      .order('created_at', { ascending: true });
    if (error || !data || !active) return;
    cb(
      (data as DirectMessageRow[]).map((m) => ({
        id: m.id,
        senderUid: m.sender_uid,
        senderName: m.sender_name,
        text: m.text,
        timestamp: m.created_at
      }))
    );
  };

  // Canal primeiro, load depois: evita perder eventos entre o load e a subscrição.
  // Filtro MANTIDO (diferente de pending_requests/sheets): mensagens nunca são
  // deletadas no app, e o filtro evita eventos/requeries de outros chats. Se um
  // dia houver exclusão de mensagem, o filtro precisará ser removido (o Realtime
  // não avalia filtros de coluna não-PK em DELETE — bug T2.18).
  const unsub = subscribeShared(
    `chat_${chatRoomId}`,
    (onEvent) =>
      supabase.channel(`chat_${chatRoomId}`).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_room_id=eq.${chatRoomId}`
        },
        onEvent
      ),
    () => {
      void load();
    }
  );
  void load();

  return () => {
    active = false;
    unsub();
  };
}
