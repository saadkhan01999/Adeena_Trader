/**
 * ============================================
 * ErrorBoundary
 * ============================================
 * Catches render errors anywhere below it.
 *
 * Without this, one bad value - a null customer on a detail panel, say - takes
 * the whole application to a blank white screen with the cause visible only in
 * the console. A shop cannot act on that. This shows a readable message and two
 * ways out: reload, or go back to the dashboard.
 *
 * Must be a class: React has no hook equivalent of componentDidCatch.
 */

import { Component } from 'react';
import { AlertOctagon, RefreshCw, Home, ChevronDown } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // In production this is where a reporting service would be called.
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => window.location.reload();

  handleGoHome = () => {
    // A hard navigation rather than a router push: the router may be part of
    // whatever just failed.
    window.location.href = '/dashboard';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-navy-50/50 p-5">
        <div className="w-full max-w-md text-center">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-50 text-danger-500 ring-8 ring-danger-50/60 mb-5">
            <AlertOctagon size={30} />
          </span>

          <h1 className="font-display font-bold text-xl text-navy-950">Something went wrong</h1>

          <p className="mt-2 text-sm text-navy-600 leading-relaxed">
            This screen ran into an unexpected problem. Your saved data is safe — reloading
            usually fixes it.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-gold btn-lg inline-flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Reload the page
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="btn-secondary btn-lg inline-flex items-center justify-center gap-2"
            >
              <Home size={16} /> Go to dashboard
            </button>
          </div>

          {/* Technical detail in development only - it would mean nothing to a
              shopkeeper, and could leak internals in production. */}
          {isDev && this.state.error && (
            <details
              open={this.state.showDetails}
              className="mt-6 text-left rounded-lg border border-navy-200 bg-white overflow-hidden"
            >
              <summary className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-navy-600 cursor-pointer hover:bg-navy-50">
                <ChevronDown size={13} />
                Technical details (development only)
              </summary>
              <pre className="px-3 py-2 text-2xs text-danger-700 bg-danger-50/50 overflow-auto max-h-56 whitespace-pre-wrap break-words">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
