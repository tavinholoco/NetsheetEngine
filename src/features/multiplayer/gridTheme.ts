/**
 * L.3c (G.21) — o grid tático como dado: o tema da cena (o fundo, a borda e a
 * linha dos setores) e o nome das linhas, A a P.
 */
export interface ThemeConfig {
  bg: string;
  border: string;
  gridColor: string;
  colorDot: string;
  name: string;
}

export const THEME_STYLES: Record<string, ThemeConfig> = {
  alley: {
    bg: 'bg-surface',
    border: 'border-accent-500/40',
    gridColor: 'border-line/80',
    colorDot: 'bg-accent-500',
    name: 'Beco Neon (Escuro / Cyan)'
  },
  corpo: {
    bg: 'bg-raised',
    border: 'border-roll-500/50',
    gridColor: 'border-roll-900/60',
    colorDot: 'bg-roll-400',
    name: 'Praça Arasaka (Azul)'
  },
  netrunner: {
    bg: 'bg-ok-950',
    border: 'border-ok-500/50',
    gridColor: 'border-ok-900/60',
    colorDot: 'bg-ok-400',
    name: 'Net Matrix (Verde)'
  },
  industrial: {
    bg: 'bg-caution-950',
    border: 'border-caution-500/50',
    gridColor: 'border-caution-900/60',
    colorDot: 'bg-caution-500',
    name: 'Zona Industrial (Amarelo)'
  },
  club: {
    bg: 'bg-cyber-950',
    border: 'border-cyber-500/50',
    gridColor: 'border-cyber-900/60',
    colorDot: 'bg-cyber-400',
    name: 'Boate Totentanz (Roxo)'
  },
  redalert: {
    bg: 'bg-fault-950',
    border: 'border-fault-500/50',
    gridColor: 'border-fault-900/60',
    colorDot: 'bg-fault-500',
    name: 'Alerta de Combate (Magenta)'
  }
};

export const ROWS_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
