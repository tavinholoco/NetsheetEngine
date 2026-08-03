/**
 * ============================================================
 * NETSHEET ENGINE — CAMADA FIREBASE (Auth + Firestore)
 * Auth, perfis de edgerunner, amizades, mensagens diretas e
 * persistência de fichas. A API exposta aqui é o contrato
 * consumido por App.tsx, AuthModal.tsx, CyberpunkMenu.tsx,
 * FriendsList.tsx e pelos hooks useCharacterSheet/useUserActivity.
 * (A Fase 2 migrará esta camada para Supabase mantendo a MESMA API.)
 * ============================================================
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile as firebaseUpdateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  type Unsubscribe
} from "firebase/firestore";
import type { CharacterSheet } from "../types/cyberpunk";

/** Configuração do projeto Firebase (fonte: firebase-applet-config.json). */
const firebaseConfig = {
  apiKey: "REMOVIDA-SEGURANCA-AIzaSy-***",
  authDomain: "concise-waters-p1ttq.firebaseapp.com",
  projectId: "concise-waters-p1ttq",
  storageBucket: "concise-waters-p1ttq.firebasestorage.app",
  messagingSenderId: "499072548392",
  appId: "1:499072548392:web:5f8c243b719d2ace317f1d"
};

const app = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Re-exports de Auth usados pelo AuthModal
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged };
export { firebaseUpdateProfile as updateProfile };
/** Encerra a sessão do Firebase (wrapper nomeado). */
export const firebaseSignOut = (a: Auth): Promise<void> => fbSignOut(a);
export type { User };

/* ============================================================
   TIPOS DA CAMADA SOCIAL
   ============================================================ */

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

/** Metadado de ficha para o roster (lista de fichas salvas). */
export interface SheetMeta {
  id: string;
  handle: string;
  role: string;
  updatedAt: string;
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

/** Cria/atualiza o perfil público do usuário no Firestore. */
export async function saveUserProfile(user: User, displayName?: string): Promise<void> {
  const profile: UserProfileData = {
    uid: user.uid,
    cyberpunkId: generateCyberpunkId(user.uid),
    email: user.email,
    displayName: displayName || user.displayName || 'Edgerunner',
    bio: '',
    avatarIcon: 'cpu',
    status: 'online'
  };
  await setDoc(doc(db, 'profiles', user.uid), profile, { merge: true });
}

/** Busca o perfil público de um usuário. */
export async function fetchUserProfile(uid: string): Promise<UserProfileData | null> {
  const snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? (snap.data() as UserProfileData) : null;
}

/** Busca um edgerunner pelo ID Cyberpunk (#NC-####). */
export async function searchUserByCyberpunkId(id: string): Promise<Omit<FriendUser, 'addedAt'> | null> {
  const normalized = id.trim().toUpperCase();
  const q = query(collection(db, 'profiles'), where('cyberpunkId', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data() as UserProfileData;
  return {
    uid: d.uid,
    cyberpunkId: d.cyberpunkId,
    displayName: d.displayName,
    avatarIcon: d.avatarIcon,
    status: d.status
  };
}

/** Atualiza apenas o status de atividade do perfil (presença). */
export async function updateProfileStatus(uid: string, status: UserProfileData['status'] | string): Promise<void> {
  await setDoc(doc(db, 'profiles', uid), { status }, { merge: true });
}

/* ============================================================
   AMIZADES
   ============================================================ */

/** Envia solicitação de amizade (NPCs são adicionados diretamente). */
export async function sendFriendRequest(
  senderProfile: UserProfileData,
  target: Omit<FriendUser, 'addedAt'>
): Promise<{ success: boolean; message: string }> {
  if (target.uid.startsWith('npc_')) {
    await setDoc(doc(db, 'friends', senderProfile.uid, 'friendships', target.uid), {
      ...target,
      addedAt: new Date().toISOString()
    });
    return { success: true, message: `NPC ${target.displayName} adicionado aos seus contatos!` };
  }

  const existing = await getDocs(
    query(
      collection(db, 'friendRequests'),
      where('senderUid', '==', senderProfile.uid),
      where('receiverUid', '==', target.uid)
    )
  );
  if (!existing.empty) {
    return { success: false, message: 'Já existe uma solicitação pendente para este edgerunner.' };
  }

  await addDoc(collection(db, 'friendRequests'), {
    senderUid: senderProfile.uid,
    senderName: senderProfile.displayName,
    senderCyberpunkId: senderProfile.cyberpunkId,
    senderAvatar: senderProfile.avatarIcon,
    receiverUid: target.uid,
    timestamp: new Date().toISOString()
  });
  return { success: true, message: `Solicitação de amizade enviada para ${target.displayName}!` };
}

/** Aceita uma solicitação e cria a amizade bidirecional. */
export async function acceptFriendRequest(req: FriendRequest, currentUserProfile: UserProfileData): Promise<void> {
  await setDoc(doc(db, 'friends', currentUserProfile.uid, 'friendships', req.senderUid), {
    uid: req.senderUid,
    cyberpunkId: req.senderCyberpunkId,
    displayName: req.senderName,
    avatarIcon: req.senderAvatar,
    status: 'online',
    addedAt: new Date().toISOString()
  });
  await setDoc(doc(db, 'friends', req.senderUid, 'friendships', currentUserProfile.uid), {
    uid: currentUserProfile.uid,
    cyberpunkId: currentUserProfile.cyberpunkId,
    displayName: currentUserProfile.displayName,
    avatarIcon: currentUserProfile.avatarIcon,
    status: 'online',
    addedAt: new Date().toISOString()
  });
  await deleteDoc(doc(db, 'friendRequests', req.id));
}

/** Recusa uma solicitação de amizade. */
export async function rejectFriendRequest(requestId: string, _uid?: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

/** Remove uma amizade nas duas direções. */
export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  await deleteDoc(doc(db, 'friends', uid, 'friendships', friendUid));
  await deleteDoc(doc(db, 'friends', friendUid, 'friendships', uid));
}

/** Assina a lista de amigos em tempo real. */
export function subscribeToFriends(uid: string, cb: (friends: FriendUser[]) => void): Unsubscribe {
  const q = query(collection(db, 'friends', uid, 'friendships'));
  return onSnapshot(q, (snap) => {
    const friends = snap.docs.map((d) => d.data() as FriendUser);
    cb(friends);
  });
}

/** Assina as solicitações de amizade pendentes em tempo real. */
export function subscribeToPendingRequests(uid: string, cb: (reqs: FriendRequest[]) => void): Unsubscribe {
  const q = query(collection(db, 'friendRequests'), where('receiverUid', '==', uid), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snap) => {
    const reqs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
    cb(reqs);
  });
}

/* ============================================================
   MENSAGENS DIRETAS
   ============================================================ */

/** Gera o id determinístico do chat entre dois usuários. */
export function getChatRoomId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('__');
}

/** Envia uma mensagem direta para o chat de dois usuários. */
export async function sendDirectMessage(senderUid: string, senderName: string, friendUid: string, text: string): Promise<void> {
  const roomId = getChatRoomId(senderUid, friendUid);
  await addDoc(collection(db, 'directMessages', roomId, 'messages'), {
    senderUid,
    senderName,
    text,
    timestamp: new Date().toISOString()
  });
}

/** Assina as mensagens de um chat em tempo real. */
export function subscribeToDirectMessages(chatRoomId: string, cb: (msgs: DirectMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'directMessages', chatRoomId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DirectMessage, 'id'>) }));
    cb(msgs);
  });
}

/* ============================================================
   FICHAS (roster + persistência cloud)
   ============================================================ */

/** Assina o roster de fichas do usuário em tempo real. */
export function subscribeToCharacterSheets(uid: string, cb: (roster: SheetMeta[]) => void): Unsubscribe {
  const q = query(collection(db, 'characterSheets', uid, 'sheets'), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const roster = snap.docs.map((d) => {
      const data = d.data() as CharacterSheet;
      return {
        id: d.id,
        handle: data.handle || 'Sem nome',
        role: data.role || 'Solo',
        updatedAt: data.updatedAt
      };
    });
    cb(roster);
  });
}

/** Salva (ou atualiza) uma ficha na nuvem. */
export async function saveCharacterSheet(uid: string, sheet: CharacterSheet): Promise<void> {
  await setDoc(doc(db, 'characterSheets', uid, 'sheets', sheet.id), {
    ...sheet,
    updatedAt: new Date().toISOString()
  });
}

/** Carrega uma ficha completa da nuvem. */
export async function loadCharacterSheet(uid: string, sheetId: string): Promise<CharacterSheet | null> {
  const snap = await getDoc(doc(db, 'characterSheets', uid, 'sheets', sheetId));
  return snap.exists() ? (snap.data() as CharacterSheet) : null;
}

/** Deleta uma ficha da nuvem. */
export async function deleteCharacterSheet(uid: string, sheetId: string): Promise<void> {
  await deleteDoc(doc(db, 'characterSheets', uid, 'sheets', sheetId));
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
