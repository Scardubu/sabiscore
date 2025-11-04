import React, { useEffect, useState } from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: string;
  timeoutMs?: number;
  showLoadingState?: boolean;
}

const DEFAULT_PLACEHOLDER = '/placeholder.svg';

/**
 * SafeImage Component
 * 
 * Enhanced image component with timeout handling, fallback support, and loading states.
 * Automatically falls back to placeholder if image fails to load within timeout.
 * 
 * @param src - Primary image source URL
 * @param fallback - Fallback image URL (defaults to placeholder.svg)
 * @param timeoutMs - Maximum time to wait for image load (default: 5000ms)
 * @param showLoadingState - Show shimmer effect while loading
 */
const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  fallback = DEFAULT_PLACEHOLDER, 
  timeoutMs = 5000,
  showLoadingState = true,
  className = '',
  ...rest 
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const img = new Image();
    let didFinish = false;
    
    setIsLoading(true);
    setError(false);
    setCurrentSrc(null);

    const timer = window.setTimeout(() => {
      if (!didFinish && mounted) {
        setCurrentSrc(fallback);
        setIsLoading(false);
        setError(true);
      }
    }, timeoutMs);

    img.onload = () => {
      didFinish = true;
      if (mounted) {
        setCurrentSrc(src);
        setIsLoading(false);
        setError(false);
      }
      clearTimeout(timer);
    };

    img.onerror = () => {
      didFinish = true;
      if (mounted) {
        setCurrentSrc(fallback);
        setIsLoading(false);
        setError(true);
      }
      clearTimeout(timer);
    };

    img.src = src;

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [src, fallback, timeoutMs]);

  if (isLoading && showLoadingState) {
    return (
      <div 
        className={`shimmer rounded animate-pulse ${className}`}
        style={{ 
          aspectRatio: '1/1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40px'
        }}
        role="status"
        aria-label="Loading image"
      >
        <svg 
          className="w-6 h-6 text-slate-600 animate-spin" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <img 
      src={currentSrc || fallback} 
      className={`transition-opacity duration-300 ${className} ${error ? 'opacity-50 grayscale' : 'opacity-100'}`}
      loading="lazy"
      {...rest} 
      onError={(e) => { 
        const target = e.currentTarget as HTMLImageElement;
        if (target.src !== fallback) {
          target.src = fallback;
          setError(true);
        }
      }} 
    />
  );
};

export default SafeImage;
