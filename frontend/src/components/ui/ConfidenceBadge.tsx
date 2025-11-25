import React from 'react';
import Tooltip from './Tooltip';

interface ConfidenceBadgeProps {
  value: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * ConfidenceBadge Component
 * 
 * Visual indicator for model confidence with color coding and tooltip.
 * 
 * Color scale:
 * - Green (90%+): Excellent confidence
 * - Blue (80-90%): High confidence
 * - Yellow (70-80%): Moderate confidence
 * - Orange (60-70%): Low confidence
 * - Red (<60%): Very low confidence
 */
const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  value,
  size = 'md',
  showLabel = true,
  className = ''
}) => {
  const percentage = Math.round(value * 100);
  
  const getColorClasses = () => {
    if (percentage >= 90) return {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'Excellent'
    };
    if (percentage >= 80) return {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      label: 'High'
    };
    if (percentage >= 70) return {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30',
      label: 'Moderate'
    };
    if (percentage >= 60) return {
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      label: 'Low'
    };
    return {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/30',
      label: 'Very Low'
    };
  };

  const colors = getColorClasses();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-semibold">{colors.label} Confidence</div>
      <div className="text-xs text-gray-300">
        Our ML model has {percentage}% confidence in this prediction based on 86 analyzed features.
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Higher confidence = stronger statistical support
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <span 
        className={`
          inline-flex items-center gap-1.5 rounded-full font-medium
          border cursor-help transition-all duration-200
          hover:scale-105
          ${colors.bg} ${colors.text} ${colors.border}
          ${sizeClasses[size]}
          ${className}
        `}
      >
        {/* Confidence indicator dot */}
        <span className={`w-2 h-2 rounded-full ${colors.text} bg-current animate-pulse`} />
        
        {/* Percentage */}
        <span>{percentage}%</span>
        
        {/* Label */}
        {showLabel && size !== 'sm' && (
          <span className="text-xs opacity-75">({colors.label})</span>
        )}
      </span>
    </Tooltip>
  );
};

export default ConfidenceBadge;
