/* eslint-disable react/forbid-dom-props */
// Note: Dynamic positioning requires inline styles for top/left coordinates
import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

/**
 * Tooltip Component
 * 
 * A lightweight, accessible tooltip with smooth animations.
 * Automatically positions to avoid viewport edges.
 * 
 * @param content - Tooltip content (text or JSX)
 * @param children - Element that triggers tooltip on hover
 * @param position - Preferred position (defaults to 'top')
 * @param delay - Show delay in milliseconds (default: 200)
 * @param className - Additional CSS classes
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;
    
    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const offset = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = trigger.top - tooltip.height - offset;
        left = trigger.left + (trigger.width - tooltip.width) / 2;
        break;
      case 'bottom':
        top = trigger.bottom + offset;
        left = trigger.left + (trigger.width - tooltip.width) / 2;
        break;
      case 'left':
        top = trigger.top + (trigger.height - tooltip.height) / 2;
        left = trigger.left - tooltip.width - offset;
        break;
      case 'right':
        top = trigger.top + (trigger.height - tooltip.height) / 2;
        left = trigger.right + offset;
        break;
    }

    // Prevent tooltip from going off-screen
    left = Math.max(8, Math.min(left, window.innerWidth - tooltip.width - 8));
    top = Math.max(8, top);

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            fixed z-50 px-3 py-2 text-sm
            bg-slate-800/95 backdrop-blur-sm text-white
            rounded-lg shadow-xl border border-white/10
            animate-fade-in pointer-events-none
            max-w-xs
            ${className}
          `}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
        >
          {content}
          <div 
            className={`
              absolute w-2 h-2 bg-slate-800/95 border-white/10 rotate-45
              ${position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r' : ''}
              ${position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 border-t border-l' : ''}
              ${position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2 border-t border-r' : ''}
              ${position === 'right' ? 'left-[-5px] top-1/2 -translate-y-1/2 border-b border-l' : ''}
            `}
          />
        </div>
      )}
    </>
  );
};

export default Tooltip;
