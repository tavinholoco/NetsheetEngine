/**
 * ============================================================
 * NETSHEET ENGINE — CAMADA SUPABASE (T2.10; dividida na L.4, o ARQ-06)
 *
 * O módulo de 891 linhas virou seis por domínio, e este arquivo é o barril:
 * **quem importava de `lib/supabase` continua importando do mesmo caminho**.
 *
 *   client.ts    — o cliente, o provider do Google e os canais compartilhados
 *   types.ts     — os tipos públicos e as linhas de cada tabela
 *   auth.ts      — cadastro, login, sessão e logout (nomes do Firebase saíram)
 *   profiles.ts  — perfil público, ID de Night City e o bucket de avatares
 *   friends.ts   — amizades, pedidos pendentes e os NPCs de demonstração
 *   chat.ts      — mensagens diretas
 *   sheets.ts    — as fichas na nuvem
 *
 * O barril é **explícito**, como o do `server/roomManager.ts` (L.3b) e não um
 * `export *`: o que é interno de um módulo fica lá dentro — o `subscribeShared`
 * e o `supabaseUrl` (o cliente e os canais compartilhados), os `*Row` de cada
 * tabela (o formato do banco) e o `Unsubscribe`. Quem precisa de um canal novo
 * mexe **dentro** da camada, que é onde a armadilha do Realtime vale: todo canal
 * passa por `subscribeShared`, porque o menu monta a rede de amigos em dois
 * lugares e o supabase-js não aceita `.on()` depois de `.subscribe()`.
 * ============================================================
 */
export { supabase, googleProvider } from './client';
export type { User, UserProfileData, FriendUser, FriendRequest, DirectMessage, SheetMeta } from './types';
export { signUpWithEmail, signInWithEmail, signInWithProvider, onAuthChange, updateProfile, signOut } from './auth';
export {
  generateCyberpunkId,
  saveUserProfile,
  fetchUserProfile,
  searchUserByCyberpunkId,
  updateProfileStatus,
  uploadAvatar,
  removeAvatar
} from './profiles';
export {
  DEMO_CYBERPUNK_USERS,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  subscribeToFriends,
  subscribeToPendingRequests
} from './friends';
export { getChatRoomId, sendDirectMessage, subscribeToDirectMessages } from './chat';
export {
  subscribeToCharacterSheets,
  saveCharacterSheet,
  loadCharacterSheet,
  deleteCharacterSheet
} from './sheets';
