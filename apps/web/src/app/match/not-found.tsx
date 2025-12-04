import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function MatchNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 text-center py-16 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/50 border border-slate-700/50">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
      </div>
      
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Match Not Found</p>
        <h1 className="text-3xl font-bold text-slate-100">We could not generate insights for that fixture</h1>
        <p className="text-slate-400 max-w-md mx-auto">
          The matchup may be unavailable, use an invalid format, or the league is not yet supported. 
          Please ensure your matchup is in the format &ldquo;Team A vs Team B&rdquo;.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
        >
          Try a different matchup
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-6 py-3 font-semibold text-slate-300 transition hover:bg-slate-700/60"
        >
          Go home
        </Link>
      </div>
      
      <div className="mt-4 text-xs text-slate-500">
        <p>Supported leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1</p>
      </div>
    </div>
  );
}
