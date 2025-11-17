import Link from "next/link";

export default function MatchNotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Match Not Found</p>
        <h1 className="text-3xl font-bold text-slate-100">We could not generate insights for that fixture</h1>
        <p className="text-slate-400">
          The matchup may be unavailable or the league is not yet supported. Select another
          fixture to keep exploring live value opportunities.
        </p>
      </div>

      <Link
        href="/match"
        className="rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
      >
        Try a different matchup
      </Link>
    </div>
  );
}
