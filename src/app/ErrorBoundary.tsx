import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Arangkada crashed:', error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-xl rounded-lg border border-destructive/40 bg-card p-6 shadow-2xl">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.25em] text-destructive">
            System Error
          </p>
          <h1 className="mt-3 text-2xl font-black uppercase tracking-tight">
            Arangkada could not load this screen
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This is usually caused by a module file that was edited while the app was running. Refresh the browser after saving your markdown changes.
          </p>
          <pre className="mt-5 max-h-48 overflow-auto rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-primary px-5 py-3 font-display text-xs font-black uppercase tracking-widest text-primary-foreground"
          >
            Reload App
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
