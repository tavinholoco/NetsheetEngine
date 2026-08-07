/**
 * ============================================================
 * NETSHEET ENGINE — HOOK DE ATIVIDADE DO USUÁRIO (T0.12 / T2.14)
 * Status online / inativo (após 60s sem interação) / em jogo
 * (quando na aba multiplayer), com heartbeat no perfil (presença).
 *
 * T2.14 (Fase 2 — migração Supabase):
 *   - Heartbeat escreve `profiles.status` na nuvem a cada 15s quando
 *     o status muda (presença visível aos amigos via Realtime).
 *   - Limpeza da presença: `pagehide` (fechar aba) → 'offline',
 *     `visibilitychange` (aba oculta) → 'inativo', logout → 'offline'.
 *   - O FriendsList escuta `profiles` via Realtime (T2.14) para que o
 *     status dos amigos atualize ao vivo.
 *
 * Interface consumida por App.tsx e CyberpunkMenu.tsx:
 *   useUserActivity(uid?, isInGame?) => 'online' | 'inativo' | 'em jogo'
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react';
import { updateProfileStatus } from '../lib/supabase';

export type ActivityStatus = 'online' | 'inativo' | 'em jogo';

const IDLE_MS = 60_000;
const HEARTBEAT_MS = 15_000;

export function useUserActivity(uid?: string, isInGame: boolean = false): ActivityStatus {
  const [status, setStatus] = useState<ActivityStatus>(isInGame ? 'em jogo' : 'online');
  const lastActivityRef = useRef<number>(Date.now());
  const uidRef = useRef<string | undefined>(uid);
  const inGameRef = useRef(isInGame);
  const lastSyncedRef = useRef<ActivityStatus | 'offline'>('offline');
  uidRef.current = uid;
  inGameRef.current = isInGame;

  const computeStatus = (): ActivityStatus => {
    if (inGameRef.current) return 'em jogo';
    return Date.now() - lastActivityRef.current > IDLE_MS ? 'inativo' : 'online';
  };

  /** Envia o status atual ao banco (presença) apenas se mudou, sem bloquear o app em falha. */
  const syncPresence = (next: ActivityStatus | 'offline', targetUid?: string) => {
    const u = targetUid ?? uidRef.current;
    if (!u) return;
    if (lastSyncedRef.current === next) return; // evita escrita redundante
    lastSyncedRef.current = next;
    updateProfileStatus(u, next).catch(() => {
      /* presença offline não bloqueia o app */
    });
  };

  // Qualquer interação do usuário zera o contador de inatividade
  useEffect(() => {
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('mousemove', markActive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('click', markActive);
    window.addEventListener('touchstart', markActive);
    return () => {
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('click', markActive);
      window.removeEventListener('touchstart', markActive);
    };
  }, []);

  // Heartbeat: recalcula o status local e sincroniza a presença no perfil.
  // Depende de [uid, isInGame]: entrar/sair do multiplayer reflete na hora
  // (o isInGame é lido via ref, mas o effect re-dispara para sincronizar já).
  // O cleanup marca 'offline' quando o uid muda (logout) ou o componente desmonta.
  useEffect(() => {
    if (!uid) {
      setStatus(isInGame ? 'em jogo' : 'online');
      return;
    }

    lastSyncedRef.current = 'offline'; // uid novo → força a 1ª sincronização
    const initial = computeStatus();
    setStatus(initial);
    syncPresence(initial, uid);

    const interval = setInterval(() => {
      const next = computeStatus();
      setStatus((prev) => {
        if (prev !== next) {
          syncPresence(next, uid);
        }
        return next;
      });
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
      // Presença limpa: deslogou ou desmontou → offline no banco
      syncPresence('offline', uid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isInGame]);

  // Presença ao fechar a aba / alternar para outra aba
  useEffect(() => {
    const onPageHide = () => {
      syncPresence('offline');
    };
    const onVisibility = () => {
      if (document.hidden) {
        syncPresence('inativo');
      } else {
        syncPresence(computeStatus());
      }
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
