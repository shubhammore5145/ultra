import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShoppingCart, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-4 animate-in fade-in duration-200">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-foreground">
                {this.props.fallbackTitle || 'सिस्टम तात्पुरती थांबली (System Recovered)'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                काही काळजी करू नका! दुकानातील चालू डेटा आणि बिलांचा डेटा सुरक्षित आहे. खालील बटण दाबून स्टोअर पुन्हा सुरू करा.
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
                <Home className="h-4 w-4" /> मुख्य पान (Home)
              </Button>
              <Button
                size="sm"
                onClick={this.handleReset}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm"
              >
                <RefreshCw className="h-4 w-4" /> रीलोड करा (Reload)
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
