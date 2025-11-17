export default function MatchInsightsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="glass-card animate-pulse space-y-4 p-6">
        <div className="h-6 w-40 rounded bg-slate-700/60" />
        <div className="h-10 w-3/4 rounded bg-slate-800/60" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-slate-800/40 bg-slate-900/40 p-4">
              <div className="h-4 w-24 rounded bg-slate-800/80" />
              <div className="h-8 w-32 rounded bg-slate-700/70" />
              <div className="h-3 w-full rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card animate-pulse space-y-4 p-6">
        <div className="h-5 w-48 rounded bg-slate-800/60" />
        <div className="h-32 rounded-xl bg-slate-900/40" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-20 rounded-lg bg-slate-900/40" />
          ))}
        </div>
      </div>
    </div>
  );
}
