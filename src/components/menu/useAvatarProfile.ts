/**
 * L.3d — o avatar e o ID de Night City do usuário logado.
 *
 * O efeito saiu do `CyberpunkMenu` inteiro (mapa da G.1f), com a mesma
 * dependência `[user, activeTab]` — é ela que faz o perfil ser consultado a
 * cada troca de aba (G.11, ADIAR: o `.then` continua sem `catch`).
 */
import { useEffect, useState } from 'react';
import { fetchUserProfile, generateCyberpunkId, type User } from '../../lib/supabase';
import type { TabType } from '../CyberpunkMenu';

export interface AvatarProfile {
  /** Chave do ícone gravado no perfil (`cpu` até o cache ou a nuvem dizerem outra coisa). */
  avatarIconKey: string;
  /** URL do bucket `avatars`, quando existe; vazio desenha o ícone. */
  avatarUrl: string;
  /** O `#NC-####` público do Edgerunner. */
  cyberpunkId: string;
  /** Limpa a URL quando a imagem do bucket não carrega. */
  clearAvatarUrl: () => void;
}

export function useAvatarProfile(user: User | null, activeTab: TabType): AvatarProfile {
  const [avatarIconKey, setAvatarIconKey] = useState<string>('cpu');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [userCyberpunkId, setUserCyberpunkId] = useState<string>('');

  // Sync avatar icon/url and Cyberpunk ID from local profile cache & cloud
  useEffect(() => {
    if (user) {
      const defaultId = generateCyberpunkId(user.uid);
      try {
        const cached = localStorage.getItem(`cyberpunk_profile_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setUserCyberpunkId(parsed.cyberpunkId || defaultId);
          if (parsed.avatarIcon) {
            setAvatarIconKey(parsed.avatarIcon);
          }
        } else {
          setUserCyberpunkId(defaultId);
        }
      } catch {
        setUserCyberpunkId(defaultId);
      }

      fetchUserProfile(user.uid).then(p => {
        if (p?.cyberpunkId) {
          setUserCyberpunkId(p.cyberpunkId);
        }
        if (p?.avatarUrl) {
          setAvatarUrl(p.avatarUrl);
        }
      });
    } else {
      setUserCyberpunkId('');
      setAvatarUrl('');
    }
  }, [user, activeTab]);

  // Avatar atualiza imediatamente após upload/remoção feitos no UserProfile
  // (evento customizado — evita depender de troca de aba para re-sync).
  useEffect(() => {
    const handler = (e: Event) => {
      setAvatarUrl((e as CustomEvent<string>).detail || '');
    };
    window.addEventListener('cyberpunk:avatar-updated', handler);
    return () => window.removeEventListener('cyberpunk:avatar-updated', handler);
  }, []);

  return {
    avatarIconKey,
    avatarUrl,
    cyberpunkId: userCyberpunkId,
    clearAvatarUrl: () => setAvatarUrl('')
  };
}
