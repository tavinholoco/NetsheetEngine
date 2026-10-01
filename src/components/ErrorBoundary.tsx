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
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-mono">
          <div className="max-w-lg w-full bg-raised/80 border-2 border-fault-600/50 rounded-2xl p-8 text-center shadow-glow-30 shadow-fault-500/20">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="font-display text-xl font-black text-fault-400 uppercase tracking-display mb-2">
              Erro Crítico no Terminal
            </h1>
            <p className="text-xs text-muted mb-1">
              A NETSHEET ENGINE encontrou uma falha inesperada no processamento.
            </p>
            <p className="text-micro text-fault-300/70 bg-fault-950/40 border border-fault-800/50 rounded p-2 mb-5 break-words">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-fault-600 hover:bg-fault-700 text-white font-black text-xs uppercase rounded transition-all cursor-pointer"
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
