"use client";

import dynamic from "next/dynamic";
import type { InsightsResponse } from "@/lib/api";

// Dynamically import InsightsDisplay with client-only rendering
const InsightsDisplay = dynamic(
  () => import("./insights-display").then((mod) => mod.InsightsDisplay),
  { 
    ssr: false,
    loading: () => (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    ),
  }
);

interface InsightsDisplayWrapperProps {
  insights: InsightsResponse;
}

export function InsightsDisplayWrapper({ insights }: InsightsDisplayWrapperProps) {
  return <InsightsDisplay insights={insights} />;
}
