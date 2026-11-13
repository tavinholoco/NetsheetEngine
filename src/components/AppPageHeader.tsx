/**
 * L.3d — a faixa de título da página, com o mapa de categoria/cor por aba.
 *
 * Saiu do `App` inteiro (mapa da G.1f: o `pageInfoMap` e o bloco `:245–282`).
 */
import React from 'react';
import type { TabType } from './CyberpunkMenu';

const PAGE_INFO: Record<TabType, { category: string; title: string; color: string }> = {
  home: { category: 'BEM-VINDO', title: 'INÍCIO // CYBERPUNK 2020 NETSHEET ENGINE', color: 'text-signal-400' },
  multiplayer: { category: 'JOGAR', title: 'MESA MULTIPLAYER EM TEMPO REAL', color: 'text-ok-400' },
  sheet: { category: 'FICHA', title: 'CRIADOR & GESTOR DE FICHA', color: 'text-accent-400' },
  presets: { category: 'LENDAS', title: 'BIBLIOTECA DE LENDAS DE NIGHT CITY', color: 'text-signal-400' },
  ai: { category: 'NETRUNNER', title: 'ASSISTENTE NETRUNNER IA & LIFEPATH', color: 'text-cyber-400' },
  dice: { category: 'DADOS', title: 'ROLADOR DE DADOS FNFF & COMBATE', color: 'text-roll-400' },
  prd: { category: 'PRD', title: 'ESPECIFICAÇÃO PRD & ROADMAP', color: 'text-fg-strong' },
  profile: { category: 'PERFIL', title: 'PERFIL DO EDGERUNNER', color: 'text-caution-400' }
};

export interface AppPageHeaderProps {
  activeTab: TabType;
  isLoggedIn: boolean;
  /** Nome da ficha ativa (só aparece com sessão). */
  handleName: string;
  role: string;
}

export const AppPageHeader: React.FC<AppPageHeaderProps> = ({ activeTab, isLoggedIn, handleName, role }) => {
  const currentPage = PAGE_INFO[activeTab];

  return (
    <div className="print:hidden bg-surface/90 border-2 border-accent-600/40 rounded-xl p-4 md:p-5 backdrop-blur-md shadow-glow-20 shadow-accent-500/15 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-signal-500 to-accent-500"></div>
      <div className="pl-3 space-y-1">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-accent-400 animate-pulse rounded-full shadow-glow-8 shadow-accent-400"></div>
          <span className="font-mono text-mini tracking-caps text-accent-400 uppercase">
            SISTEMA // {currentPage.category}
          </span>
        </div>
        <h1 key={activeTab} className={`animate-glitch font-display text-xl sm:text-2xl md:text-3xl font-black italic tracking-display uppercase ${currentPage.color} drop-shadow-glow-12 drop-shadow-white/15 leading-tight`}>
          {currentPage.title}
        </h1>
        {isLoggedIn && (
          <p className="text-xs text-fg-soft pt-1 flex items-center space-x-1.5">
            <span className="text-muted">FICHA ATIVA:</span>
            <strong className="text-signal-400 font-bold">{handleName || 'Edgerunner'}</strong>
            <span className="text-accent-400 font-bold">({role || 'Solo'})</span>
          </p>
        )}
      </div>
    </div>
  );
};
