import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FutbolStats Pro: Error no capturado:', error, errorInfo);
  }

  public handleReload = () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#162032] border border-slate-700/80 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hubo un problema al renderizar</h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {this.state.error?.message || 'Error inesperado en los componentes gráficos.'}
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Limpiar memoria y reiniciar</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
