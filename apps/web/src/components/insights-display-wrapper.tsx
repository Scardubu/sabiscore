"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { InsightsResponse } from "@/lib/api";
import { ErrorBoundary, PredictionErrorFallback } from "./error-boundary";
import { PredictionSkeleton } from "./prediction-skeleton";

// Dynamically import InsightsDisplay with client-only rendering
const InsightsDisplay = dynamic(
  () => import("./insights-display").then((mod) => mod.InsightsDisplay),
  { 
    ssr: false,
    loading: () => <PredictionSkeleton />,
  }
);

interface InsightsDisplayWrapperProps {
  insights: InsightsResponse;
}

// Safe error tracking that only runs on client
function trackClientError(error: Error, errorInfo: React.ErrorInfo) {
  // Only track errors on the client
  if (typeof window === "undefined") return;
  
  // Lazy import to avoid SSR issues
  import("@/lib/monitoring/free-analytics").then(({ freeMonitoring }) => {
    freeMonitoring.trackError({
      type: "insights_display",
      message: `${error.message} - Component: ${errorInfo.componentStack?.slice(0, 100)}`,
      timestamp: Date.now(),
    });
  }).catch(() => {
    // Silently fail if monitoring is unavailable
  });
}

export function InsightsDisplayWrapper({ insights }: InsightsDisplayWrapperProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <PredictionErrorFallback error={error} reset={reset} />}
      onError={trackClientError}
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
