import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import Skeleton from './Skeleton';

interface LoadingCardProps {
  variant?: 'spinner' | 'skeleton' | 'enhanced';
  title?: string;
  message?: string;
  className?: string;
}

/**
 * LoadingCard Component
 * 
 * A complete loading state card with multiple variants for different use cases.
 * 
 * Variants:
 * - spinner: Simple centered spinner with optional message
 * - skeleton: Content placeholders matching real content layout
 * - enhanced: Full featured with animated icon, progress, and engaging content
 * 
 * @param variant - Loading display style
 * @param title - Loading title/heading
 * @param message - Descriptive message
 * @param className - Additional CSS classes
 */
const LoadingCard: React.FC<LoadingCardProps> = ({ 
  variant = 'spinner',
  title = 'Loading',
  message = 'Please wait...',
  className = ''
}) => {
  if (variant === 'skeleton') {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="space-y-4">
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={16} />
          <div className="pt-4">
            <Skeleton variant="rectangular" width="100%" height={200} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="95%" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'enhanced') {
    return (
      <div className={`glass-card p-8 animate-fade-in ${className}`}>
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          {/* Animated gradient ring with improved styling */}
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full" 
              style={{ 
                width: '80px', 
                height: '80px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)',
                backgroundSize: '200% 200%',
                animation: 'gradient-rotate 3s ease infinite, spin 2s linear infinite',
                opacity: 0.4,
                filter: 'blur(12px)'
              }} 
            />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full glass-card animate-scale-pulse">
              <svg 
                className="w-10 h-10 text-primary" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                />
              </svg>
            </div>
          </div>

          {/* Title with shimmer */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {title}
            </h3>
            <p className="text-sm text-gray-400 loading-pulse">
              {message}
            </p>
          </div>

          {/* Enhanced progress bar */}
          <div className="w-full max-w-xs">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div 
                className="h-full absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, transparent)',
                  animation: 'progress 2s ease-in-out infinite',
                  width: '50%'
                }}
              />
            </div>
          </div>

          {/* Fun fact or tip */}
          <div className="glass-card p-4 max-w-md border border-slate-700/40">
            <p className="text-xs text-gray-300 leading-relaxed">
              💡 <span className="font-medium text-primary">Did you know?</span> Our AI models analyze thousands of data points in seconds to provide accurate predictions.
            </p>
          </div>
        </div>

        <style>{`
          @keyframes gradient-rotate {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </div>
    );
  }

  // Default: spinner variant
  return (
    <div className={`glass-card p-8 ${className}`}>
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <LoadingSpinner size="lg" variant="primary" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingCard;
