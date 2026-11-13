/**
 * L.3d — o aviso flutuante de sincronização da ficha.
 */
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const SaveToastBanner: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="print:hidden fixed bottom-4 left-4 z-50 max-w-md bg-surface border-2 border-ok-400 p-4 rounded-lg shadow-glow-25 shadow-ok-500/50 text-xs backdrop-blur-sm space-y-1">
      <div className="flex items-center space-x-2 text-ok-400 font-bold uppercase">
        <CheckCircle2 className="w-4 h-4" />
        <span>Sincronização Concluída</span>
      </div>
      <p className="text-fg">{message}</p>
    </div>
  );
};
