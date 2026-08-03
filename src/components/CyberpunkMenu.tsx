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
import { User, generateCyberpunkId, fetchUserProfile } from '../lib/firebase';
import { ActivityStatus } from '../hooks/useUserActivity';
import { PatchNotesFeed } from './PatchNotesFeed';
import { FriendsList } from './FriendsList';

export type TabType = 'home' | 'multiplayer' | 'sheet' | 'presets' | 'ai' | 'dice' | 'prd' | 'profile';

interface CyberpunkMenuProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  characterName: string;
  characterRole: string;
  user?: User | null;
  activityStatus?: ActivityStatus;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

const AVATAR_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; border: string; bg: string }
> = {
  cpu: { icon: Cpu, color: 'text-cyan-400', border: 'border-cyan-400', bg: 'bg-cyan-950/80' },
  shield: { icon: Shield, color: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-950/80' },
  skull: { icon: Skull, color: 'text-red-400', border: 'border-red-400', bg: 'bg-red-950/80' },
  radio: { icon: Radio, color: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-950/80' },
  zap: { icon: Zap, color: 'text-emerald-400', border: 'border-emerald-400', bg: 'bg-emerald-950/80' }
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
    border: 'border-emerald-500/80 hover:border-emerald-400',
    borderActive: 'border-emerald-400 ring-2 ring-emerald-400/60',
    shadow: 'shadow-[0_0_18px_rgba(16,185,129,0.35)]',
    shadowActive: 'shadow-[0_0_28px_rgba(16,185,129,0.65)]',
    dotBg: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/60',
    badgeBg: 'bg-emerald-950/50',
    label: 'ONLINE'
  },
  'inativo': {
    border: 'border-amber-400/80 hover:border-amber-300',
    borderActive: 'border-amber-400 ring-2 ring-amber-400/60',
    shadow: 'shadow-[0_0_18px_rgba(251,191,36,0.35)]',
    shadowActive: 'shadow-[0_0_28px_rgba(251,191,36,0.65)]',
    dotBg: 'bg-amber-500',
    textColor: 'text-amber-400',
    badgeBorder: 'border-amber-500/60',
    badgeBg: 'bg-amber-950/50',
    label: 'INATIVO'
  },
  'em jogo': {
    border: 'border-purple-500/80 hover:border-purple-400',
    borderActive: 'border-purple-400 ring-2 ring-purple-400/60',
    shadow: 'shadow-[0_0_18px_rgba(168,85,247,0.35)]',
    shadowActive: 'shadow-[0_0_28px_rgba(168,85,247,0.65)]',
    dotBg: 'bg-purple-500',
    textColor: 'text-purple-400',
    badgeBorder: 'border-purple-500/60',
    badgeBg: 'bg-purple-950/50',
    label: 'EM JOGO'
  }
};

const MENU_ITEMS = [
  { id: 'home' as TabType, label: 'INÍCIO', icon: Home, accent: 'text-yellow-400' },
  { id: 'multiplayer' as TabType, label: 'JOGAR', icon: Radio, accent: 'text-emerald-400' },
  { id: 'sheet' as TabType, label: 'FICHA', icon: Cpu, accent: 'text-cyan-400' },
  { id: 'presets' as TabType, label: 'LENDAS', icon: Swords, accent: 'text-yellow-400' },
  { id: 'ai' as TabType, label: 'NETRUNNER IA', icon: Bot, accent: 'text-purple-400' },
  { id: 'dice' as TabType, label: 'DADOS', icon: Dice5, accent: 'text-pink-400' },
  { id: 'prd' as TabType, label: 'PRD', icon: FileText, accent: 'text-red-400' }
];

export const CyberpunkMenu: React.FC<CyberpunkMenuProps> = ({
  activeTab,
  setActiveTab,
  characterName,
  user,
  activityStatus = 'online',
  onOpenAuth,
  onLogout
}) => {
  const [avatarIconKey, setAvatarIconKey] = useState<string>('cpu');
  const [showPatchNotes, setShowPatchNotes] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [userCyberpunkId, setUserCyberpunkId] = useState<string>('');

  // Sync avatar icon and Cyberpunk ID from local profile cache & cloud
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
      });
    } else {
      setUserCyberpunkId('');
    }
  }, [user, activeTab]);

  const avatarInfo = AVATAR_CONFIG[avatarIconKey] || AVATAR_CONFIG['cpu'];
  const UserAvatarComp = avatarInfo.icon;
  const statusInfo = STATUS_LED_CONFIG[activityStatus] || STATUS_LED_CONFIG['online'];

  return (
    <aside
      className={`shrink-0 font-mono relative z-40 transition-all duration-300 lg:my-4 lg:ml-4 lg:sticky lg:top-4 lg:self-start ${
        isMinimized ? 'w-full lg:w-20' : 'w-full lg:w-80'
      }`}
    >
      {/* Desktop Minimization Toggle Button on Border */}
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="hidden lg:flex absolute -right-3.5 top-8 z-50 w-7 h-7 bg-red-600 hover:bg-yellow-400 text-black rounded-full border-2 border-yellow-400 items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all cursor-pointer"
        title={isMinimized ? 'Expandir Menu' : 'Minimizar Menu'}
      >
        {isMinimized ? (
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        ) : (
          <ChevronLeft className="w-4 h-4 stroke-[3]" />
        )}
      </button>

      {/* Mobile Top Header Bar */}
      <div className="lg:hidden bg-slate-950/95 border-b-2 border-red-500/80 px-3 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-[0_4px_20px_rgba(239,68,68,0.3)] backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-950 border border-yellow-400 rounded flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.4)]">
            <span className="text-yellow-400 font-black text-xs">NE</span>
          </div>
          <div>
            <span className="text-xs font-black text-yellow-400 uppercase tracking-widest block leading-none">
              NETSHEET
            </span>
            <span className="text-[9px] text-red-500 font-bold uppercase tracking-tight block pt-0.5">
              v0.4.0
            </span>
          </div>
        </div>

        {/* Active Tab Badge Pill on Mobile Header */}
        {(() => {
          const currentItem = MENU_ITEMS.find((m) => m.id === activeTab) || MENU_ITEMS[0];
          const CurrentIcon = currentItem.icon;
          return (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500/60 rounded text-[11px] font-bold uppercase text-yellow-300">
              <CurrentIcon className={`w-3.5 h-3.5 ${currentItem.accent}`} />
              <span>{currentItem.label}</span>
            </div>
          );
        })()}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPatchNotes(!showPatchNotes)}
            className={`p-2 bg-slate-900 border rounded transition-all ${
              showPatchNotes ? 'border-yellow-400 text-yellow-400' : 'border-slate-700 text-slate-300 hover:text-red-400'
            }`}
            title="Notas de Atualização"
          >
            <Newspaper className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`px-3 py-1.5 font-black text-xs uppercase tracking-wider rounded border-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              isMobileMenuOpen
                ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.6)]'
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
        <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 bg-slate-950/98 backdrop-blur-2xl border-b-2 border-red-500 shadow-[0_10px_35px_rgba(239,68,68,0.5)] z-50 p-4 space-y-4 overflow-y-auto animate-fadeIn">
          {/* Mobile User Profile Header Banner */}
          {user ? (
            <div>
              <div
                onClick={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border-2 cursor-pointer bg-slate-900/90 flex items-center justify-between ${statusInfo.borderActive} ${statusInfo.shadow}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-lg border ${avatarInfo.border} ${avatarInfo.bg} flex items-center justify-center shrink-0`}>
                    <UserAvatarComp className={`w-5 h-5 ${avatarInfo.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5 leading-tight">
                      <span className={`text-xs ${avatarInfo.color} font-black uppercase tracking-wider block`}>
                        {user.displayName || user.email?.split('@')[0]}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/90 px-1.5 py-0.2 rounded border border-cyan-500/60 shrink-0">
                        {userCyberpunkId}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] mt-0.5">
                      <Wifi className={`w-2.5 h-2.5 ${statusInfo.textColor}`} />
                      <span className={`font-bold uppercase ${statusInfo.textColor}`}>{statusInfo.label}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-yellow-400" />
              </div>
              <FriendsList user={user} isMinimized={false} />
            </div>
          ) : (
            <button
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-3 px-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded border-2 border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.5)] flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4 text-black shrink-0" />
              <span>ACESSAR CONTA // EDGERUNNER</span>
            </button>
          )}

          {/* Compact Cyberpunk Grid of Modules */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-red-500 font-black uppercase tracking-widest block">
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
                    className={`p-3 rounded-lg border-2 uppercase font-mono transition-all flex items-center space-x-2.5 ${
                      isActive
                        ? 'bg-red-950/90 border-red-500 text-yellow-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-red-500/50'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-yellow-400 animate-pulse' : item.accent} shrink-0`} />
                    <span className="text-xs font-black tracking-wider truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patch Notes Accordion in Mobile Drawer */}
          {showPatchNotes && (
            <div className="pt-2 border-t border-red-500/30">
              <div className="bg-slate-900/90 border border-red-500/40 rounded-xl p-3">
                <PatchNotesFeed compact embedded />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Desktop Sidebar Container */}
      <div
        className={`hidden lg:flex bg-slate-950/95 border-2 border-red-600/70 rounded-2xl ${
          isMinimized ? 'p-3' : 'p-4'
        } h-auto flex-col justify-between relative overflow-hidden backdrop-blur-md shadow-[0_0_25px_rgba(239,68,68,0.2)] transition-all`}
      >
        {/* Red Glitch Background Overlay & CRT Scanlines */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-slate-950/90 to-black pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%),linear-gradient(90deg,rgba(255,0,0,0.08),rgba(0,0,0,0),rgba(0,0,255,0.04))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40 z-0"></div>

        {/* Content Layer */}
        <div className="relative z-10 space-y-4">
          {/* Top Title Section */}
          {!isMinimized ? (
            <div className="border-b-2 border-red-500/60 pb-3 space-y-1">
              <h1 className="text-2xl lg:text-3xl font-black italic tracking-tighter text-yellow-400 drop-shadow-[0_0_18px_rgba(250,204,21,0.9)] uppercase leading-none">
                NETSHEET ENGINE
              </h1>
              <div className="flex items-center space-x-2 pt-1">
                <h2 className="text-xs lg:text-sm font-black tracking-widest text-red-500 uppercase leading-none drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]">
                  CYBERPUNK 2020
                </h2>
                <span className="text-[9px] text-slate-400 font-bold tracking-tight bg-red-950/80 px-1.5 py-0.5 border border-red-800/80 rounded leading-none">
                  v0.4.0
                </span>
              </div>
            </div>
          ) : (
            <div className="border-b-2 border-red-500/60 pb-3 text-center">
              <div className="w-10 h-10 mx-auto bg-red-950 border-2 border-yellow-400 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(250,204,21,0.6)]">
                <span className="text-yellow-400 font-black text-xs tracking-tighter">NE</span>
              </div>
              <span className="text-[8px] text-red-400 font-black uppercase block mt-1 tracking-widest">
                v0.4.0
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
                  } rounded-lg border-2 uppercase font-mono cursor-pointer ${
                    isActive
                      ? 'bg-red-950/80 border-red-500 text-yellow-300 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-red-500/60 hover:text-red-400 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Left Active Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,1)] rounded-l"></div>
                  )}

                  {isMinimized ? (
                    <IconComp
                      className={`w-5 h-5 ${
                        isActive ? 'text-yellow-400 animate-pulse' : item.accent
                      }`}
                    />
                  ) : (
                    <>
                      <div className="flex items-center space-x-3 pl-1">
                        <IconComp
                          className={`w-4 h-4 ${
                            isActive ? 'text-yellow-400 animate-pulse' : item.accent
                          } shrink-0`}
                        />
                        <span className="text-xs font-black tracking-widest leading-none">
                          {item.label}
                        </span>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 transition-transform shrink-0 ${
                          isActive
                            ? 'text-yellow-400 translate-x-1'
                            : 'text-slate-600 group-hover:text-red-400'
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
              className={`w-full bg-slate-900/80 border transition-all duration-300 rounded-xl overflow-hidden ${
                showPatchNotes
                  ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-slate-950/95'
                  : 'border-slate-800 hover:border-red-500/60'
              }`}
            >
              {/* Accordion Header / Button */}
              <button
                onClick={() => setShowPatchNotes(!showPatchNotes)}
                className={`w-full py-2 ${
                  isMinimized ? 'px-2 justify-center' : 'px-3 justify-between'
                } text-slate-300 hover:text-red-400 text-xs font-bold uppercase flex items-center transition-all cursor-pointer group`}
                title="Notas de Atualização"
              >
                <div className="flex items-center space-x-2">
                  <Terminal
                    className={`w-4 h-4 ${
                      showPatchNotes
                        ? 'text-yellow-400 animate-pulse'
                        : 'text-red-400 group-hover:text-yellow-400'
                    } shrink-0`}
                  />
                  {!isMinimized && (
                    <span
                      className={`${
                        showPatchNotes
                          ? 'text-yellow-400 font-extrabold'
                          : 'text-slate-200 group-hover:text-red-400'
                      }`}
                    >
                      NOTAS DE ATUALIZAÇÃO
                    </span>
                  )}
                </div>

                {!isMinimized && (
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-red-400 bg-red-950 px-2 py-0.5 border border-red-800/80 rounded font-bold">
                      v0.4.0
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                        showPatchNotes ? 'rotate-180 text-yellow-400' : 'group-hover:text-yellow-400'
                      }`}
                    />
                  </div>
                )}
              </button>

              {/* Expanded Patch Notes Content Area */}
              {showPatchNotes && !isMinimized && (
                <div className="p-2 border-t border-red-500/30 bg-slate-950/90 animate-fadeIn">
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
                className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all bg-slate-950/90 ${
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
                  {/* User Avatar */}
                  <div
                    className={`w-9 h-9 rounded-lg border ${avatarInfo.border} ${avatarInfo.bg} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <UserAvatarComp className={`w-5 h-5 ${avatarInfo.color}`} />
                  </div>

                  {/* Name and LED status */}
                  {!isMinimized && (
                    <div>
                      <div className="flex items-center space-x-1.5 leading-tight">
                        <span
                          className={`text-xs ${avatarInfo.color} font-black uppercase tracking-wider block truncate max-w-[100px]`}
                        >
                          {user.displayName || user.email?.split('@')[0]}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/90 px-1.5 py-0.2 rounded border border-cyan-500/60 shrink-0">
                          {userCyberpunkId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-[9px] mt-0.5">
                        <Wifi className={`w-2.5 h-2.5 ${statusInfo.textColor}`} />
                        <span className={`font-bold uppercase ${statusInfo.textColor}`}>
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
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded transition-all border border-transparent hover:border-slate-800 cursor-pointer"
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
              } bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded border-2 border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all flex items-center justify-center space-x-2 cursor-pointer`}
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

