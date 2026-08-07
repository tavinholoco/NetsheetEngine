/**
 * ============================================================
 * NETSHEET ENGINE — HOOK DE ATIVIDADE DO USUÁRIO (T0.12)
 * Status online / inativo (após 60s sem interação) / em jogo
 * (quando na aba multiplayer), com heartbeat no perfil (presença).
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
  uidRef.current = uid;
  inGameRef.current = isInGame;

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

  // Heartbeat: recalcula o status e sincroniza a presença no perfil
  useEffect(() => {
    const compute = (): ActivityStatus => {
      if (inGameRef.current) return 'em jogo';
      return Date.now() - lastActivityRef.current > IDLE_MS ? 'inativo' : 'online';
    };

    setStatus(compute());

    const interval = setInterval(() => {
      const next = compute();
      setStatus((prev) => {
        if (prev !== next && uidRef.current) {
          updateProfileStatus(uidRef.current, next).catch(() => {
            /* presença offline não bloqueia o app */
          });
        }
        return next;
      });
    }, HEARTBEAT_MS);

    // Sincronização inicial
    if (uidRef.current) {
      updateProfileStatus(uidRef.current, compute()).catch(() => {
        /* ignore */
      });
    }

    return () => clearInterval(interval);
  }, []);

  return status;
}
