import React, { useState, useEffect } from 'react';
import {
  Home,
  Radio,
  Cpu,
  UserCheck,
  Bot,
  Dice5,
  FileText,
  User as UserIcon,
  Shield,
  Skull,
  Swords,
  Zap,
  Wifi,
  LogOut,
  LogIn,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Terminal,
  Newspaper,
  X
} from 'lucide-react';
import { User, generateCyberpunkId, fetchUserProfile } from '../lib/supabase';
import { ActivityStatus } from '../hooks/useUserActivity';
import { PatchNotesFeed } from './PatchNotesFeed';
import { APP_VERSION } from '../version';
import { FriendsList } from '../features/social/FriendsList';
import { useUiStore } from '../stores/useUiStore';
import { useSheetStore } from '../stores/useSheetStore';

export type TabType = 'home' | 'multiplayer' | 'sheet' | 'presets' | 'ai' | 'dice' | 'prd' | 'profile';

interface CyberpunkMenuProps {
  /** Fase 4 (T4.2) — aba e usuário vêm das stores; props mínimas para callbacks. */
  activityStatus?: ActivityStatus;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

const AVATAR_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; border: string; bg: string }
> = {
  cpu: { icon: Cpu, color: 'text-accent-400', border: 'border-accent-400', bg: 'bg-accent-950/80' },
  shield: { icon: Shield, color: 'text-signal-400', border: 'border-signal-400', bg: 'bg-signal-950/80' },
  skull: { icon: Skull, color: 'text-red-400', border: 'border-red-400', bg: 'bg-red-950/80' },
  radio: { icon: Radio, color: 'text-cyber-400', border: 'border-cyber-400', bg: 'bg-cyber-950/80' },
  zap: { icon: Zap, color: 'text-ok-400', border: 'border-ok-400', bg: 'bg-ok-950/80' }
};

const STATUS_LED_CONFIG: Record<
  ActivityStatus,
  {
    border: string;
    borderActive: string;
    shadow: string;
    shadowActive: string;
    dotBg: string;
    textColor: string;
    badgeBorder: string;
    badgeBg: string;
    label: string;
  }
> = {
  'online': {
    border: 'border-ok-500/80 hover:border-ok-400',
    borderActive: 'border-ok-400 ring-2 ring-ok-400/60',
    shadow: 'shadow-glow-18 shadow-ok-500/35',
    shadowActive: 'shadow-glow-28 shadow-ok-500/65',
    dotBg: 'bg-ok-500',
    textColor: 'text-ok-400',
    badgeBorder: 'border-ok-500/60',
    badgeBg: 'bg-ok-950/50',
    label: 'ONLINE'
  },
  'inativo': {
    border: 'border-caution-400/80 hover:border-caution-300',
    borderActive: 'border-caution-400 ring-2 ring-caution-400/60',
    shadow: 'shadow-glow-18 shadow-caution-400/35',
    shadowActive: 'shadow-glow-28 shadow-caution-400/65',
    dotBg: 'bg-caution-500',
    textColor: 'text-caution-400',
    badgeBorder: 'border-caution-500/60',
    badgeBg: 'bg-caution-950/50',
    label: 'INATIVO'
  },
  'em jogo': {
    border: 'border-cyber-500/80 hover:border-cyber-400',
    borderActive: 'border-cyber-400 ring-2 ring-cyber-400/60',
    shadow: 'shadow-glow-18 shadow-cyber-500/35',
    shadowActive: 'shadow-glow-28 shadow-cyber-500/65',
    dotBg: 'bg-cyber-500',
    textColor: 'text-cyber-400',
    badgeBorder: 'border-cyber-500/60',
    badgeBg: 'bg-cyber-950/50',
    label: 'EM JOGO'
  }
};

const MENU_ITEMS = [
  { id: 'home' as TabType, label: 'INÍCIO', icon: Home, accent: 'text-signal-400' },
  { id: 'multiplayer' as TabType, label: 'JOGAR', icon: Radio, accent: 'text-ok-400' },
  { id: 'sheet' as TabType, label: 'FICHA', icon: Cpu, accent: 'text-accent-400' },
  { id: 'presets' as TabType, label: 'LENDAS', icon: Swords, accent: 'text-signal-400' },
  { id: 'ai' as TabType, label: 'NETRUNNER IA', icon: Bot, accent: 'text-cyber-400' },
  { id: 'dice' as TabType, label: 'DADOS', icon: Dice5, accent: 'text-pink-400' },
  { id: 'prd' as TabType, label: 'PRD', icon: FileText, accent: 'text-red-400' }
];

export const CyberpunkMenu: React.FC<CyberpunkMenuProps> = ({
  activityStatus = 'online',
  onOpenAuth,
  onLogout
}) => {
  // Fase 4 (T4.2) — estado global via Zustand (sem prop drilling)
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const user = useSheetStore((s) => s.user);

  const [avatarIconKey, setAvatarIconKey] = useState<string>('cpu');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [showPatchNotes, setShowPatchNotes] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
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
      } catch (e) {
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

  const avatarInfo = AVATAR_CONFIG[avatarIconKey] || AVATAR_CONFIG['cpu'];
  const UserAvatarComp = avatarInfo.icon;
  const statusInfo = STATUS_LED_CONFIG[activityStatus] || STATUS_LED_CONFIG['online'];

  // Renderiza a imagem do avatar (bucket avatars) quando disponível; senão o ícone.
  const renderAvatar = (sizeCls: string) => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt="Avatar"
          className={`${sizeCls} object-cover rounded-lg shrink-0`}
          onError={() => setAvatarUrl('')}
        />
      );
    }
    return (
      <div className={`${sizeCls} rounded-lg border ${avatarInfo.border} ${avatarInfo.bg} flex items-center justify-center shrink-0`}>
        <UserAvatarComp className={`w-5 h-5 ${avatarInfo.color}`} />
      </div>
    );
  };

  return (
    <aside
      className={`shrink-0 relative z-40 transition-all duration-300 lg:my-4 lg:ml-4 lg:sticky lg:top-4 lg:self-start ${
        isMinimized ? 'w-full lg:w-20' : 'w-full lg:w-80'
      }`}
    >
      {/* Desktop Minimization Toggle Button on Border */}
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="hidden lg:flex absolute -right-3.5 top-8 z-50 w-7 h-7 bg-red-600 hover:bg-signal-400 text-black rounded-full border-2 border-signal-400 items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all cursor-pointer"
        title={isMinimized ? 'Expandir Menu' : 'Minimizar Menu'}
      >
        {isMinimized ? (
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        ) : (
          <ChevronLeft className="w-4 h-4 stroke-[3]" />
        )}
      </button>

      {/* Mobile Top Header Bar */}
      <div className="lg:hidden bg-surface/95 border-b-2 border-red-500/80 px-3 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-[0_4px_20px_rgba(239,68,68,0.3)] backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-950 border border-signal-400 rounded flex items-center justify-center shadow-glow-10 shadow-signal-400/40">
            <span className="font-display text-signal-400 font-black text-xs">NE</span>
          </div>
          <div>
            <span className="font-display text-xs font-black text-signal-400 uppercase tracking-display block leading-none">
              NETSHEET
            </span>
            <span className="font-mono text-micro text-red-500 uppercase tracking-tight block pt-0.5">
              {APP_VERSION}
            </span>
          </div>
        </div>

        {/* Active Tab Badge Pill on Mobile Header */}
        {(() => {
          const currentItem = MENU_ITEMS.find((m) => m.id === activeTab) || MENU_ITEMS[0];
          const CurrentIcon = currentItem.icon;
          return (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500/60 rounded text-mini font-bold uppercase text-signal-300">
              <CurrentIcon className={`w-3.5 h-3.5 ${currentItem.accent}`} />
              <span>{currentItem.label}</span>
            </div>
          );
        })()}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPatchNotes(!showPatchNotes)}
            className={`p-2 bg-raised border rounded transition-all ${
              showPatchNotes ? 'border-signal-400 text-signal-400' : 'border-line-strong text-fg-soft hover:text-red-400'
            }`}
            title="Notas de Atualização"
          >
            <Newspaper className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`px-3 py-1.5 font-black text-xs uppercase tracking-caps rounded border-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              isMobileMenuOpen
                ? 'bg-signal-400 text-black border-signal-300 shadow-glow-15 shadow-signal-400/60'
                : 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
            }`}
          >
            {isMobileMenuOpen ? (
              <>
                <X className="w-4 h-4 stroke-[3]" />
                <span>FECHAR</span>
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4" />
                <span>MENU</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Cyberpunk HUD Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 bg-surface/98 backdrop-blur-2xl border-b-2 border-red-500 shadow-[0_10px_35px_rgba(239,68,68,0.5)] z-50 p-4 space-y-4 overflow-y-auto animate-fadeIn">
          {/* Mobile User Profile Header Banner */}
          {user ? (
            <div>
              <div
                onClick={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border-2 cursor-pointer bg-raised/90 flex items-center justify-between ${statusInfo.borderActive} ${statusInfo.shadow}`}
              >
                <div className="flex items-center space-x-3">
                  {renderAvatar('w-9 h-9')}
                  <div>
                    <div className="flex items-center space-x-1.5 leading-tight">
                      <span className={`text-xs ${avatarInfo.color} font-black uppercase tracking-caps block`}>
                        {user.displayName || user.email?.split('@')[0]}
                      </span>
                      <span className="text-micro font-mono text-accent-300 bg-accent-950/90 px-1.5 py-0.2 rounded border border-accent-500/60 shrink-0">
                        {userCyberpunkId}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-micro mt-0.5">
                      <Wifi className={`w-2.5 h-2.5 ${statusInfo.textColor}`} />
                      <span className={`font-mono uppercase ${statusInfo.textColor}`}>{statusInfo.label}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-signal-400" />
              </div>
              <FriendsList user={user} isMinimized={false} />
            </div>
          ) : (
            <button
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-3 px-4 bg-signal-400 hover:bg-signal-300 text-black font-black text-xs uppercase tracking-caps rounded border-2 border-signal-300 shadow-glow-15 shadow-signal-400/50 flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4 text-black shrink-0" />
              <span>ACESSAR CONTA // EDGERUNNER</span>
            </button>
          )}

          {/* Compact Cyberpunk Grid of Modules */}
          <div className="space-y-1.5">
            <span className="font-mono text-micro text-red-500 uppercase tracking-caps block">
              MÓDULOS DE NAVEGAÇÃO // SELECT
            </span>
            <div className="grid grid-cols-2 gap-2">
              {MENU_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-3 rounded-lg border-2 uppercase transition-all flex items-center space-x-2.5 ${
                      isActive
                        ? 'bg-red-950/90 border-red-500 text-signal-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        : 'bg-raised/80 border-line text-fg-soft hover:border-red-500/50'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-signal-400 animate-pulse' : item.accent} shrink-0`} />
                    <span className="text-xs font-black tracking-caps truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patch Notes Accordion in Mobile Drawer */}
          {showPatchNotes && (
            <div className="pt-2 border-t border-red-500/30">
              <div className="bg-raised/90 border border-red-500/40 rounded-xl p-3">
                <PatchNotesFeed compact embedded />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Desktop Sidebar Container */}
      <div
        className={`hidden lg:flex bg-surface/95 border-2 border-red-600/70 rounded-2xl ${
          isMinimized ? 'p-3' : 'p-4'
        } h-auto flex-col justify-between relative overflow-hidden backdrop-blur-md shadow-[0_0_25px_rgba(239,68,68,0.2)] transition-all`}
      >
        {/* Red Glitch Background Overlay & CRT Scanlines */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-surface/90 to-black pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%),linear-gradient(90deg,rgba(255,0,0,0.08),rgba(0,0,0,0),rgba(0,0,255,0.04))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40 z-0"></div>

        {/* Content Layer */}
        <div className="relative z-10 space-y-4">
          {/* Top Title Section */}
          {!isMinimized ? (
            <div className="border-b-2 border-red-500/60 pb-3 space-y-1">
              <h1 className="font-display text-2xl lg:text-3xl font-black italic tracking-displayer text-signal-400 drop-shadow-glow-18 drop-shadow-signal-400/90 uppercase leading-none">
                NETSHEET ENGINE
              </h1>
              <div className="flex items-center space-x-2 pt-1">
                <h2 className="font-display text-xs lg:text-sm font-black tracking-display text-red-500 uppercase leading-none drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]">
                  CYBERPUNK 2020
                </h2>
                <span className="font-mono text-micro text-muted tracking-tight bg-red-950/80 px-1.5 py-0.5 border border-red-800/80 rounded leading-none">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-b-2 border-red-500/60 pb-3 text-center">
              <div className="w-10 h-10 mx-auto bg-red-950 border-2 border-signal-400 rounded-lg flex items-center justify-center shadow-glow-12 shadow-signal-400/60">
                <span className="font-display text-signal-400 font-black text-xs tracking-displayer">NE</span>
              </div>
              <span className="font-mono text-micro text-red-400 uppercase block mt-1 tracking-caps">
                {APP_VERSION}
              </span>
            </div>
          )}

          {/* Vertical Navigation Menu Buttons */}
          <nav className="space-y-1.5">
            {MENU_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const IconComp = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  title={item.label}
                  className={`w-full transition-all duration-200 group relative flex items-center ${
                    isMinimized ? 'justify-center p-2.5' : 'justify-between py-2.5 px-3'
                  } rounded-lg border-2 uppercase cursor-pointer ${
                    isActive
                      ? 'bg-red-950/80 border-red-500 text-signal-300 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                      : 'bg-raised/60 border-line/80 text-fg-soft hover:border-red-500/60 hover:text-red-400 hover:bg-raised/90'
                  }`}
                >
                  {/* Left Active Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-signal-400 shadow-glow-8 shadow-signal-400 rounded-l"></div>
                  )}

                  {isMinimized ? (
                    <IconComp
                      className={`w-5 h-5 ${
                        isActive ? 'text-signal-400 animate-pulse' : item.accent
                      }`}
                    />
                  ) : (
                    <>
                      <div className="flex items-center space-x-3 pl-1">
                        <IconComp
                          className={`w-4 h-4 ${
                            isActive ? 'text-signal-400 animate-pulse' : item.accent
                          } shrink-0`}
                        />
                        <span className="text-xs font-black tracking-caps leading-none">
                          {item.label}
                        </span>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 transition-transform shrink-0 ${
                          isActive
                            ? 'text-signal-400 translate-x-1'
                            : 'text-faint group-hover:text-red-400'
                        }`}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Integrated Expandable Patch Notes Accordion */}
          <div className="pt-1">
            <div
              className={`w-full border transition-all duration-300 rounded-xl overflow-hidden ${
                showPatchNotes
                  ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-surface/95'
                  : 'border-line hover:border-red-500/60'
              }`}
            >
              {/* Accordion Header / Button */}
              <button
                onClick={() => setShowPatchNotes(!showPatchNotes)}
                className={`w-full py-2 ${
                  isMinimized ? 'px-2 justify-center' : 'px-3 justify-between'
                } text-fg-soft hover:text-red-400 text-xs font-bold uppercase flex items-center transition-all cursor-pointer group`}
                title="Notas de Atualização"
              >
                <div className="flex items-center space-x-2">
                  <Terminal
                    className={`w-4 h-4 ${
                      showPatchNotes
                        ? 'text-signal-400 animate-pulse'
                        : 'text-red-400 group-hover:text-signal-400'
                    } shrink-0`}
                  />
                  {!isMinimized && (
                    <span
                      className={`${
                        showPatchNotes
                          ? 'text-signal-400 font-extrabold'
                          : 'text-fg group-hover:text-red-400'
                      }`}
                    >
                      NOTAS DE ATUALIZAÇÃO
                    </span>
                  )}
                </div>

                {!isMinimized && (
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-normal text-micro text-red-400 bg-red-950 px-2 py-0.5 border border-red-800/80 rounded">
                      {APP_VERSION}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${
                        showPatchNotes ? 'rotate-180 text-signal-400' : 'group-hover:text-signal-400'
                      }`}
                    />
                  </div>
                )}
              </button>

              {/* Expanded Patch Notes Content Area */}
              {showPatchNotes && !isMinimized && (
                <div className="p-2 border-t border-red-500/30 bg-surface/90 animate-fadeIn">
                  <PatchNotesFeed compact embedded />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ITEM: UNIFIED USER PROFILE BUTTON */}
        <div className="relative z-10 pt-3 mt-4 border-t-2 border-red-600/60 shrink-0">
          {user ? (
            <div>
              <div
                onClick={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
                title={user.displayName || user.email?.split('@')[0]}
                className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all bg-surface/90 ${
                  activeTab === 'profile'
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
                  {!isMinimized && (
                    <div>
                      <div className="flex items-center space-x-1.5 leading-tight">
                        <span
                          className={`text-xs ${avatarInfo.color} font-black uppercase tracking-caps block truncate max-w-[100px]`}
                        >
                          {user.displayName || user.email?.split('@')[0]}
                        </span>
                        <span className="text-micro font-mono text-accent-300 bg-accent-950/90 px-1.5 py-0.2 rounded border border-accent-500/60 shrink-0">
                          {userCyberpunkId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-micro mt-0.5">
                        <Wifi className={`w-2.5 h-2.5 ${statusInfo.textColor}`} />
                        <span className={`font-mono uppercase ${statusInfo.textColor}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                {!isMinimized && onLogout && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogout();
                    }}
                    title="Sair da Conta"
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-raised rounded transition-all border border-transparent hover:border-line cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Friends List Component */}
            <FriendsList user={user} isMinimized={isMinimized} />
          </div>
          ) : (
            <button
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                setIsMobileMenuOpen(false);
              }}
              title="Acessar Conta"
              className={`w-full py-3 ${
                isMinimized ? 'px-2' : 'px-4'
              } bg-signal-400 hover:bg-signal-300 text-black font-black text-xs uppercase tracking-caps rounded border-2 border-signal-300 shadow-glow-15 shadow-signal-400/50 transition-all flex items-center justify-center space-x-2 cursor-pointer`}
            >
              <LogIn className="w-4 h-4 text-black shrink-0" />
              {!isMinimized && <span>PERFIL // ACESSAR CONTA</span>}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

