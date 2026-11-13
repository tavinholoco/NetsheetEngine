/**
 * ============================================================
 * NETSHEET ENGINE — AUTENTICAÇÃO (L.4, o ARQ-06)
 *
 * Os nomes do Firebase saíram: `createUserWithEmailAndPassword`,
 * `signInWithEmailAndPassword`, `signInWithPopup`, `onAuthStateChanged` e
 * `firebaseSignOut` viraram `signUpWithEmail`, `signInWithEmail`,
 * `signInWithProvider`, `onAuthChange` e `signOut`. **As assinaturas são as
 * mesmas** (o primeiro parâmetro do client continua ali), porque a L.4 é
 * renomear e dividir, não mudar contrato.
 * ============================================================
 */
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, type Unsubscribe } from './client';
import type { User } from './types';

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

/**
 * Cadastro por e-mail/senha.
 * O perfil é auto-criado pelo trigger handle_new_user; saveUserProfile
 * completa display_name/avatar após o cadastro.
 */
export async function signUpWithEmail(
  _client: SupabaseClient,
  email: string,
  password: string
): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: mapSupabaseUser(data.user) as User };
}

/** Login por e-mail/senha. */
export async function signInWithEmail(
  _client: SupabaseClient,
  email: string,
  password: string
): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: mapSupabaseUser(data.user) as User };
}

/**
 * Login com Google (OAuth). O Supabase usa fluxo de redirect (não popup):
 * esta função inicia o fluxo e retorna { user: null }; o AuthModal (T2.11)
 * trata o retorno via onAuthChange após o redirect.
 */
export async function signInWithProvider(
  _client: SupabaseClient,
  _provider: unknown
): Promise<{ user: User | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
  return { user: null };
}

/** Assina mudanças de estado de autenticação (sessão inicial + login/logout). */
export function onAuthChange(
  _client: SupabaseClient,
  cb: (user: User | null) => void
): Unsubscribe {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(mapSupabaseUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

/** Atualiza dados do usuário (ex.: display_name). */
export async function updateProfile(
  _user: User,
  updates: { displayName?: string; photoURL?: string | null }
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { display_name: updates.displayName ?? null }
  });
  if (error) throw error;
}

/** Encerra a sessão. */
export async function signOut(_client: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
