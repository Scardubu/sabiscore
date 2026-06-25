import { Metadata } from "next";
import { Suspense } from "react";
import { PerformancePageClient } from "@/components/performance/performance-page-client";

export const metadata: Metadata = {
  title: "Intelligence Hub | SabiScore",
  description: "Model accuracy trends, value bet scanner, and performance analytics across all leagues.",
};

export default function PerformancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-8 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
              Live Intelligence
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Performance Dashboard
          </h1>
          <p className="text-slate-400">
            Rolling model accuracy, value bet opportunities, and per-league calibration.
          </p>
        </header>

        <Suspense
          fallback={
            <div className="grid gap-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl bg-slate-800/50"
                  aria-hidden="true"
                />
              ))}
            </div>
          }
        >
          <PerformancePageClient />
        </Suspense>
      </div>
    </div>
  );
}
