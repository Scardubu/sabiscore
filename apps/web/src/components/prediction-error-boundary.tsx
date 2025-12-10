/**
 * Prediction Error Boundary
 * 
 * Gracefully handles errors in prediction components with retry capability.
 * Integrates with the free monitoring system to track errors in production.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

export class PredictionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Prediction error caught:', error, errorInfo);
    
    // Track error in monitoring system
    freeMonitoring.trackError({
      type: 'prediction_boundary_error',
      message: `${this.props.componentName || 'Unknown'}: ${error.message}`,
      timestamp: Date.now(),
    });
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    if (newRetryCount <= MAX_RETRIES) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: newRetryCount,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Prediction Failed
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {this.state.error?.message || 'An unexpected error occurred while generating predictions.'}
              </p>
              
              {canRetry ? (
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again ({MAX_RETRIES - this.state.retryCount} attempts left)
                </button>
              ) : (
                <div className="text-sm text-slate-500">
                  Maximum retries reached. Please refresh the page or try again later.
                </div>
              )}
            </div>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 pt-4 border-t border-slate-700/50">
              <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300">
                Error Details (Dev Only)
              </summary>
              <pre className="mt-2 text-xs text-red-400/80 overflow-auto max-h-40 bg-slate-900/50 rounded p-3">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
