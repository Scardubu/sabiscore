"use client";

import React from "react";

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className = "" }: ChartSkeletonProps) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-slate-800/40 ${className}`}>
      <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
    </div>
  );
}

export default ChartSkeleton;
