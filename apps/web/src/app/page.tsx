import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  Gauge,
  Layers3,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { VerdictBadge } from "@/components/verdict-badge";
import { VERDICT_SEQUENCE } from "@/lib/verdict-presentation";

const PROVIDERS = ["ESPN", "FBRef", "SofaScore", "Understat", "Transfermarkt"];
const LEAGUES = [
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Eredivisie",
  "UEFA Champions League",
];

const PRINCIPLES = [
  {
    icon: Database,
    title: "Real evidence or no verdict",
    body: "Missing, stale, or conflicting inputs fail closed. Production paths never replace unavailable football data with league averages or placeholder odds.",
  },
  {
    icon: BarChart3,
    title: "Probability before prediction",
    body: "The interface compares calibrated 1X2 probabilities with multiplicatively de-vigged market probabilities and explains the resulting edge.",
  },
  {
    icon: ShieldCheck,
    title: "Risk is part of the product",
    body: "Quarter-Kelly is the display default, every suggestion is capped at 5% of bankroll, and pass states are treated as successful decisions.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-16 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.14),transparent_38%),linear-gradient(145deg,#0d1b18,#07110f)] px-6 py-12 shadow-2xl shadow-black/30 sm:px-10 lg:px-14 lg:py-16">
        <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Evidence-first football intelligence
            </p>
            <h1 className="mt-6 max-w-4xl text-balance text-4xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">
              Make the right action obvious before the market moves.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
              SabiScore turns verified provider evidence, calibrated models, and current 1X2 prices into one plain-English verdict—without inventing missing data.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/intelligence"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
              >
                Open intelligence <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 font-bold text-white transition hover:border-white/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Read the methodology
              </Link>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Interface contract</p>
                <p className="mt-1 text-sm text-slate-300">Every verdict includes a rationale.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400">Example state</span>
            </div>
            <VerdictBadge
              verdict="NO_BET"
              rationale="We could not verify enough independent evidence to justify a position, so the correct action is to skip this match."
            />
            <p className="px-1 text-xs leading-5 text-slate-500">
              This is a presentation example, not a recommendation for a live fixture.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="system-contract-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Production contract</p>
            <h2 id="system-contract-heading" className="mt-2 text-3xl font-black tracking-tight text-white">A smaller set of numbers you can trust.</h2>
          </div>
          <Link href="/docs" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">See all guardrails →</Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ContractCard icon={Trophy} value="7" label="independent league policies" />
          <ContractCard icon={Layers3} value="5" label="provider evidence profiles" />
          <ContractCard icon={Gauge} value="6" label="ordered verdict levels" />
          <ContractCard icon={ShieldCheck} value="5%" label="absolute stake cap" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Product principles">
        {PRINCIPLES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#0b1714] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Coverage</p>
          <h2 className="mt-2 text-3xl font-black text-white">Seven leagues. Five evidence profiles. One decision language.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Each league keeps its own calibration, draw prior, home advantage, freshness threshold, and Kelly cap. Provider status is shown rather than hidden.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ListCard title="Supported leagues" items={LEAGUES} />
          <ListCard title="Evidence profiles" items={PROVIDERS} />
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-emerald-200">The full verdict sequence</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{VERDICT_SEQUENCE.join(" → ")}</p>
          </div>
          <Link href="/intelligence" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-slate-100">
            Analyze a verified fixture
          </Link>
        </div>
      </section>
    </div>
  );
}

function ContractCard({ icon: Icon, value, label }: { icon: typeof Trophy; value: string; label: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <span className="text-3xl font-black tabular-nums text-white">{value}</span>
      </div>
      <p className="mt-4 text-sm text-slate-400">{label}</p>
    </article>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/15 p-5">
      <h3 className="font-bold text-white">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-slate-400">
        {items.map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-300">•</span>{item}</li>)}
      </ul>
    </article>
  );
}
