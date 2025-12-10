"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { InsightsResponse } from "@/lib/api";
import { ErrorBoundary, PredictionErrorFallback } from "./error-boundary";
import { freeMonitoring } from "@/lib/monitoring/free-analytics";

// Dynamically import InsightsDisplay with client-only rendering
const InsightsDisplay = dynamic(
  () => import("./insights-display").then((mod) => mod.InsightsDisplay),
  { 
    ssr: false,
    loading: () => (
      <div className="p-8 flex items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500"></div>
            <div className="absolute inset-2 animate-[spin_0.8s_linear_infinite_reverse] rounded-full border-2 border-purple-500/30 border-t-purple-500"></div>
          </div>
          <p className="text-sm text-slate-400 animate-pulse">Finalizing insights...</p>
          <span className="sr-only">Loading match insights</span>
        </div>
      </div>
    ),
  }
);

interface InsightsDisplayWrapperProps {
  insights: InsightsResponse;
}

export function InsightsDisplayWrapper({ insights }: InsightsDisplayWrapperProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <PredictionErrorFallback error={error} reset={reset} />}
      onError={(error, errorInfo) => {
        // Track error in monitoring system
        freeMonitoring.trackError({
          type: "insights_display",
          message: `${error.message} - Component: ${errorInfo.componentStack?.slice(0, 100)}`,
          timestamp: Date.now(),
        });
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <InsightsDisplay insights={insights} />
      </motion.div>
    </ErrorBoundary>
  );
}
