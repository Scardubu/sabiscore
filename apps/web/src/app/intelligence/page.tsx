import { BettingIntelligenceDashboard } from "@/components/betting-intelligence-dashboard";

export const metadata = {
  title: "Betting Intelligence",
  description: "Verified evidence, calibrated 1X2 probabilities, market value, and responsible staking guidance.",
};

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedLeague = typeof params.league === "string" ? params.league : "EPL";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Live analysis workspace</p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Fixture intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Retrieve verified evidence, add one coherent bookmaker snapshot, and let the six-gate engine decide whether the correct action is to pass, monitor, or act.</p>
          </div>
          <p className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-slate-400">Requested league: {requestedLeague.replaceAll("_", " ")}</p>
        </div>
      </section>
      <BettingIntelligenceDashboard initialCompetition={requestedLeague} />
    </div>
  );
}
