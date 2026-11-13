/**
 * L.4 — amizades: pedido, aceite, recusa, remoção, as duas assinaturas em
 * tempo real e os NPCs de demonstração.
 *
 * NPCs de demonstração (uid `npc_*`) não têm linha em `profiles` (FK uuid):
 * as "amizades" com NPCs ficam no localStorage e são mescladas aqui; o chat
 * com NPCs continua no banco (o `chat_room_id` inclui o uid real → RLS ok).
 */
import { supabase, subscribeShared, type Unsubscribe } from './client';
import type { FriendRequest, FriendRequestRow, FriendUser, ProfileRow, UserProfileData } from './types';

/** Amigos NPC de demonstração (armazenados localmente — não existem em profiles). */
const NPC_FRIENDS_LS_KEY = 'cyberpunk_npc_friends_v1';

function readNpcFriends(): FriendUser[] {
  try {
    return JSON.parse(localStorage.getItem(NPC_FRIENDS_LS_KEY) || '[]') as FriendUser[];
  } catch {
    return [];
  }
}

function writeNpcFriends(list: FriendUser[]): void {
  try {
    localStorage.setItem(NPC_FRIENDS_LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * Envia solicitação de amizade. NPCs (uid `npc_*`) são adicionados
 * diretamente aos contatos locais; usuários reais geram um registro
 * em `friend_requests` (compatível com o tipo FriendRequest).
 */
export async function sendFriendRequest(
  senderProfile: UserProfileData,
  target: Omit<FriendUser, 'addedAt'>
): Promise<{ success: boolean; message: string }> {
  if (target.uid.startsWith('npc_')) {
    const npcs = readNpcFriends();
    if (!npcs.some((f) => f.uid === target.uid)) {
      npcs.push({ ...target, addedAt: new Date().toISOString() });
      writeNpcFriends(npcs);
    }
    return { success: true, message: `NPC ${target.displayName} adicionado aos seus contatos!` };
  }

  // Duplicata: solicitação pendente já existente
  const { data: existing, error: dupError } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('sender_uid', senderProfile.uid)
    .eq('receiver_uid', target.uid)
    .maybeSingle();
  if (dupError) throw dupError;
  if (existing) {
    return { success: false, message: 'Já existe uma solicitação pendente para este edgerunner.' };
  }

  const { error } = await supabase.from('friend_requests').insert({
    sender_uid: senderProfile.uid,
    sender_name: senderProfile.displayName,
    sender_cyberpunk_id: senderProfile.cyberpunkId,
    sender_avatar: senderProfile.avatarIcon,
    receiver_uid: target.uid
  });
  if (error) throw error;
  return { success: true, message: `Solicitação de amizade enviada para ${target.displayName}!` };
}

/**
 * Aceita uma solicitação: cria a amizade (par canônico sender < receiver
 * na tabela friendships, status accepted) e remove a solicitação.
 */
export async function acceptFriendRequest(
  req: FriendRequest,
  currentUserProfile: UserProfileData
): Promise<void> {
  const [a, b] = [req.senderUid, currentUserProfile.uid].sort();

  const { error: upsertError } = await supabase.from('friendships').upsert(
    {
      sender_id: a,
      receiver_id: b,
      status: 'accepted'
    },
    { onConflict: 'sender_id,receiver_id' }
  );
  if (upsertError) throw upsertError;

  const { error: delError } = await supabase.from('friend_requests').delete().eq('id', req.id);
  if (delError) throw delError;
}

/** Recusa uma solicitação de amizade. */
export async function rejectFriendRequest(requestId: string, _uid?: string): Promise<void> {
  const { error } = await supabase.from('friend_requests').delete().eq('id', requestId);
  if (error) throw error;
}

/** Remove uma amizade (par canônico) — ou o NPC local, se for o caso. */
export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  if (friendUid.startsWith('npc_')) {
    writeNpcFriends(readNpcFriends().filter((f) => f.uid !== friendUid));
    return;
  }
  const [a, b] = [uid, friendUid].sort();
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('sender_id', a)
    .eq('receiver_id', b);
  if (error) throw error;
}

/**
 * Assina a lista de amigos em tempo real.
 * Amigos reais: friendships (accepted) onde o usuário participa, com
 * dados do perfil do outro lado via join em profiles.
 * NPCs de demonstração: mesclados do localStorage.
 */
export function subscribeToFriends(uid: string, cb: (friends: FriendUser[]) => void): Unsubscribe {
  let active = true;

  const load = async () => {
    const { data: rels, error } = await supabase
      .from('friendships')
      .select('sender_id, receiver_id, created_at')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    if (error || !rels || !active) {
      if (active) cb(readNpcFriends());
      return;
    }

    const otherIds: string[] = [];
    for (const r of rels) {
      otherIds.push(r.sender_id === uid ? r.receiver_id : r.sender_id);
    }

    let dbFriends: FriendUser[] = [];
    if (otherIds.length > 0) {
      const { data: profs, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherIds);
      if (!profError && profs && active) {
        dbFriends = (profs as ProfileRow[]).map((p) => {
          const rel = rels.find(
            (r) => r.sender_id === p.id || r.receiver_id === p.id
          );
          return {
            uid: p.id,
            cyberpunkId: p.cyberpunk_id,
            displayName: p.display_name,
            avatarIcon: p.avatar_icon,
            status: p.status,
            addedAt: rel?.created_at ?? new Date().toISOString()
          };
        });
      }
    }

    if (active) cb([...readNpcFriends(), ...dbFriends]);
  };

  // Canal primeiro, load depois: evita perder eventos entre o load e a subscrição.
  // Escuta `friendships` (adicionar/remover amizade) E `profiles` (status do
  // amigo muda ao vivo via presença Realtime — T2.14). RLS filtra as linhas.
  const unsub = subscribeShared(
    `friends_${uid}`,
    (onEvent) =>
      supabase
        .channel(`friends_${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          onEvent
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles' },
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

/** Assina as solicitações de amizade pendentes (receiver = uid) em tempo real. */
export function subscribeToPendingRequests(
  uid: string,
  cb: (reqs: FriendRequest[]) => void
): Unsubscribe {
  let active = true;

  const load = async () => {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_uid', uid)
      .order('created_at', { ascending: false });
    if (error || !data || !active) return;
    cb(
      (data as FriendRequestRow[]).map((r) => ({
        id: r.id,
        senderUid: r.sender_uid,
        senderName: r.sender_name,
        senderCyberpunkId: r.sender_cyberpunk_id,
        senderAvatar: r.sender_avatar,
        receiverUid: r.receiver_uid,
        timestamp: r.created_at
      }))
    );
  };

  // Canal primeiro, load depois: evita perder eventos entre o load e a subscrição.
  // SEM filter por coluna: o Realtime do Supabase NÃO avalia filtros de colunas
  // não-PK em eventos DELETE (a WAL só carrega a PK) — o painel de pendentes
  // ficaria travado após aceitar/recusar. A RLS (select_participant) já limita
  // as linhas que o usuário recebe (bug encontrado na T2.18).
  const unsub = subscribeShared(
    `pending_requests_${uid}`,
    (onEvent) =>
      supabase.channel(`pending_requests_${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
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

/* ============================================================
   USUÁRIOS DE DEMONSTRAÇÃO (NPCs de Night City)
   ============================================================ */

export const DEMO_CYBERPUNK_USERS: Omit<FriendUser, 'addedAt'>[] = [
  { uid: 'npc_silverhand', cyberpunkId: '#NC-0001', displayName: 'Johnny Silverhand', avatarIcon: 'skull', status: 'online' },
  { uid: 'npc_v', cyberpunkId: '#NC-0002', displayName: 'V', avatarIcon: 'zap', status: 'online' },
  { uid: 'npc_judy', cyberpunkId: '#NC-0003', displayName: 'Judy Álvarez', avatarIcon: 'bot', status: 'em jogo' },
  { uid: 'npc_panam', cyberpunkId: '#NC-0004', displayName: 'Panam Palmer', avatarIcon: 'zap', status: 'inativo' },
  { uid: 'npc_rogue', cyberpunkId: '#NC-0005', displayName: 'Rogue Amendiares', avatarIcon: 'shield', status: 'offline' },
  { uid: 'npc_trauma', cyberpunkId: '#NC-0006', displayName: 'Trauma Team Bravo', avatarIcon: 'shield', status: 'online' }
];
