import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * Fase 7 (T7.1) — PÁGINA 404 (rota desconhecida)
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface/90 border-l-4 border-l-fault-500 border-y border-r border-line rounded-2xl p-10 text-center animate-fadeIn">
      <div className="font-display text-[80px] font-black text-fault-500/30 select-none leading-none">404</div>
      <h2 className="font-display text-lg sm:text-xl font-black text-fault-400 uppercase tracking-display mt-2">// ROTA NÃO ENCONTRADA</h2>
      <p className="text-xs text-muted mt-3 max-w-md mx-auto">
        A Net não reconhece esse endereço. Verifique a URL ou volte para o terminal principal, choomba.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 px-5 py-2.5 bg-accent-500 hover:bg-accent-400 text-black font-black text-xs uppercase rounded shadow-glow-15 shadow-accent-500/40 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
      >
        <Home className="w-4 h-4" />
        <span>Voltar ao Início</span>
      </button>
    </div>
  );
};
