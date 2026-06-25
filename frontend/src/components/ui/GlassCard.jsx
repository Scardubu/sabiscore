import React from 'react';

export const GlassCard = ({ children, className = '' }) => (
  <div className={`backdrop-blur-sm bg-white/10 dark:bg-slate-900/40 border border-white/20 rounded-xl shadow-lg hover:shadow-xl transition-shadow ${className}`}>
    {children}
  </div>
);
