/**
 * ============================================================
 * NETSHEET ENGINE — CAMADA SUPABASE (T2.10)
 * Substitui src/lib/firebase.ts mantendo a MESMA API (contrato):
 *   auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
 *   signInWithPopup, onAuthStateChanged, updateProfile, firebaseSignOut,
 *   saveUserProfile, fetchUserProfile, searchUserByCyberpunkId,
 *   updateProfileStatus, sendFriendRequest, acceptFriendRequest,
 *   rejectFriendRequest, removeFriend, subscribeToFriends,
 *   subscribeToPendingRequests, getChatRoomId, sendDirectMessage,
 *   subscribeToDirectMessages, subscribeToCharacterSheets,
 *   saveCharacterSheet, loadCharacterSheet, deleteCharacterSheet,
 *   generateCyberpunkId, DEMO_CYBERPUNK_USERS, tipos UserProfileData,
 *   FriendUser, FriendRequest, DirectMessage, SheetMeta, User.
 *
 * Adaptações ao modelo Supabase (migrations 0001–0004):
 *   - uids são uuid (auth.users.id); perfis em `profiles`.
 *   - RLS: leitura de perfis pública (autenticado); amizades/fichas/
 *     mensagens somente para participantes/donos.
 *   - Realtime (postgres_changes) no lugar do onSnapshot do Firestore.
 *   - NPCs de demonstração (uid `npc_*`) não têm linha em `profiles`
 *     (FK uuid): as "amizades" com NPCs ficam no localStorage e são
 *     mescladas em subscribeToFriends; o chat com NPCs continua no
 *     banco (chat_room_id inclui o uid real → RLS ok).
 *   - profiles NÃO guarda e-mail (removido na migration 0004): o e-mail
 *     vem do JWT (auth.getUser()), nunca de `profiles`.
 * ============================================================
 */

import { createClient, type SupabaseClient, type RealtimeChannel, type User as SupabaseUser } from '@supabase/supabase-js';
import type { CharacterSheet } from '../types/cyberpunk';

/* ============================================================
   CLIENTE
   ============================================================ */

// Ambiente do Vite (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env.local)
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const supabaseUrl: string = env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
// Fallback local (anon key do ambiente `supabase start` — chave pública por design)
const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const auth: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/** Provider Google (marcador — o fluxo OAuth do Supabase usa redirect, ver T2.11). */
export const googleProvider = { provider: 'google' } as const;

/** Unsubscribe padrão da camada (compatível com o onSnapshot do Firebase). */
export type Unsubscribe = () => void;

/* ============================================================
   CANAIS REALTIME COMPARTILHADOS (fix T2.12)
   O CyberpunkMenu monta o FriendsList em 2 lugares (desktop sidebar
   + drawer mobile) e o chat/fichas podem ser assinados mais de uma
   vez. O supabase-js não permite `.on()` após `.subscribe()` num
   canal com o mesmo nome — então canais são compartilhados por
   chave com refcount: o 1º subscriber cria, os demais reutilizam,
   e todos os `load`s registrados disparam a cada evento.
   ============================================================ */

interface SharedChannelEntry {
  channel: RealtimeChannel;
  loads: Set<() => void>;
}

const sharedChannels = new Map<string, SharedChannelEntry>();

function subscribeShared(
  key: string,
  setup: (onEvent: () => void) => RealtimeChannel,
  load: () => void
): Unsubscribe {
  let entry = sharedChannels.get(key);
  if (!entry) {
    const loads = new Set<() => void>();
    const onEvent = () => {
      loads.forEach((l) => l());
    };
    // Inscreve o canal ANTES do load inicial (o subscriber chama `void load()`
    // logo após este retorno) para não perder eventos no intervalo.
    const channel = setup(onEvent).subscribe();
    entry = { channel, loads };
    sharedChannels.set(key, entry);
  }
  entry.loads.add(load);
  return () => {
    const e = sharedChannels.get(key);
    if (!e) return;
    e.loads.delete(load);
    if (e.loads.size === 0) {
      sharedChannels.delete(key);
      // removeChannel remove o canal da lista interna do client — evita que um
      // resubscribe rápido reutilize o canal fechado (erro "after subscribe()").
      void auth.removeChannel(e.channel);
    }
  };
}

/* ============================================================
   TIPOS (mesmo contrato do firebase.ts)
   ============================================================ */

/** Usuário autenticado no formato consumido pelos componentes. */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserProfileData {
  uid: string;
  cyberpunkId: string;
  email: string | null;
  displayName: string;
  bio: string;
  avatarIcon: string;
  status: 'online' | 'inativo' | 'em jogo' | 'offline';
}

export interface FriendUser {
  uid: string;
  cyberpunkId: string;
  displayName: string;
  avatarIcon: string;
  status: string;
  addedAt: string;
}

export interface FriendRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderCyberpunkId: string;
  senderAvatar: string;
  receiverUid: string;
  timestamp: string;
}

export interface DirectMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface SheetMeta {
  id: string;
  handle: string;
  role: string;
  updatedAt: string;
}

/* ============================================================
   HELPERS DE MAPEAMENTO
   ============================================================ */

function mapSupabaseUser(u: SupabaseUser | null): User | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    null;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: name,
    photoURL: (meta.avatar_url as string) ?? null
  };
}

/** Linha da tabela profiles. */
interface ProfileRow {
  id: string;
  cyberpunk_id: string;
  display_name: string;
  bio: string;
  avatar_icon: string;
  avatar_url: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Linha da tabela friend_requests. */
interface FriendRequestRow {
  id: string;
  sender_uid: string;
  sender_name: string;
  sender_cyberpunk_id: string;
  sender_avatar: string;
  receiver_uid: string;
  created_at: string;
}

/** Linha da tabela direct_messages. */
interface DirectMessageRow {
  id: string;
  chat_room_id: string;
  sender_uid: string;
  sender_name: string;
  text: string;
  created_at: string;
}

/** Linha da tabela character_sheets. */
interface CharacterSheetRow {
  id: string;
  user_id: string;
  sheet_id: string;
  handle: string;
  role: string;
  data: CharacterSheet;
  created_at: string;
  updated_at: string;
}

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

/* ============================================================
   AUTH (mesmas assinaturas do firebase.ts)
   ============================================================ */

/**
 * Cadastro por e-mail/senha. Retorna { user } (formato Firebase).
 * O perfil é auto-criado pelo trigger handle_new_user; saveUserProfile
 * completa display_name/avatar após o cadastro.
 */
export async function createUserWithEmailAndPassword(
  _client: SupabaseClient,
  email: string,
  password: string
): Promise<{ user: User }> {
  const { data, error } = await auth.auth.signUp({ email, password });
  if (error) throw error;
  return { user: mapSupabaseUser(data.user) as User };
}

/** Login por e-mail/senha. Retorna { user } (formato Firebase). */
export async function signInWithEmailAndPassword(
  _client: SupabaseClient,
  email: string,
  password: string
): Promise<{ user: User }> {
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: mapSupabaseUser(data.user) as User };
}

/**
 * Login com Google (OAuth). O Supabase usa fluxo de redirect (não popup):
 * esta função inicia o fluxo e retorna { user: null }; o AuthModal (T2.11)
 * tratará o retorno via onAuthStateChanged após o redirect.
 */
export async function signInWithPopup(
  _client: SupabaseClient,
  _provider: unknown
): Promise<{ user: User | null }> {
  const { error } = await auth.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
  return { user: null };
}

/** Assina mudanças de estado de autenticação (sessão inicial + login/logout). */
export function onAuthStateChanged(
  _client: SupabaseClient,
  cb: (user: User | null) => void
): Unsubscribe {
  const { data } = auth.auth.onAuthStateChange((_event, session) => {
    cb(mapSupabaseUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

/** Atualiza dados do usuário (ex.: display_name). Formato Firebase: (user, { displayName }). */
export async function updateProfile(
  _user: User,
  updates: { displayName?: string; photoURL?: string | null }
): Promise<void> {
  const { error } = await auth.auth.updateUser({
    data: { display_name: updates.displayName ?? null }
  });
  if (error) throw error;
}

/** Encerra a sessão (wrapper nomeado compatível com firebaseSignOut). */
export async function firebaseSignOut(_client: SupabaseClient): Promise<void> {
  const { error } = await auth.auth.signOut();
  if (error) throw error;
}

/* ============================================================
   PERFIS / IDENTITY
   ============================================================ */

/** Gera o ID Cyberpunk determinístico (#NC-XXXX) a partir do uid. */
export function generateCyberpunkId(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  const num = 1000 + (hash % 9000);
  return `#NC-${num}`;
}

/**
 * Cria/atualiza o perfil público. O trigger já criou a linha no signup
 * (com cyberpunk_id determinístico); este upsert atualiza os campos
 * mutáveis e mantém o contrato de cyberpunk_id do cliente.
 */
export async function saveUserProfile(user: User, displayName?: string): Promise<void> {
  const { error } = await auth
    .from('profiles')
    .upsert(
      {
        id: user.uid,
        cyberpunk_id: generateCyberpunkId(user.uid),
        display_name: displayName || user.displayName || 'Edgerunner',
        bio: '',
        avatar_icon: 'cpu',
        avatar_url: '',
        status: 'online'
      },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

/** Busca o perfil público de um usuário. */
export async function fetchUserProfile(uid: string): Promise<UserProfileData | null> {
  const { data, error } = await auth.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProfileRow;
  return {
    uid: row.id,
    cyberpunkId: row.cyberpunk_id,
    email: null, // e-mail não é mais exposto em profiles (migration 0004); vem do JWT
    displayName: row.display_name,
    bio: row.bio,
    avatarIcon: row.avatar_icon,
    status: row.status as UserProfileData['status']
  };
}

/** Busca um edgerunner pelo ID Cyberpunk (#NC-####). */
export async function searchUserByCyberpunkId(id: string): Promise<Omit<FriendUser, 'addedAt'> | null> {
  const normalized = id.trim().toUpperCase();
  const { data, error } = await auth
    .from('profiles')
    .select('*')
    .eq('cyberpunk_id', normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProfileRow;
  return {
    uid: row.id,
    cyberpunkId: row.cyberpunk_id,
    displayName: row.display_name,
    avatarIcon: row.avatar_icon,
    status: row.status
  };
}

/** Atualiza apenas o status de atividade do perfil (presença). */
export async function updateProfileStatus(uid: string, status: string): Promise<void> {
  const { error } = await auth.from('profiles').update({ status }).eq('id', uid);
  if (error) throw error;
}

/* ============================================================
   AMIZADES
   ============================================================ */

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
  const { data: existing, error: dupError } = await auth
    .from('friend_requests')
    .select('id')
    .eq('sender_uid', senderProfile.uid)
    .eq('receiver_uid', target.uid)
    .maybeSingle();
  if (dupError) throw dupError;
  if (existing) {
    return { success: false, message: 'Já existe uma solicitação pendente para este edgerunner.' };
  }

  const { error } = await auth.from('friend_requests').insert({
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

  const { error: upsertError } = await auth.from('friendships').upsert(
    {
      sender_id: a,
      receiver_id: b,
      status: 'accepted'
    },
    { onConflict: 'sender_id,receiver_id' }
  );
  if (upsertError) throw upsertError;

  const { error: delError } = await auth.from('friend_requests').delete().eq('id', req.id);
  if (delError) throw delError;
}

/** Recusa uma solicitação de amizade. */
export async function rejectFriendRequest(requestId: string, _uid?: string): Promise<void> {
  const { error } = await auth.from('friend_requests').delete().eq('id', requestId);
  if (error) throw error;
}

/** Remove uma amizade (par canônico) — ou o NPC local, se for o caso. */
export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  if (friendUid.startsWith('npc_')) {
    writeNpcFriends(readNpcFriends().filter((f) => f.uid !== friendUid));
    return;
  }
  const [a, b] = [uid, friendUid].sort();
  const { error } = await auth
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
    const { data: rels, error } = await auth
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
      const { data: profs, error: profError } = await auth
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
      auth
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
    const { data, error } = await auth
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
  const unsub = subscribeShared(
    `pending_requests_${uid}`,
    (onEvent) =>
      auth.channel(`pending_requests_${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_uid=eq.${uid}` },
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
   MENSAGENS DIRETAS
   ============================================================ */

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
  const { error } = await auth.from('direct_messages').insert({
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
    const { data, error } = await auth
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
  const unsub = subscribeShared(
    `chat_${chatRoomId}`,
    (onEvent) =>
      auth.channel(`chat_${chatRoomId}`).on(
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

/* ============================================================
   FICHAS (roster + persistência cloud)
   ============================================================ */

/** Assina o roster de fichas do usuário em tempo real. */
export function subscribeToCharacterSheets(
  uid: string,
  cb: (roster: SheetMeta[]) => void
): Unsubscribe {
  let active = true;

  const load = async () => {
    const { data, error } = await auth
      .from('character_sheets')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    if (error || !data || !active) return;
    cb(
      (data as CharacterSheetRow[]).map((s) => ({
        id: s.sheet_id,
        handle: s.handle || 'Sem nome',
        role: s.role || 'Solo',
        updatedAt: s.updated_at
      }))
    );
  };

  // Canal primeiro, load depois: evita perder eventos entre o load e a subscrição.
  const unsub = subscribeShared(
    `sheets_${uid}`,
    (onEvent) =>
      auth.channel(`sheets_${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'character_sheets', filter: `user_id=eq.${uid}` },
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

/** Salva (ou atualiza) uma ficha na nuvem (upsert por user_id + sheet_id). */
export async function saveCharacterSheet(uid: string, sheet: CharacterSheet): Promise<void> {
  const { error } = await auth.from('character_sheets').upsert(
    {
      user_id: uid,
      sheet_id: sheet.id,
      handle: sheet.handle || '',
      role: sheet.role || '',
      data: sheet,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,sheet_id' }
  );
  if (error) throw error;
}

/** Carrega uma ficha completa da nuvem. */
export async function loadCharacterSheet(
  uid: string,
  sheetId: string
): Promise<CharacterSheet | null> {
  const { data, error } = await auth
    .from('character_sheets')
    .select('data')
    .eq('user_id', uid)
    .eq('sheet_id', sheetId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as CharacterSheetRow).data : null;
}

/** Deleta uma ficha da nuvem. */
export async function deleteCharacterSheet(uid: string, sheetId: string): Promise<void> {
  const { error } = await auth
    .from('character_sheets')
    .delete()
    .eq('user_id', uid)
    .eq('sheet_id', sheetId);
  if (error) throw error;
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
