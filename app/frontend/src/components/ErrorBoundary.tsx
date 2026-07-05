import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb] px-4">
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 max-w-md w-full text-center">
                    <p className="text-4xl mb-4">⚠️</p>
                    <h2 className="text-lg font-semibold text-stone-800 mb-2">Something went wrong</h2>
                    <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                        An unexpected error occurred. Your data is safe — try refreshing the page.
                    </p>
                    <p className="text-xs text-stone-300 font-mono bg-stone-50 rounded-lg px-3 py-2 mb-6 text-left break-words">
                        {this.state.error.message}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-[#0f172a] text-white text-sm font-medium rounded-xl hover:bg-[#1e293b] transition-colors"
                    >
                        Reload app
                    </button>
                </div>
            </div>
        );
    }
}
