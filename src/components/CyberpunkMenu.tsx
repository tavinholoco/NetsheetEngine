/**
 * ============================================================
 * NETSHEET ENGINE — MENU VERTICAL (HUD Cyberpunk 2020)
 *
 * L.3d — o arquivo passou de 607 linhas para a casca do menu. Saíram, pelo
 * mapa da G.1f: o dado (itens, avatares e o LED de status) para
 * `menu/menuConfig.ts`, o efeito do avatar para `menu/useAvatarProfile.ts`, e
 * o cartão do usuário — que existia em duas cópias, no celular e no
 * computador — para `menu/ProfileCard.tsx`. Nada mudou de comportamento.
 * ============================================================
 */
import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Terminal,
  Newspaper,
  X,
  LogIn
} from 'lucide-react';
import { ActivityStatus } from '../hooks/useUserActivity';
import { PatchNotesFeed } from './PatchNotesFeed';
import { APP_VERSION } from '../version';
import { FriendsList } from '../features/social/FriendsList';
import { useUiStore } from '../stores/useUiStore';
import { useSheetStore } from '../stores/useSheetStore';
// L.3d — o dado do menu, o avatar do usuário e o cartão do perfil
import { MENU_ITEMS, STATUS_LED_CONFIG } from './menu/menuConfig';
import { useAvatarProfile } from './menu/useAvatarProfile';
import { ProfileCard } from './menu/ProfileCard';

export type TabType = 'home' | 'multiplayer' | 'sheet' | 'presets' | 'ai' | 'dice' | 'prd' | 'profile';

interface CyberpunkMenuProps {
  /** Fase 4 (T4.2) — aba e usuário vêm das stores; props mínimas para callbacks. */
  activityStatus?: ActivityStatus;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const CyberpunkMenu: React.FC<CyberpunkMenuProps> = ({
  activityStatus = 'online',
  onOpenAuth,
  onLogout
}) => {
  // Fase 4 (T4.2) — estado global via Zustand (sem prop drilling)
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const user = useSheetStore((s) => s.user);

  const [showPatchNotes, setShowPatchNotes] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const { avatarIconKey, avatarUrl, cyberpunkId: userCyberpunkId, clearAvatarUrl } = useAvatarProfile(user, activeTab);
  const statusInfo = STATUS_LED_CONFIG[activityStatus];

  return (
    <aside
      className={`print:hidden shrink-0 relative z-40 transition-all duration-300 lg:my-4 lg:ml-4 lg:sticky lg:top-4 lg:self-start ${
        isMinimized ? 'w-full lg:w-20' : 'w-full lg:w-80'
      }`}
    >
      {/* Desktop Minimization Toggle Button on Border */}
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="hidden lg:flex absolute -right-3.5 top-8 z-50 w-7 h-7 bg-accent-500 hover:bg-signal-400 text-black rounded-full border-2 border-signal-400 items-center justify-center shadow-glow-12 shadow-accent-500/90 transition-all cursor-pointer"
        title={isMinimized ? 'Expandir Menu' : 'Minimizar Menu'}
      >
        {isMinimized ? (
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        ) : (
          <ChevronLeft className="w-4 h-4 stroke-[3]" />
        )}
      </button>

      {/* Mobile Top Header Bar */}
      <div className="lg:hidden bg-surface/95 border-b-2 border-accent-500/80 px-3 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-glow-20 shadow-accent-500/30 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-accent-950 border border-signal-400 rounded flex items-center justify-center shadow-glow-10 shadow-signal-400/40">
            <span className="font-display text-signal-400 font-black text-xs">NE</span>
          </div>
          <div>
            <span className="font-display text-xs font-black text-signal-400 uppercase tracking-display block leading-none">
              NETSHEET
            </span>
            <span className="font-mono text-micro text-accent-500 uppercase tracking-tight block pt-0.5">
              {APP_VERSION}
            </span>
          </div>
        </div>

        {/* Active Tab Badge Pill on Mobile Header */}
        {(() => {
          const currentItem = MENU_ITEMS.find((m) => m.id === activeTab) || MENU_ITEMS[0];
          const CurrentIcon = currentItem.icon;
          return (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-signal-950/80 border border-signal-500/60 rounded text-mini font-bold uppercase text-signal-300">
              <CurrentIcon className={`w-3.5 h-3.5 ${currentItem.accent}`} />
              <span>{currentItem.label}</span>
            </div>
          );
        })()}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPatchNotes(!showPatchNotes)}
            className={`p-2 bg-raised border rounded transition-all ${
              showPatchNotes ? 'border-signal-400 text-signal-400' : 'border-line-strong text-fg-soft hover:text-accent-400'
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
                : 'bg-accent-500 text-black border-accent-300 shadow-glow-12 shadow-accent-500/50'
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
        <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 bg-surface/98 backdrop-blur-2xl border-b-2 border-accent-500 shadow-glow-30 shadow-accent-500/50 z-50 p-4 space-y-4 overflow-y-auto animate-fadeIn">
          {/* Mobile User Profile Header Banner */}
          {user ? (
            <div>
              <ProfileCard
                variant="mobile"
                user={user}
                cyberpunkId={userCyberpunkId}
                avatarUrl={avatarUrl}
                avatarIconKey={avatarIconKey}
                statusInfo={statusInfo}
                onOpenProfile={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
                onAvatarError={clearAvatarUrl}
              />
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
            <span className="font-mono text-micro text-accent-500 uppercase tracking-caps block">
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
                        ? 'bg-signal-950/90 border-signal-400 text-signal-300 shadow-glow-15 shadow-signal-400/40'
                        : 'bg-raised/80 border-line text-fg-soft hover:border-accent-500/50'
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
            <div className="pt-2 border-t border-accent-500/30">
              <div className="bg-raised/90 border border-accent-500/40 rounded-xl p-3">
                <PatchNotesFeed compact embedded />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Desktop Sidebar Container */}
      <div
        className={`hidden lg:flex bg-surface/95 border-2 border-accent-600/70 rounded-2xl ${
          isMinimized ? 'p-3' : 'p-4'
        } h-auto flex-col justify-between relative overflow-hidden backdrop-blur-md shadow-glow-25 shadow-accent-500/20 transition-all`}
      >
        {/* Glitch Background Overlay & CRT Scanlines */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-950/40 via-surface/90 to-black pointer-events-none z-0"></div>
        <div className="absolute inset-0 crt-phosphor pointer-events-none opacity-40 z-0"></div>

        {/* Content Layer */}
        <div className="relative z-10 space-y-4">
          {/* Top Title Section */}
          {!isMinimized ? (
            <div className="border-b-2 border-accent-500/60 pb-3 space-y-1">
              <h1 className="font-display text-2xl lg:text-3xl font-black italic tracking-display text-signal-400 drop-shadow-glow-18 drop-shadow-signal-400/90 uppercase leading-none">
                NETSHEET ENGINE
              </h1>
              <div className="flex items-center space-x-2 pt-1">
                <h2 className="font-display text-xs lg:text-sm font-black tracking-display text-accent-400 uppercase leading-none drop-shadow-glow-10 drop-shadow-accent-500/70">
                  CYBERPUNK 2020
                </h2>
                <span className="font-mono text-micro text-muted tracking-tight bg-accent-950/80 px-1.5 py-0.5 border border-accent-800/80 rounded leading-none">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-b-2 border-accent-500/60 pb-3 text-center">
              <div className="w-10 h-10 mx-auto bg-accent-950 border-2 border-signal-400 rounded-lg flex items-center justify-center shadow-glow-12 shadow-signal-400/60">
                <span className="font-display text-signal-400 font-black text-xs tracking-display">NE</span>
              </div>
              <span className="font-mono text-micro text-accent-400 uppercase block mt-1 tracking-caps">
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
                      ? 'bg-signal-950/80 border-signal-400 text-signal-300 shadow-glow-20 shadow-signal-400/40'
                      : 'bg-raised/60 border-line/80 text-fg-soft hover:border-accent-500/60 hover:text-accent-400 hover:bg-raised/90'
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
                            : 'text-faint group-hover:text-accent-400'
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
                  ? 'border-accent-500 shadow-glow-20 shadow-accent-500/30 bg-surface/95'
                  : 'border-line hover:border-accent-500/60'
              }`}
            >
              {/* Accordion Header / Button */}
              <button
                onClick={() => setShowPatchNotes(!showPatchNotes)}
                className={`w-full py-2 ${
                  isMinimized ? 'px-2 justify-center' : 'px-3 justify-between'
                } text-fg-soft hover:text-accent-400 text-xs font-bold uppercase flex items-center transition-all cursor-pointer group`}
                title="Notas de Atualização"
              >
                <div className="flex items-center space-x-2">
                  <Terminal
                    className={`w-4 h-4 ${
                      showPatchNotes
                        ? 'text-signal-400 animate-pulse'
                        : 'text-accent-400 group-hover:text-signal-400'
                    } shrink-0`}
                  />
                  {!isMinimized && (
                    <span
                      className={`${
                        showPatchNotes
                          ? 'text-signal-400 font-extrabold'
                          : 'text-fg group-hover:text-accent-400'
                      }`}
                    >
                      NOTAS DE ATUALIZAÇÃO
                    </span>
                  )}
                </div>

                {!isMinimized && (
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-normal text-micro text-accent-400 bg-accent-950 px-2 py-0.5 border border-accent-800/80 rounded">
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
                <div className="p-2 border-t border-accent-500/30 bg-surface/90 animate-fadeIn">
                  <PatchNotesFeed compact embedded />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ITEM: UNIFIED USER PROFILE BUTTON */}
        <div className="relative z-10 pt-3 mt-4 border-t-2 border-accent-600/60 shrink-0">
          {user ? (
            <div>
              <ProfileCard
                variant="desktop"
                user={user}
                cyberpunkId={userCyberpunkId}
                avatarUrl={avatarUrl}
                avatarIconKey={avatarIconKey}
                statusInfo={statusInfo}
                isMinimized={isMinimized}
                isProfileActive={activeTab === 'profile'}
                onOpenProfile={() => {
                  setActiveTab('profile');
                  setIsMobileMenuOpen(false);
                }}
                onLogout={onLogout}
                onAvatarError={clearAvatarUrl}
              />
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
