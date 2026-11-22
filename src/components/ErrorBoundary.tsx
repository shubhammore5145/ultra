import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  inline?: boolean;
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
    console.error('MartGPT React Error Caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="p-6 m-4 bg-card text-card-foreground border border-amber-500/30 rounded-2xl shadow-md text-center space-y-3 animate-in fade-in">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                {this.props.fallbackTitle || 'Module Temporarily Unavailable'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                An isolated issue occurred in this section, but your store data and other tabs are completely safe.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-muted/70 p-2 rounded-lg text-[11px] font-mono text-muted-foreground text-left max-h-20 overflow-y-auto max-w-lg mx-auto">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}
            <div className="flex justify-center gap-2 pt-1">
              <Button 
                size="sm" 
                onClick={() => this.setState({ hasError: false, error: null })} 
                className="text-xs font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reload Module
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4 animate-in fade-in duration-200">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-foreground">
                {this.props.fallbackTitle || 'System Recovered'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your store and transaction data is completely safe. Click the button below to restart the screen.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-muted/50 p-2.5 rounded-xl border text-[11px] font-mono text-muted-foreground text-left max-h-24 overflow-y-auto">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
              >
                <Home className="h-4 w-4" /> Home Screen
              </Button>
              <Button
                size="sm"
                onClick={this.handleReset}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm"
              >
                <RefreshCw className="h-4 w-4" /> Reload Screen
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
