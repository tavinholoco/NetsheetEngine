/**
 * L.4 — os tipos da camada Supabase, e as linhas cruas de cada tabela.
 *
 * Os tipos públicos são os mesmos de antes (o contrato que os componentes
 * consomem); as linhas (`*Row`) só existem para o mapeamento de cada módulo.
 */
import type { CharacterSheet } from '../../types/cyberpunk';

/* ============================================================
   TIPOS PÚBLICOS
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
  /** URL pública do avatar enviado para o bucket avatars (vazio se ainda não enviou). */
  avatarUrl: string;
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
   LINHAS DAS TABELAS (migrations 0001–0008)
   ============================================================ */

/** Linha da tabela profiles. */
export interface ProfileRow {
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
export interface FriendRequestRow {
  id: string;
  sender_uid: string;
  sender_name: string;
  sender_cyberpunk_id: string;
  sender_avatar: string;
  receiver_uid: string;
  created_at: string;
}

/** Linha da tabela direct_messages. */
export interface DirectMessageRow {
  id: string;
  chat_room_id: string;
  sender_uid: string;
  sender_name: string;
  text: string;
  created_at: string;
}

/** Linha da tabela character_sheets. */
export interface CharacterSheetRow {
  id: string;
  user_id: string;
  sheet_id: string;
  handle: string;
  role: string;
  data: CharacterSheet;
  created_at: string;
  updated_at: string;
}
