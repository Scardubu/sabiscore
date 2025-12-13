"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { InsightsResponse } from "@/lib/api";
import { ErrorBoundary, PredictionErrorFallback } from "./error-boundary";
import { freeMonitoring } from "@/lib/monitoring/free-analytics";
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
