import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL-PREVIEW-ERROR] Caught crash:', error, errorInfo);
  }

  private handleReload = () => {
    // Attempt full reload to bust stale cache/state
    window.location.reload();
  };

  public render() {
    const { hasError, error } = this.state;
    if (hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div id="error-boundary-recovery" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center font-sans select-none">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-red-500/15 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <ShieldAlert size={32} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">Something went wrong</h1>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                The application encountered an unexpected issue inside the interactive frame. Press reload to refresh your workspace.
              </p>
            </div>

            {error && (
              <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl text-left overflow-auto max-h-32 hide-scrollbar">
                <code className="text-[10px] font-mono text-rose-400 whitespace-pre-wrap leading-normal break-all">
                  Err: {error.toString()}
                </code>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform shadow-lg cursor-pointer text-sm"
            >
              <RefreshCw size={16} />
              Re-evaluate Status & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
