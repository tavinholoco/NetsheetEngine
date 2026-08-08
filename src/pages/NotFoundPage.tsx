import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * Fase 7 (T7.1) — PÁGINA 404 (rota desconhecida)
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-slate-950/90 border-l-4 border-red-500 border-y border-r border-slate-800 rounded-2xl p-10 text-center font-mono animate-fadeIn">
      <div className="text-[80px] font-black text-red-500/30 select-none leading-none">404</div>
      <h2 className="text-xl font-black text-red-400 uppercase tracking-widest mt-2">// ROTA NÃO ENCONTRADA</h2>
      <p className="text-xs text-slate-400 mt-3 max-w-md mx-auto">
        A Net não reconhece esse endereço. Verifique a URL ou volte para o terminal principal, choomba.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase rounded shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
      >
        <Home className="w-4 h-4" />
        <span>Voltar ao Início</span>
      </button>
    </div>
  );
};
