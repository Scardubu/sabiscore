import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

/**
 * Skeleton Component
 * 
 * Provides loading placeholders that match the shape of content being loaded.
 * Creates a smooth, professional loading experience with shimmer animation.
 * 
 * @param variant - Shape: text (rounded rect), circular (circle), rectangular (sharp edges), card (glass card)
 * @param width - Width in px or CSS units (e.g., '100%', '300px', 300)
 * @param height - Height in px or CSS units
 * @param className - Additional CSS classes
 * @param count - Number of skeleton items to render (for lists)
 */
const Skeleton: React.FC<SkeletonProps> = ({ 
  variant = 'text',
  width,
  height,
  className = '',
  count = 1
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'rounded h-4';
      case 'circular':
        return 'rounded-full aspect-square';
      case 'rectangular':
        return 'rounded-none';
      case 'card':
        return 'rounded-2xl glass-card';
      default:
        return 'rounded';
    }
  };

  const getStyle = () => {
    const style: React.CSSProperties = {};
    if (width) {
      style.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height) {
      style.height = typeof height === 'number' ? `${height}px` : height;
    }
    return style;
  };

  const skeletonElement = (
    <div 
      className={`shimmer ${getVariantClasses()} ${className}`}
      style={getStyle()}
      role="status"
      aria-label="Loading content"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index}>{skeletonElement}</div>
        ))}
      </div>
    );
  }

  return skeletonElement;
};

export default Skeleton;
