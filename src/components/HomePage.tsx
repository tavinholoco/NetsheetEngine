import React from 'react';
import { TabType } from './CyberpunkMenu';
import { APP_VERSION } from '../version';
import {
  Home,
  Radio,
  Cpu,
  Swords,
  Bot,
  Dice5,
  FileText,
  User as UserIcon,
  Shield,
  Zap,
  Terminal,
  ArrowRight
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: TabType) => void;
}

const MODULE_CARDS: { tab: TabType; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; accent: string; border: string; bg: string }[] = [
  { tab: 'sheet', title: 'FICHA', desc: 'Crie e gerencie fichas de edgerunner com atributos, perícias, cromo e armas.', icon: Cpu, accent: 'text-accent-400', border: 'hover:border-accent-500/60', bg: 'bg-accent-950/20' },
  { tab: 'multiplayer', title: 'JOGAR', desc: 'Mesas multiplayer em tempo real com grid tático, iniciativa e poderes de GM.', icon: Radio, accent: 'text-ok-400', border: 'hover:border-ok-500/60', bg: 'bg-ok-950/20' },
  { tab: 'dice', title: 'DADOS', desc: 'Rolador FNFF: perícia, dano e death save com crítico explosivo e fumble.', icon: Dice5, accent: 'text-pink-400', border: 'hover:border-pink-500/60', bg: 'bg-pink-950/20' },
  { tab: 'ai', title: 'NETRUNNER IA', desc: 'Assistente inteligente para diagnóstico de build, regras e lifepath.', icon: Bot, accent: 'text-cyber-400', border: 'hover:border-cyber-500/60', bg: 'bg-cyber-950/20' },
  { tab: 'presets', title: 'LENDAS', desc: 'Biblioteca de presets de Night City com clonagem 1-clique.', icon: Swords, accent: 'text-signal-400', border: 'hover:border-signal-500/60', bg: 'bg-signal-950/20' },
  { tab: 'prd', title: 'PRD', desc: 'Especificação do produto, roadmap de 13 fases e arquitetura técnica.', icon: FileText, accent: 'text-red-400', border: 'hover:border-red-500/60', bg: 'bg-red-950/20' },
  { tab: 'profile', title: 'PERFIL', desc: 'Seu perfil de edgerunner, ID Cyberpunk e fichas salvas na nuvem.', icon: UserIcon, accent: 'text-caution-400', border: 'hover:border-caution-500/60', bg: 'bg-caution-950/20' }
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6 font-mono animate-fadeIn">
      {/* Hero */}
      <div className="relative overflow-hidden bg-surface/90 border-2 border-red-600/40 rounded-2xl p-8 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-red-500 via-signal-500 to-accent-500" />
        <div className="absolute inset-0 crt-scanlines opacity-30 pointer-events-none" />
        <div className="relative z-10 pl-3 space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-signal-400 animate-pulse-glow" />
            <span className="text-[11px] font-black tracking-widest text-red-500 uppercase">
              NETSHEET ENGINE // TERMINAL ONLINE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black italic tracking-tight text-signal-400 uppercase drop-shadow-glow-20 drop-shadow-signal-400/50">
            Bem-vindo a Night City
          </h1>
          <p className="text-sm text-fg-soft max-w-2xl leading-relaxed">
            Sua suíte completa de Cyberpunk 2020: crie fichas com fidelidade às regras, role dados FNFF,
            converse com outros edgerunners e sente-se na mesa multiplayer em tempo real com grid tático.
            Choomba, o futuro é agora.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('sheet')}
              className="px-5 py-2.5 bg-signal-400 hover:bg-signal-300 text-black font-black text-xs uppercase rounded border-2 border-signal-300 shadow-glow-15 shadow-signal-400/50 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>Criar Ficha</span>
            </button>
            <button
              onClick={() => onNavigate('multiplayer')}
              className="px-5 py-2.5 bg-ok-500 hover:bg-ok-400 text-black font-black text-xs uppercase rounded border-2 border-ok-300 shadow-glow-15 shadow-ok-500/50 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Jogar Agora</span>
            </button>
            <span className="text-[10px] text-subtle uppercase tracking-wider">
              {APP_VERSION} • Estado: {new Date().toLocaleTimeString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULE_CARDS.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.tab}
              onClick={() => onNavigate(mod.tab)}
              className={`group bg-surface/80 border border-line rounded-xl p-5 text-left transition-all hover:scale-[1.02] hover:shadow-glow-20 hover:shadow-accent-500/15 ${mod.border} cursor-pointer`}
            >
              <div className={`w-11 h-11 rounded-lg ${mod.bg} border border-line-strong flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
                <Icon className={`w-5 h-5 ${mod.accent}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-black uppercase tracking-wider ${mod.accent}`}>{mod.title}</span>
                <ArrowRight className={`w-4 h-4 text-faint group-hover:text-accent-400 group-hover:translate-x-1 transition-all`} />
              </div>
              <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{mod.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="bg-surface/80 border border-line rounded-lg p-3 flex items-center justify-between text-[10px] font-mono text-subtle">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-accent-400" />
          <span>SISTEMA.NET // NETSHEET ENGINE — módulos prontos para uso</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-ok-500 animate-pulse" />
          <span className="text-ok-400 font-bold uppercase">ONLINE</span>
        </div>
      </div>
    </div>
  );
};
