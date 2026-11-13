/**
 * L.3d — o cartão do usuário logado, um só para as duas cópias.
 *
 * A G.1f mapeou o mesmo cartão duas vezes (`:282` no celular, `:528` no
 * computador). As duas versões continuam com as classes de antes; o que saiu
 * foi a duplicação do avatar, do nome, do `#NC-####` e do LED de status — e o
 * `renderAvatar` que vivia no menu.
 */
import React from 'react';
import { ChevronRight, LogOut, Wifi } from 'lucide-react';
import type { User } from '../../lib/supabase';
import { AVATAR_CONFIG, type StatusLedInfo } from './menuConfig';

export interface ProfileCardProps {
  user: User;
  cyberpunkId: string;
  avatarUrl: string;
  avatarIconKey: string;
  statusInfo: StatusLedInfo;
  /** `mobile` é o do drawer (com a seta); `desktop` é o do rodapé da sidebar (com o "Sair"). */
  variant: 'mobile' | 'desktop';
  isMinimized?: boolean;
  /** No computador, o cartão ganha o anel quando a aba do perfil está aberta. */
  isProfileActive?: boolean;
  onOpenProfile: () => void;
  onLogout?: () => void;
  /** A imagem do bucket não carregou: volta para o ícone. */
  onAvatarError: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  user,
  cyberpunkId,
  avatarUrl,
  avatarIconKey,
  statusInfo,
  variant,
  isMinimized = false,
  isProfileActive = false,
  onOpenProfile,
  onLogout,
  onAvatarError
}) => {
  const avatarInfo = AVATAR_CONFIG[avatarIconKey] || AVATAR_CONFIG['cpu'];
  const UserAvatarComp = avatarInfo.icon;

  // Avatar: a imagem do bucket quando existe, o ícone do perfil quando não.
  const renderAvatar = (sizeCls: string) => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt="Avatar"
          className={`${sizeCls} object-cover rounded-lg shrink-0`}
          onError={onAvatarError}
        />
      );
    }
    return (
      <div className={`${sizeCls} rounded-lg border ${avatarInfo.border} ${avatarInfo.bg} flex items-center justify-center shrink-0`}>
        <UserAvatarComp className={`w-5 h-5 ${avatarInfo.color}`} />
      </div>
    );
  };

  // Nome, `#NC-####` e LED — o bloco que estava duplicado nos dois cartões.
  const renderIdentity = (nameClass: string) => (
    <div>
      <div className="flex items-center space-x-1.5 leading-tight">
        <span className={nameClass}>
          {user.displayName || user.email?.split('@')[0]}
        </span>
        <span className="text-micro font-mono text-accent-300 bg-accent-950/90 px-1.5 py-0.2 rounded border border-accent-500/60 shrink-0">
          {cyberpunkId}
        </span>
      </div>
      <div className="flex items-center space-x-1 text-micro mt-0.5">
        <Wifi className={`w-2.5 h-2.5 ${statusInfo.textColor}`} />
        <span className={`font-mono uppercase ${statusInfo.textColor}`}>
          {statusInfo.label}
        </span>
      </div>
    </div>
  );

  const nameClass = `text-xs ${avatarInfo.color} font-black uppercase tracking-caps block`;

  if (variant === 'mobile') {
    return (
      <div
        onClick={onOpenProfile}
        className={`p-3 rounded-xl border-2 cursor-pointer bg-raised/90 flex items-center justify-between ${statusInfo.borderActive} ${statusInfo.shadow}`}
      >
        <div className="flex items-center space-x-3">
          {renderAvatar('w-9 h-9')}
          {renderIdentity(nameClass)}
        </div>
        <ChevronRight className="w-5 h-5 text-signal-400" />
      </div>
    );
  }

  return (
    <div
      onClick={onOpenProfile}
      title={user.displayName || user.email?.split('@')[0]}
      className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all bg-surface/90 ${
        isProfileActive
          ? `${statusInfo.borderActive} ${statusInfo.shadowActive}`
          : `${statusInfo.border} ${statusInfo.shadow}`
      }`}
    >
      <div
        className={`flex items-center ${
          isMinimized ? 'justify-center' : 'justify-between'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* User Avatar (imagem do bucket ou ícone) */}
          {renderAvatar('w-9 h-9 shadow-sm')}

          {/* Name and LED status */}
          {!isMinimized && renderIdentity(`${nameClass} truncate max-w-[100px]`)}
        </div>

        {/* Logout Button */}
        {!isMinimized && onLogout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogout();
            }}
            title="Sair da Conta"
            className="p-1.5 text-muted hover:text-accent-400 hover:bg-raised rounded transition-all border border-transparent hover:border-line cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
