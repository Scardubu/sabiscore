"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface LivePredictionFlowProps {
  homeTeam: string;
  awayTeam: string;
  league?: string;
}

export function LivePredictionFlow({
  homeTeam,
  awayTeam,
  league = "EPL",
}: LivePredictionFlowProps) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" />
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Backend evidence required</h2>
            <p className="mt-1 text-sm opacity-90">
              {homeTeam} vs {awayTeam} ({league}) can be analyzed only after the FastAPI backend resolves
              the fixture, model evidence, and one coherent bookmaker snapshot.
            </p>
          </div>
          <Link
            href="/intelligence"
            className="inline-flex items-center gap-2 rounded-md bg-amber-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-amber-200 dark:text-amber-950"
          >
            <ShieldCheck className="h-4 w-4" />
            Open Intelligence Workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
