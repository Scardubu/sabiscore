import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, BookOpen, Database, Gauge, ShieldCheck } from "lucide-react";
import { VERDICT_PRESENTATION, VERDICT_SEQUENCE } from "@/lib/verdict-presentation";

const PROVIDERS = [
  ["ESPN", "Fixtures, results, and broad match context"],
  ["FBRef", "Team, referee, and tactical evidence"],
  ["SofaScore", "Lineups, availability, and live match context"],
  ["Understat", "Expected-goals evidence"],
  ["Transfermarkt", "Squad availability and contribution context"],
] as const;

export const metadata = {
  title: "Methodology",
  description: "How SabiScore gathers evidence, calibrates probabilities, assigns verdicts, and limits staking guidance.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-16">
      <header className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,#0e201b,#091310)] p-6 sm:p-10">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-emerald-300 hover:text-emerald-200"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back home</Link>
        <div className="mt-5 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Methodology and safeguards</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Understand every number before acting on it.</h1>
          <p className="mt-5 text-base leading-7 text-slate-300">SabiScore is designed to withhold a recommendation when verified evidence is incomplete. This page explains the contracts behind the interface without publishing unsupported performance claims.</p>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-3" aria-label="Core methodology">
        <MethodCard icon={Database} title="Evidence first">Five provider profiles are queried independently. Availability, freshness, and source conflicts remain visible in the result.</MethodCard>
        <MethodCard icon={BarChart3} title="Calibrated probabilities">Model probabilities are calibrated per league and compared with multiplicatively de-vigged market probabilities.</MethodCard>
        <MethodCard icon={ShieldCheck} title="Fail closed">Unavailable features, incoherent odds, stale critical inputs, or gate failures produce a pass state rather than an estimate.</MethodCard>
      </section>

      <section aria-labelledby="verdict-heading">
        <SectionHeading eyebrow="Decision language" title="Six verdicts, ordered from incomplete to highest conviction" id="verdict-heading" />
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          {VERDICT_SEQUENCE.map((verdict, index) => {
            const item = VERDICT_PRESENTATION[verdict];
            return (
              <article key={verdict} className="grid gap-3 border-b border-white/10 bg-white/[0.025] p-5 last:border-b-0 md:grid-cols-[52px_220px_1fr] md:items-center">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-sm font-black text-slate-400">{index + 1}</span>
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{verdict}</p><h3 className="mt-1 font-bold text-white">{item.label}</h3></div>
                <p className="text-sm leading-6 text-slate-400">{item.summary}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionHeading eyebrow="Evidence panel" title="What the five sources contribute" id="providers-heading" />
          <p className="mt-4 text-sm leading-6 text-slate-400">A source can be live, stale, unavailable, or conflicting. Single-provider evidence cannot promote a verdict above HOLD.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <dl className="space-y-4">
            {PROVIDERS.map(([name, description]) => <div key={name} className="grid gap-1 border-b border-white/10 pb-4 last:border-0 last:pb-0 sm:grid-cols-[150px_1fr]"><dt className="font-bold text-white">{name}</dt><dd className="text-sm leading-6 text-slate-400">{description}</dd></div>)}
          </dl>
        </div>
      </section>

      <section aria-labelledby="market-heading">
        <SectionHeading eyebrow="Market math" title="How value and stake guidance are calculated" id="market-heading" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Definition term="Bookmaker implied probability">The reciprocal of decimal odds. The three outcomes are normalized using multiplicative de-vig before comparison.</Definition>
          <Definition term="Edge">SabiScore calibrated probability minus the bookmaker fair probability for the same outcome.</Definition>
          <Definition term="Expected value">The average theoretical return per unit staked at the current verified price. It is not a promised return.</Definition>
          <Definition term="Quarter-Kelly">One quarter of the Kelly fraction is the display default. No surfaced suggestion may exceed 5% of bankroll.</Definition>
          <Definition term="Closing-line value">Recorded only after a verified Pinnacle closing price exists. It is never estimated from an unrelated quality score.</Definition>
          <Definition term="RPS and ECE">Ranked Probability Score is the primary model-selection metric. Expected Calibration Error triggers league recalibration above 0.03.</Definition>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6 sm:p-8" aria-labelledby="responsible-heading">
        <div className="flex gap-4">
          <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h2 id="responsible-heading" className="text-xl font-black text-white">Responsible use</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Betting involves financial risk. Treat every stake as expendable, respect local laws, set firm deposit and time limits, and stop when betting stops being recreational. A NO_BET verdict is a valid and often valuable outcome.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/intelligence" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-200"><Gauge className="h-4 w-4" aria-hidden="true" />Open intelligence</Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-5 py-3 font-bold text-white hover:border-white/25"><BookOpen className="h-4 w-4" aria-hidden="true" />Return home</Link>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">{eyebrow}</p><h2 id={id} className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h2></div>;
}

function MethodCard({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><Icon className="h-6 w-6 text-emerald-300" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{children}</p></article>;
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h3 className="font-bold text-white">{term}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{children}</p></article>;
}
