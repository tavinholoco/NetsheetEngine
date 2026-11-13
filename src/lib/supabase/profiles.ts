/**
 * L.4 — perfil público, ID de Night City e o bucket de avatares.
 */
import { supabase, supabaseUrl } from './client';
import type { FriendUser, ProfileRow, User, UserProfileData } from './types';

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
  const { error } = await supabase
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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
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
    avatarUrl: row.avatar_url || '',
    status: row.status as UserProfileData['status']
  };
}

/** Busca um edgerunner pelo ID Cyberpunk (#NC-####). */
export async function searchUserByCyberpunkId(id: string): Promise<Omit<FriendUser, 'addedAt'> | null> {
  const normalized = id.trim().toUpperCase();
  const { data, error } = await supabase
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
  const { error } = await supabase.from('profiles').update({ status }).eq('id', uid);
  if (error) throw error;
}

/* ============================================================
   STORAGE — AVATAR (T2.16 bucket avatars / T2.17 upload)
   ============================================================ */

/** MIME types aceitos pelo bucket avatars (migration 0002). */
const AVATAR_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

/** Limite do bucket avatars (5 MB, migration 0002). */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Monta a URL pública de um objeto do bucket avatars. */
function avatarPublicUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

/**
 * Remove (melhor esforço) os objetos de avatar antigos da pasta do usuário,
 * preservando o recém-enviado (`keepPath`). O upload novo é gravado ANTES da
 * limpeza para nunca deixar o perfil sem avatar se o envio falhar.
 */
async function cleanupOldAvatarObjects(uid: string, keepPath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('avatars').list(uid, { limit: 100 });
  // Sem a lista, a limpeza fica para o próximo envio.
  if (error) return;
  const stale = (data ?? [])
    .map((f) => f.name)
    .filter((n) => n && !n.endsWith('/') && `${uid}/${n}` !== keepPath);
  if (stale.length === 0) return;
  await supabase.storage.from('avatars').remove(stale.map((n) => `${uid}/${n}`));
}

/**
 * Envia um arquivo de imagem como avatar do usuário (bucket avatars,
 * pasta `avatars/<uid>/`) e grava a URL pública em `profiles.avatar_url`.
 * Valida tipo (png/jpeg/webp/gif) e tamanho (≤ 5 MB) no cliente.
 * Retorna a URL pública do novo avatar.
 */
export async function uploadAvatar(uid: string, file: File | Blob): Promise<string> {
  const ext = AVATAR_MIME_EXT[file.type];
  if (!ext) {
    throw new Error('Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Imagem muito grande. O limite é 5 MB.');
  }

  // Sube o novo primeiro; só depois remove os antigos (se o upload falhar,
  // o avatar atual permanece intacto).
  const path = `${uid}/avatar_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false
  });
  if (error) {
    throw new Error(`Falha ao enviar avatar: ${error.message}`);
  }

  await cleanupOldAvatarObjects(uid, path);

  const url = avatarPublicUrl(path);
  // Não bloqueia o upload — o avatar fica no bucket mesmo sem o link no perfil
  // (o erro da gravação não é lido).
  await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', uid);
  return url;
}

/** Remove o avatar: apaga os objetos do bucket e limpa `profiles.avatar_url`. */
export async function removeAvatar(uid: string): Promise<void> {
  await cleanupOldAvatarObjects(uid, '');
  const { error } = await supabase.from('profiles').update({ avatar_url: '' }).eq('id', uid);
  if (error) throw error;
}
