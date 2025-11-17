import Link from "next/link";
import { MatchSelector } from "@/components/match-selector";

export const metadata = {
  title: "Match Insights | Sabiscore",
  description: "Choose a league and matchup to generate Sabiscore betting insights.",
};

export default function MatchLandingPage() {
  const featureCards = [
    {
      title: "Smart Kelly",
      body: "Auto-sizes stakes with ⅛ Kelly and liquidity safeguards.",
    },
    {
      title: "Market Radar",
      body: "Compares model edge against live bookmaker lines in seconds.",
    },
    {
      title: "Confidence Bands",
      body: "Monte Carlo bands show volatility and probability swings.",
    },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-sm font-semibold text-indigo-200">
          <span>Live Match Insights</span>
          <span className="text-indigo-400">Updated every 15s</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
          Generate actionable edges for any fixture
        </h1>
        <p className="text-base text-slate-400 md:text-lg">
          Select your league and teams to unlock probability curves, value bets, and risk guidance tuned for the latest market moves.
        </p>
      </section>

      <MatchSelector />

      <section className="grid gap-6 md:grid-cols-3">
        {featureCards.map((feature) => (
          <div key={feature.title} className="glass-card space-y-2 p-6">
            <h2 className="text-lg font-semibold text-slate-100">{feature.title}</h2>
            <p className="text-sm text-slate-400">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-sm text-slate-400">
        <p className="mb-4 font-semibold text-slate-200">Need a refresher on the numbers?</p>
        <ul className="list-disc space-y-2 pl-6 text-left">
          <li>&ldquo;Edge&rdquo; shows how far the market deviates from Sabiscore fair odds.</li>
          <li>&ldquo;Kelly stake&rdquo; scales position sizing to protect bankroll and downside.</li>
          <li>
            &ldquo;CLV&rdquo; captures expected price movement; use it to gauge closing line efficiency.
          </li>
        </ul>
        <p className="mt-4 text-slate-500">
          Want deeper methodology notes? Dive into the <Link href="/docs" className="text-indigo-300 hover:text-indigo-200">product docs</Link>.
        </p>
      </section>
    </div>
  );
}
