import React from 'react';
import Tooltip from './Tooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

/**
 * StatCard Component
 * 
 * Compact card for displaying a single statistic with optional trend indicator.
 * Perfect for dashboards and data-heavy interfaces.
 */
const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  tooltip,
  className = '',
  variant = 'default'
}) => {
  const variantClasses = {
    default: 'border-white/10',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5'
  };

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-gray-400'
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    )
  };

  const content = (
    <div className={`
      glass-card p-4 border transition-all duration-200
      hover:scale-[1.02] hover:border-white/20
      ${variantClasses[variant]}
      ${className}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">
              {value}
            </span>
            {trend && (
              <span className={`flex items-center gap-0.5 ${trendColors[trend]}`}>
                {trendIcons[trend]}
              </span>
            )}
          </div>
          {subValue && (
            <p className="text-xs text-gray-500 mt-1">
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-indigo-400 opacity-60">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} position="top">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default StatCard;
