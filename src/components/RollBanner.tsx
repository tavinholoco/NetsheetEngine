/**
 * L.3d — a notificação flutuante da última rolagem.
 */
import React from 'react';
import { Dice5 } from 'lucide-react';
import type { RollResult } from '../types/cyberpunk';

export const RollBanner: React.FC<{ banner: RollResult | null }> = ({ banner }) => {
  if (!banner) return null;

  return (
    <div className="print:hidden fixed bottom-4 right-4 z-50 max-w-sm bg-raised/90 border-2 border-accent-400 p-4 rounded-lg shadow-glow-25 shadow-accent-500/50 animate-bounce text-xs font-mono backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-line pb-1 mb-2">
        <span className="text-signal-400 flex items-center space-x-1">
          <Dice5 className="w-4 h-4 text-accent-400" />
          <span>{banner.label}</span>
        </span>
        <span className="text-micro text-muted">{banner.timestamp}</span>
      </div>

      <div className="text-xl text-accent-300 my-1">
        RESULTADO TOTAL: {banner.total}
      </div>

      <p className="text-mini text-fg-soft">{banner.details}</p>
    </div>
  );
};
