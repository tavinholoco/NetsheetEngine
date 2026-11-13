/**
 * ============================================================
 * NETSHEET ENGINE — CLIENTE SUPABASE (L.4, o ARQ-06)
 *
 * O cliente, o provider do Google e os canais Realtime compartilhados.
 * O resto da camada mora por domínio: `auth`, `profiles`, `friends`, `chat`
 * e `sheets`, e o `index.ts` reexporta tudo — quem importa de
 * `lib/supabase` continua importando do mesmo caminho.
 * ============================================================
 */
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

/* ============================================================
   CLIENTE
   ============================================================ */

// Ambiente do Vite (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env.local)
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const supabaseUrl: string = env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
// Fallback local (anon key do ambiente `supabase start` — chave pública por design)
const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/** Provider do Google — o fluxo OAuth do Supabase usa redirect, não popup. */
export const googleProvider = { provider: 'google' } as const;

/** Unsubscribe padrão da camada. */
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

export function subscribeShared(
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
      void supabase.removeChannel(e.channel);
    }
  };
}
