import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary global — captura erros de renderização para evitar
 * que uma falha derrube o app inteiro. Consumido por main.tsx.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[NETSHEET ENGINE] Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-mono">
          <div className="max-w-lg w-full bg-slate-900/80 border-2 border-red-600/50 rounded-2xl p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-black text-red-400 uppercase tracking-widest mb-2">
              Erro Crítico no Terminal
            </h1>
            <p className="text-xs text-slate-400 mb-1">
              A NETSHEET ENGINE encontrou uma falha inesperada no processamento.
            </p>
            <p className="text-[10px] text-red-300/70 bg-red-950/40 border border-red-800/50 rounded p-2 mb-5 break-words">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded transition-all cursor-pointer"
              >
                Reiniciar Terminal
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
