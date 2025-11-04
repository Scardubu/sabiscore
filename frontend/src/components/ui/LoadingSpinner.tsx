import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'white';
  className?: string;
  message?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4'
};

const variantClasses = {
  primary: 'border-primary border-t-transparent',
  secondary: 'border-secondary border-t-transparent',
  white: 'border-white border-t-transparent'
};

/**
 * LoadingSpinner Component
 * 
 * A consistent, accessible loading spinner with multiple sizes and variants.
 * Includes proper ARIA attributes for screen readers.
 * 
 * @param size - Spinner size: sm (16px), md (32px), lg (48px), xl (64px)
 * @param variant - Color variant: primary (blue), secondary (gold), white
 * @param className - Additional CSS classes
 * @param message - Optional loading message displayed below spinner
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  variant = 'primary',
  className = '',
  message
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div 
        className={`
          animate-spin rounded-full
          ${sizeClasses[size]} 
          ${variantClasses[variant]}
        `}
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {message && (
        <p className="text-sm text-gray-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
