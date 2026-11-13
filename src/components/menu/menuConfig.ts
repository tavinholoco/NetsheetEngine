/**
 * L.3d — o dado do menu: itens de navegação, avatares e o LED de status.
 *
 * Saiu do `CyberpunkMenu` como dado puro (o mesmo movimento do `gridTheme.ts`
 * na L.3c): o componente passa a ser só a tela.
 */
import type { ComponentType } from 'react';
import { Bot, Cpu, Dice5, FileText, Home, Radio, Shield, Skull, Swords, Zap } from 'lucide-react';
import type { ActivityStatus } from '../../hooks/useUserActivity';
import type { TabType } from '../CyberpunkMenu';

export type AvatarConfig = {
  icon: ComponentType<{ className?: string }>;
  color: string;
  border: string;
  bg: string;
};

export const AVATAR_CONFIG: Record<string, AvatarConfig> = {
  cpu: { icon: Cpu, color: 'text-accent-400', border: 'border-accent-400', bg: 'bg-accent-950/80' },
  shield: { icon: Shield, color: 'text-signal-400', border: 'border-signal-400', bg: 'bg-signal-950/80' },
  skull: { icon: Skull, color: 'text-fault-400', border: 'border-fault-400', bg: 'bg-fault-950/80' },
  radio: { icon: Radio, color: 'text-cyber-400', border: 'border-cyber-400', bg: 'bg-cyber-950/80' },
  zap: { icon: Zap, color: 'text-ok-400', border: 'border-ok-400', bg: 'bg-ok-950/80' }
};

export type StatusLedInfo = {
  border: string;
  borderActive: string;
  shadow: string;
  shadowActive: string;
  dotBg: string;
  textColor: string;
  badgeBorder: string;
  badgeBg: string;
  label: string;
};

export const STATUS_LED_CONFIG: Record<ActivityStatus, StatusLedInfo> = {
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

export const MENU_ITEMS = [
  { id: 'home' as TabType, label: 'INÍCIO', icon: Home, accent: 'text-signal-400' },
  { id: 'multiplayer' as TabType, label: 'JOGAR', icon: Radio, accent: 'text-ok-400' },
  { id: 'sheet' as TabType, label: 'FICHA', icon: Cpu, accent: 'text-accent-400' },
  { id: 'presets' as TabType, label: 'LENDAS', icon: Swords, accent: 'text-signal-400' },
  { id: 'ai' as TabType, label: 'NETRUNNER IA', icon: Bot, accent: 'text-cyber-400' },
  { id: 'dice' as TabType, label: 'DADOS', icon: Dice5, accent: 'text-roll-400' },
  { id: 'prd' as TabType, label: 'PRD', icon: FileText, accent: 'text-fg-strong' }
];
